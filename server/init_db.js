/**
 * init_db.js — Initialize SQLite database and migrate data from JSON files.
 * Run once: node init_db.js
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'inventory.db');
const DATA_FILE = path.join(__dirname, 'data.json');
const TX_FILE = path.join(__dirname, 'transactions.json');

// Create or open database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // Better concurrent read performance

console.log('>> Creating tables...');

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
`);

console.log('>> Tables created.');

// ─── Migrate items from data.json ───────────────────────

let itemCount = 0;
try {
    const items = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    const insert = db.prepare(`
        INSERT OR REPLACE INTO items (id, name, category, price, stock, rarity, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((rows) => {
        for (const item of rows) {
            insert.run(
                item.id,
                item.name,
                item.category || 'MISC',
                Number(item.price) || 0,
                Number(item.stock) || 0,
                item.rarity || 'COMMON',
                item.status || (Number(item.stock) < 5 ? 'LOW_STOCK' : 'IN_STOCK')
            );
        }
    });

    insertMany(items);
    itemCount = items.length;
    console.log(`>> Migrated ${itemCount} items from data.json`);
} catch (e) {
    console.log(`>> No data.json found or parse error: ${e.message}`);
}

// ─── Migrate transactions from transactions.json ────────

let txCount = 0;
try {
    const txs = JSON.parse(fs.readFileSync(TX_FILE, 'utf-8'));
    const insert = db.prepare(`
        INSERT OR REPLACE INTO transactions (transaction_id, item_name, category, unit_price, quantity, total, timestamp, type, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((rows) => {
        for (const tx of rows) {
            insert.run(
                tx.transaction_id,
                tx.item_name,
                tx.category || null,
                Number(tx.unit_price) || 0,
                Number(tx.quantity) || 0,
                Number(tx.total) || 0,
                tx.timestamp || null,
                tx.type || null,
                tx.source || null
            );
        }
    });

    insertMany(txs);
    txCount = txs.length;
    console.log(`>> Migrated ${txCount} transactions from transactions.json`);
} catch (e) {
    console.log(`>> No transactions.json found or parse error: ${e.message}`);
}

db.close();

console.log('\n  ══════════════════════════════════════════');
console.log(`  ✓ Database created: ${DB_PATH}`);
console.log(`  ✓ Items:        ${itemCount}`);
console.log(`  ✓ Transactions: ${txCount}`);
console.log('  ══════════════════════════════════════════\n');
