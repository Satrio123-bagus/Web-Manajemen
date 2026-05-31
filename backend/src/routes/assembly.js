const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const {
    db,
    betterSqlite,
    insertTransaction,
    stmts,
} = require("../models/dbStore");
const schema = require("../db/schema");
const { items, bom_recipes } = schema;
const { eq, like, desc, sql } = require("drizzle-orm");

// 1. Ambil data WIP (Tanpa Mika) dan ketersediaan stok Mika
router.get("/wip", async (req, res) => {
    try {
        // Cari semua barang yang berstatus WIP Tanpa Mika
        const wipItems = await db
            .select()
            .from(items)
            .where(like(items.name, "%(Tanpa Mika)%"))
            .all();

        // Cari ketersediaan Mika di inventory (nama persis "Mika" atau yang mengandung kata Mika)
        // Menurut instruksi pengguna: tulis saja hanya dengan kata "Mika"
        let mikaStock = await db
            .select()
            .from(items)
            .where(eq(items.name, "Mika"))
            .get();

        if (!mikaStock) {
            // Fallback jika huruf besar/kecil berbeda
            mikaStock = await db
                .select()
                .from(items)
                .where(like(items.name, "%Mika%"))
                .get();
        }

        res.json({
            success: true,
            wip: wipItems.filter((item) => item.stock > 0), // Hanya tampilkan yang stoknya ada
            mika: mikaStock || { name: "Mika", stock: 0 },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: "Gagal memuat data WIP",
        });
    }
});

// 2. Proses Rakit Mika
router.post("/assemble", async (req, res) => {
    const { wip_id, mika_id, quantity } = req.body;

    if (!wip_id || !quantity || quantity <= 0) {
        return res
            .status(400)
            .json({ success: false, error: "Data perakitan tidak valid" });
    }

    try {
        const assemblyTx = betterSqlite.transaction(() => {
            // A. Dapatkan item WIP
            const wipItem = db
                .select()
                .from(items)
                .where(eq(items.id, wip_id))
                .get();
            if (!wipItem) throw new Error("Item WIP tidak ditemukan");
            if (wipItem.stock < quantity)
                throw new Error(
                    `Stok ${wipItem.name} tidak mencukupi (Hanya ada ${wipItem.stock})`
                );

            // B. Dapatkan item Mika (gunakan ID atau fallback cari by name "Mika")
            let mikaItem;
            if (mika_id) {
                mikaItem = db
                    .select()
                    .from(items)
                    .where(eq(items.id, mika_id))
                    .get();
            } else {
                mikaItem = db
                    .select()
                    .from(items)
                    .where(like(items.name, "%Mika%"))
                    .get();
            }
            if (!mikaItem)
                throw new Error("Komponen Mika tidak ditemukan di gudang");
            if (mikaItem.stock < quantity)
                throw new Error(
                    `Stok ${mikaItem.name} tidak mencukupi (Hanya ada ${mikaItem.stock})`
                );

            // C. Potong Stok WIP & Mika
            const newWipStock = wipItem.stock - quantity;
            db.update(items)
                .set({
                    stock: newWipStock,
                    status: newWipStock < 2 ? "LOW_STOCK" : "IN_STOCK",
                })
                .where(eq(items.id, wipItem.id))
                .run();

            const newMikaStock = mikaItem.stock - quantity;
            db.update(items)
                .set({
                    stock: newMikaStock,
                    status: newMikaStock < 2 ? "LOW_STOCK" : "IN_STOCK",
                })
                .where(eq(items.id, mikaItem.id))
                .run();

            // D. Tentukan Nama Barang Jadi
            // Menghilangkan kata "(Tanpa Mika)"
            let finalName = wipItem.name
                .replace(/\s*\(Tanpa Mika\)\s*/gi, "")
                .trim();

            // Cek apakah finalName ini merupakan remote Panasonic yang ada di Buku Resep BOM
            const recipe = stmts.getRecipeByRemote.get(finalName);
            let isWipTutup = false;

            if (recipe) {
                // Konversi JIT: Panasonic yang dirakit mika, tapi tetap tanpa tutup
                finalName = `${finalName} (Tanpa Tutup)`;
                isWipTutup = true;
            }

            // E. Tambah / Buat Stok Barang Jadi
            let finalItem = db
                .select()
                .from(items)
                .where(eq(items.name, finalName))
                .get();

            if (finalItem) {
                // Update stok existing
                const newFinalStock = finalItem.stock + quantity;
                db.update(items)
                    .set({
                        stock: newFinalStock,
                        status: newFinalStock < 2 ? "LOW_STOCK" : "IN_STOCK",
                    })
                    .where(eq(items.id, finalItem.id))
                    .run();
            } else {
                // Buat item baru di gudang
                const newId = crypto.randomUUID();
                db.insert(items)
                    .values({
                        id: newId,
                        name: finalName,
                        category: wipItem.category || "REMOTE",
                        price: wipItem.price || 0,
                        stock: quantity,
                        status: quantity < 2 ? "LOW_STOCK" : "IN_STOCK",
                        bab: wipItem.bab || "Uncategorized",
                        sub_bab: wipItem.sub_bab || "Uncategorized",
                        location: wipItem.location || "Belum Ditentukan",
                        condition: "READY",
                    })
                    .run();
            }

            // F. Log Transaksi Perakitan (Traceability)
            const txTime = new Date().toISOString();

            // Pemakaian WIP
            insertTransaction({
                transaction_id: crypto.randomUUID(),
                item_name: wipItem.name,
                category: wipItem.category,
                unit_price: wipItem.price,
                quantity: quantity,
                total: 0, // Produksi internal tidak mencatat omzet
                timestamp: txTime,
                type: "ASSEMBLY_CONSUMED",
                source: "STASIUN_RAKIT",
            });

            // Pemakaian Mika
            insertTransaction({
                transaction_id: crypto.randomUUID(),
                item_name: mikaItem.name,
                category: mikaItem.category,
                unit_price: mikaItem.price,
                quantity: quantity,
                total: 0,
                timestamp: txTime,
                type: "ASSEMBLY_CONSUMED",
                source: "STASIUN_RAKIT",
            });

            // Hasil Produksi
            insertTransaction({
                transaction_id: crypto.randomUUID(),
                item_name: finalName,
                category: wipItem.category,
                unit_price: wipItem.price,
                quantity: quantity,
                total: 0,
                timestamp: txTime,
                type: "ASSEMBLY_PRODUCED",
                source: "STASIUN_RAKIT",
            });

            return {
                message: "Perakitan berhasil",
                hasil: finalName,
                quantity: quantity,
                isWipTutup: isWipTutup,
            };
        });

        const result = assemblyTx();
        res.json({ success: true, ...result });
    } catch (err) {
        console.error(err);
        res.status(400).json({
            success: false,
            error: err.message || "Gagal melakukan perakitan",
        });
    }
});

module.exports = router;
