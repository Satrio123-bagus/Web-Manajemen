const express = require("express");
const router = express.Router();
const {
    stmts,
    refreshInventory,
    insertTransaction,
    state,
    betterSqlite,
} = require("../models/dbStore");
const { validate, sellSchema } = require("../middleware/validation");
const { sendLowStockPush } = require("../agents/pushNotifier"); // Push saat stok kritis

router.post("/sell", validate(sellSchema), (req, res) => {
    const { id, quantity: qty } = req.body;

    const item = stmts.getItemById.get(id);
    if (!item) return res.status(404).json({ error: "ITEM_NOT_FOUND" });

    if (item.stock < qty) {
        return res.status(400).json({
            error: "INSUFFICIENT_STOCK",
            available: item.stock,
            requested: qty,
            item_name: item.name,
        });
    }

    // JIT Assembly check
    let tutupItem = null;
    let recipe = null;
    if (item.name.includes("(Tanpa Tutup)")) {
        const baseName = item.name
            .replace(/\s*\(Tanpa Tutup\)\s*/gi, "")
            .trim();
        recipe = stmts.getRecipeByRemote.get(baseName);

        if (recipe && recipe.jenis_tutup && recipe.jenis_tutup.trim() !== "-") {
            tutupItem = stmts.getItemByName.get(recipe.jenis_tutup);

            if (!tutupItem) {
                return res.status(400).json({
                    error: "MISSING_TUTUP_ITEM",
                    message: `Penjualan Dibatalkan: Komponen tutup "${recipe.jenis_tutup}" (berdasarkan BOM) tidak ditemukan di gudang.`,
                });
            }

            if (tutupItem.stock < qty) {
                return res.status(400).json({
                    error: "INSUFFICIENT_STOCK_TUTUP",
                    message: `Penjualan Dibatalkan: Stok tutup "${recipe.jenis_tutup}" habis atau kurang (Sisa: ${tutupItem.stock}, Butuh: ${qty}).`,
                });
            }
        }
    }

    const runSale = betterSqlite.transaction(() => {
        const ts = new Date().toISOString();

        // 1. Potong stok remote utama
        const newStock = item.stock - qty;
        const newStatus = newStock < 2 ? "LOW_STOCK" : "IN_STOCK";
        stmts.updateItem.run(
            item.name,
            item.category,
            item.price,
            newStock,
            item.rarity,
            newStatus,
            item.bab || "Uncategorized",
            item.sub_bab || "Uncategorized",
            id,
            item.location || "Belum Ditentukan",
            item.condition || "READY"
        );

        const tx = {
            transaction_id: `TX-SALE-${Date.now()}`,
            item_name: item.name,
            category: item.category,
            unit_price: item.price,
            quantity: qty,
            total: item.price * qty,
            timestamp: ts,
            type: "SALE",
            source: "QUICK_SELL",
        };
        insertTransaction(tx);

        // 2. Jika ada tutup, potong stok tutup secara JIT
        let newTutupStock = null;
        if (tutupItem) {
            newTutupStock = tutupItem.stock - qty;
            const newTutupStatus = newTutupStock < 2 ? "LOW_STOCK" : "IN_STOCK";
            // updateItem params: name, category, price, stock, rarity, status, bab, sub_bab, id, location, condition
            stmts.updateItem.run(
                tutupItem.name,
                tutupItem.category,
                tutupItem.price,
                newTutupStock,
                tutupItem.rarity,
                newTutupStatus,
                tutupItem.bab || "Uncategorized",
                tutupItem.sub_bab || "Uncategorized",
                tutupItem.id,
                tutupItem.location || "Belum Ditentukan",
                tutupItem.condition || "READY"
            );

            insertTransaction({
                transaction_id: `TX-JIT-${Date.now()}`,
                item_name: tutupItem.name,
                category: tutupItem.category,
                unit_price: tutupItem.price,
                quantity: qty,
                total: 0,
                timestamp: ts,
                type: "JIT_ASSEMBLY_CONSUMED",
                source: "QUICK_SELL",
            });
        }

        return { tx, newStock, newTutupStock };
    });

    try {
        const result = runSale();
        refreshInventory();

        res.json({
            message: "SALE_RECORDED",
            transaction: result.tx,
            remaining_stock: result.newStock,
            jit_tutup_consumed: tutupItem ? recipe.jenis_tutup : null,
            jit_tutup_remaining: result.newTutupStock,
        });

        // Kirim push alert jika stok item ini baru saja turun di bawah 2 (non-blocking)
        if (result.newStock < 2) {
            const freshItem = stmts.getItemById.get(id);
            if (freshItem) sendLowStockPush([freshItem]).catch(() => {});
        }
        if (tutupItem && result.newTutupStock < 2) {
            const freshTutup = stmts.getItemById.get(tutupItem.id);
            if (freshTutup) sendLowStockPush([freshTutup]).catch(() => {});
        }
    } catch (err) {
        res.status(500).json({ error: "SALE_FAILED", message: err.message });
    }
});

// GET /transactions — Full paginated transaction history untuk halaman History
router.get("/transactions", (req, res) => {
    const { page = 1, limit = 100, type } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(500, parseInt(limit) || 100);
    const offset = (pageNum - 1) * limitNum;

    try {
        // Filter berdasarkan tipe langsung di SQL (lebih efisien daripada filter di JS)
        let data;
        let total;
        if (type && type !== "ALL") {
            data = stmts.getAllTxPaginatedByType.all(type, limitNum, offset);
            total = stmts.countTxByType.get(type);
        } else {
            data = stmts.getAllTxPaginated.all(limitNum, offset);
            total = stmts.countTx.get();
        }

        res.json({ data, total, page: pageNum, limit: limitNum });
    } catch (err) {
        // Fallback ke method lama
        res.json(stmts.getRecentTx.all());
    }
});

module.exports = router;
