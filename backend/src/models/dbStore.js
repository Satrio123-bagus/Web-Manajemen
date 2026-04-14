const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const { eq, sum, count, desc, like, or, sql } = require('drizzle-orm');
const schema = require('../db/schema');
const { items, transactions, conversations } = schema;

// ─── SQLite DATABASE + DRIZZLE ORM ──────────────────────
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
const DB_PATH = path.join(dataDir, 'inventory.db');
const betterSqlite = new Database(DB_PATH);
betterSqlite.pragma('journal_mode = WAL');

// Ensure tables exist natively first (fallback while moving to Drizzle Kit migrations)
betterSqlite.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'MISC',
    price    INTEGER DEFAULT 0,
    stock    INTEGER DEFAULT 0,
    rarity   TEXT DEFAULT 'BIASA',
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
  CREATE TABLE IF NOT EXISTS barang (
    id TEXT PRIMARY KEY,
    nama_barang TEXT NOT NULL,
    stok INTEGER NOT NULL DEFAULT 0,
    kategori TEXT
  );
`);
try { betterSqlite.exec(`ALTER TABLE items ADD COLUMN bab TEXT NOT NULL DEFAULT 'Uncategorized'`); } catch (_) { }
try { betterSqlite.exec(`ALTER TABLE items ADD COLUMN sub_bab TEXT NOT NULL DEFAULT 'Uncategorized'`); } catch (_) { }
try { betterSqlite.exec(`UPDATE items SET bab = category WHERE bab = 'Uncategorized' AND category IS NOT NULL AND category != ''`); } catch (_) { }

// Initialize Drizzle ORM
const db = drizzle(betterSqlite, { schema });

// Wrapper to mimic the old prepared statements API using Drizzle ORM to maintain backward compatibility with routes
const stmts = {
  getAllItems: {
    all: () => db.select().from(items).orderBy(sql`${items.name} COLLATE NOCASE`).all()
  },
  getPaginatedItems: {
    all: (limit, offset) => db.select().from(items).orderBy(sql`${items.name} COLLATE NOCASE`).limit(limit).offset(offset).all()
  },
  getItemById: {
    get: (id) => db.select().from(items).where(eq(items.id, id)).get()
  },
  insertItem: {
    run: (id, name, category, price, stock, rarity, status, bab, sub_bab) =>
      db.insert(items).values({ id, name, category, price, stock, rarity, status, bab, sub_bab }).run()
  },
  updateItem: {
    run: (name, category, price, stock, rarity, status, bab, sub_bab, id) =>
      db.update(items).set({ name, category, price, stock, rarity, status, bab, sub_bab }).where(eq(items.id, id)).run()
  },
  deleteItem: {
    run: (id) => db.delete(items).where(eq(items.id, id)).run()
  },
  countItems: {
    get: () => {
      const result = db.select({ cnt: count() }).from(items).get();
      return result;
    }
  },
  deleteAll: {
    run: () => db.delete(items).run()
  },
  insertTx: {
    run: (transaction_id, item_name, category, unit_price, quantity, total, timestamp, type, source) =>
      db.insert(transactions).values({ transaction_id, item_name, category, unit_price, quantity, total, timestamp, type, source }).run()
  },
  getRecentTx: {
    all: () => db.select().from(transactions).orderBy(desc(transactions.timestamp)).limit(10).all()
  },
  searchItems: {
    all: (term1, term2, term3, term4) =>
      db.select().from(items).where(or(
        like(items.name, term1),
        like(items.category, term2),
        like(items.bab, term3),
        like(items.sub_bab, term4)
      )).orderBy(sql`${items.name} COLLATE NOCASE`).all()
  },
  getTopSellers: {
    all: () => db.select({
      item_name: transactions.item_name,
      total_sold: sql`SUM(${transactions.quantity})`.mapWith(Number),
      total_revenue: sql`SUM(${transactions.total})`.mapWith(Number)
    }).from(transactions).where(eq(transactions.type, 'SALE')).groupBy(transactions.item_name).orderBy(desc(sql`SUM(${transactions.quantity})`)).limit(5).all()
  },
  getRevenueTotal: {
    get: () => {
      const res = db.select({
        revenue: sql`COALESCE(SUM(${transactions.total}), 0)`.mapWith(Number),
        sale_count: count()
      }).from(transactions).where(eq(transactions.type, 'SALE')).get();
      return res || { revenue: 0, sale_count: 0 };
    }
  },
  getDailyTrends: {
    all: () => db.select({
      day: sql`strftime('%Y-%m-%d', ${transactions.timestamp})`,
      revenue: sql`SUM(${transactions.total})`.mapWith(Number),
      items: sql`SUM(${transactions.quantity})`.mapWith(Number)
    }).from(transactions).where(eq(transactions.type, 'SALE')).groupBy(sql`strftime('%Y-%m-%d', ${transactions.timestamp})`).orderBy(desc(sql`strftime('%Y-%m-%d', ${transactions.timestamp})`)).limit(7).all()
  },
  getAllTx: {
    all: () => db.select().from(transactions).orderBy(desc(transactions.timestamp)).limit(20).all()
  },
  getLastTransaction: {
    get: () => db.select().from(transactions).orderBy(desc(transactions.timestamp)).limit(1).get()
  },
  deleteTx: {
    run: (id) => db.delete(transactions).where(eq(transactions.transaction_id, id)).run()
  },
  getConversation: {
    all: (sessionId) => db.select({ role: conversations.role, content: conversations.content }).from(conversations).where(eq(conversations.session_id, sessionId)).orderBy(desc(conversations.id)).limit(10).all()
  },
  insertConversation: {
    run: (session_id, role, content, timestamp) => db.insert(conversations).values({ session_id, role, content, timestamp }).run()
  },
  clearConversation: {
    run: (sessionId) => db.delete(conversations).where(eq(conversations.session_id, sessionId)).run()
  },
};

const state = {
  inventory: stmts.getAllItems.all(),
  terminalLogs: [],
  readNotificationIds: new Set(),
  BOOT_TIME: Date.now()
};

console.log(`>> Loaded ${state.inventory.length} items from SQLite via Drizzle ORM`);

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

const reindexDatabase = betterSqlite.transaction(() => {
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
