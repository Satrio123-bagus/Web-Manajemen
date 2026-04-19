// ─── ANOMALY AGENT ───────────────────────────────────────────────────────────
// Agent deteksi anomali transaksi mingguan.
//
// Cara kerja:
// 1. Kode JS menganalisis 14 hari transaksi dan menghitung metrik objektif
// 2. Temuan anomali (dihitung secara matematis, bukan oleh AI) dikirim ke Hermes
// 3. Hermes hanya bertugas menulis interpretasi naratif yang mudah dibaca
// 4. Hasil dikirim ke Telegram + push notification jika ada anomali signifikan
//
// Anomali yang dideteksi:
// - Hari tanpa transaksi apapun (dead day)
// - Item yang tiba-tiba berhenti terjual (drop ke 0 dari aktif)
// - Transaksi dengan quantity sangat tinggi (outlier statistik)
// - Penurunan pendapatan harian > 70% dari rata-rata

const { stmts, state } = require('../models/dbStore');
const hermes = require('./hermesClient');
const { sendReport } = require('./telegramNotifier');
const { sendPushToAll } = require('./pushNotifier');

const ANOMALY_SYSTEM_PROMPT = `Kamu adalah analis bisnis untuk toko INSERT3COINS. 
Kamu diberikan temuan anomali dari sistem otomatis yang sudah menganalisis data transaksi.

Tugasmu: Tulis interpretasi singkat yang mudah dipahami pemilik toko.
- Jelaskan apa yang terjadi dalam bahasa bisnis sederhana
- Berikan 1-2 kemungkinan penyebab per anomali
- Berikan saran tindakan konkret
- Format: plain text, pakai emoji untuk header, maksimal 15 baris
- Jika tidak ada anomali signifikan, katakan sistem berjalan normal`;

/**
 * Jalankan deteksi anomali transaksi 14 hari terakhir
 * @returns {Promise<{success: boolean, anomalyCount: number, report: string|null}>}
 */
async function detectAnomalies() {
    console.log('[ANOMALY] Memulai deteksi anomali transaksi...');

    // ─── Ambil data ───────────────────────────────────────────────────────────
    const allTx = stmts.getAllTxPaginated.all(500, 0);
    const allItems = stmts.getAllItems.all();

    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const date14ago = new Date(now - 14 * msPerDay).toISOString().slice(0, 10);
    const date7ago  = new Date(now - 7  * msPerDay).toISOString().slice(0, 10);
    const today     = now.toISOString().slice(0, 10);

    // Filter ke 14 hari terakhir
    const recentTx   = allTx.filter(t => t.timestamp >= date14ago);
    const salesTx    = recentTx.filter(t => t.type === 'SALE');

    if (salesTx.length === 0) {
        console.log('[ANOMALY] Tidak ada data penjualan dalam 14 hari. Skip.');
        return { success: true, anomalyCount: 0, report: null };
    }

    // ─── Analisis per hari ────────────────────────────────────────────────────
    const dayStats = {};
    for (let d = 0; d < 14; d++) {
        const dateKey = new Date(now - d * msPerDay).toISOString().slice(0, 10);
        dayStats[dateKey] = { revenue: 0, units: 0, txCount: 0 };
    }

    salesTx.forEach(t => {
        const day = t.timestamp?.slice(0, 10);
        if (day && dayStats[day]) {
            dayStats[day].revenue  += t.total    || 0;
            dayStats[day].units    += t.quantity  || 0;
            dayStats[day].txCount  += 1;
        }
    });

    const dayValues = Object.values(dayStats);
    const activeDays = dayValues.filter(d => d.txCount > 0);
    const avgRevenue = activeDays.length > 0
        ? activeDays.reduce((s, d) => s + d.revenue, 0) / activeDays.length
        : 0;
    const avgUnits = activeDays.length > 0
        ? activeDays.reduce((s, d) => s + d.units, 0) / activeDays.length
        : 0;

    // ─── Deteksi Anomali ──────────────────────────────────────────────────────
    const anomalies = [];

    // 1. Hari tanpa transaksi (dead days) — kecuali hari ini yang belum selesai
    const deadDays = Object.entries(dayStats)
        .filter(([day, stat]) => day < today && stat.txCount === 0)
        .map(([day]) => day);
    if (deadDays.length >= 2) {
        anomalies.push({
            type: 'DEAD_DAYS',
            severity: deadDays.length >= 4 ? 'HIGH' : 'MEDIUM',
            detail: `${deadDays.length} hari tanpa transaksi: ${deadDays.slice(0, 3).join(', ')}${deadDays.length > 3 ? ` +${deadDays.length - 3} lainnya` : ''}`,
        });
    }

    // 2. Hari dengan revenue sangat rendah (< 20% dari rata-rata)
    const lowRevenueDays = Object.entries(dayStats)
        .filter(([day, stat]) => day < today && stat.txCount > 0 && avgRevenue > 0 && stat.revenue < avgRevenue * 0.2)
        .map(([day, stat]) => `${day} (Rp ${stat.revenue.toLocaleString('id-ID')})`);
    if (lowRevenueDays.length >= 2) {
        anomalies.push({
            type: 'LOW_REVENUE_DAYS',
            severity: 'MEDIUM',
            detail: `Pendapatan sangat rendah di ${lowRevenueDays.length} hari: ${lowRevenueDays.slice(0, 2).join(', ')}`,
        });
    }

    // 3. Transaksi quantity sangat tinggi (outlier > 3x rata-rata per transaksi)
    const avgQtyPerTx = salesTx.length > 0
        ? salesTx.reduce((s, t) => s + (t.quantity || 0), 0) / salesTx.length
        : 1;
    const bulkOutliers = salesTx
        .filter(t => (t.quantity || 0) > avgQtyPerTx * 3 && (t.quantity || 0) >= 10)
        .map(t => `${t.item_name} x${t.quantity} (${t.timestamp?.slice(0, 10)})`);
    if (bulkOutliers.length > 0) {
        anomalies.push({
            type: 'BULK_OUTLIER',
            severity: 'LOW',
            detail: `Transaksi jumlah sangat besar (kemungkinan wholesale): ${bulkOutliers.slice(0, 2).join(', ')}`,
        });
    }

    // 4. Item yang aktif minggu lalu tapi berhenti terjual minggu ini
    const soldLastWeek = new Set(
        salesTx.filter(t => t.timestamp >= date14ago && t.timestamp < date7ago).map(t => t.item_name)
    );
    const soldThisWeek = new Set(
        salesTx.filter(t => t.timestamp >= date7ago).map(t => t.item_name)
    );
    const stoppedSelling = [...soldLastWeek].filter(name => !soldThisWeek.has(name));
    if (stoppedSelling.length >= 3) {
        anomalies.push({
            type: 'ITEMS_STOPPED',
            severity: 'MEDIUM',
            detail: `${stoppedSelling.length} item berhenti terjual minggu ini: ${stoppedSelling.slice(0, 3).join(', ')}${stoppedSelling.length > 3 ? ` +${stoppedSelling.length - 3}` : ''}`,
        });
    }

    // 5. Penurunan revenue mingguan signifikan (> 50%)
    const thisWeekRev = salesTx.filter(t => t.timestamp >= date7ago).reduce((s, t) => s + (t.total || 0), 0);
    const lastWeekRev = salesTx.filter(t => t.timestamp >= date14ago && t.timestamp < date7ago).reduce((s, t) => s + (t.total || 0), 0);
    if (lastWeekRev > 0 && thisWeekRev < lastWeekRev * 0.5) {
        const dropPct = (((lastWeekRev - thisWeekRev) / lastWeekRev) * 100).toFixed(0);
        anomalies.push({
            type: 'REVENUE_DROP',
            severity: 'HIGH',
            detail: `Pendapatan minggu ini turun ${dropPct}% dari minggu lalu (Rp ${thisWeekRev.toLocaleString('id-ID')} vs Rp ${lastWeekRev.toLocaleString('id-ID')})`,
        });
    }

    console.log(`[ANOMALY] Ditemukan ${anomalies.length} anomali.`);

    // Jika tidak ada anomali signifikan (HIGH/MEDIUM), tidak perlu kirim notifikasi
    const significantAnomalies = anomalies.filter(a => a.severity !== 'LOW');
    if (significantAnomalies.length === 0) {
        console.log('[ANOMALY] Tidak ada anomali signifikan. Sistem berjalan normal.');
        return { success: true, anomalyCount: 0, report: null };
    }

    // ─── Minta Hermes membuat narasi dari temuan ──────────────────────────────
    const available = await hermes.isAvailable();
    if (!available) {
        console.warn('[ANOMALY] Hermes tidak tersedia, kirim temuan mentah ke Telegram.');
        const rawReport = `⚠️ ANOMALI TERDETEKSI (${anomalies.length} temuan):\n\n` +
            anomalies.map(a => `[${a.severity}] ${a.type}: ${a.detail}`).join('\n');
        await sendReport(rawReport).catch(() => {});
        return { success: true, anomalyCount: anomalies.length, report: rawReport };
    }

    const anomalyPrompt = `Data statistik untuk periode 14 hari terakhir:
- Total transaksi dianalisis: ${salesTx.length}
- Rata-rata pendapatan harian: Rp ${Math.round(avgRevenue).toLocaleString('id-ID')}
- Rata-rata unit terjual/hari: ${avgUnits.toFixed(1)}

Temuan anomali dari sistem:
${anomalies.map((a, i) => `${i + 1}. [${a.severity}] ${a.type}: ${a.detail}`).join('\n')}

Tulis interpretasi dan saran tindakan untuk pemilik toko.`;

    let report;
    try {
        report = await hermes.generate(anomalyPrompt, {
            system: ANOMALY_SYSTEM_PROMPT,
            temperature: 0.3,
            maxTokens: 600,
        });
    } catch (err) {
        console.error('[ANOMALY] Hermes gagal generate narasi:', err.message);
        report = anomalies.map(a => `[${a.severity}] ${a.detail}`).join('\n');
    }

    // ─── Kirim ke Telegram ────────────────────────────────────────────────────
    const weekStr = `${date7ago} — ${today}`;
    const telegramMsg = `🔍 ANALISIS ANOMALI MINGGUAN\n${weekStr}\n\n${report}`;
    await sendReport(telegramMsg).catch(err => {
        console.warn('[ANOMALY] Telegram gagal:', err.message);
    });

    // ─── Kirim push notification jika ada anomali HIGH ────────────────────────
    const hasHighSeverity = anomalies.some(a => a.severity === 'HIGH');
    if (hasHighSeverity) {
        await sendPushToAll({
            title: '🔍 Anomali Terdeteksi di Inventori',
            body: `${anomalies.filter(a => a.severity === 'HIGH').length} anomali penting ditemukan. Lihat laporan.`,
            url: '/',
            tag: 'anomaly',
        }).catch(() => {});
    }

    console.log(`[ANOMALY] Laporan anomali berhasil dikirim (${anomalies.length} temuan, ${significantAnomalies.length} signifikan).`);
    return { success: true, anomalyCount: anomalies.length, report };
}

module.exports = { detectAnomalies };
