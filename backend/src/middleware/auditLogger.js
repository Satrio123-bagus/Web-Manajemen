// ─── AUDIT LOGGER ────────────────────────────────────────────────────────────
// Mencatat aksi-aksi kritis ke database untuk keperluan forensik keamanan.
// Digunakan ketika: login, hapus item, reindex, operasi massal via terminal.
//
// Entry log disimpan di tabel `audit_log` dan dapat dilihat dari Settings/Admin.

const { betterSqlite } = require('../models/dbStore');

// Buat tabel jika belum ada
betterSqlite.exec(`
  CREATE TABLE IF NOT EXISTS audit_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    action    TEXT NOT NULL,
    details   TEXT,
    ip        TEXT,
    user_agent TEXT,
    timestamp TEXT NOT NULL
  );
`);

/**
 * Catat satu entry audit log
 * @param {string} action - Nama aksi (contoh: 'LOGIN_SUCCESS', 'ITEM_DELETE', 'REINDEX')
 * @param {string} details - Detail tambahan (contoh: item ID, jumlah, dll)
 * @param {object} req - Express request objek (untuk mengambil IP dan User-Agent)
 */
function logAudit(action, details = '', req = null) {
    try {
        const ip = req
            ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()
            : 'system';
        const ua = req ? (req.headers['user-agent'] || '').slice(0, 200) : 'system';
        const timestamp = new Date().toISOString();

        betterSqlite.prepare(
            'INSERT INTO audit_log (action, details, ip, user_agent, timestamp) VALUES (?, ?, ?, ?, ?)'
        ).run(action, String(details).slice(0, 500), ip, ua, timestamp);
    } catch (err) {
        // Audit log tidak boleh crash aplikasi utama
        console.error('[AUDIT] Gagal catat log:', err.message);
    }
}

/**
 * Ambil audit log terbaru
 * @param {number} limit - Jumlah entry yang diambil (default 50)
 */
function getAuditLog(limit = 50) {
    try {
        return betterSqlite.prepare(
            'SELECT * FROM audit_log ORDER BY id DESC LIMIT ?'
        ).all(Math.min(limit, 200));
    } catch {
        return [];
    }
}

module.exports = { logAudit, getAuditLog };
