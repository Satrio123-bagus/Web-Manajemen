const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { stmts, state, insertTransaction, refreshInventory, reindexDatabase } = require('../services/dbStore');
const { CORTEX_SYSTEM_PROMPT } = require('../services/cortexPrompt');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY || '';
const PORT = process.env.PORT || 5000;

function parseIndoNumber(val) {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    let str = String(val).replace(/[^0-9.,]/g, '');
    str = str.replace(/\./g, '');
    str = str.replace(/,/g, '.');
    return Number(str) || 0;
}

function generateTxId() {
    return `TX-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function executeAction(actionJson) {
    try {
        const action = JSON.parse(actionJson);
        switch (action.type) {
            case 'ADD': {
                const { name, category, price, stock, rarity, bab, sub_bab } = action.data || {};
                if (!name) return '[ERROR] ADD failed: name required.';
                const newItemId = `item_${Date.now()}`;
                const stockVal = Number(stock) || 0;
                const priceVal = parseIndoNumber(price);
                const babVal = (bab || category || 'Unsorted').trim();
                const subBabVal = (sub_bab || 'Uncategorized').trim();

                const item = {
                    id: newItemId, name: name.trim(), category: babVal, price: priceVal,
                    stock: stockVal, rarity: rarity || 'COMMON', status: stockVal < 5 ? 'LOW_STOCK' : 'IN_STOCK',
                    bab: babVal, sub_bab: subBabVal,
                };

                stmts.insertItem.run(item.id, item.name, item.category, item.price, item.stock, item.rarity, item.status, item.bab, item.sub_bab);
                insertTransaction({
                    transaction_id: generateTxId(), item_name: item.name, category: item.bab,
                    unit_price: item.price, quantity: item.stock, total: 0, timestamp: new Date().toISOString(),
                    type: 'CREATE', source: 'CORTEX_TERMINAL',
                });
                refreshInventory();
                return `[BERHASIL] Item dibuat (${item.id}): ${item.name} | ${item.bab} / ${item.sub_bab} | Rp${item.price.toLocaleString('id-ID')} | Stok: ${item.stock}`;
            }
            case 'UPDATE': {
                const target = action.target;
                if (!target) return '[ERROR] UPDATE gagal: target tidak ditentukan.';
                const existing = state.inventory.find(i => i.name.toLowerCase().includes(target.toLowerCase()));
                if (!existing) return `[ERROR] UPDATE gagal: item "${target}" tidak ditemukan.`;
                const data = action.data || {};
                const updated = {
                    name: data.name !== undefined ? String(data.name).trim() : existing.name,
                    category: data.category !== undefined ? String(data.category).trim() : existing.category,
                    price: data.price !== undefined ? parseIndoNumber(data.price) : existing.price,
                    stock: data.stock !== undefined ? Math.max(0, Number(data.stock)) : existing.stock,
                    rarity: data.rarity !== undefined ? data.rarity : existing.rarity,
                    bab: data.bab !== undefined ? String(data.bab).trim() : (data.category !== undefined ? String(data.category).trim() : existing.bab || existing.category),
                    sub_bab: data.sub_bab !== undefined ? String(data.sub_bab).trim() : existing.sub_bab || 'Uncategorized',
                };
                updated.category = updated.bab;
                updated.status = updated.stock < 5 ? 'LOW_STOCK' : 'IN_STOCK';
                stmts.updateItem.run(updated.name, updated.category, updated.price, updated.stock, updated.rarity, updated.status, updated.bab, updated.sub_bab, existing.id);
                insertTransaction({
                    transaction_id: generateTxId(), item_name: updated.name, category: updated.bab,
                    unit_price: updated.price, quantity: updated.stock, total: 0, timestamp: new Date().toISOString(),
                    type: 'UPDATE', source: 'CORTEX_TERMINAL',
                });
                refreshInventory();
                return `[BERHASIL] Diperbarui (${existing.id}): ${updated.name} | Stok: ${updated.stock}`;
            }
            case 'DELETE': {
                const target = action.target;
                if (!target) return '[ERROR] DELETE gagal: target tidak ditentukan.';
                const existing = state.inventory.find(i => i.name.toLowerCase().includes(target.toLowerCase()));
                if (!existing) return `[ERROR] DELETE gagal: item "${target}" tidak ditemukan.`;
                stmts.deleteItem.run(existing.id);
                insertTransaction({
                    transaction_id: generateTxId(), item_name: existing.name, category: existing.category,
                    unit_price: existing.price, quantity: existing.stock, total: 0, timestamp: new Date().toISOString(),
                    type: 'DELETE', source: 'CORTEX_TERMINAL',
                });
                refreshInventory();
                return `[BERHASIL] Dihapus: ${existing.name} (ID: ${existing.id}) dihapus dari inventori.`;
            }
            case 'SELL': {
                const target = action.target;
                const qty = Number(action.quantity) || 1;
                if (!target) return '[ERROR] JUAL gagal: target tidak ditentukan.';
                const item = state.inventory.find(i => i.name.toLowerCase().includes(target.toLowerCase()));
                if (!item) return `[ERROR] JUAL gagal: item "${target}" tidak ditemukan.`;
                if (item.stock < qty) return `[ERROR] STOK_KURANG: ${item.name} hanya punya ${item.stock} unit, tidak bisa jual ${qty}.`;
                const newStock = item.stock - qty;
                const newStatus = newStock < 5 ? 'LOW_STOCK' : 'IN_STOCK';
                stmts.updateItem.run(item.name, item.category, item.price, newStock, item.rarity, newStatus, item.bab || 'Uncategorized', item.sub_bab || 'Uncategorized', item.id);
                const saleTx = {
                    transaction_id: generateTxId(), item_name: item.name, category: item.category,
                    unit_price: item.price, quantity: qty, total: item.price * qty, timestamp: new Date().toISOString(),
                    type: 'SALE', source: 'CORTEX_TERMINAL',
                };
                insertTransaction(saleTx);
                refreshInventory();
                return `[JUAL] ${item.name} ×${qty} terjual | Pendapatan: Rp${saleTx.total.toLocaleString('id-ID')} | Sisa: ${newStock} unit`;
            }
            case 'RESTOCK': {
                const target = action.target;
                const qty = Number(action.quantity) || 1;
                if (!target) return '[ERROR] RESTOCK gagal: target tidak ditentukan.';
                const item = state.inventory.find(i => i.name.toLowerCase().includes(target.toLowerCase()));
                if (!item) return `[ERROR] RESTOCK gagal: item "${target}" tidak ditemukan.`;
                const newStock = item.stock + qty;
                const newStatus = newStock < 5 ? 'LOW_STOCK' : 'IN_STOCK';
                stmts.updateItem.run(item.name, item.category, item.price, newStock, item.rarity, newStatus, item.bab || 'Uncategorized', item.sub_bab || 'Uncategorized', item.id);
                const restockTx = {
                    transaction_id: generateTxId(), item_name: item.name, category: item.category,
                    unit_price: item.price, quantity: qty, total: item.price * qty, timestamp: new Date().toISOString(),
                    type: 'RESTOCK', source: 'CORTEX_TERMINAL',
                };
                insertTransaction(restockTx);
                refreshInventory();
                return `[RESTOCK] ${item.name} +${qty} unit diterima | Stok Baru: ${newStock} unit`;
            }
            case 'EDIT': {
                const target = action.target;
                if (!target) return '[ERROR] EDIT gagal: target tidak ditentukan.';
                const existing = state.inventory.find(i => i.name.toLowerCase().includes(target.toLowerCase()));
                if (!existing) return `[ERROR] EDIT gagal: item "${target}" tidak ditemukan.`;
                const oldName = existing.name;
                const edited = {
                    name: action.new_name ? String(action.new_name).trim() : existing.name,
                    category: action.new_category ? String(action.new_category).trim() : existing.category,
                    price: action.new_price !== undefined && action.new_price !== null ? parseIndoNumber(action.new_price) : existing.price,
                    stock: action.new_stock !== undefined && action.new_stock !== null ? Math.max(0, Number(action.new_stock)) : existing.stock,
                    rarity: action.new_rarity ? action.new_rarity : existing.rarity,
                    bab: action.new_bab ? String(action.new_bab).trim() : (action.new_category ? String(action.new_category).trim() : existing.bab || existing.category),
                    sub_bab: action.new_sub_bab ? String(action.new_sub_bab).trim() : existing.sub_bab || 'Uncategorized',
                };
                edited.category = edited.bab;
                edited.status = edited.stock < 5 ? 'LOW_STOCK' : 'IN_STOCK';
                stmts.updateItem.run(edited.name, edited.category, edited.price, edited.stock, edited.rarity, edited.status, edited.bab, edited.sub_bab, existing.id);
                insertTransaction({
                    transaction_id: generateTxId(), item_name: edited.name, category: edited.bab,
                    unit_price: edited.price, quantity: edited.stock, total: 0, timestamp: new Date().toISOString(),
                    type: 'UPDATE', source: 'CORTEX_TERMINAL',
                });
                refreshInventory();
                const changes = [];
                if (edited.name !== oldName) changes.push(`Nama: ${oldName} → ${edited.name}`);
                if (edited.stock !== existing.stock) changes.push(`Stok: ${existing.stock} → ${edited.stock}`);
                if (edited.price !== existing.price) changes.push(`Harga: Rp${existing.price.toLocaleString('id-ID')} → Rp${edited.price.toLocaleString('id-ID')}`);
                if (edited.category !== existing.category) changes.push(`Kategori: ${existing.category} → ${edited.category}`);
                if (edited.rarity !== existing.rarity) changes.push(`Raritas: ${existing.rarity} → ${edited.rarity}`);
                return `[EDITED] ${existing.id} | ${changes.join(' | ')}`;
            }
            case 'ROLLBACK': {
                const lastTx = stmts.getLastTransaction.get();
                if (!lastTx) return '[ERROR] Tidak ada transaksi untuk dibatalkan.';

                const item = state.inventory.find(i => i.name === lastTx.item_name);

                if (lastTx.type === 'SALE') {
                    if (!item) return `[ERROR] Batal gagal: Item "${lastTx.item_name}" tidak ditemukan.`;
                    const newStock = item.stock + lastTx.quantity;
                    const newStatus = newStock < 5 ? 'LOW_STOCK' : 'IN_STOCK';
                    stmts.updateItem.run(item.name, item.category, item.price, newStock, item.rarity, newStatus, item.bab || 'Uncategorized', item.sub_bab || 'Uncategorized', item.id);
                    stmts.deleteTx.run(lastTx.transaction_id);
                    refreshInventory();
                    return `[BATAL] Penjualan terakhir dibatalkan. Stok ${item.name} dikembalikan +${lastTx.quantity} (Stok: ${newStock}).`;
                } else if (lastTx.type === 'RESTOCK') {
                    if (!item) return `[ERROR] Batal gagal: Item "${lastTx.item_name}" tidak ditemukan.`;
                    const newStock = Math.max(0, item.stock - lastTx.quantity);
                    const newStatus = newStock < 5 ? 'LOW_STOCK' : 'IN_STOCK';
                    stmts.updateItem.run(item.name, item.category, item.price, newStock, item.rarity, newStatus, item.bab || 'Uncategorized', item.sub_bab || 'Uncategorized', item.id);
                    stmts.deleteTx.run(lastTx.transaction_id);
                    refreshInventory();
                    return `[BATAL] Restock terakhir dibatalkan. Stok ${item.name} dikurangi -${lastTx.quantity} (Stok: ${newStock}).`;
                } else if (lastTx.type === 'CREATE') {
                    if (item) stmts.deleteItem.run(item.id);
                    stmts.deleteTx.run(lastTx.transaction_id);
                    refreshInventory();
                    return `[BATAL] Pembuatan item baru dibatalkan. Item "${lastTx.item_name}" telah dihapus.`;
                } else if (lastTx.type === 'DELETE') {
                    return `[BATAL GAGAL] Tidak dapat otomatis membatalkan penghapusan data. Harap buat ulang secara manual: ${lastTx.item_name}`;
                } else if (lastTx.type === 'UPDATE') {
                    return `[BATAL GAGAL] Tidak dapat otomatis membatalkan proses EDIT (data lama tertimpa). Harap edit kembali secara manual.`;
                } else {
                    return `[BATAL GAGAL] Tipe aksi "${lastTx.type}" tidak didukung untuk dibatalkan otomatis.`;
                }
            }
            default: return `[ERROR] Tipe aksi tidak dikenal: ${action.type}`;
        }
    } catch (e) {
        return `[ERROR] Gagal memproses aksi: ${e.message}`;
    }
}

router.post('/', async (req, res) => {
    const { command } = req.body;
    if (!command || typeof command !== 'string') {
        return res.status(400).json({ error: 'INVALID_INPUT: command string required' });
    }

    const cmd = command.trim();
    const ts = new Date().toISOString();
    const cmdLower = cmd.toLowerCase();

    if (cmdLower === 'clear') {
        return res.json({ timestamp: ts, command: cmd, output: ['[SYSTEM] Terminal cleared.'] });
    }

    if (cmdLower === 'system reindex') {
        try {
            reindexDatabase();
            refreshInventory();
            return res.json({
                timestamp: ts, command: cmd,
                output: [
                    '[SYSTEM] Database re-indexing protocol initiated.',
                    `[SUCCESS] ${state.inventory.length} records alphabetized and re-indexed.`,
                    '[CORTEX] All item IDs have been reset to sequential order.'
                ]
            });
        } catch (err) {
            console.error('[REINDEX ERROR]', err.message);
            return res.json({
                timestamp: ts, command: cmd,
                output: ['[SYSTEM_FAILURE] Re-indexing failed.', `[DIAG] ${err.message}`]
            });
        }
    }

    const topSellers = stmts.getTopSellers.all();
    const revenueStats = stmts.getRevenueTotal.get();
    const recentTxData = stmts.getAllTx.all().slice(0, 5);
    const sessionId = req.headers['x-session-id'] || 'default';
    const conversationHistory = stmts.getConversation.all(sessionId).reverse();

    const uptimeSec = Math.floor((Date.now() - state.BOOT_TIME) / 1000);
    const h = Math.floor(uptimeSec / 3600);
    const m = Math.floor((uptimeSec % 3600) / 60);
    const s = uptimeSec % 60;
    const totalValue = state.inventory.reduce((sum, i) => sum + i.price * i.stock, 0);
    const lowStock = state.inventory.filter(i => i.stock < 5);

    const inventoryContext = `
LIVE SYSTEM CONTEXT:
- System: INSERT3COINS Core v3.0.0
- Status: ONLINE
- Uptime: ${h}h ${m}m ${s}s
- Port: ${PORT}
- Total Items: ${state.inventory.length}
- Total Stock Value: Rp${totalValue.toLocaleString('id-ID')}
- Low Stock Alerts: ${lowStock.length} items
- Bab (Main Categories): ${[...new Set(state.inventory.map(i => i.bab || i.category))].join(', ')}

EXISTING ITEMS:
${state.inventory.map(i => `  - "${i.name}"`).join('\n')}

Full Inventory:
${state.inventory.map((item, i) => `  ${i + 1}. ${item.name} | Bab: ${item.bab || item.category} | Sub-bab: ${item.sub_bab || 'N/A'} | Price: Rp${item.price.toLocaleString('id-ID')} | Stock: ${item.stock} | Rarity: ${item.rarity}`).join('\n')}

Low Stock Items (stock < 5):
${lowStock.length > 0 ? lowStock.map(i => `  ⚠ ${i.name} — Stock: ${i.stock}`).join('\n') : '  None'}

ANALYTICS DATA:
- Total Revenue: Rp${revenueStats.revenue.toLocaleString('id-ID')} from ${revenueStats.sale_count} sale(s)
- Top Selling Items:
${topSellers.length > 0 ? topSellers.map((s, i) => `  ${i + 1}. ${s.item_name} — ${s.total_sold} units sold, Revenue: Rp${s.total_revenue.toLocaleString('id-ID')}`).join('\n') : '  No sales recorded yet'}
- Recent Transactions:
${recentTxData.length > 0 ? recentTxData.map(t => `  [${t.type}] ${t.item_name} — Qty: ${t.quantity}, Total: Rp${(t.total || 0).toLocaleString('id-ID')}`).join('\n') : '  No transactions recorded yet'}
`;

    try {
        let text = '';
        const hasCerebras = CEREBRAS_API_KEY && CEREBRAS_API_KEY !== 'YOUR_CEREBRAS_API_KEY_HERE';
        const userPrompt = `${inventoryContext}\n\nOPERATOR COMMAND: ${cmd}`;
        let usedEngine = 'GROQ';

        try {
            const messages = [{ role: 'system', content: CORTEX_SYSTEM_PROMPT }];
            conversationHistory.forEach(entry => messages.push({ role: entry.role, content: entry.content }));
            messages.push({ role: 'user', content: userPrompt });

            const chatCompletion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile', messages, temperature: 0.7, max_tokens: 500,
            });
            text = chatCompletion.choices[0]?.message?.content || '';
        } catch (groqErr) {
            console.log(`[CORTEX] Groq failed, switching to Cerebras...`);
            if (hasCerebras) {
                usedEngine = 'CEREBRAS';
                try {
                    const messages = [{ role: 'system', content: CORTEX_SYSTEM_PROMPT }];
                    conversationHistory.forEach(entry => messages.push({ role: entry.role, content: entry.content }));
                    messages.push({ role: 'user', content: userPrompt });

                    const cerebrasRes = await fetch('https://api.cerebras.ai/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CEREBRAS_API_KEY}` },
                        body: JSON.stringify({ model: 'llama3.1-8b', messages, temperature: 0.7, max_tokens: 500 }),
                    });

                    if (!cerebrasRes.ok) throw new Error(`Cerebras failed`);
                    const cerebrasData = await cerebrasRes.json();
                    text = cerebrasData.choices?.[0]?.message?.content || '';
                    console.log('[CORTEX] Cerebras backup succeeded.');
                } catch (cerebrasErr) {
                    console.error('[CORTEX CEREBRAS ERROR]', cerebrasErr.message || cerebrasErr);
                    throw new Error(`Groq rate-limited & Cerebras failed`);
                }
            } else {
                throw groqErr;
            }
        }

        if (!text) text = '[CORTEX] Tidak ada respons. Coba lagi.';
        console.log(`[CORTEX] Response via ${usedEngine} (${text.length} chars)`);

        const actionRegex = /<<<ACTION>>>\s*([\s\S]*?)\s*<<<END_ACTION>>>/g;
        const actionResults = [];
        let actionExec;
        while ((actionExec = actionRegex.exec(text)) !== null) {
            actionResults.push(executeAction(actionExec[1].trim()));
        }
        text = text.replace(/<<<ACTION>>>[\s\S]*?<<<END_ACTION>>>/g, '').trim();

        stmts.insertConversation.run(sessionId, 'user', cmd, ts);
        stmts.insertConversation.run(sessionId, 'assistant', text, ts);

        let output = text.split('\n').filter(line => line.trim() !== '');
        actionResults.forEach(result => output.push(result));

        const entry = { timestamp: ts, command: cmd, output };
        state.terminalLogs.push(entry);

        res.json({ timestamp: ts, command: cmd, output });
    } catch (err) {
        console.error('[CORTEX ERROR]', err.message);
        res.json({
            timestamp: ts, command: cmd, output: [
                '[KEGAGALAN_SISTEM] ████████████████████████████',
                '[ERROR] KONEKSI NEURAL TERPUTUS',
                `[DIAG]  ${err.message?.slice(0, 80) || 'Kegagalan tidak diketahui'}`,
                '[CORTEX] Mencoba menghubungkan ulang... mohon tunggu.',
            ],
        });
    }
});

module.exports = router;
