// ─── REPORT AGENT ───────────────────────────────────────────────────────────
// Agen laporan harian. Membaca database inventori → kirim ke Hermes →
// menghasilkan ringkasan analisis → simpan ke tabel reports.
// Dijadwalkan via node-cron setiap malam (00:00 WIB).

const { stmts, state, refreshInventory } = require('../models/dbStore');
const hermes = require('./hermesClient');
const { sendReport } = require('./telegramNotifier');

const REPORT_SYSTEM_PROMPT = `Kamu adalah analis inventori toko INSERT3COINS. Tugasmu membuat LAPORAN HARIAN yang ringkas dan actionable.

ATURAN WAJIB (PENTING):
1. Tulis dalam Bahasa Indonesia yang baku, profesional, dan logis bisnis.
2. DILARANG KERAS menggunakan terjemahan harfiah yang aneh (misal: jangan gunakan "stok kaya", "turun terseru", "terburuk"). Gunakan kata yang pantas seperti "stok berlebih", "turun drastis", atau "signifikan".
3. DILARANG KERAS memberikan rekomendasi penjualan/diskon untuk barang yang jumlah stoknya 0 (kosong).
4. JANGAN halusinasi. Jika stok tinggi = 0, artinya TIDAK ADA barang yang stoknya berlebih. Jangan dipaksakan.
5. Format: plain text, bukan markdown.
6. Gunakan emoji untuk header section (📦 📈 ⚠️ 💡).
7. Fokus pada data NYATA yang diberikan.
8. Berikan 2-3 rekomendasi konkret berdasarkan data (abaikan jika tidak ada data yang masuk akal).
9. Maksimal 20 baris, singkat dan padat.
10. Sebutkan item spesifik (nama + ID) saat memberi peringatan/rekomendasi.`;

/**
 * Generate laporan harian inventori
 * @returns {Promise<{success: boolean, report: string|null, error: string|null}>}
 */
async function generateDailyReport() {
    console.log('[REPORT AGENT] Memulai pembuatan laporan harian...');

    // Cek ketersediaan Hermes
    const available = await hermes.isAvailable();
    if (!available) {
        console.warn('[REPORT AGENT] Hermes tidak tersedia. Mencoba pull model...');
        const pulled = await hermes.pullModel();
        if (!pulled) {
            return { success: false, report: null, error: 'Hermes model tidak tersedia dan gagal di-download.' };
        }
    }

    // Kumpulkan data dari database
    refreshInventory();
    const allItems = stmts.getAllItems.all();
    const allTx = stmts.getAllTxPaginated.all(500, 0);   // Ambil 500 transaksi terakhir untuk analisis
    const topSellers = stmts.getTopSellers.all();
    const revenueStats = stmts.getRevenueTotal.get();
    const dailyTrends = stmts.getDailyTrends.all();
    const lowStock = allItems.filter(i => i.stock < 2);
    const outOfStock = allItems.filter(i => i.stock === 0);
    const totalValue = allItems.reduce((sum, i) => sum + i.price * i.stock, 0);

    // ─── Hitung window waktu ────────────────────────────────────────────────────
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const msPerDay = 24 * 60 * 60 * 1000;
    const date7ago  = new Date(now - 7  * msPerDay).toISOString().slice(0, 10);
    const date14ago = new Date(now - 14 * msPerDay).toISOString().slice(0, 10);

    // ─── Perbandingan Minggu Ini vs Minggu Lalu ─────────────────────────────────
    const salesOnly = allTx.filter(t => t.type === 'SALE');

    const thisWeekSales = salesOnly.filter(t => t.timestamp >= date7ago);
    const lastWeekSales = salesOnly.filter(t => t.timestamp >= date14ago && t.timestamp < date7ago);

    const thisWeekRevenue = thisWeekSales.reduce((s, t) => s + (t.total || 0), 0);
    const lastWeekRevenue = lastWeekSales.reduce((s, t) => s + (t.total || 0), 0);
    const thisWeekUnits   = thisWeekSales.reduce((s, t) => s + (t.quantity || 0), 0);
    const lastWeekUnits   = lastWeekSales.reduce((s, t) => s + (t.quantity || 0), 0);

    const revenueChangePct = lastWeekRevenue > 0
        ? ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue * 100).toFixed(1)
        : null;
    const revenueArrow = revenueChangePct === null ? '—' : (revenueChangePct >= 0 ? `↑ +${revenueChangePct}%` : `↓ ${revenueChangePct}%`);

    // ─── Transaksi Hari Ini ──────────────────────────────────────────────────────
    const todayTx    = allTx.filter(t => t.timestamp && t.timestamp.startsWith(today));
    const todaySales = todayTx.filter(t => t.type === 'SALE');
    const todayRevenue = todaySales.reduce((sum, t) => sum + (t.total || 0), 0);

    // ─── Estimasi Runway Stok (berapa hari sebelum habis) ───────────────────────
    // Hitung rata-rata penjualan harian per item dari 7 hari terakhir
    const unitsSoldThisWeek = {};
    thisWeekSales.forEach(t => {
        unitsSoldThisWeek[t.item_name] = (unitsSoldThisWeek[t.item_name] || 0) + (t.quantity || 0);
    });

    const criticalRunway = allItems
        .filter(i => i.stock > 0 && unitsSoldThisWeek[i.name])
        .map(i => {
            const avgPerDay = (unitsSoldThisWeek[i.name] || 0) / 7;
            const daysLeft  = avgPerDay > 0 ? Math.floor(i.stock / avgPerDay) : null;
            return { name: i.name, stock: i.stock, daysLeft };
        })
        .filter(i => i.daysLeft !== null && i.daysLeft <= 14)  // Hanya yang kritis (≤ 14 hari)
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 5);

    // ─── Tren Item: Naik / Turun ─────────────────────────────────────────────────
    const itemTrendThis = {}, itemTrendLast = {};
    thisWeekSales.forEach(t => { itemTrendThis[t.item_name] = (itemTrendThis[t.item_name] || 0) + (t.quantity || 0); });
    lastWeekSales.forEach(t => { itemTrendLast[t.item_name] = (itemTrendLast[t.item_name] || 0) + (t.quantity || 0); });

    const trendingUp = Object.entries(itemTrendThis)
        .map(([name, qty]) => ({ name, thisWeek: qty, lastWeek: itemTrendLast[name] || 0 }))
        .filter(i => i.thisWeek > i.lastWeek)
        .sort((a, b) => (b.thisWeek - b.lastWeek) - (a.thisWeek - a.lastWeek))
        .slice(0, 3);

    const trendingDown = Object.entries(itemTrendLast)
        .map(([name, qty]) => ({ name, lastWeek: qty, thisWeek: itemTrendThis[name] || 0 }))
        .filter(i => i.thisWeek < i.lastWeek)
        .sort((a, b) => (b.lastWeek - b.thisWeek) - (a.lastWeek - a.thisWeek))
        .slice(0, 3);

    // ─── Buat prompt untuk Hermes dengan data yang sudah dihitung ───────────────
    const dataPrompt = `DATA INVENTORI INSERT3COINS — ${today}:

📊 PERBANDINGAN MINGGU INI vs MINGGU LALU:
- Pendapatan  : Rp ${thisWeekRevenue.toLocaleString('id-ID')} vs Rp ${lastWeekRevenue.toLocaleString('id-ID')} (${revenueArrow})
- Unit Terjual: ${thisWeekUnits} unit vs ${lastWeekUnits} unit minggu lalu

📋 RINGKASAN HARI INI (${today}):
- Transaksi   : ${todayTx.length} (${todaySales.length} penjualan)
- Pendapatan  : Rp ${todayRevenue.toLocaleString('id-ID')}

🏬 INVENTORI:
- Total Item  : ${allItems.length} produk
- Nilai Stok  : Rp ${totalValue.toLocaleString('id-ID')}
- Stok Habis  : ${outOfStock.length} item
- Stok Rendah : ${lowStock.length} item (<2 unit)

⏳ ESTIMASI RUNWAY STOK (item yang akan habis ≤ 14 hari):
${criticalRunway.length > 0
    ? criticalRunway.map(i => `  - ${i.name}: sisa ${i.stock} unit → habis ~${i.daysLeft} hari lagi`).join('\n')
    : '  Tidak ada item yang terancam habis dalam 14 hari ke depan.'}

📈 ITEM TREN NAIK (minggu ini vs lalu):
${trendingUp.length > 0
    ? trendingUp.map(i => `  - ${i.name}: ${i.lastWeek} → ${i.thisWeek} unit (+${i.thisWeek - i.lastWeek})`).join('\n')
    : '  Tidak ada tren kenaikan signifikan.'}

📉 ITEM TREN TURUN (minggu ini vs lalu):
${trendingDown.length > 0
    ? trendingDown.map(i => `  - ${i.name}: ${i.lastWeek} → ${i.thisWeek} unit (-${i.lastWeek - i.thisWeek})`).join('\n')
    : '  Tidak ada tren penurunan signifikan.'}

⚠️ ITEM STOK KRITIS:
${lowStock.length > 0 ? lowStock.map(i => `  [${i.id}] ${i.name} — Stok: ${i.stock}`).join('\n') : '  Tidak ada.'}

🏆 ITEM TERLARIS (ALL TIME):
${topSellers.length > 0 ? topSellers.map((s, i) => `  ${i + 1}. ${s.item_name} — ${s.total_sold} terjual, Rp ${s.total_revenue.toLocaleString('id-ID')}`).join('\n') : '  Belum ada data.'}

📅 TREN HARIAN (7 HARI TERAKHIR):
${dailyTrends.length > 0 ? dailyTrends.map(d => `  ${d.day}: ${d.items} unit, Rp ${d.revenue.toLocaleString('id-ID')}`).join('\n') : '  Belum ada tren.'}

Berdasarkan data di atas, buat laporan harian yang ringkas dengan highlight perubahan mingguan, peringatan, dan 2-3 rekomendasi konkret.`;

    try {
        const report = await hermes.generate(dataPrompt, {
            system: REPORT_SYSTEM_PROMPT,
            temperature: 0.4,
            maxTokens: 800,
        });

        if (!report || report.trim().length < 20) {
            return { success: false, report: null, error: 'Hermes menghasilkan laporan kosong.' };
        }

        // Simpan ke database
        saveReport('DAILY', report);

        // Kirim ke Telegram (opsional — hanya jika dikonfigurasi)
        await sendReport(`📊 LAPORAN HARIAN INSERT3COINS\n${today}\n\n${report}`).catch(err => {
            console.warn('[REPORT AGENT] Telegram gagal:', err.message);
        });

        console.log(`[REPORT AGENT] Laporan harian berhasil dibuat (${report.length} chars).`);
        return { success: true, report, error: null };
    } catch (err) {
        console.error('[REPORT AGENT] Error:', err.message);
        return { success: false, report: null, error: err.message };
    }
}

/**
 * Simpan laporan ke tabel reports di database
 */
function saveReport(type, content) {
    try {
        stmts.insertReport.run(
            new Date().toISOString().slice(0, 10),
            type,
            content,
            hermes.MODEL_NAME,
            new Date().toISOString()
        );
    } catch (err) {
        console.error('[REPORT AGENT] Gagal simpan ke DB:', err.message);
    }
}

module.exports = { generateDailyReport };
