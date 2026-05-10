const express = require('express');
const router = express.Router();
const { stmts, state } = require('../models/dbStore');

router.get('/', async (req, res) => {
    const period = req.query.period || 'monthly'; // daily, weekly, monthly, yearly

    // ─── OPTIMIZED: Single-pass inventory aggregation (Kept for compatibility) ────────
    let totalStockValue = 0;
    let totalStock = 0;
    let lowStockCount = 0;
    const lowStockItems = [];
    const categoryMap = {};

    for (const i of state.inventory) {
        totalStockValue += i.price * i.stock;
        totalStock += i.stock;

        if (i.stock < 2) {
            lowStockCount++;
            lowStockItems.push({
                id: i.id, name: i.name, category: i.category,
                price: i.price, stock: i.stock, rarity: i.rarity,
                bab: i.bab
            });
        }

        const babKey = i.bab || i.category || 'Uncategorized';
        categoryMap[babKey] = (categoryMap[babKey] || 0) + 1;
    }

    const totalItems = state.inventory.length;
    const categoryDistribution = Object.entries(categoryMap).map(([name, count]) => ({
        name, count, value: Math.round((count / totalItems) * 100),
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

    // ─── AI Insights (Hermes Anomaly) ────────────────────────
    let aiInsights = null;
    try {
        const { hermes } = require('../agents/hermesClient');
        const available = await hermes.isAvailable();
        if (available && salesStats.tx_count > 0) {
            // Very simple insight prompt
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

    res.json({
        totalItems, totalStockValue, totalStock, lowStockCount,
        lowStockItems, categoryDistribution, 
        stockTrends, // overrides the old one with dynamic
        salesStats, topSellers, deadStock, aiInsights,
        currentPeriod: period
    });
});

module.exports = router;
