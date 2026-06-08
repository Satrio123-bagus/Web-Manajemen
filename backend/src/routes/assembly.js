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

        // Ambil semua item Mika
        const allMikas = await db
            .select()
            .from(items)
            .where(like(items.name, "Mika%"))
            .all();

        const mikaStocks = allMikas.filter((m) => !m.name.includes("Poles"));
        const reworkMikaStocks = allMikas.filter((m) =>
            m.name.includes("Poles Ulang")
        );

        // Ambil BOM Recipes
        const recipes = await db.select().from(bom_recipes).all();

        res.json({
            success: true,
            wip: wipItems.filter((item) => item.stock > 0),
            mikaStocks: mikaStocks,
            reworkMikaStocks: reworkMikaStocks,
            recipes: recipes,
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
// 3. Lapor Mika Rusak / Kusam (Admin)
router.post("/defect-mika", async (req, res) => {
    const { mika_id, quantity } = req.body;
    if (!quantity || quantity <= 0)
        return res
            .status(400)
            .json({ success: false, error: "Jumlah tidak valid" });

    try {
        const defectTx = betterSqlite.transaction(() => {
            let mikaItem;
            if (mika_id) {
                mikaItem = db
                    .select()
                    .from(items)
                    .where(eq(items.id, mika_id))
                    .get();
            } else {
                mikaItem =
                    db
                        .select()
                        .from(items)
                        .where(eq(items.name, "Mika"))
                        .get() ||
                    db
                        .select()
                        .from(items)
                        .where(like(items.name, "%Mika%"))
                        .get();
            }
            if (!mikaItem) throw new Error("Komponen Mika tidak ditemukan");
            if (mikaItem.stock < quantity)
                throw new Error("Stok Mika tidak mencukupi untuk dilaporkan");

            // Potong stok mika bagus
            const newStock = mikaItem.stock - quantity;
            db.update(items)
                .set({ stock: newStock })
                .where(eq(items.id, mikaItem.id))
                .run();

            // Tambah stok mika poles ulang
            const reworkName = "Mika (Poles Ulang)";
            let reworkItem = db
                .select()
                .from(items)
                .where(eq(items.name, reworkName))
                .get();
            if (reworkItem) {
                db.update(items)
                    .set({ stock: reworkItem.stock + quantity })
                    .where(eq(items.id, reworkItem.id))
                    .run();
            } else {
                db.insert(items)
                    .values({
                        id: crypto.randomUUID(),
                        name: reworkName,
                        category: "KOMPONEN",
                        price: 0,
                        stock: quantity,
                        status: "IN_STOCK",
                        bab: mikaItem.bab || "Uncategorized",
                        sub_bab: mikaItem.sub_bab || "Uncategorized",
                        location: mikaItem.location || "Belum Ditentukan",
                        condition: "REWORK",
                    })
                    .run();
            }

            // Log
            insertTransaction({
                transaction_id: crypto.randomUUID(),
                item_name: mikaItem.name,
                category: "KOMPONEN",
                unit_price: 0,
                quantity: quantity,
                total: 0,
                timestamp: new Date().toISOString(),
                type: "DEFECT_LOGGED",
                source: "STASIUN_MIKA_ADMIN",
            });

            return { message: "Mika berhasil dipindah ke status Poles Ulang" };
        });

        const result = defectTx();
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// 4. Selesai Poles Mika (Pekerja Casing)
router.post("/rework-mika", async (req, res) => {
    const { rework_mika_id, quantity } = req.body;
    if (!rework_mika_id || !quantity || quantity <= 0)
        return res
            .status(400)
            .json({
                success: false,
                error: "Data tidak lengkap atau tidak valid",
            });

    try {
        const reworkTx = betterSqlite.transaction(() => {
            const reworkItem = db
                .select()
                .from(items)
                .where(eq(items.id, rework_mika_id))
                .get();

            if (!reworkItem)
                throw new Error("Item Poles Ulang tidak ditemukan");
            if (reworkItem.stock < quantity)
                throw new Error("Stok Mika Poles Ulang tidak mencukupi");

            // Cari nama mika asli
            const baseName = reworkItem.name.replace(" (Poles Ulang)", "");
            let mikaItem = db
                .select()
                .from(items)
                .where(eq(items.name, baseName))
                .get();

            if (!mikaItem) {
                // Buat jika tidak ada (meski aneh karena asalnya dari situ)
                const newId = crypto.randomUUID();
                db.insert(items)
                    .values({
                        id: newId,
                        name: baseName,
                        category: "KOMPONEN",
                        stock: 0,
                        price: 0,
                        bab: "Mika",
                        sub_bab: "Mika AC",
                    })
                    .run();
                mikaItem = { id: newId, stock: 0 };
            }

            // Kurangi poles ulang
            db.update(items)
                .set({ stock: reworkItem.stock - quantity })
                .where(eq(items.id, reworkItem.id))
                .run();
            // Tambah mika bagus
            db.update(items)
                .set({ stock: mikaItem.stock + quantity })
                .where(eq(items.id, mikaItem.id))
                .run();

            // Log
            insertTransaction({
                transaction_id: crypto.randomUUID(),
                item_name: reworkItem.name,
                category: "KOMPONEN",
                unit_price: 0,
                quantity: quantity,
                total: 0,
                timestamp: new Date().toISOString(),
                type: "REWORK_COMPLETED",
                source: "STASIUN_POLES_MIKA",
            });

            return {
                message: "Mika berhasil dipoles dan kembali menjadi stok bagus",
            };
        });

        const result = reworkTx();
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

module.exports = router;
