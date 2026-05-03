// ─── PREFIX RULES API ───────────────────────────────────────────────────────
// Endpoint untuk mengelola daftar prefix klasifikasi remote.
// Data disimpan di prefixRules.json agar bisa diedit dari frontend Settings.

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const RULES_FILE = path.join(__dirname, '..', 'data', 'prefixRules.json');

// Helper: Baca rules dari file
function readRules() {
    try {
        const raw = fs.readFileSync(RULES_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch (err) {
        console.error('[PREFIX] Gagal membaca prefixRules.json:', err.message);
        return { rules: [] };
    }
}

// Helper: Tulis rules ke file
function writeRules(data) {
    fs.writeFileSync(RULES_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// GET /api/settings/prefixes — Ambil semua prefix rules
router.get('/', (req, res) => {
    const data = readRules();
    res.json(data);
});

// PUT /api/settings/prefixes — Update seluruh daftar rules (dari frontend)
router.put('/', (req, res) => {
    const { rules } = req.body;
    if (!Array.isArray(rules)) {
        return res.status(400).json({ error: 'Format tidak valid. Harus { rules: [...] }' });
    }

    // Validasi setiap rule
    for (const rule of rules) {
        if (!rule.prefix || !rule.brand || !rule.confidence) {
            return res.status(400).json({ error: `Rule tidak valid: prefix, brand, dan confidence wajib diisi.` });
        }
        if (!['high', 'medium', 'low'].includes(rule.confidence)) {
            return res.status(400).json({ error: `Confidence harus 'high', 'medium', atau 'low'.` });
        }
    }

    writeRules({ rules });
    console.log(`[PREFIX] Rules diperbarui: ${rules.length} entri.`);
    res.json({ success: true, count: rules.length });
});

module.exports = router;
