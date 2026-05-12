const express = require('express');
const router = express.Router();
const { stmts } = require('../models/dbStore');

router.get('/', async (req, res) => {
    const period = req.query.period || 'monthly'; // daily, weekly, monthly, yearly

    // ─── OPTIMIZED: Single SQL query menggantikan loop JS ────────────────
    const invStats = stmts.getInventoryStats.get();
    const totalItems = invStats.totalItems;
    const totalStockValue = invStats.totalStockValue;
    const totalStock = invStats.totalStock;
    const lowStockCount = invStats.lowStockCount;
    const lowStockItems = stmts.getLowStockItems.all();

    // Fetch Category Distribution based on Sales
    const rawCategoryDist = stmts.getSalesCategoryDistribution.all(period);
    const categoryDistribution = rawCategoryDist.map(d => ({
        name: d.name,
        count: d.count,
        value: d.count // Used by Recharts Pie
    }));

    // ─── NEW: Sales specific analytics ────────────────────────
    const salesStats = stmts.getSalesStats.get(period);
    
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
        stockTrends, // overrides the old one with dynamic
        salesStats, topSellers, deadStock,
        currentPeriod: period
    });
});

// ─── NEW: Separate Endpoint for Slow AI Insights ────────────────────────
router.get('/insight', async (req, res) => {
    const period = req.query.period || 'monthly';
    const salesStats = stmts.getSalesStats.get(period);
    const topSellers = stmts.getTopSellersPeriod.all(period);

    let aiInsights = null;
    try {
        const { hermes } = require('../agents/hermesClient');
        const available = await hermes.isAvailable();
        if (available && salesStats.tx_count > 0) {
            const prompt = `Buat 2 kalimat singkat gaya cyberpunk tentang penjualan ${period} toko. 
Revenue: Rp${salesStats.total_revenue.toLocaleString('id-ID')}, Items: ${salesStats.total_items}. 
Top item: ${topSellers.length > 0 ? topSellers[0].item_name : '-'}.
Beri satu pujian atau peringatan stok mati.`;
            aiInsights = await hermes.ask(prompt);
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
