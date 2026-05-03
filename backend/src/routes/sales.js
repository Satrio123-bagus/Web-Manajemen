const express = require('express');
const router = express.Router();
const { stmts, refreshInventory, insertTransaction, state } = require('../models/dbStore');
const { validate, sellSchema } = require('../middleware/validation');
const { sendLowStockPush } = require('../agents/pushNotifier'); // Push saat stok kritis

router.post('/sell', validate(sellSchema), (req, res) => {
    const { id, quantity: qty } = req.body;

    const item = stmts.getItemById.get(id);
    if (!item) return res.status(404).json({ error: 'ITEM_NOT_FOUND' });

    if (item.stock < qty) {
        return res.status(400).json({
            error: 'INSUFFICIENT_STOCK',
            available: item.stock,
            requested: qty,
            item_name: item.name,
        });
    }

    const newStock = item.stock - qty;
    const newStatus = newStock < 2 ? 'LOW_STOCK' : 'IN_STOCK';
    stmts.updateItem.run(item.name, item.category, item.price, newStock, item.rarity, newStatus, item.bab || 'Uncategorized', item.sub_bab || 'Uncategorized', id, item.location || 'Belum Ditentukan');

    const tx = {
        transaction_id: `TX-${Date.now()}`,
        item_name: item.name,
        category: item.category,
        unit_price: item.price,
        quantity: qty,
        total: item.price * qty,
        timestamp: new Date().toISOString(),
        type: 'SALE',
        source: 'QUICK_SELL',
    };
    insertTransaction(tx);
    refreshInventory();

    res.json({
        message: 'SALE_RECORDED',
        transaction: tx,
        remaining_stock: newStock,
    });

    // Kirim push alert jika stok item ini baru saja turun di bawah 5 (non-blocking)
    if (newStock < 2) {
        const freshItem = stmts.getItemById.get(id);
        if (freshItem) sendLowStockPush([freshItem]).catch(() => {});
    }
});

// GET /transactions — Full paginated transaction history untuk halaman History
router.get('/transactions', (req, res) => {
    const { page = 1, limit = 100, type } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(500, parseInt(limit) || 100);
    const offset = (pageNum - 1) * limitNum;

    try {
        let data = stmts.getAllTxPaginated.all(limitNum, offset);
        const total = stmts.countTx.get();

        // Filter berdasarkan tipe jika ada
        if (type && type !== 'ALL') {
            data = data.filter(tx => tx.type === type);
        }

        res.json({ data, total, page: pageNum, limit: limitNum });
    } catch (err) {
        // Fallback ke method lama
        res.json(stmts.getRecentTx.all());
    }
});

module.exports = router;
