const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../services/dbStore');
const { tabelBarang } = require('../db/schema');

router.post('/', async (req, res) => {
  try {
    const { nama_barang, stok, kategori } = req.body;

    // 1. Buat UUID unik di Node.js SEBELUM masuk ke database
    const idBaru = crypto.randomUUID(); 

    // 2. Masukkan ke dalam SQLite menggunakan Drizzle
    db.insert(tabelBarang).values({
      id: idBaru, // Masukkan UUID yang baru dibuat
      nama_barang: nama_barang,
      stok: stok,
      kategori: kategori
    }).run(); // Note: Better-sqlite3 is synchronous, use .run() instead of await

    // 3. Kembalikan respons sukses ke Frontend
    res.status(201).json({ 
      pesan: "Barang berhasil ditambahkan!", 
      id_barang: idBaru 
    });

  } catch (error) {
    console.error("Gagal menambah barang:", error);
    res.status(500).json({ pesan: "Terjadi kesalahan di server" });
  }
});

module.exports = router;
