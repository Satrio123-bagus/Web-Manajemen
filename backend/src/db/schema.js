const { sqliteTable, text, integer } = require('drizzle-orm/sqlite-core');

const items = sqliteTable('items', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    category: text('category').notNull().default('MISC'),
    price: integer('price').default(0),
    stock: integer('stock').default(0),
    rarity: text('rarity').default('COMMON'),
    status: text('status').default('IN_STOCK'),
    bab: text('bab').notNull().default('Uncategorized'),
    sub_bab: text('sub_bab').notNull().default('Uncategorized'),
});

const transactions = sqliteTable('transactions', {
    transaction_id: text('transaction_id').primaryKey(),
    item_name: text('item_name').notNull(),
    category: text('category'),
    unit_price: integer('unit_price').default(0),
    quantity: integer('quantity').default(0),
    total: integer('total').default(0),
    timestamp: text('timestamp'),
    type: text('type'),
    source: text('source'),
});

const conversations = sqliteTable('conversations', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    session_id: text('session_id').notNull(),
    role: text('role').notNull(),
    content: text('content').notNull(),
    timestamp: text('timestamp'),
});

const tabelBarang = sqliteTable('barang', {
    id: text('id').primaryKey(),
    nama_barang: text('nama_barang').notNull(),
    stok: integer('stok').notNull().default(0),
    kategori: text('kategori')
});

module.exports = {
    items,
    transactions,
    conversations,
    tabelBarang,
};
