const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { stmts } = require("../models/dbStore");

// GET /api/settings/recipes
router.get("/", (req, res) => {
    try {
        const recipes = stmts.getAllRecipes.all();
        res.json({ success: true, recipes });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/settings/recipes/fix-db
router.get("/fix-db", (req, res) => {
    try {
        const db = require("better-sqlite3")("./data/inventory.db");
        db.exec("ALTER TABLE bom_recipes ADD COLUMN jenis_mika TEXT;");
        res.json({ success: true, message: "Berhasil menambahkan kolom jenis_mika" });
    } catch (err) {
        if (err.message.includes("duplicate column")) {
            res.json({ success: true, message: "Kolom jenis_mika sudah ada (aman)" });
        } else {
            res.status(500).json({ success: false, error: err.message });
        }
    }
});

// POST /api/settings/recipes
router.post("/", (req, res) => {
    try {
        const { tipe_remote, jenis_tutup, jenis_mika } = req.body;
        if (!tipe_remote || !jenis_tutup || !jenis_mika) {
            return res.status(400).json({
                success: false,
                error: "tipe_remote, jenis_tutup, dan jenis_mika harus diisi",
            });
        }

        // Cek apakah resep sudah ada (menghindari duplicate unique constraint crash)
        const existing = stmts.getRecipeByRemote.get(tipe_remote);
        if (existing) {
            return res.status(400).json({
                success: false,
                error: "Resep untuk tipe ini sudah ada",
            });
        }

        const id = crypto.randomUUID();
        stmts.insertRecipe.run(id, tipe_remote, jenis_tutup, jenis_mika);
        res.json({
            success: true,
            message: "Resep berhasil ditambahkan",
            recipe: { id, tipe_remote, jenis_tutup, jenis_mika },
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/settings/recipes/:id
router.delete("/:id", (req, res) => {
    try {
        stmts.deleteRecipe.run(req.params.id);
        res.json({ success: true, message: "Resep dihapus" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
