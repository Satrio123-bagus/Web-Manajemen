// ─── REPORT AGENT ───────────────────────────────────────────────────────────
// Agen laporan harian. Membaca database inventori → kirim ke Hermes →
// menghasilkan ringkasan analisis → simpan ke tabel reports.
// Dijadwalkan via node-cron setiap malam (00:00 WIB).

const { stmts, state, refreshInventory } = require('../models/dbStore');
const hermes = require('./hermesClient');
const { sendReport } = require('./telegramNotifier');

const REPORT_SYSTEM_PROMPT = `Kamu adalah analis inventori toko INSERT3COINS. Tugasmu membuat LAPORAN HARIAN yang ringkas dan actionable.

Aturan:
- Tulis dalam Bahasa Indonesia
- Format: plain text, bukan markdown
- Gunakan emoji untuk header section (📦 📈 ⚠️ 💡)
- Fokus pada data NYATA yang diberikan, JANGAN mengarang angka
- Berikan 2-3 rekomendasi konkret berdasarkan data
- Maksimal 20 baris, singkat dan padat
- Sebutkan item spesifik (nama + ID) saat memberi peringatan/rekomendasi`;

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
    const recentTx = stmts.getAllTx.all();
    const topSellers = stmts.getTopSellers.all();
    const revenueStats = stmts.getRevenueTotal.get();
    const dailyTrends = stmts.getDailyTrends.all();
    const lowStock = allItems.filter(i => i.stock < 5);
    const outOfStock = allItems.filter(i => i.stock === 0);
    const totalValue = allItems.reduce((sum, i) => sum + i.price * i.stock, 0);

    // Hitung transaksi hari ini
    const today = new Date().toISOString().slice(0, 10);
    const todayTx = recentTx.filter(t => t.timestamp && t.timestamp.startsWith(today));
    const todaySales = todayTx.filter(t => t.type === 'SALE');
    const todayRevenue = todaySales.reduce((sum, t) => sum + (t.total || 0), 0);

    // Buat prompt untuk Hermes
    const dataPrompt = `DATA INVENTORI INSERT3COINS — ${today}:

RINGKASAN:
- Total Item: ${allItems.length} produk
- Total Nilai Stok: Rp ${totalValue.toLocaleString('id-ID')}
- Stok Habis: ${outOfStock.length} item
- Stok Rendah (<5): ${lowStock.length} item

TRANSAKSI HARI INI:
- Total Transaksi: ${todayTx.length}
- Penjualan: ${todaySales.length} transaksi
- Pendapatan Hari Ini: Rp ${todayRevenue.toLocaleString('id-ID')}

TOTAL HISTORIS:
- Total Pendapatan: Rp ${revenueStats.revenue.toLocaleString('id-ID')} dari ${revenueStats.sale_count} penjualan

ITEM STOK RENDAH (KRITIS):
${lowStock.length > 0 ? lowStock.map(i => `  [${i.id}] ${i.name} — Stok: ${i.stock} | Bab: ${i.bab || i.category}`).join('\n') : '  Tidak ada item stok rendah.'}

ITEM TERLARIS (ALL TIME):
${topSellers.length > 0 ? topSellers.map((s, i) => `  ${i + 1}. ${s.item_name} — ${s.total_sold} terjual, Rp ${s.total_revenue.toLocaleString('id-ID')}`).join('\n') : '  Belum ada data penjualan.'}

TREN HARIAN (7 HARI TERAKHIR):
${dailyTrends.length > 0 ? dailyTrends.map(d => `  ${d.day}: ${d.items} item terjual, Rp ${d.revenue.toLocaleString('id-ID')}`).join('\n') : '  Belum ada tren.'}

Berdasarkan data di atas, buat laporan harian yang ringkas dengan peringatan dan rekomendasi.`;

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
