const express = require('express');
const router = express.Router();
const { stmts, state } = require('../services/dbStore');

router.get('/', (_req, res) => {
    const totalItems = state.inventory.length;
    const totalStockValue = state.inventory.reduce((s, i) => s + i.price * i.stock, 0);
    const totalStock = state.inventory.reduce((s, i) => s + i.stock, 0);
    const lowStockCount = state.inventory.filter(i => i.stock < 5).length;

    // Category distribution (grouped by bab)
    const categoryMap = {};
    state.inventory.forEach(i => {
        const babKey = i.bab || i.category || 'Uncategorized';
        categoryMap[babKey] = (categoryMap[babKey] || 0) + 1;
    });
    const categoryDistribution = Object.entries(categoryMap).map(([name, count]) => ({
        name, count, value: Math.round((count / totalItems) * 100),
    }));

    // Rarity distribution
    const rarityMap = {};
    state.inventory.forEach(i => {
        rarityMap[i.rarity || 'COMMON'] = (rarityMap[i.rarity || 'COMMON'] || 0) + 1;
    });
    const rarityDistribution = Object.entries(rarityMap).map(([name, count]) => ({ name, count }));

    // Real stock/sales trends (simulated daily data based on latest 7 days of sales)
    const dailySales = stmts.getDailyTrends.all().reverse(); // reverse to get chronological order

    // Map to the format expected by the frontend
    const stockTrends = dailySales.map(d => ({
        week: d.day.slice(5), // Make it visually MM-DD
        assets: d.revenue || 0,
        items: d.items || 0,
    }));

    if (stockTrends.length === 0) {
        stockTrends.push({ week: 'No Data', assets: 0, items: 0 });
    }

    res.json({
        totalItems, totalStockValue, totalStock, lowStockCount,
        categoryDistribution, rarityDistribution, stockTrends,
    });
});

module.exports = router;
