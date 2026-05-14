const express = require('express');
const router = express.Router();
const { stmts } = require('../models/dbStore');
// ─── FIX: Import hermesClient di top-level, bukan di dalam handler ──────────
const hermesClient = require('../agents/hermesClient');

// ─── AI Insight Cache (TTL 10 menit) ────────────────────────────────────────
const insightCache = new Map(); // key: period, value: { text, timestamp }
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 menit

function getCachedInsight(period) {
    const cached = insightCache.get(period);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
        return cached.text;
    }
    return null;
}

function setCachedInsight(period, text) {
    insightCache.set(period, { text, timestamp: Date.now() });
}

router.get('/', async (req, res) => {
    try {
        const period = req.query.period || 'monthly'; // daily, weekly, monthly, yearly

        // ─── OPTIMIZED: Single SQL query menggantikan loop JS ────────────────
        const invStats = stmts.getInventoryStats.get();
        const totalItems = invStats?.totalItems || 0;
        const totalStockValue = invStats?.totalStockValue || 0;
        const totalStock = invStats?.totalStock || 0;
        const lowStockCount = invStats?.lowStockCount || 0;
        const lowStockItems = stmts.getLowStockItems.all();

        // Fetch Category Distribution based on Sales
        const rawCategoryDist = stmts.getSalesCategoryDistribution.all(period);
        const categoryDistribution = rawCategoryDist.map(d => ({
            name: d.name,
            count: d.count,
            value: d.count // Used by Recharts Pie
        }));

        // ─── Sales specific analytics ────────────────────────────────────────
        const salesStats = stmts.getSalesStats.get(period) || { total_revenue: 0, total_items: 0, tx_count: 0 };
        
        // Calculate AOV (Average Order Value)
        const avgOrderValue = salesStats.tx_count > 0 ? Math.round(salesStats.total_revenue / salesStats.tx_count) : 0;
        salesStats.avg_order_value = avgOrderValue;

        // Fetch Trends
        const rawTrends = stmts.getSalesTrends.all(period).reverse(); // Oldest to newest
        // Format trends for Recharts
        const stockTrends = rawTrends.length > 0 ? rawTrends.map(d => ({
            week: d.time_label,
            assets: d.revenue || 0,
            items: d.items || 0,
        })) : [{ week: 'No Data', assets: 0, items: 0 }];

        // Fetch Top Sellers & Dead Stock
        const topSellers = stmts.getTopSellersPeriod.all(period);
        const deadStock = stmts.getDeadStock.all();

        res.json({
            totalItems, totalStockValue, totalStock, lowStockCount,
            lowStockItems, categoryDistribution, 
            stockTrends,
            salesStats, topSellers, deadStock,
            currentPeriod: period
        });
    } catch (err) {
        console.error('[ANALYTICS] Error:', err);
        res.status(500).json({ error: 'ANALYTICS_ERROR', message: err.message });
    }
});

// ─── Separate Endpoint for AI Insights (with caching) ───────────────────────
// Frontend mengirim ringkasan data via query params agar endpoint ini
// tidak perlu query database lagi (menghilangkan duplikasi query).
router.get('/insight', async (req, res) => {
    const period = req.query.period || 'monthly';

    // Cek cache dulu — jika masih valid, langsung return
    const cached = getCachedInsight(period);
    if (cached) {
        return res.json({ aiInsights: cached, cached: true });
    }

    // Ambil data dari query params (dikirim oleh frontend dari response /analytics)
    const totalRevenue = parseInt(req.query.total_revenue) || 0;
    const totalItems = parseInt(req.query.total_items) || 0;
    const txCount = parseInt(req.query.tx_count) || 0;
    const topItem = req.query.top_item || '-';

    let aiInsights = null;
    try {
        // ─── FIX: Gunakan hermesClient.isAvailable() dan .generate() ────
        const available = await hermesClient.isAvailable();
        if (available && txCount > 0) {
            const prompt = `Buat 2 kalimat singkat gaya cyberpunk tentang penjualan ${period} toko. 
Revenue: Rp${totalRevenue.toLocaleString('id-ID')}, Items: ${totalItems}. 
Top item: ${topItem}.
Beri satu pujian atau peringatan stok mati.`;
            aiInsights = await hermesClient.generate(prompt);
            // Simpan ke cache setelah berhasil generate
            setCachedInsight(period, aiInsights);
        } else {
            aiInsights = "Sistem AI Hermes sedang memantau. Menunggu volume data yang memadai untuk menghasilkan Insight Penjualan.";
        }
    } catch (err) {
        console.error("AI Insight Error:", err);
        aiInsights = "Gagal terhubung ke neural network Hermes.";
    }

    res.json({ aiInsights });
});

module.exports = router;
