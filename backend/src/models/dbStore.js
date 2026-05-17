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
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'DAILY',
    content TEXT NOT NULL,
    generated_by TEXT DEFAULT 'HERMES_3B',
    timestamp TEXT
  );
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_tx_type_time ON transactions(type, timestamp);
  CREATE INDEX IF NOT EXISTS idx_tx_item_name ON transactions(item_name);
`);
try { betterSqlite.exec(`ALTER TABLE items ADD COLUMN bab TEXT NOT NULL DEFAULT 'Uncategorized'`); } catch (_) { }
try { betterSqlite.exec(`ALTER TABLE items ADD COLUMN sub_bab TEXT NOT NULL DEFAULT 'Uncategorized'`); } catch (_) { }
try { betterSqlite.exec(`ALTER TABLE items ADD COLUMN location TEXT NOT NULL DEFAULT 'Belum Ditentukan'`); } catch (_) { }
try { betterSqlite.exec(`ALTER TABLE items ADD COLUMN condition TEXT NOT NULL DEFAULT 'READY'`); } catch (_) { }
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
    run: (id, name, category, price, stock, rarity, status, bab, sub_bab, location, condition) =>
      db.insert(items).values({ id, name, category, price, stock, rarity, status, bab, sub_bab, location: location || 'Belum Ditentukan', condition: condition || 'READY' }).run()
  },
  updateItem: {
    run: (name, category, price, stock, rarity, status, bab, sub_bab, id, location, condition) =>
      db.update(items).set({ name, category, price, stock, rarity, status, bab, sub_bab, location: location || undefined, condition: condition || undefined }).where(eq(items.id, id)).run()
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
        like(items.sub_bab, term4),
        like(items.location, term1)
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
  getSalesTrends: {
    // period: 'daily' (24h/hours), 'weekly' (7 days), 'monthly' (30 days), 'yearly' (12 months)
    all: (period) => {
      let groupSql, orderSql, limit, whereSql;
      if (period === 'daily') {
        // Last 24 hours grouped by hour
        whereSql = sql`${transactions.timestamp} >= datetime('now', '-1 day', 'localtime')`;
        groupSql = sql`strftime('%H:00', ${transactions.timestamp})`;
        orderSql = desc(sql`strftime('%Y-%m-%d %H:00', ${transactions.timestamp})`);
        limit = 24;
      } else if (period === 'weekly') {
        whereSql = sql`${transactions.timestamp} >= datetime('now', '-7 days', 'localtime')`;
        groupSql = sql`strftime('%Y-%m-%d', ${transactions.timestamp})`;
        orderSql = desc(sql`strftime('%Y-%m-%d', ${transactions.timestamp})`);
        limit = 7;
      } else if (period === 'yearly') {
        whereSql = sql`${transactions.timestamp} >= datetime('now', '-1 year', 'localtime')`;
        groupSql = sql`strftime('%Y-%m', ${transactions.timestamp})`;
        orderSql = desc(sql`strftime('%Y-%m', ${transactions.timestamp})`);
        limit = 12;
      } else { // monthly (default)
        whereSql = sql`${transactions.timestamp} >= datetime('now', '-30 days', 'localtime')`;
        groupSql = sql`strftime('%Y-%m-%d', ${transactions.timestamp})`;
        orderSql = desc(sql`strftime('%Y-%m-%d', ${transactions.timestamp})`);
        limit = 30;
      }

      return db.select({
        time_label: groupSql,
        revenue: sql`SUM(${transactions.total})`.mapWith(Number),
        items: sql`SUM(${transactions.quantity})`.mapWith(Number)
      }).from(transactions)
        .where(sql`${transactions.type} = 'SALE' AND ${whereSql}`)
        .groupBy(groupSql)
        .orderBy(orderSql)
        .limit(limit)
        .all();
    }
  },
  getSalesStats: {
    get: (period) => {
      let whereSql;
      if (period === 'daily') whereSql = sql`${transactions.timestamp} >= datetime('now', '-1 day', 'localtime')`;
      else if (period === 'weekly') whereSql = sql`${transactions.timestamp} >= datetime('now', '-7 days', 'localtime')`;
      else if (period === 'yearly') whereSql = sql`${transactions.timestamp} >= datetime('now', '-1 year', 'localtime')`;
      else whereSql = sql`${transactions.timestamp} >= datetime('now', '-30 days', 'localtime')`; // monthly default

      const res = db.select({
        total_revenue: sql`COALESCE(SUM(${transactions.total}), 0)`.mapWith(Number),
        total_items: sql`COALESCE(SUM(${transactions.quantity}), 0)`.mapWith(Number),
        tx_count: count()
      }).from(transactions).where(sql`${transactions.type} = 'SALE' AND ${whereSql}`).get();
      return res || { total_revenue: 0, total_items: 0, tx_count: 0 };
    }
  },
  getTopSellersPeriod: {
    all: (period) => {
      let whereSql;
      if (period === 'daily') whereSql = sql`${transactions.timestamp} >= datetime('now', '-1 day', 'localtime')`;
      else if (period === 'weekly') whereSql = sql`${transactions.timestamp} >= datetime('now', '-7 days', 'localtime')`;
      else if (period === 'yearly') whereSql = sql`${transactions.timestamp} >= datetime('now', '-1 year', 'localtime')`;
      else whereSql = sql`${transactions.timestamp} >= datetime('now', '-30 days', 'localtime')`;

      return db.select({
        item_name: transactions.item_name,
        total_sold: sql`SUM(${transactions.quantity})`.mapWith(Number),
        total_revenue: sql`SUM(${transactions.total})`.mapWith(Number)
      }).from(transactions).where(sql`${transactions.type} = 'SALE' AND ${whereSql}`)
      .groupBy(transactions.item_name).orderBy(desc(sql`SUM(${transactions.total})`)).limit(5).all()
    }
  },
  getSalesCategoryDistribution: {
    all: (period) => {
      let whereSql;
      if (period === 'daily') whereSql = sql`${transactions.timestamp} >= datetime('now', '-1 day', 'localtime')`;
      else if (period === 'weekly') whereSql = sql`${transactions.timestamp} >= datetime('now', '-7 days', 'localtime')`;
      else if (period === 'yearly') whereSql = sql`${transactions.timestamp} >= datetime('now', '-1 year', 'localtime')`;
      else whereSql = sql`${transactions.timestamp} >= datetime('now', '-30 days', 'localtime')`;

      return db.select({
        name: sql`COALESCE(${transactions.category}, 'Uncategorized')`,
        count: sql`SUM(${transactions.quantity})`.mapWith(Number)
      }).from(transactions).where(sql`${transactions.type} = 'SALE' AND ${whereSql}`)
      .groupBy(sql`COALESCE(${transactions.category}, 'Uncategorized')`)
      .orderBy(desc(sql`SUM(${transactions.quantity})`)).all()
    }
  },
  getDeadStock: {
    all: () => {
      // Items with stock > 0 but no sales in the last 30 days
      // ─── OPTIMIZED: NOT EXISTS lebih efisien dari NOT IN ──────────────
      // NOT EXISTS berhenti mencari begitu menemukan 1 match,
      // sedangkan NOT IN harus evaluate seluruh subquery result.
      return db.select({
        id: items.id,
        name: items.name,
        stock: items.stock,
        price: items.price,
        value: sql`${items.stock} * ${items.price}`.mapWith(Number)
      }).from(items)
      .where(sql`${items.stock} > 0 AND NOT EXISTS (SELECT 1 FROM ${transactions} WHERE ${transactions.item_name} = ${items.name} AND ${transactions.timestamp} >= datetime('now', '-30 days', 'localtime'))`)
      .orderBy(desc(sql`${items.stock} * ${items.price}`))
      .limit(5)
      .all();
    }
  },
  getAllTx: {
    all: () => db.select().from(transactions).orderBy(desc(transactions.timestamp)).limit(20).all()
  },
  getAllTxPaginated: {
    // Ambil semua transaksi dengan limit besar untuk halaman History
    all: (limit = 200, offset = 0) => db.select().from(transactions)
      .orderBy(desc(transactions.timestamp))
      .limit(limit)
      .offset(offset)
      .all()
  },
  getAllTxPaginatedByType: {
    // Ambil transaksi yang sudah difilter berdasarkan tipe (lebih efisien daripada filter di JS)
    all: (type, limit = 200, offset = 0) => db.select().from(transactions)
      .where(eq(transactions.type, type))
      .orderBy(desc(transactions.timestamp))
      .limit(limit)
      .offset(offset)
      .all()
  },
  countTxByType: {
    get: (type) => {
      const result = db.select({ cnt: count() }).from(transactions).where(eq(transactions.type, type)).get();
      return result?.cnt || 0;
    }
  },
  countTx: {
    get: () => {
      const result = db.select({ cnt: count() }).from(transactions).get();
      return result?.cnt || 0;
    }
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
  // ─── Hermes Agent: Reports ─────────────────────────────────────────
  insertReport: {
    run: (date, type, content, generatedBy, timestamp) => {
      const stmt = betterSqlite.prepare('INSERT INTO reports (date, type, content, generated_by, timestamp) VALUES (?, ?, ?, ?, ?)');
      return stmt.run(date, type, content, generatedBy, timestamp);
    }
  },
  getReports: {
    all: (limit = 10) => {
      const stmt = betterSqlite.prepare('SELECT * FROM reports ORDER BY id DESC LIMIT ?');
      return stmt.all(limit);
    }
  },
  getLatestReport: {
    get: () => {
      const stmt = betterSqlite.prepare('SELECT * FROM reports ORDER BY id DESC LIMIT 1');
      return stmt.get();
    }
  },
  // ─── Push Notifications: Subscriptions ──────────────────────────────────
  insertPushSub: {
    run: (endpoint, p256dh, auth, userAgent) => {
      const stmt = betterSqlite.prepare(
        'INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth, user_agent, created_at) VALUES (?, ?, ?, ?, ?)'
      );
      return stmt.run(endpoint, p256dh, auth, userAgent || '', new Date().toISOString());
    }
  },
  deletePushSub: {
    run: (endpoint) => {
      const stmt = betterSqlite.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?');
      return stmt.run(endpoint);
    }
  },
  getAllPushSubs: {
    all: () => betterSqlite.prepare('SELECT * FROM push_subscriptions').all()
  },
  countPushSubs: {
    get: () => betterSqlite.prepare('SELECT COUNT(*) as cnt FROM push_subscriptions').get()
  },
  // ─── Optimized Inventory Stats (menggantikan loop JS di analytics) ──────
  getInventoryStats: {
    get: () => {
      const res = db.select({
        totalItems: count(),
        totalStock: sql`COALESCE(SUM(${items.stock}), 0)`.mapWith(Number),
        totalStockValue: sql`COALESCE(SUM(${items.price} * ${items.stock}), 0)`.mapWith(Number),
        lowStockCount: sql`COALESCE(SUM(CASE WHEN ${items.stock} < 2 THEN 1 ELSE 0 END), 0)`.mapWith(Number),
      }).from(items).get();
      return res || { totalItems: 0, totalStock: 0, totalStockValue: 0, lowStockCount: 0 };
    }
  },
  getLowStockItems: {
    all: () => db.select({
      id: items.id, name: items.name, category: items.category,
      price: items.price, stock: items.stock, rarity: items.rarity, bab: items.bab
    }).from(items).where(sql`${items.stock} < 2`).orderBy(items.name).all()
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
  betterSqlite,
  stmts,
  state,
  refreshInventory,
  insertTransaction,
  reindexDatabase
};
