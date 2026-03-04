const Database = require('better-sqlite3');
const path = require('path');

// Menentukan lokasi file database (akan dibuat otomatis di folder server)
const dbPath = path.resolve(__dirname, '../web_manajemen.db');

// Membuka koneksi (langsung berjalan seketika karena ini sinkron/synchronous)
// { verbose: console.log } akan mencetak semua perintah SQL ke terminal (sangat berguna untuk debugging)
const db = new Database(dbPath, { verbose: console.log });

console.log('✅ Berhasil terhubung ke SQLite menggunakan better-sqlite3.');

// Membuat tabel dasar untuk Web-Manajemen jika belum ada
db.exec(`
  CREATE TABLE IF NOT EXISTS produk_asli (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT,
    kategori TEXT,
    stok INTEGER,
    harga INTEGER
  );
`);

// Mengekspor koneksi agar bisa dipakai di file router utama
module.exports = db;
