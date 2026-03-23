const express = require('express');
const router = express.Router();
const { stmts, state } = require('../models/dbStore');

router.get('/', (_req, res) => {
    const notifications = [];
    const now = new Date();

    // Critical: items with stock = 0
    state.inventory.filter(i => i.stock === 0).forEach(item => {
        const id = `critical_${item.id}`;
        notifications.push({
            id, type: 'critical', title: 'OUT_OF_STOCK',
            message: `${item.name} has 0 units remaining. Immediate restock required.`,
            item_name: item.name, timestamp: now.toISOString(),
            read: state.readNotificationIds.has(id),
        });
    });

    // Warning: items with stock 1-4
    state.inventory.filter(i => i.stock > 0 && i.stock < 5).forEach(item => {
        const id = `warning_${item.id}`;
        notifications.push({
            id, type: 'warning', title: 'LOW_STOCK',
            message: `${item.name} has only ${item.stock} unit(s) left.`,
            item_name: item.name, timestamp: now.toISOString(),
            read: state.readNotificationIds.has(id),
        });
    });

    // Info: recent bulk sales (qty >= 3)
    const recentTx = stmts.getAllTx.all();
    recentTx.filter(t => t.type === 'SALE' && t.quantity >= 3).slice(0, 3).forEach(tx => {
        const id = `sale_${tx.transaction_id}`;
        notifications.push({
            id, type: 'info', title: 'BULK_SALE',
            message: `${tx.quantity}x ${tx.item_name} sold — Revenue: Rp${(tx.total || 0).toLocaleString('id-ID')}`,
            item_name: tx.item_name, timestamp: tx.timestamp,
            read: state.readNotificationIds.has(id),
        });
    });

    res.json(notifications);
});

router.post('/read', (req, res) => {
    const { id } = req.body;
    if (id) state.readNotificationIds.add(id);
    res.json({ success: true });
});

module.exports = router;
