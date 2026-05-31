const express = require("express");
const router = express.Router();
const {
    db,
    betterSqlite,
    insertTransaction,
    stmts,
} = require("../models/dbStore");
const schema = require("../db/schema");
const { orders, items } = schema;
const { eq, asc, desc } = require("drizzle-orm");
const crypto = require("crypto");

// 1. Dapatkan semua pesanan aktif (Untuk Pekerja & Admin)
router.get("/pending", async (req, res) => {
    try {
        const pendingOrders = await db
            .select()
            .from(orders)
            .where(eq(orders.status, "PENDING"))
            .orderBy(asc(orders.timestamp))
            .all();
        res.json(pendingOrders);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Gagal memuat pesanan" });
    }
});

// 2. Admin membuat pesanan baru
router.post("/", async (req, res) => {
    const { tipe_remote, quantity } = req.body;
    if (!tipe_remote || quantity == null || quantity <= 0) {
        return res.status(400).json({ error: "Data pesanan tidak valid" });
    }

    try {
        const newId = crypto.randomUUID();
        const timestamp = new Date().toISOString();
        await db
            .insert(orders)
            .values({
                id: newId,
                tipe_remote: tipe_remote,
                quantity: quantity,
                status: "PENDING",
                timestamp: timestamp,
            })
            .run();
        res.json({ message: "Pesanan berhasil dibuat", id: newId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Gagal membuat pesanan" });
    }
});

// 3. Admin menyelesaikan pesanan (Potong stok & catat uang)
router.put("/:id/complete", async (req, res) => {
    const orderId = req.params.id;

    try {
        // Mulai SQLite Transaction agar aman jika ada error di tengah jalan
        const completeOrderTx = betterSqlite.transaction(() => {
            // A. Cek apakah pesanan ada dan masih pending
            const order = db
                .select()
                .from(orders)
                .where(eq(orders.id, orderId))
                .get();
            if (!order) throw new Error("Pesanan tidak ditemukan");
            if (order.status === "COMPLETED")
                throw new Error("Pesanan sudah diselesaikan");

            // B. Cek Resep (BOM)
            const recipe = stmts.getRecipeByRemote.get(order.tipe_remote);

            let mainItemName = order.tipe_remote;
            if (recipe) {
                mainItemName = `${order.tipe_remote} (Tanpa Tutup)`;
            }

            const item = db
                .select()
                .from(items)
                .where(eq(items.name, mainItemName))
                .get();

            if (!item) {
                // Fallback untuk stok lama (jika ada barang utuh yg belum kena aturan WIP)
                const legacyItem = db
                    .select()
                    .from(items)
                    .where(eq(items.name, order.tipe_remote))
                    .get();
                if (!legacyItem) {
                    throw new Error(
                        `Barang ${mainItemName} atau ${order.tipe_remote} tidak ditemukan di gudang`
                    );
                }

                const newStock = Math.max(0, legacyItem.stock - order.quantity);
                const newStatus = newStock < 2 ? "LOW_STOCK" : "IN_STOCK";
                db.update(items)
                    .set({ stock: newStock, status: newStatus })
                    .where(eq(items.id, legacyItem.id))
                    .run();

                const txId = crypto.randomUUID();
                insertTransaction({
                    transaction_id: txId,
                    item_name: legacyItem.name,
                    category: legacyItem.category,
                    unit_price: legacyItem.price,
                    quantity: order.quantity,
                    total: legacyItem.price * order.quantity,
                    timestamp: new Date().toISOString(),
                    type: "SALE",
                    source: "ORDER_FULFILLMENT",
                });
            } else {
                // C. Potong stok WIP utama
                const newStock = Math.max(0, item.stock - order.quantity);
                const newStatus = newStock < 2 ? "LOW_STOCK" : "IN_STOCK";

                db.update(items)
                    .set({ stock: newStock, status: newStatus })
                    .where(eq(items.id, item.id))
                    .run();

                // Potong stok tutup baterai (Jika ada resepnya)
                if (recipe) {
                    const coverItem = db
                        .select()
                        .from(items)
                        .where(eq(items.name, recipe.jenis_tutup))
                        .get();
                    if (coverItem) {
                        const newCoverStock = Math.max(
                            0,
                            coverItem.stock - order.quantity
                        );
                        const newCoverStatus =
                            newCoverStock < 2 ? "LOW_STOCK" : "IN_STOCK";
                        db.update(items)
                            .set({
                                stock: newCoverStock,
                                status: newCoverStatus,
                            })
                            .where(eq(items.id, coverItem.id))
                            .run();
                    }
                }

                // D. Catat Pemasukan Uang (Catat sebagai produk utuh / tipe_remote asli)
                const txId = crypto.randomUUID();
                insertTransaction({
                    transaction_id: txId,
                    item_name: order.tipe_remote, // <-- Penting: Analitik harus melihat ini sebagai barang utuh
                    category: item.category,
                    unit_price: item.price,
                    quantity: order.quantity,
                    total: item.price * order.quantity,
                    timestamp: new Date().toISOString(),
                    type: "SALE",
                    source: "ORDER_FULFILLMENT",
                });
            }

            // E. Tandai pesanan sebagai COMPLETED
            db.update(orders)
                .set({ status: "COMPLETED" })
                .where(eq(orders.id, orderId))
                .run();

            return {
                message: "Pesanan berhasil dikirim dan stok terpotong",
                item: item.name,
                sold: order.quantity,
            };
        });

        const result = completeOrderTx();
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(400).json({
            error: err.message || "Gagal menyelesaikan pesanan",
        });
    }
});

module.exports = router;
