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
    location: text('location').notNull().default('Belum Ditentukan'),
    condition: text('condition').notNull().default('READY'),
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

const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    username: text('username').notNull().unique(),
    password_hash: text('password_hash').notNull(),
    role: text('role').notNull().default('CASING'), // CASING, MESIN, ADMIN
});

const production_jobs = sqliteTable('production_jobs', {
    id: text('id').primaryKey(),
    tipe_remote: text('tipe_remote').notNull(),
    komponen: text('komponen').notNull(), // CASING, MESIN, LAYAR
    kriteria: text('kriteria'), // Baut, Tidak Baut, dll
    status: text('status').notNull().default('MENTAH'), // MENTAH, PROSES, QC_CEK, SELESAI_JUAL, SELESAI_RAKIT, RUSAK
    catatan: text('catatan'),
    alokasi: integer('alokasi').default(1),
    assigned_to: text('assigned_to'), // ID user (opsional)
    timestamp: text('timestamp'),
    supplier: text('supplier').notNull().default('Campuran (Lama)'),
});

const supply_reports = sqliteTable('supply_reports', {
    id: text('id').primaryKey(),
    pekerja: text('pekerja').notNull(), // username
    laporan: text('laporan').notNull(),
    status: text('status').notNull().default('PENDING'), // PENDING, RESOLVED
    timestamp: text('timestamp'),
});

const supplier_analytics_rollup = sqliteTable('supplier_analytics_rollup', {
    id: text('id').primaryKey(),
    bulan: text('bulan').notNull(), // format YYYY-MM
    supplier: text('supplier').notNull(),
    tipe_remote: text('tipe_remote').notNull(),
    total_bagus: integer('total_bagus').default(0),
    total_rusak: integer('total_rusak').default(0),
    timestamp: text('timestamp'),
});

module.exports = {
    items,
    transactions,
    conversations,
    tabelBarang,
    users,
    production_jobs,
    supply_reports,
    supplier_analytics_rollup,
};
