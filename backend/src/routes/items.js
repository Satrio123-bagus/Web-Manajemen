const express = require('express');
const router = express.Router();
const { stmts, state, refreshInventory, insertTransaction, betterSqlite } = require('../models/dbStore');
const { validate, itemSchema, assembleSchema } = require('../middleware/validation');
const { autoClassifyIfNeeded } = require('../agents/classifyAgent'); // Hermes auto-classifier
const { logAudit } = require('../middleware/auditLogger');

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
        stock: stockVal, rarity: rarity || 'BIASA', status: stockVal < 2 ? 'LOW_STOCK' : 'IN_STOCK',
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

    // Jalankan auto-klasifikasi Hermes di background (non-blocking)
    // Hermes akan mengisi bab/sub_bab/rarity jika item belum punya kategori
    autoClassifyIfNeeded(newItemId).catch(() => {});
});

// ─── ASSEMBLE ITEMS ──────────────────────────────────────
router.post('/assemble', validate(assembleSchema), (req, res) => {
    const { targetItemId, quantity, materials } = req.body;
    
    const target = stmts.getItemById.get(targetItemId);
    if (!target) {
        return res.status(404).json({ error: 'ITEM_NOT_FOUND', message: 'Remote/Target tidak ditemukan.' });
    }

    // Prepare materials and validate stock
    const materialItems = [];
    for (const mat of materials) {
        const item = stmts.getItemById.get(mat.id);
        if (!item) {
            return res.status(404).json({ error: 'ITEM_NOT_FOUND', message: `Bahan baku dengan ID ${mat.id} tidak ditemukan.` });
        }
        if (item.stock < mat.qty) {
            return res.status(400).json({ error: 'INSUFFICIENT_STOCK', message: `Stok ${item.name} tidak mencukupi untuk dirakit.` });
        }
        materialItems.push({ item, qty: mat.qty });
    }

    const runAssembly = betterSqlite.transaction(() => {
        const ts = new Date().toISOString();

        // 1. Kurangi stok bahan & Catat transaksi
        let sourceNames = [];
        for (const { item, qty } of materialItems) {
            const newStock = item.stock - qty;
            const newStatus = newStock < 2 ? 'LOW_STOCK' : 'IN_STOCK';
            stmts.updateItem.run(item.name, item.category, item.price, newStock, item.rarity, newStatus, item.bab, item.sub_bab, item.id);
            
            insertTransaction({
                transaction_id: `TX-ASM-OUT-${Date.now()}-${item.id}`, item_name: item.name, category: item.bab,
                unit_price: item.price, quantity: -qty, total: 0,
                timestamp: ts, type: 'ASSEMBLY_OUT', source: 'WEB_UI'
            });
            sourceNames.push(item.name);
        }

        // 2. Tambah stok hasil rakitan & Catat transaksi
        const newTargetStock = target.stock + quantity;
        const newTargetStatus = newTargetStock < 2 ? 'LOW_STOCK' : 'IN_STOCK';
        stmts.updateItem.run(target.name, target.category, target.price, newTargetStock, target.rarity, newTargetStatus, target.bab, target.sub_bab, target.id);

        insertTransaction({
            transaction_id: `TX-ASM-IN-${Date.now()}`, item_name: target.name, category: target.bab,
            unit_price: target.price, quantity: quantity, total: 0,
            timestamp: ts, type: 'ASSEMBLY_IN', source: 'WEB_UI'
        });
        
        return sourceNames.join(', ');
    });

    try {
        const sources = runAssembly();
        refreshInventory();
        logAudit('ITEM_ASSEMBLED', `Rakit ${quantity} ${target.name} dari: ${sources}`, req);
        res.json({ message: 'ASSEMBLY_SUCCESS', targetId: target.id, quantity });
    } catch (err) {
        res.status(500).json({ error: 'ASSEMBLY_FAILED', message: err.message });
    }
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
    updated.status = updated.stock < 2 ? 'LOW_STOCK' : 'IN_STOCK';

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

    // Catat ke audit log — hapus item adalah aksi yang tidak bisa di-undo
    logAudit('ITEM_DELETE', `ID: ${id} | Name: ${existing.name} | Stock: ${existing.stock}`, req);

    res.json({ message: 'ITEM_DECONSTRUCTED', id: existing.id, name: existing.name });
});

module.exports = router;
