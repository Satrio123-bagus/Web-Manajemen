const express = require('express');
const router = express.Router();
const { stmts, state } = require('../models/dbStore');

router.get('/', (_req, res) => {
    // ─── OPTIMIZED: Single-pass inventory aggregation ────────
    let totalStockValue = 0;
    let totalStock = 0;
    let lowStockCount = 0;
    const lowStockItems = [];
    const categoryMap = {};
    const rarityMap = {};

    for (const i of state.inventory) {
        totalStockValue += i.price * i.stock;
        totalStock += i.stock;

        if (i.stock < 2) {
            lowStockCount++;
            lowStockItems.push({
                id: i.id, name: i.name, category: i.category,
                price: i.price, stock: i.stock, rarity: i.rarity,
            });
        }

        const babKey = i.bab || i.category || 'Uncategorized';
        categoryMap[babKey] = (categoryMap[babKey] || 0) + 1;

        const rarKey = i.rarity || 'BIASA';
        rarityMap[rarKey] = (rarityMap[rarKey] || 0) + 1;
    }

    const totalItems = state.inventory.length;
    const categoryDistribution = Object.entries(categoryMap).map(([name, count]) => ({
        name, count, value: Math.round((count / totalItems) * 100),
    }));
    const rarityDistribution = Object.entries(rarityMap).map(([name, count]) => ({ name, count }));

    // Real stock/sales trends (latest 7 days)
    const dailySales = stmts.getDailyTrends.all().reverse();
    const stockTrends = dailySales.map(d => ({
        week: d.day.slice(5),
        assets: d.revenue || 0,
        items: d.items || 0,
    }));

    if (stockTrends.length === 0) {
        stockTrends.push({ week: 'No Data', assets: 0, items: 0 });
    }

    res.json({
        totalItems, totalStockValue, totalStock, lowStockCount,
        lowStockItems, // NEW: low stock items included for DashboardHome
        categoryDistribution, rarityDistribution, stockTrends,
    });
});

module.exports = router;
