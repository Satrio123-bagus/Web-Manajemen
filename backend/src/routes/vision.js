const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const { stmts, state, insertTransaction, refreshInventory } = require('../models/dbStore');
const { CORTEX_SYSTEM_PROMPT } = require('../services/cortexPrompt');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

// ─── Maximum image size: 4MB (Groq base64 limit) ───────────────────────────
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;

// ─── Allowed image MIME types ───────────────────────────────────────────────
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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

// ─── Reuse executeAction from terminal.js logic ─────────────────────────────
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
                    stock: stockVal, rarity: rarity || 'BIASA', status: stockVal < 2 ? 'LOW_STOCK' : 'IN_STOCK',
                    bab: babVal, sub_bab: subBabVal,
                };

                stmts.insertItem.run(item.id, item.name, item.category, item.price, item.stock, item.rarity, item.status, item.bab, item.sub_bab, 'Belum Ditentukan');
                insertTransaction({
                    transaction_id: generateTxId(), item_name: item.name, category: item.bab,
                    unit_price: item.price, quantity: item.stock, total: 0, timestamp: new Date().toISOString(),
                    type: 'CREATE', source: 'CORTEX_VISION',
                });
                refreshInventory();
                return `[BERHASIL] Item dibuat (${item.id}): ${item.name} | ${item.bab} / ${item.sub_bab} | Rp${item.price.toLocaleString('id-ID')} | Stok: ${item.stock}`;
            }
            case 'SELL': {
                const target = action.target;
                const qty = Number(action.quantity) || 1;
                if (!target) return '[ERROR] JUAL gagal: target tidak ditentukan.';
                const item = state.inventory.find(i => i.name.toLowerCase().includes(target.toLowerCase()));
                if (!item) return `[ERROR] JUAL gagal: item "${target}" tidak ditemukan.`;
                if (item.stock < qty) return `[ERROR] STOK_KURANG: ${item.name} hanya punya ${item.stock} unit.`;
                const newStock = item.stock - qty;
                const newStatus = newStock < 2 ? 'LOW_STOCK' : 'IN_STOCK';
                stmts.updateItem.run(item.name, item.category, item.price, newStock, item.rarity, newStatus, item.bab || 'Uncategorized', item.sub_bab || 'Uncategorized', item.id, item.location || 'Belum Ditentukan');
                const saleTx = {
                    transaction_id: generateTxId(), item_name: item.name, category: item.category,
                    unit_price: item.price, quantity: qty, total: item.price * qty, timestamp: new Date().toISOString(),
                    type: 'SALE', source: 'CORTEX_VISION',
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
                const newStatus = newStock < 2 ? 'LOW_STOCK' : 'IN_STOCK';
                stmts.updateItem.run(item.name, item.category, item.price, newStock, item.rarity, newStatus, item.bab || 'Uncategorized', item.sub_bab || 'Uncategorized', item.id, item.location || 'Belum Ditentukan');
                insertTransaction({
                    transaction_id: generateTxId(), item_name: item.name, category: item.category,
                    unit_price: item.price, quantity: qty, total: item.price * qty, timestamp: new Date().toISOString(),
                    type: 'RESTOCK', source: 'CORTEX_VISION',
                });
                refreshInventory();
                return `[RESTOCK] ${item.name} +${qty} unit diterima | Stok Baru: ${newStock} unit`;
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
                    bab: data.bab !== undefined ? String(data.bab).trim() : existing.bab || existing.category,
                    sub_bab: data.sub_bab !== undefined ? String(data.sub_bab).trim() : existing.sub_bab || 'Uncategorized',
                };
                updated.category = updated.bab;
                updated.status = updated.stock < 2 ? 'LOW_STOCK' : 'IN_STOCK';
                stmts.updateItem.run(updated.name, updated.category, updated.price, updated.stock, updated.rarity, updated.status, updated.bab, updated.sub_bab, existing.id, existing.location || 'Belum Ditentukan');
                insertTransaction({
                    transaction_id: generateTxId(), item_name: updated.name, category: updated.bab,
                    unit_price: updated.price, quantity: updated.stock, total: 0, timestamp: new Date().toISOString(),
                    type: 'UPDATE', source: 'CORTEX_VISION',
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
                    type: 'DELETE', source: 'CORTEX_VISION',
                });
                refreshInventory();
                return `[BERHASIL] Dihapus: ${existing.name} (ID: ${existing.id}) dihapus dari inventori.`;
            }
            case 'EDIT': {
                const target = action.target;
                if (!target) return '[ERROR] EDIT gagal: target tidak ditentukan.';
                const existing = state.inventory.find(i => i.name.toLowerCase().includes(target.toLowerCase()));
                if (!existing) return `[ERROR] EDIT gagal: item "${target}" tidak ditemukan.`;
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
                edited.status = edited.stock < 2 ? 'LOW_STOCK' : 'IN_STOCK';
                stmts.updateItem.run(edited.name, edited.category, edited.price, edited.stock, edited.rarity, edited.status, edited.bab, edited.sub_bab, existing.id, existing.location || 'Belum Ditentukan');
                insertTransaction({
                    transaction_id: generateTxId(), item_name: edited.name, category: edited.bab,
                    unit_price: edited.price, quantity: edited.stock, total: 0, timestamp: new Date().toISOString(),
                    type: 'UPDATE', source: 'CORTEX_VISION',
                });
                refreshInventory();
                return `[EDITED] ${existing.id} | ${edited.name}`;
            }
            default: return `[ERROR] Tipe aksi tidak dikenal: ${action.type}`;
        }
    } catch (e) {
        return `[ERROR] Gagal memproses aksi: ${e.message}`;
    }
}

// ─── STEP 1: Extract text from image using Vision AI ────────────────────────
// CATATAN: Groq TIDAK memiliki model Vision di plan saat ini.
// OCR dilakukan sepenuhnya via OpenRouter (mendukung model vision gratis).
async function extractTextFromImage(base64Image) {
    // Determine mime type from data URI or default to jpeg
    let mimeType = 'image/jpeg';
    let rawBase64 = base64Image;
    if (base64Image.startsWith('data:')) {
        const match = base64Image.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
            mimeType = match[1];
            rawBase64 = match[2];
        }
    }

    // Validate MIME type
    if (!ALLOWED_TYPES.includes(mimeType)) {
        throw new Error(`Tipe file tidak didukung: ${mimeType}. Gunakan JPEG, PNG, atau WebP.`);
    }

    // Validate size
    const sizeBytes = Buffer.from(rawBase64, 'base64').length;
    if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
        throw new Error(`Ukuran gambar terlalu besar (${(sizeBytes / 1024 / 1024).toFixed(1)}MB). Maksimal 4MB.`);
    }

    const imageUrl = `data:${mimeType};base64,${rawBase64}`;

    // OpenRouter Vision — menggunakan free router yang otomatis pilih model vision terbaik
    const hasOpenRouter = OPENROUTER_API_KEY && OPENROUTER_API_KEY !== 'YOUR_OPENROUTER_API_KEY_HERE';
    if (!hasOpenRouter) {
        throw new Error('OpenRouter API key tidak tersedia. CORTEX Vision memerlukan OpenRouter untuk OCR.');
    }

    // Coba model vision secara berurutan (dari yang paling akurat ke fallback)
    const visionModels = [
        'google/gemma-3-27b-it:free',                         // Gemma 3 — gratis, sangat bagus untuk OCR
        'meta-llama/llama-3.2-11b-vision-instruct:free',      // Llama 3.2 Vision — gratis, ringan
        'qwen/qwen2.5-vl-72b-instruct:free',                  // Qwen VL — gratis, kuat
    ];

    const ocrPrompt = `Baca SEMUA teks yang terlihat di gambar ini. Tulis ulang teks tersebut apa adanya, dalam format yang sama persis.
Jika ada kode produk, nomor seri, harga, atau jumlah, pastikan semua tertulis.
Jika gambar berisi tabel atau daftar, pertahankan formatnya.
Hanya tuliskan teks yang terbaca. Jangan tambahkan komentar atau penjelasan.`;

    for (const model of visionModels) {
        try {
            console.log(`[VISION] Trying OCR with model: ${model}`);
            const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'https://3coinsstock.com',
                    'X-Title': 'INSERT3COINS CORTEX VISION'
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: ocrPrompt },
                                { type: 'image_url', image_url: { url: imageUrl } }
                            ]
                        }
                    ],
                    temperature: 0.1,
                    max_tokens: 1000
                }),
            });

            if (!orRes.ok) {
                console.warn(`[VISION] Model ${model} failed with status ${orRes.status}, trying next...`);
                continue;
            }

            const orData = await orRes.json();
            const result = orData.choices?.[0]?.message?.content || '';

            if (result.trim().length > 2) {
                console.log(`[VISION] OCR success via ${model} (${result.length} chars)`);
                return { text: result, engine: model.split('/').pop().split(':')[0].toUpperCase() };
            }

            console.warn(`[VISION] Model ${model} returned empty result, trying next...`);
        } catch (err) {
            console.warn(`[VISION] Model ${model} error: ${err.message}, trying next...`);
        }
    }

    throw new Error('Semua Vision AI model gagal membaca gambar. Coba foto ulang dengan pencahayaan yang lebih baik.');
}

// ─── STEP 2: Send OCR text + command to CORTEX for processing ───────────────
async function processCortexWithOCR(ocrText, command, sessionId) {
    const topSellers = stmts.getTopSellers.all();
    const revenueStats = stmts.getRevenueTotal.get();
    const conversationHistory = stmts.getConversation.all(sessionId).reverse();

    // Build a compact inventory context (same as terminal.js)
    const lowStock = state.inventory.filter(i => i.stock < 2);
    const sample = state.inventory.slice(0, 15);
    const combinedItems = [...new Map([...lowStock, ...sample].map(item => [item.id, item])).values()].slice(0, 25);

    const inventoryContext = `
LIVE SYSTEM CONTEXT:
- System: INSERT3COINS Core v3.0.0 + CORTEX VISION
- Total Items (in DB): ${state.inventory.length}
- Low Stock Alerts: ${lowStock.length} items

EXISTING ITEMS (Sample, Max 25):
${combinedItems.map((item, i) => `  ${i + 1}. [${item.id}] ${item.name} | Bab: ${item.bab || item.category} | Sub-bab: ${item.sub_bab || 'N/A'} | Price: Rp${item.price.toLocaleString('id-ID')} | Stock: ${item.stock} | Rarity: ${item.rarity}`).join('\n')}
`;

    const userPrompt = `${inventoryContext}

[OCR_DATA] Berikut adalah teks yang dibaca dari foto yang dikirim operator:
---
${ocrText}
---

OPERATOR COMMAND: ${command}`;

    // Try Groq first, then fallback
    try {
        const messages = [{ role: 'system', content: CORTEX_SYSTEM_PROMPT }];
        conversationHistory.forEach(entry => messages.push({ role: entry.role, content: entry.content }));
        messages.push({ role: 'user', content: userPrompt });

        const chatCompletion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile', messages, temperature: 0.6, max_tokens: 500,
        });
        return chatCompletion.choices[0]?.message?.content || '[CORTEX] Tidak ada respons.';
    } catch (err) {
        console.error('[VISION CORTEX] Groq failed:', err.message);

        // Fallback to OpenRouter
        const hasOpenRouter = OPENROUTER_API_KEY && OPENROUTER_API_KEY !== 'YOUR_OPENROUTER_API_KEY_HERE';
        if (!hasOpenRouter) throw err;

        const messages = [{ role: 'system', content: CORTEX_SYSTEM_PROMPT }];
        conversationHistory.forEach(entry => messages.push({ role: entry.role, content: entry.content }));
        messages.push({ role: 'user', content: userPrompt });

        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://3coinsstock.com',
                'X-Title': 'INSERT3COINS CORTEX'
            },
            body: JSON.stringify({
                model: 'meta-llama/llama-3.1-70b-instruct',
                messages, temperature: 0.6, max_tokens: 500
            }),
        });

        if (!orRes.ok) throw new Error(`OpenRouter failed: ${orRes.status}`);
        const orData = await orRes.json();
        return orData.choices?.[0]?.message?.content || '[CORTEX] Tidak ada respons.';
    }
}

// ─── MAIN ROUTE: POST /api/terminal/vision ──────────────────────────────────
router.post('/', async (req, res) => {
    const { image, command } = req.body;
    const ts = new Date().toISOString();

    // Validate inputs
    if (!image || typeof image !== 'string') {
        return res.status(400).json({ error: 'INVALID_INPUT: field "image" (base64 string) diperlukan.' });
    }
    if (!command || typeof command !== 'string') {
        return res.status(400).json({ error: 'INVALID_INPUT: field "command" (string) diperlukan.' });
    }
    if (command.length > 500) {
        return res.status(400).json({ error: 'INVALID_INPUT: Command terlalu panjang (maks 500 karakter).' });
    }

    const cmd = command.trim();
    const sessionId = req.headers['x-session-id'] || 'default';

    try {
        // STEP 1: OCR — Extract text from image
        const { text: ocrText, engine: visionEngine } = await extractTextFromImage(image);

        if (!ocrText || ocrText.trim().length < 2) {
            return res.json({
                timestamp: ts, command: cmd, output: [
                    '[VISION] 📷 Gambar diterima, tetapi tidak ada teks yang terbaca.',
                    '[CORTEX] Coba foto ulang dengan pencahayaan yang lebih baik atau jarak yang lebih dekat.',
                ]
            });
        }

        console.log(`[VISION] OCR via ${visionEngine}: "${ocrText.slice(0, 100)}..."`);

        // STEP 2: Send OCR result + command to CORTEX
        let cortexResponse = await processCortexWithOCR(ocrText, cmd, sessionId);

        if (!cortexResponse) cortexResponse = '[CORTEX] Tidak ada respons. Coba lagi.';

        // STEP 3: Execute any ACTION blocks from CORTEX response
        const actionRegex = /<<<ACTION>>>\s*([\s\S]*?)\s*<<<END_ACTION>>>/g;
        const actionResults = [];
        let actionExec;
        let deleteCount = 0;
        const MAX_ACTIONS_PER_CMD = 5;
        const MAX_DELETES_PER_CMD = 1;

        while ((actionExec = actionRegex.exec(cortexResponse)) !== null) {
            if (actionResults.length >= MAX_ACTIONS_PER_CMD) {
                actionResults.push('[SECURITY] Batas maksimum aksi per perintah tercapai.');
                break;
            }
            const actionStr = actionExec[1].trim();
            try {
                const parsed = JSON.parse(actionStr);
                if (parsed.type === 'DELETE') {
                    deleteCount++;
                    if (deleteCount > MAX_DELETES_PER_CMD) {
                        actionResults.push('[SECURITY] Batas DELETE per perintah tercapai.');
                        continue;
                    }
                }
            } catch (e) {
                actionResults.push('[ERROR] Aksi tidak valid, JSON rusak.');
                continue;
            }
            actionResults.push(executeAction(actionStr));
        }
        cortexResponse = cortexResponse.replace(/<<<ACTION>>>[\s\S]*?<<<END_ACTION>>>/g, '').trim();

        // Save conversation
        stmts.insertConversation.run(sessionId, 'user', `[VISION] ${cmd} | OCR: ${ocrText.slice(0, 200)}`, ts);
        stmts.insertConversation.run(sessionId, 'assistant', cortexResponse, ts);

        // Build output
        let output = [
            `[VISION] 📷 Foto dipindai via ${visionEngine}`,
            `[VISION] Teks terbaca: "${ocrText.slice(0, 150)}${ocrText.length > 150 ? '...' : ''}"`,
            '',
        ];
        output.push(...cortexResponse.split('\n').filter(line => line.trim() !== ''));
        actionResults.forEach(result => output.push(result));

        state.terminalLogs.push({ timestamp: ts, command: `[VISION] ${cmd}`, output });

        res.json({ timestamp: ts, command: `[VISION] ${cmd}`, output });
    } catch (err) {
        console.error('[VISION ERROR]', err.message);
        console.error('[VISION DETAIL]', err.stack || err);
        res.json({
            timestamp: ts, command: cmd, output: [
                '[VISION ERROR] ████████████████████████████',
                `[ERROR] ${err.message || 'Gagal memproses gambar.'}`,
                '[CORTEX] Coba foto ulang atau gunakan perintah teks biasa.',
            ],
        });
    }
});

module.exports = router;
