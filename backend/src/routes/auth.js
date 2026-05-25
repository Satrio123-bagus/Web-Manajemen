const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { logAudit } = require('../middleware/auditLogger');

// ─── LOGIN RATE LIMITER ─────────────────────────────────────────
// Memblokir IP jika gagal login 5 kali berturut-turut dalam 15 menit
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 5, // Reverted to 5
    skipSuccessfulRequests: true, // HANYA hitung jika login gagal!
    message: {
        error: 'TOO_MANY_REQUESTS',
        message: 'Akses Ditolak. Anda gagal login terlalu sering. Silakan coba lagi dalam 15 menit.'
    },
    standardHeaders: true, // Mengembalikan info rate limit di headers `RateLimit-*`
    legacyHeaders: false, // Menonaktifkan headers `X-RateLimit-*` (format lama)
    validate: false,
});

const { stmts } = require('../models/dbStore');

router.post('/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error('[FATAL] JWT_SECRET is not set in .env!');
        return res.status(500).json({
            error: 'SERVER_CONFIG_ERROR',
            message: 'Konfigurasi server tidak lengkap. Hubungi administrator.'
        });
    }

    // Default to fallback if no username provided, to avoid breaking old clients momentarily
    if (!username || !password) {
        return res.status(401).json({
            error: 'UNAUTHORIZED',
            message: 'Akses Ditolak. Username dan Password harus diisi.'
        });
    }

    const user = stmts.getUserByUsername.get(username);
    
    if (!user) {
        logAudit('LOGIN_FAILED', `User tidak ditemukan: ${username}`, req);
        return res.status(401).json({
            error: 'UNAUTHORIZED',
            message: 'Akses Ditolak. Username atau Password salah.'
        });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
        logAudit('LOGIN_FAILED', `Password salah untuk user: ${username}`, req);
        return res.status(401).json({
            error: 'UNAUTHORIZED',
            message: 'Akses Ditolak. Username atau Password salah.'
        });
    }

    // Generate JWT token valid for 8 hours
    const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, system: 'CORTEX', timestamp: Date.now() },
        jwtSecret,
        { expiresIn: '8h' }
    );

    logAudit('LOGIN_SUCCESS', `Login berhasil: ${username} (${user.role})`, req);
    res.json({
        success: true,
        message: `Selamat datang, ${user.username} (${user.role})`,
        token: token,
        role: user.role,
        username: user.username
    });
});

module.exports = router;
