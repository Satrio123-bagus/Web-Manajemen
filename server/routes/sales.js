const express = require('express');
const router = express.Router();
const { stmts, refreshInventory, insertTransaction, state } = require('../services/dbStore');
const { validate, sellSchema } = require('../middleware/validation');

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
    const newStatus = newStock < 5 ? 'LOW_STOCK' : 'IN_STOCK';
    stmts.updateItem.run(item.name, item.category, item.price, newStock, item.rarity, newStatus, item.bab || 'Uncategorized', item.sub_bab || 'Uncategorized', id);

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
});

router.get('/transactions', (_req, res) => {
    const recent = stmts.getRecentTx.all();
    res.json(recent);
});

module.exports = router;
