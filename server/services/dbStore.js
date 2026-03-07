const Database = require('better-sqlite3');
const path = require('path');

// ─── SQLite DATABASE ────────────────────────────────────
const DB_PATH = path.join(__dirname, '../inventory.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Ensure tables exist
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

// ─── SAFE MIGRATION: Add bab & sub_bab columns ─────────
try { db.exec(`ALTER TABLE items ADD COLUMN bab TEXT NOT NULL DEFAULT 'Uncategorized'`); } catch (_) { }
try { db.exec(`ALTER TABLE items ADD COLUMN sub_bab TEXT NOT NULL DEFAULT 'Uncategorized'`); } catch (_) { }
try { db.exec(`UPDATE items SET bab = category WHERE bab = 'Uncategorized' AND category IS NOT NULL AND category != ''`); } catch (_) { }

// Prepared statements
const stmts = {
    getAllItems: db.prepare('SELECT * FROM items ORDER BY name COLLATE NOCASE'),
    getItemById: db.prepare('SELECT * FROM items WHERE id = ?'),
    insertItem: db.prepare('INSERT INTO items (id, name, category, price, stock, rarity, status, bab, sub_bab) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    updateItem: db.prepare('UPDATE items SET name = ?, category = ?, price = ?, stock = ?, rarity = ?, status = ?, bab = ?, sub_bab = ? WHERE id = ?'),
    deleteItem: db.prepare('DELETE FROM items WHERE id = ?'),
    countItems: db.prepare('SELECT COUNT(*) as cnt FROM items'),
    deleteAll: db.prepare('DELETE FROM items'),
    insertTx: db.prepare('INSERT INTO transactions (transaction_id, item_name, category, unit_price, quantity, total, timestamp, type, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    getRecentTx: db.prepare('SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 10'),
    searchItems: db.prepare('SELECT * FROM items WHERE name LIKE ? OR category LIKE ? OR bab LIKE ? OR sub_bab LIKE ? ORDER BY name COLLATE NOCASE'),
    getTopSellers: db.prepare(`SELECT item_name, SUM(quantity) as total_sold, SUM(total) as total_revenue FROM transactions WHERE type = 'SALE' GROUP BY item_name ORDER BY total_sold DESC LIMIT 5`),
    getRevenueTotal: db.prepare(`SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as sale_count FROM transactions WHERE type = 'SALE'`),
    getDailyTrends: db.prepare(`SELECT strftime('%Y-%m-%d', timestamp) as day, SUM(total) as revenue, SUM(quantity) as items FROM transactions WHERE type = 'SALE' GROUP BY day ORDER BY day DESC LIMIT 7`),
    getAllTx: db.prepare('SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 20'),
    getConversation: db.prepare('SELECT role, content FROM conversations WHERE session_id = ? ORDER BY id DESC LIMIT 10'),
    insertConversation: db.prepare('INSERT INTO conversations (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)'),
    clearConversation: db.prepare('DELETE FROM conversations WHERE session_id = ?'),
};

// State
const state = {
    inventory: stmts.getAllItems.all(),
    terminalLogs: [],
    readNotificationIds: new Set(),
    BOOT_TIME: Date.now()
};

console.log(`>> Loaded ${state.inventory.length} items from SQLite`);

const refreshInventory = () => {
    state.inventory = stmts.getAllItems.all();
};

const insertTransaction = (tx) => {
    stmts.insertTx.run(
        tx.transaction_id, tx.item_name, tx.category || null,
        tx.unit_price || 0, tx.quantity || 0, tx.total || 0,
        tx.timestamp || null, tx.type || null, tx.source || null
    );
};

const reindexDatabase = db.transaction(() => {
    const allItems = stmts.getAllItems.all();
    allItems.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    stmts.deleteAll.run();
    allItems.forEach((item, index) => {
        const newId = `#${String(index + 1).padStart(3, '0')}`;
        stmts.insertItem.run(newId, item.name, item.category, item.price, item.stock, item.rarity, item.status, item.bab || 'Uncategorized', item.sub_bab || 'Uncategorized');
    });
    console.log(`>> Database Re-indexed. ${allItems.length} items sorted A-Z.`);
});

module.exports = {
    db,
    stmts,
    state,
    refreshInventory,
    insertTransaction,
    reindexDatabase
};
