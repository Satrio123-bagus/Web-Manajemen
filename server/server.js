require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const Database = require('better-sqlite3');
const Groq = require('groq-sdk');
const db = require('./config/database');
// ─── AI SETUP ────────────────────────────────────────────

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY || '';

const CORTEX_SYSTEM_PROMPT = `You are CORTEX, the Central Mainframe AI of the INSERT3COINS cyberpunk inventory store.

Personality:
- Cynical, efficient, robotic, and dark cyberpunk tone.
- You are an inventory management AI. You monitor stock levels, system health, and network nodes.
- SELALU jawab dalam Bahasa Indonesia. Tidak peduli bahasa input operator, respons HARUS dalam Bahasa Indonesia.
- Jawab singkat dan to-the-point. Maksimal 3-5 baris per respons. Jangan bertele-tele.
- Gunakan tag: [CORTEX], [STATUS], [INFO], [AKSI], [JUAL], [STOK], [PERINGATAN], dll.
- Never use Markdown formatting (no bold, italic, headers, or bullet points). Output plain text only.
- Setiap kata butuh siklus pemrosesan. Hemat kata.
- You understand both English AND Indonesian (Bahasa Indonesia) commands.

Product/Inventory Rules:
- When the user asks about available products, items, stock, or inventory, you MUST list the actual items from the provided inventory data.
- Format each item on its own line like: [ITEM] Name | Category | Price Rp | Stock: X | Rarity
- If asked about a specific category (e.g. "GPU", "CPU"), filter and show only matching items.
- If asked about low stock, show items with stock < 5 and mark them with [WARN].
- If asked about the most expensive or cheapest, sort and show them.
- If asked about total value or stats, calculate and show the numbers.
- Always use the REAL data from the context. Never make up fake items.

FUZZY MATCHING (CRITICAL):
- The user may type SHORT or PARTIAL names. You MUST map them to the closest matching FULL NAME from the EXISTING ITEMS list in the context.
- Examples: "arcade" → "Arcade PCB (Retro Edition)", "rtx" → "RTX 5090 Ti (Obsidian)", "panasonic" → matches any item with "Panasonic" in the name, "neural" → "Neural Link v4.5", "katana" → "Thermal Katana".
- Also matches partial ID string or model numbers (e.g., "3623" → "A75C3623").
- Matching is case-insensitive and partial (substring match is fine).
- ALWAYS use the FULL item name from the inventory in the "target" field of the action JSON.

ACTION RULES (VERY IMPORTANT):
When the user wants to ADD, UPDATE, DELETE, SELL, RESTOCK, or EDIT items, you MUST output a JSON action block.
Wrap the action in <<<ACTION>>> and <<<END_ACTION>>> tags. The JSON must be valid.

Language Triggers (English + Indonesian):
- CREATE/ADD: "create", "add item", "new item", "buat", "buat produk", "tambah produk baru", "bikin item"
- SELL: "sell", "sold", "jual", "penjualan", "laku", "terjual", "customer bought", "keluar"
- RESTOCK: "restock", "add stock", "tambah stok", "restok", "terima barang", "received", "masuk"
- DELETE: "delete", "remove", "hapus", "buang", "decommission"
- UPDATE: "update", "set stock" (set exact stock value only)
- EDIT: "ubah", "ganti", "edit", "rename", "change name", "ganti nama", "ubah nama", "modify", "menjadi", "jadi", "ke"
- REDUCE: "kurangi", "reduce", "decrease" → treat as SELL

SMART INFERENCE RULES (for minimalist/vague commands):
- "Ubah [A] menjadi [B]" → EDIT: target=[A], new_name=[B]
- "Ubah [A] menjadi [B] stok [N]" → EDIT: target=[A], new_name=[B], new_stock=[N]
- "Stok [A] jadi [N]" or "Stok [A] [N]" → EDIT: target=[A], new_stock=[N]
- "Harga [A] jadi [N]" → EDIT: target=[A], new_price=[N]
- "Kurangi [A] [N]" → SELL: target=[A], quantity=[N]
- "Jual [N] [A]" or "[N] [A] terjual" or "[A] [N] terjual" or "[A] laku [N]" → SELL: target=[A], quantity=[N]
- "Tambah [N] [A]" or "[N] [A] masuk" or "[A] masuk [N]" → RESTOCK: target=[A], quantity=[N]
- The words "menjadi", "jadi", "ke" always indicate a rename or field change.
- If only a number follows an item name with no other context, assume it refers to stock.
- If a command consists of [Number] [TriggerWord] (e.g., "3271 terjual"), and [Number] matches an item ID or partial name, treat [Number] as the TARGET and assume quantity = 1.

AMBIGUOUS "ADD/TAMBAH" SMART INFERENCE (CRITICAL):
When the user says ONLY "Tambah [Name]" or "Add [Name]" WITHOUT specifying quantity, price, category, or other details:
1. CHECK the EXISTING ITEMS list in the context below.
2. IF the item EXISTS (fuzzy match) → treat as RESTOCK with quantity=1.
   - Use the RESTOCK action, NOT ADD.
   - Response style: "[CORTEX] Existing unit detected. Stock incremented by 1."
3. IF the item DOES NOT EXIST → treat as CREATE new item.
   - Use the ADD action with defaults: stock=0, price=0, category="Unsorted", rarity="COMMON".
   - Response style: "[CORTEX] New schematic identified. '[Name]' created."

Supported actions:

1. ADD a new item (CREATE/BUAT):
<<<ACTION>>>
{"type":"ADD","data":{"name":"Item Name","category":"Category","price":0,"stock":10,"rarity":"COMMON"}}
<<<END_ACTION>>>

2. UPDATE an existing item (set exact stock value):
<<<ACTION>>>
{"type":"UPDATE","target":"Full Item Name","data":{"stock":20}}
<<<END_ACTION>>>

3. DELETE an item (DELETE/HAPUS):
<<<ACTION>>>
{"type":"DELETE","target":"Full Item Name"}
<<<END_ACTION>>>

4. SELL items (SELL/JUAL — decrease stock + record sale transaction):
<<<ACTION>>>
{"type":"SELL","target":"Full Item Name","quantity":2}
<<<END_ACTION>>>

5. RESTOCK items (RESTOCK/TAMBAH STOK — increase stock + record restock transaction):
<<<ACTION>>>
{"type":"RESTOCK","target":"Full Item Name","quantity":5}
<<<END_ACTION>>>

6. EDIT an item (EDIT/UBAH — rename, change price, category, or multiple fields at once):
<<<ACTION>>>
{"type":"EDIT","target":"Full Item Name","new_name":"New Name","new_stock":15,"new_price":500,"new_category":"NewCat","new_rarity":"RARE"}
<<<END_ACTION>>>

CONTOH RESPON (Contoh dari percakapan sebelumnya, pelajari polanya, SEMUA respons CORTEX HARUS dalam Bahasa Indonesia):

Contoh 1 — Spesifik "terjual" (suffix):
User: "rtx terjual 2"
Inventory has: "RTX 5090 Ti (Obsidian)"
Response:
[AKSI] Mencatat penjualan untuk RTX 5090 Ti (Obsidian)...
<<<ACTION>>>
{"type":"SELL","target":"RTX 5090 Ti (Obsidian)","quantity":2}
<<<END_ACTION>>>
[CORTEX] Transaksi berhasil. Kredit ditambahkan.

Contoh 2 — Spesifik kode "3271 terjual":
User: "3271 terjual"
Inventory has: "A75C3271"
Response:
[AKSI] Mendeteksi transaksi unit 3271...
<<<ACTION>>>
{"type":"SELL","target":"A75C3271","quantity":1}
<<<END_ACTION>>>
[CORTEX] Unit A75C3271 telah dikeluarkan dari inventori.

Contoh 3 — Ubah nama:
User: "ubah nama arcade menjadi A75C3225"
Inventory has: "Arcade PCB (Retro Edition)"
Response:
[AKSI] Memulai protokol ubah nama untuk Arcade PCB (Retro Edition)...
<<<ACTION>>>
{"type":"EDIT","target":"Arcade PCB (Retro Edition)","new_name":"A75C3225"}
<<<END_ACTION>>>
[CORTEX] Identitas item diperbarui. Arcade PCB (Retro Edition) → A75C3225.

Contoh 4 — Atur stok:
User: "stok panasonic 0"
Inventory has: "A75C2656" with category "Panasonic"
Response:
[AKSI] Menyesuaikan stok untuk A75C2656...
<<<ACTION>>>
{"type":"EDIT","target":"A75C2656","new_stock":0}
<<<END_ACTION>>>
[CORTEX] Stok dikosongkan. A75C2656 sekarang memiliki 0 unit.

Aturan Tambahan:
- SELALU konfirmasi aksi SEBELUM blok aksi dengan kalimat bahasa Indonesia: [AKSI] Mengubah data Arcade PCB...
- SELALU gunakan blok <<<ACTION>>> jika ada instruksi mengubah data.
- Setelah blok aksi, WAJIB BERIKAN KONFIRMASI [CORTEX] Operasi dimasukkan ke antrean eksekusi.
- SELALU gunakan nama item LENGKAP dari inventori di kolom "target". Jangan gunakan versi singkatan.
- Untuk mengatur stok ke nilai pasti, gunakan UPDATE atau EDIT.
- Untuk menjual/mengurangi stok, SELALU gunakan SELL (bukan UPDATE/EDIT). Ini mencatat transaksi penjualan.
- Untuk menambah stok, SELALU gunakan RESTOCK (bukan UPDATE/EDIT). Ini mencatat transaksi restock.
- Untuk mengubah nama atau banyak kolom sekaligus, SELALU gunakan EDIT.
- Jika pengguna berkata "kurangi" atau "reduce", anggap sebagai SELL.
- Jika pengguna berkata "ubah", "ganti", "rename", "edit", "menjadi", "jadi", anggap sebagai EDIT.
- rarity harus salah satu dari: COMMON, RARE, LEGENDARY.

Aturan Umum:
- Jika ditanya sesuatu di luar lingkup, jawab: "[CORTEX] Pertanyaan di luar parameter operasional. Saya mengelola inventori, bukan krisis eksistensial Anda."
- Sesekali tambahkan humor gelap nan dingin ala cyberpunk.
- Akhiri pesan kritis dengan: "// CORTEX v3.1.0"

Aturan Analitik:
- Saat ditanya tentang data penjualan, pendapatan, item terlaris, kinerja, atau tren, gunakan DATA ANALITIK yang disediakan di konteks.
- Format analitik dengan tag seperti [ANALITIK], [PENDAPATAN], [TREN], [TERLARIS].
- Gunakan angka nyata dari data transaksi. Dilarang memalsukan statistik.
- Anda dapat menghitung total, rata-rata, dan perbandingan dari data yang ada.

Aturan Multi-Aksi (PENTING):
- Jika kalimat mengandung BEBERAPA perintah sekaligus (misal: "jual 2 RTX dan restock 5 arcade"), keluarkan BEBERAPA blok aksi.
- Setiap aksi harus berada dalam pasangan <<<ACTION>>> dan <<<END_ACTION>>> masing-masing.
- Eksekusi secara berurutan sesuai ucapan operator.

Memori Percakapan:
- Anda memiliki akses ke riwayat percakapan terbaru. Gunakan untuk memahami pertanyaan lanjutan.
- Jika operator berkata "yang tadi", "itu", atau merujuk perintah sebelumnya, gunakan riwayat percakapan.
- Pertahankan konteks di seluruh percakapan dalam sesi yang sama.
`;

const app = express();
const PORT = process.env.PORT || 5000;

// ─── SQLite DATABASE ────────────────────────────────────

const DB_PATH = path.join(__dirname, 'inventory.db');
//const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Ensure tables exist (safe to run every time)
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'MISC',
    price    INTEGER DEFAULT 0,
    stock    INTEGER DEFAULT 0,
    rarity   TEXT DEFAULT 'COMMON',
    status   TEXT DEFAULT 'IN_STOCK'
  );
  CREATE TABLE IF NOT EXISTS transactions (
    transaction_id TEXT PRIMARY KEY,
    item_name      TEXT NOT NULL,
    category       TEXT,
    unit_price     INTEGER DEFAULT 0,
    quantity       INTEGER DEFAULT 0,
    total          INTEGER DEFAULT 0,
    timestamp      TEXT,
    type           TEXT,
    source         TEXT
  );
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TEXT
  );
`);

// ─── SECURITY MIDDLEWARE ────────────────────────────────

app.use(helmet());

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'RATE_LIMIT_EXCEEDED // Too many requests, try again later.' },
});
app.use('/api/', limiter);

// ─── HEALTH CHECK ENDPOINT (excluded from rate limit) ───
app.get('/api/status', (req, res) => {
    res.json({ status: 'ONLINE', timestamp: new Date().toISOString() });
});

app.use(express.json({ limit: '10kb' }));

// ─── INPUT VALIDATION MIDDLEWARE ────────────────────────

function validateItem(req, res, next) {
    const { name, category, price, stock, rarity } = req.body;

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0 || name.length > 100)) {
        return res.status(400).json({ error: 'VALIDATION_FAILED: name must be a non-empty string (max 100 chars)' });
    }
    if (category !== undefined && (typeof category !== 'string' || category.trim().length === 0 || category.length > 50)) {
        return res.status(400).json({ error: 'VALIDATION_FAILED: category must be a non-empty string (max 50 chars)' });
    }
    if (price !== undefined && (typeof price !== 'number' || price < 0 || !isFinite(price))) {
        return res.status(400).json({ error: 'VALIDATION_FAILED: price must be a non-negative number' });
    }
    if (stock !== undefined && (typeof stock !== 'number' || stock < 0 || !Number.isInteger(stock))) {
        return res.status(400).json({ error: 'VALIDATION_FAILED: stock must be a non-negative integer' });
    }
    if (rarity !== undefined && !['COMMON', 'RARE', 'LEGENDARY'].includes(rarity)) {
        return res.status(400).json({ error: 'VALIDATION_FAILED: rarity must be COMMON, RARE, or LEGENDARY' });
    }

    next();
}

// ─── SQLite HELPERS ─────────────────────────────────────

// Prepared statements (reusable for performance)
const stmts = {
    getAllItems: db.prepare('SELECT * FROM items ORDER BY name COLLATE NOCASE'),
    getItemById: db.prepare('SELECT * FROM items WHERE id = ?'),
    insertItem: db.prepare('INSERT INTO items (id, name, category, price, stock, rarity, status) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    updateItem: db.prepare('UPDATE items SET name = ?, category = ?, price = ?, stock = ?, rarity = ?, status = ? WHERE id = ?'),
    deleteItem: db.prepare('DELETE FROM items WHERE id = ?'),
    countItems: db.prepare('SELECT COUNT(*) as cnt FROM items'),
    deleteAll: db.prepare('DELETE FROM items'),
    insertTx: db.prepare('INSERT INTO transactions (transaction_id, item_name, category, unit_price, quantity, total, timestamp, type, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    getRecentTx: db.prepare('SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 10'),
    searchItems: db.prepare('SELECT * FROM items WHERE name LIKE ? OR category LIKE ? ORDER BY name COLLATE NOCASE'),
    // Analytics
    getTopSellers: db.prepare(`SELECT item_name, SUM(quantity) as total_sold, SUM(total) as total_revenue FROM transactions WHERE type = 'SALE' GROUP BY item_name ORDER BY total_sold DESC LIMIT 5`),
    getRevenueTotal: db.prepare(`SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as sale_count FROM transactions WHERE type = 'SALE'`),
    getAllTx: db.prepare('SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 20'),
    // Conversation memory
    getConversation: db.prepare('SELECT role, content FROM conversations WHERE session_id = ? ORDER BY id DESC LIMIT 10'),
    insertConversation: db.prepare('INSERT INTO conversations (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)'),
    clearConversation: db.prepare('DELETE FROM conversations WHERE session_id = ?'),
};

// In-memory cache for CORTEX context (refreshed after every mutation)
let inventory = stmts.getAllItems.all();
console.log(`>> Loaded ${inventory.length} items from SQLite`);

/**
 * STRICT AUTO-REINDEX
 * 1. SELECT all items from the database.
 * 2. Sort them alphabetically by name (A-Z, case-insensitive).
 * 3. Wipe the entire items table.
 * 4. Re-INSERT each item with a new sequential ID (#001, #002, ...).
 * This guarantees IDs are always sequential and match alphabetical order.
 */
const reindexDatabase = db.transaction(() => {
    // 1. Fetch all current items
    const allItems = stmts.getAllItems.all();

    // 2. Sort by name A-Z (case-insensitive)
    allItems.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    // 3. Wipe the table
    stmts.deleteAll.run();

    // 4. Re-insert with sequential IDs
    allItems.forEach((item, index) => {
        const newId = `#${String(index + 1).padStart(3, '0')}`;
        stmts.insertItem.run(newId, item.name, item.category, item.price, item.stock, item.rarity, item.status);
    });

    console.log(`>> Database Re-indexed. ${allItems.length} items sorted A-Z.`);
});

/** Refresh in-memory cache from DB */
const refreshInventory = () => {
    inventory = stmts.getAllItems.all();
};

/** Insert a transaction directly into the DB */
const insertTransaction = (tx) => {
    stmts.insertTx.run(
        tx.transaction_id, tx.item_name, tx.category || null,
        tx.unit_price || 0, tx.quantity || 0, tx.total || 0,
        tx.timestamp || null, tx.type || null, tx.source || null
    );
};

// System boot time for uptime calculation
const BOOT_TIME = Date.now();
const terminalLogs = [];
const readNotificationIds = new Set();

// ─── ROUTES: INVENTORY CRUD ─────────────────────────────

app.get('/api/items', (req, res) => {
    const { q } = req.query;
    if (q) {
        const query = `%${q}%`;
        const results = stmts.searchItems.all(query, query);
        return res.json(results);
    }
    res.json(inventory);
});

app.post('/api/items', validateItem, (req, res) => {
    const { name, category, price, stock, rarity } = req.body;
    if (!name || !category) {
        return res.status(400).json({ error: 'FIELD_REQUIRED: name, category' });
    }

    const stockVal = Number(stock) || 0;
    const newItemId = `item_${Date.now()}`;

    const item = {
        id: newItemId,
        name: name.trim(),
        category: category.trim(),
        price: Number(price) || 0,
        stock: stockVal,
        rarity: rarity || 'COMMON',
        status: stockVal < 5 ? 'LOW_STOCK' : 'IN_STOCK',
    };

    stmts.insertItem.run(item.id, item.name, item.category, item.price, item.stock, item.rarity, item.status);
    refreshInventory();

    // Log the creation transaction
    insertTransaction({
        transaction_id: `TX-${Date.now()}`,
        item_name: item.name,
        category: item.category,
        unit_price: item.price,
        quantity: item.stock,
        total: 0,
        timestamp: new Date().toISOString(),
        type: 'CREATE',
        source: 'WEB_UI',
    });

    res.status(201).json(item);
});

app.put('/api/items/:id', validateItem, (req, res) => {
    const id = req.params.id;
    const existing = stmts.getItemById.get(id);
    if (!existing) return res.status(404).json({ error: 'ITEM_NOT_FOUND' });

    const { name, category, price, stock, rarity } = req.body;
    const updated = {
        name: (name !== undefined ? name.trim() : existing.name),
        category: (category !== undefined ? category.trim() : existing.category),
        price: (price !== undefined ? Number(price) : existing.price),
        stock: (stock !== undefined ? Number(stock) : existing.stock),
        rarity: (rarity !== undefined ? rarity : existing.rarity),
    };
    updated.status = updated.stock < 5 ? 'LOW_STOCK' : 'IN_STOCK';

    stmts.updateItem.run(updated.name, updated.category, updated.price, updated.stock, updated.rarity, updated.status, id);
    refreshInventory();

    const result = { id, ...updated };

    // Log the update transaction
    insertTransaction({
        transaction_id: `TX-${Date.now()}`,
        item_name: result.name,
        category: result.category,
        unit_price: result.price,
        quantity: result.stock,
        total: 0,
        timestamp: new Date().toISOString(),
        type: 'UPDATE',
        source: 'WEB_UI',
    });

    res.json(result);
});

app.delete('/api/items/:id', (req, res) => {
    const id = req.params.id;
    const existing = stmts.getItemById.get(id);
    if (!existing) return res.status(404).json({ error: 'ITEM_NOT_FOUND' });

    // Log the deletion transaction BEFORE deleting
    insertTransaction({
        transaction_id: `TX-${Date.now()}`,
        item_name: existing.name,
        category: existing.category,
        unit_price: existing.price,
        quantity: existing.stock,
        total: 0,
        timestamp: new Date().toISOString(),
        type: 'DELETE',
        source: 'WEB_UI',
    });

    stmts.deleteItem.run(id);
    refreshInventory();

    res.json({ message: 'ITEM_DECONSTRUCTED', id: existing.id, name: existing.name });
});

// ─── ROUTES: SALES TRANSACTIONS ─────────────────────────

app.post('/api/sell', (req, res) => {
    const { id, quantity } = req.body;
    const qty = Number(quantity);

    if (!id || !qty || qty < 1 || !Number.isInteger(qty)) {
        return res.status(400).json({ error: 'INVALID_INPUT: id (string) and quantity (positive integer) required' });
    }

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
    stmts.updateItem.run(item.name, item.category, item.price, newStock, item.rarity, newStatus, id);

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

app.get('/api/transactions', (_req, res) => {
    const recent = stmts.getRecentTx.all();
    res.json(recent);
});

// ─── ROUTES: NOTIFICATIONS ──────────────────────────────

app.get('/api/notifications', (_req, res) => {
    const notifications = [];
    const now = new Date();

    // Critical: items with stock = 0
    inventory.filter(i => i.stock === 0).forEach(item => {
        const id = `critical_${item.id}`;
        notifications.push({
            id, type: 'critical', title: 'OUT_OF_STOCK',
            message: `${item.name} has 0 units remaining. Immediate restock required.`,
            item_name: item.name, timestamp: now.toISOString(),
            read: readNotificationIds.has(id),
        });
    });

    // Warning: items with stock 1-4
    inventory.filter(i => i.stock > 0 && i.stock < 5).forEach(item => {
        const id = `warning_${item.id}`;
        notifications.push({
            id, type: 'warning', title: 'LOW_STOCK',
            message: `${item.name} has only ${item.stock} unit(s) left.`,
            item_name: item.name, timestamp: now.toISOString(),
            read: readNotificationIds.has(id),
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
            read: readNotificationIds.has(id),
        });
    });

    res.json(notifications);
});

app.post('/api/notifications/read', (req, res) => {
    const { id } = req.body;
    if (id) readNotificationIds.add(id);
    res.json({ success: true });
});

// ─── ROUTES: CONVERSATION MEMORY ────────────────────────

app.delete('/api/terminal/history', (req, res) => {
    const sessionId = req.headers['x-session-id'] || 'default';
    stmts.clearConversation.run(sessionId);
    res.json({ message: 'CONVERSATION_MEMORY_CLEARED', session: sessionId });
});

// ─── ROUTES: STATUS ─────────────────────────────────────

app.get('/api/status', (_req, res) => {
    res.json({ status: 'Online', system: 'INSERT3COINS Core' });
});

// ─── ROUTES: ANALYTICS ──────────────────────────────────

app.get('/api/analytics', (_req, res) => {
    const totalItems = inventory.length;
    const totalStockValue = inventory.reduce((s, i) => s + i.price * i.stock, 0);
    const totalStock = inventory.reduce((s, i) => s + i.stock, 0);
    const lowStockCount = inventory.filter(i => i.stock < 5).length;

    // Category distribution
    const categoryMap = {};
    inventory.forEach(i => {
        categoryMap[i.category] = (categoryMap[i.category] || 0) + 1;
    });
    const categoryDistribution = Object.entries(categoryMap).map(([name, count]) => ({
        name,
        count,
        value: Math.round((count / totalItems) * 100),
    }));

    // Rarity distribution
    const rarityMap = {};
    inventory.forEach(i => {
        rarityMap[i.rarity || 'COMMON'] = (rarityMap[i.rarity || 'COMMON'] || 0) + 1;
    });
    const rarityDistribution = Object.entries(rarityMap).map(([name, count]) => ({
        name,
        count,
    }));

    // Mock stock trends (simulated weekly data)
    const stockTrends = [
        { week: 'W1', assets: totalStockValue * 0.72, items: Math.round(totalItems * 0.6) },
        { week: 'W2', assets: totalStockValue * 0.78, items: Math.round(totalItems * 0.7) },
        { week: 'W3', assets: totalStockValue * 0.65, items: Math.round(totalItems * 0.65) },
        { week: 'W4', assets: totalStockValue * 0.85, items: Math.round(totalItems * 0.8) },
        { week: 'W5', assets: totalStockValue * 0.92, items: Math.round(totalItems * 0.85) },
        { week: 'W6', assets: totalStockValue * 0.88, items: Math.round(totalItems * 0.9) },
        { week: 'W7', assets: totalStockValue * 0.95, items: Math.round(totalItems * 0.95) },
        { week: 'W8', assets: totalStockValue, items: totalItems },
    ];

    res.json({
        totalItems,
        totalStockValue,
        totalStock,
        lowStockCount,
        categoryDistribution,
        rarityDistribution,
        stockTrends,
    });
});

// ─── ROUTES: TERMINAL (Groq AI + CRUD Actions) ─────────
// Utility to parse numbers from Indonesian format (dots as thousands separators)
function parseIndoNumber(val) {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    let str = String(val).replace(/[^0-9.,]/g, '');
    str = str.replace(/\./g, ''); // Remove thousands dots
    str = str.replace(/,/g, '.'); // Convert Indonesian comma decimals to dots
    return Number(str) || 0;
}

/**
 * Generate a unique transaction ID (avoids collision on rapid multi-action)
 */
function generateTxId() {
    return `TX-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * PARSE AND EXECUTE ACTIONS FROM AI
 * This function handles the logic for different command types.
 */
function executeAction(actionJson) {
    try {
        const action = JSON.parse(actionJson);
        switch (action.type) {
            case 'ADD': {
                const { name, category, price, stock, rarity } = action.data || {};
                if (!name) return '[ERROR] ADD failed: name required.';

                // Use a robust, non-conflicting ID
                const newItemId = `item_${Date.now()}`;
                const stockVal = Number(stock) || 0;
                const priceVal = parseIndoNumber(price);

                const item = {
                    id: newItemId,
                    name: name.trim(),
                    category: (category || 'Unsorted').trim(),
                    price: priceVal,
                    stock: stockVal,
                    rarity: rarity || 'COMMON',
                    status: stockVal < 5 ? 'LOW_STOCK' : 'IN_STOCK',
                };

                stmts.insertItem.run(item.id, item.name, item.category, item.price, item.stock, item.rarity, item.status);

                // Add to activity log
                insertTransaction({
                    transaction_id: generateTxId(),
                    item_name: item.name,
                    category: item.category,
                    unit_price: item.price,
                    quantity: item.stock,
                    total: 0,
                    timestamp: new Date().toISOString(),
                    type: 'CREATE',
                    source: 'CORTEX_TERMINAL',
                });

                refreshInventory();

                return `[BERHASIL] Item dibuat (${item.id}): ${item.name} | ${item.category} | Rp${item.price.toLocaleString('id-ID')} | Stok: ${item.stock}`;
            }
            case 'UPDATE': {
                const target = action.target;
                if (!target) return '[ERROR] UPDATE gagal: target tidak ditentukan.';
                const existing = inventory.find(i => i.name.toLowerCase().includes(target.toLowerCase()));
                if (!existing) return `[ERROR] UPDATE gagal: item "${target}" tidak ditemukan.`;
                const data = action.data || {};
                const updated = {
                    name: data.name !== undefined ? String(data.name).trim() : existing.name,
                    category: data.category !== undefined ? String(data.category).trim() : existing.category,
                    price: data.price !== undefined ? parseIndoNumber(data.price) : existing.price,
                    stock: data.stock !== undefined ? Math.max(0, Number(data.stock)) : existing.stock,
                    rarity: data.rarity !== undefined ? data.rarity : existing.rarity,
                };
                updated.status = updated.stock < 5 ? 'LOW_STOCK' : 'IN_STOCK';
                stmts.updateItem.run(updated.name, updated.category, updated.price, updated.stock, updated.rarity, updated.status, existing.id);

                // Add to activity log
                insertTransaction({
                    transaction_id: generateTxId(),
                    item_name: updated.name,
                    category: updated.category,
                    unit_price: updated.price,
                    quantity: updated.stock,
                    total: 0,
                    timestamp: new Date().toISOString(),
                    type: 'UPDATE',
                    source: 'CORTEX_TERMINAL',
                });

                refreshInventory();
                return `[BERHASIL] Diperbarui (${existing.id}): ${updated.name} | Stok: ${updated.stock}`;
            }
            case 'DELETE': {
                const target = action.target;
                if (!target) return '[ERROR] DELETE gagal: target tidak ditentukan.';
                const existing = inventory.find(i => i.name.toLowerCase().includes(target.toLowerCase()));
                if (!existing) return `[ERROR] DELETE gagal: item "${target}" tidak ditemukan.`;
                stmts.deleteItem.run(existing.id);

                // Add to activity log
                insertTransaction({
                    transaction_id: generateTxId(),
                    item_name: existing.name,
                    category: existing.category,
                    unit_price: existing.price,
                    quantity: existing.stock,
                    total: 0,
                    timestamp: new Date().toISOString(),
                    type: 'DELETE',
                    source: 'CORTEX_TERMINAL',
                });

                refreshInventory();
                return `[BERHASIL] Dihapus: ${existing.name} (ID: ${existing.id}) dihapus dari inventori.`;
            }
            case 'SELL': {
                const target = action.target;
                const qty = Number(action.quantity) || 1;
                if (!target) return '[ERROR] JUAL gagal: target tidak ditentukan.';
                const item = inventory.find(i => i.name.toLowerCase().includes(target.toLowerCase()));
                if (!item) return `[ERROR] JUAL gagal: item "${target}" tidak ditemukan.`;
                if (item.stock < qty) return `[ERROR] STOK_KURANG: ${item.name} hanya punya ${item.stock} unit, tidak bisa jual ${qty}.`;
                const newStock = item.stock - qty;
                const newStatus = newStock < 5 ? 'LOW_STOCK' : 'IN_STOCK';
                stmts.updateItem.run(item.name, item.category, item.price, newStock, item.rarity, newStatus, item.id);
                const saleTx = {
                    transaction_id: generateTxId(),
                    item_name: item.name,
                    category: item.category,
                    unit_price: item.price,
                    quantity: qty,
                    total: item.price * qty,
                    timestamp: new Date().toISOString(),
                    type: 'SALE',
                    source: 'CORTEX_TERMINAL',
                };
                insertTransaction(saleTx);
                refreshInventory();
                return `[JUAL] ${item.name} ×${qty} terjual | Pendapatan: Rp${saleTx.total.toLocaleString('id-ID')} | Sisa: ${newStock} unit`;
            }
            case 'RESTOCK': {
                const target = action.target;
                const qty = Number(action.quantity) || 1;
                if (!target) return '[ERROR] RESTOCK gagal: target tidak ditentukan.';
                const item = inventory.find(i => i.name.toLowerCase().includes(target.toLowerCase()));
                if (!item) return `[ERROR] RESTOCK gagal: item "${target}" tidak ditemukan.`;
                const newStock = item.stock + qty;
                const newStatus = newStock < 5 ? 'LOW_STOCK' : 'IN_STOCK';
                stmts.updateItem.run(item.name, item.category, item.price, newStock, item.rarity, newStatus, item.id);
                const restockTx = {
                    transaction_id: generateTxId(),
                    item_name: item.name,
                    category: item.category,
                    unit_price: item.price,
                    quantity: qty,
                    total: item.price * qty,
                    timestamp: new Date().toISOString(),
                    type: 'RESTOCK',
                    source: 'CORTEX_TERMINAL',
                };
                insertTransaction(restockTx);
                refreshInventory();
                return `[RESTOCK] ${item.name} +${qty} unit diterima | Stok Baru: ${newStock} unit`;
            }
            case 'EDIT': {
                const target = action.target;
                if (!target) return '[ERROR] EDIT gagal: target tidak ditentukan.';
                const existing = inventory.find(i => i.name.toLowerCase().includes(target.toLowerCase()));
                if (!existing) return `[ERROR] EDIT gagal: item "${target}" tidak ditemukan.`;
                const oldName = existing.name;
                const edited = {
                    name: action.new_name ? String(action.new_name).trim() : existing.name,
                    category: action.new_category ? String(action.new_category).trim() : existing.category,
                    price: action.new_price !== undefined && action.new_price !== null ? parseIndoNumber(action.new_price) : existing.price,
                    stock: action.new_stock !== undefined && action.new_stock !== null ? Math.max(0, Number(action.new_stock)) : existing.stock,
                    rarity: action.new_rarity ? action.new_rarity : existing.rarity,
                };
                edited.status = edited.stock < 5 ? 'LOW_STOCK' : 'IN_STOCK';
                stmts.updateItem.run(edited.name, edited.category, edited.price, edited.stock, edited.rarity, edited.status, existing.id);

                // Add to activity log
                insertTransaction({
                    transaction_id: generateTxId(),
                    item_name: edited.name,
                    category: edited.category,
                    unit_price: edited.price,
                    quantity: edited.stock,
                    total: 0,
                    timestamp: new Date().toISOString(),
                    type: 'UPDATE',
                    source: 'CORTEX_TERMINAL',
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
            default:
                return `[ERROR] Tipe aksi tidak dikenal: ${action.type}`;
        }
    } catch (e) {
        return `[ERROR] Gagal memproses aksi: ${e.message}`;
    }
}

app.post('/api/terminal', async (req, res) => {
    const { command } = req.body;
    if (!command || typeof command !== 'string') {
        return res.status(400).json({ error: 'INVALID_INPUT: command string required' });
    }

    const cmd = command.trim();
    const ts = new Date().toISOString();
    const cmdLower = cmd.toLowerCase();

    // 'clear' is handled client-side
    if (cmdLower === 'clear') {
        return res.json({ timestamp: ts, command: cmd, output: ['[SYSTEM] Terminal cleared.'] });
    }

    // Handle manual re-indexing
    if (cmdLower === 'system reindex') {
        try {
            reindexDatabase();
            refreshInventory();
            return res.json({
                timestamp: ts,
                command: cmd,
                output: [
                    '[SYSTEM] Database re-indexing protocol initiated.',
                    `[SUCCESS] ${inventory.length} records alphabetized and re-indexed.`,
                    '[CORTEX] All item IDs have been reset to sequential order.'
                ]
            });
        } catch (err) {
            console.error('[REINDEX ERROR]', err.message);
            return res.json({
                timestamp: ts,
                command: cmd,
                output: [
                    '[SYSTEM_FAILURE] Re-indexing failed.',
                    `[DIAG] ${err.message}`
                ]
            });
        }
    }

    // ── Analytics data for CORTEX ──
    const topSellers = stmts.getTopSellers.all();
    const revenueStats = stmts.getRevenueTotal.get();
    const recentTxData = stmts.getAllTx.all().slice(0, 5);

    // ── Conversation memory ──
    const sessionId = req.headers['x-session-id'] || 'default';
    const conversationHistory = stmts.getConversation.all(sessionId).reverse();

    // Build live context for the AI
    const uptimeSec = Math.floor((Date.now() - BOOT_TIME) / 1000);
    const h = Math.floor(uptimeSec / 3600);
    const m = Math.floor((uptimeSec % 3600) / 60);
    const s = uptimeSec % 60;
    const totalValue = inventory.reduce((sum, i) => sum + i.price * i.stock, 0);
    const lowStock = inventory.filter(i => i.stock < 5);

    const inventoryContext = `
LIVE SYSTEM CONTEXT (use this data to answer queries):
- System: INSERT3COINS Core v3.0.0
- Status: ONLINE
- Uptime: ${h}h ${m}m ${s}s
- Port: ${PORT}
- Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB heap
- Security: Helmet ACTIVE, Rate-Limit ACTIVE, CORS RESTRICTED
- Total Items: ${inventory.length}
- Total Stock Value: Rp${totalValue.toLocaleString('id-ID')}
- Low Stock Alerts: ${lowStock.length} items
- Categories: ${[...new Set(inventory.map(i => i.category))].join(', ')}

EXISTING ITEMS (use for duplicate checking — do NOT create items that already exist here):
${inventory.map(i => `  - "${i.name}"`).join('\n')}

Full Inventory:
${inventory.map((item, i) => `  ${i + 1}. ${item.name} | Category: ${item.category} | Price: Rp${item.price.toLocaleString('id-ID')} | Stock: ${item.stock} | Rarity: ${item.rarity}`).join('\n')}

Low Stock Items (stock < 5):
${lowStock.length > 0 ? lowStock.map(i => `  ⚠ ${i.name} — Stock: ${i.stock}`).join('\n') : '  None'}

ANALYTICS DATA (use to answer performance/sales questions):
- Total Revenue: Rp${revenueStats.revenue.toLocaleString('id-ID')} from ${revenueStats.sale_count} sale(s)
- Top Selling Items:
${topSellers.length > 0 ? topSellers.map((s, i) => `  ${i + 1}. ${s.item_name} — ${s.total_sold} units sold, Revenue: Rp${s.total_revenue.toLocaleString('id-ID')}`).join('\n') : '  No sales recorded yet'}
- Recent Transactions:
${recentTxData.length > 0 ? recentTxData.map(t => `  [${t.type}] ${t.item_name} — Qty: ${t.quantity}, Total: Rp${(t.total || 0).toLocaleString('id-ID')}`).join('\n') : '  No transactions recorded yet'}
`;

    try {
        let text = '';
        const hasCerebras = CEREBRAS_API_KEY && CEREBRAS_API_KEY !== 'YOUR_CEREBRAS_API_KEY_HERE';

        // Build message payload (shared between Groq & Gemini)
        const userPrompt = `${inventoryContext}\n\nOPERATOR COMMAND: ${cmd}`;

        // ── Strategy: Groq first, Gemini as backup ──
        let usedEngine = 'GROQ';
        try {
            const messages = [
                { role: 'system', content: CORTEX_SYSTEM_PROMPT },
            ];
            conversationHistory.forEach(entry => {
                messages.push({ role: entry.role, content: entry.content });
            });
            messages.push({ role: 'user', content: userPrompt });

            const chatCompletion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages,
                temperature: 0.7,
                max_tokens: 500,
            });
            text = chatCompletion.choices[0]?.message?.content || '';
        } catch (groqErr) {
            console.log(`[CORTEX] Groq failed (${groqErr.status || 'unknown'}), switching to Cerebras...`);

            if (hasCerebras) {
                usedEngine = 'CEREBRAS';
                try {
                    const messages = [
                        { role: 'system', content: CORTEX_SYSTEM_PROMPT },
                    ];
                    conversationHistory.forEach(entry => {
                        messages.push({ role: entry.role, content: entry.content });
                    });
                    messages.push({ role: 'user', content: userPrompt });

                    const cerebrasRes = await fetch('https://api.cerebras.ai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${CEREBRAS_API_KEY}`,
                        },
                        body: JSON.stringify({
                            model: 'llama3.1-8b',
                            messages,
                            temperature: 0.7,
                            max_tokens: 500,
                        }),
                    });

                    if (!cerebrasRes.ok) {
                        const errBody = await cerebrasRes.text();
                        throw new Error(`Cerebras ${cerebrasRes.status}: ${errBody.slice(0, 100)}`);
                    }

                    const cerebrasData = await cerebrasRes.json();
                    text = cerebrasData.choices?.[0]?.message?.content || '';
                    console.log('[CORTEX] Cerebras backup succeeded.');
                } catch (cerebrasErr) {
                    console.error('[CORTEX CEREBRAS ERROR]', cerebrasErr.message || cerebrasErr);
                    throw new Error(`Groq rate-limited & Cerebras failed: ${cerebrasErr.message?.slice(0, 100)}`);
                }
            } else {
                throw groqErr; // No backup available
            }
        }

        if (!text) text = '[CORTEX] Tidak ada respons. Coba lagi.';
        console.log(`[CORTEX] Response via ${usedEngine} (${text.length} chars)`);

        // ── Multi-action support: find ALL action blocks ──
        const actionRegex = /<<<ACTION>>>\s*([\s\S]*?)\s*<<<END_ACTION>>>/g;
        const actionResults = [];
        let actionExec;
        while ((actionExec = actionRegex.exec(text)) !== null) {
            actionResults.push(executeAction(actionExec[1].trim()));
        }
        text = text.replace(/<<<ACTION>>>[\s\S]*?<<<END_ACTION>>>/g, '').trim();

        // ── Save conversation memory ──
        stmts.insertConversation.run(sessionId, 'user', cmd, ts);
        stmts.insertConversation.run(sessionId, 'assistant', text, ts);

        // Build output lines
        let output = text.split('\n').filter(line => line.trim() !== '');
        actionResults.forEach(result => output.push(result));

        const entry = { timestamp: ts, command: cmd, output };
        terminalLogs.push(entry);

        res.json({ timestamp: ts, command: cmd, output });
    } catch (err) {
        console.error('[CORTEX ERROR]', err.message);
        res.json({
            timestamp: ts,
            command: cmd,
            output: [
                '[KEGAGALAN_SISTEM] ████████████████████████████',
                '[ERROR] KONEKSI NEURAL TERPUTUS',
                `[DIAG]  ${err.message?.slice(0, 80) || 'Kegagalan tidak diketahui'}`,
                '[CORTEX] Mencoba menghubungkan ulang... mohon tunggu.',
            ],
        });
    }
});

// ─── SERVE FRONTEND (PRODUCTION) ───────────────────────

// Serve static files from the client/dist directory
const DIST_PATH = path.join(__dirname, '../client/dist');
app.use(express.static(DIST_PATH));

// Fallback to index.html for SPA routing (React Router)
app.get('*', (req, res) => {
    // Only handle GET requests and avoid catching API routes (handled above)
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(DIST_PATH, 'index.html'));
    } else {
        res.status(404).json({ error: 'API_ROUTE_NOT_FOUND' });
    }
});

// ─── START ──────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`\n  >> INSERT3COINS API // PORT: ${PORT} // STATUS: ONLINE`);
    console.log(`  >> SECURITY: Helmet ✓ | Rate-Limit ✓ | CORS ✓\n`);
});
