const express = require('express');
const router = express.Router();
const { stmts, state, refreshInventory, insertTransaction } = require('../models/dbStore');
const { validate, itemSchema } = require('../middleware/validation');

router.get('/', (req, res) => {
    const { q, page, limit } = req.query;
    
    // Search Mode
    if (q) {
        const query = `%${q}%`;
        const results = stmts.searchItems.all(query, query, query, query);
        return res.json(results);
    }
    
    // Pagination Mode
    if (page && limit) {
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 50;
        const offset = (pageNum - 1) * limitNum;
        
        const totalResult = stmts.countItems.get();
        const totalItems = totalResult?.cnt || 0;
        const totalPages = Math.ceil(totalItems / limitNum);
        
        const results = stmts.getPaginatedItems.all(limitNum, offset);
        
        return res.json({
            data: results,
            total: totalItems,
            page: pageNum,
            totalPages: totalPages
        });
    }

    // Default Fallback (Legacy)
    res.json(state.inventory);
});

router.post('/', validate(itemSchema), (req, res) => {
    const { name, category, price, stock, rarity, bab, sub_bab } = req.body;
    if (!name) return res.status(400).json({ error: 'FIELD_REQUIRED: name' });

    const stockVal = Number(stock) || 0;
    const newItemId = `item_${Date.now()}`;
    const babVal = (bab || category || 'Uncategorized').trim();
    const subBabVal = (sub_bab || 'Uncategorized').trim();

    const item = {
        id: newItemId, name: name.trim(), category: babVal, price: Number(price) || 0,
        stock: stockVal, rarity: rarity || 'BIASA', status: stockVal < 5 ? 'LOW_STOCK' : 'IN_STOCK',
        bab: babVal, sub_bab: subBabVal
    };

    stmts.insertItem.run(item.id, item.name, item.category, item.price, item.stock, item.rarity, item.status, item.bab, item.sub_bab);
    refreshInventory();

    insertTransaction({
        transaction_id: `TX-${Date.now()}`, item_name: item.name, category: item.bab,
        unit_price: item.price, quantity: item.stock, total: 0,
        timestamp: new Date().toISOString(), type: 'CREATE', source: 'WEB_UI'
    });

    res.status(201).json(item);
});

router.put('/:id', validate(itemSchema), (req, res) => {
    const id = req.params.id;
    const existing = stmts.getItemById.get(id);
    if (!existing) return res.status(404).json({ error: 'ITEM_NOT_FOUND' });

    const { name, category, price, stock, rarity, bab, sub_bab } = req.body;
    const updated = {
        name: (name !== undefined ? name.trim() : existing.name),
        category: (category !== undefined ? category.trim() : existing.category),
        price: (price !== undefined ? Number(price) : existing.price),
        stock: (stock !== undefined ? Number(stock) : existing.stock),
        rarity: (rarity !== undefined ? rarity : existing.rarity),
        bab: (bab !== undefined ? bab.trim() : (category !== undefined ? category.trim() : existing.bab)),
        sub_bab: (sub_bab !== undefined ? sub_bab.trim() : existing.sub_bab),
    };
    updated.category = updated.bab;
    updated.status = updated.stock < 5 ? 'LOW_STOCK' : 'IN_STOCK';

    stmts.updateItem.run(updated.name, updated.category, updated.price, updated.stock, updated.rarity, updated.status, updated.bab, updated.sub_bab, id);
    refreshInventory();

    const result = { id, ...updated };
    insertTransaction({
        transaction_id: `TX-${Date.now()}`, item_name: result.name, category: result.bab,
        unit_price: result.price, quantity: result.stock, total: 0,
        timestamp: new Date().toISOString(), type: 'UPDATE', source: 'WEB_UI'
    });

    res.json(result);
});

router.delete('/:id', (req, res) => {
    const id = req.params.id;
    const existing = stmts.getItemById.get(id);
    if (!existing) return res.status(404).json({ error: 'ITEM_NOT_FOUND' });

    insertTransaction({
        transaction_id: `TX-${Date.now()}`, item_name: existing.name, category: existing.category,
        unit_price: existing.price, quantity: existing.stock, total: 0,
        timestamp: new Date().toISOString(), type: 'DELETE', source: 'WEB_UI'
    });

    stmts.deleteItem.run(id);
    refreshInventory();
    res.json({ message: 'ITEM_DECONSTRUCTED', id: existing.id, name: existing.name });
});

module.exports = router;
