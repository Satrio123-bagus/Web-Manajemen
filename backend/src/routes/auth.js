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
    max: 5, // Membatasi setiap IP hanya 5 request per windowMs
    message: {
        error: 'TOO_MANY_REQUESTS',
        message: 'Akses Ditolak. Anda mencoba login terlalu sering. Silakan coba lagi dalam 15 menit.'
    },
    standardHeaders: true, // Mengembalikan info rate limit di headers `RateLimit-*`
    legacyHeaders: false, // Menonaktifkan headers `X-RateLimit-*` (format lama)
});

router.post('/login', loginLimiter, async (req, res) => {
    const { password } = req.body;

    // ─── SECURITY: Crash if critical env vars are missing ────────
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;
    const jwtSecret = process.env.JWT_SECRET;

    if (!passwordHash || !jwtSecret) {
        console.error('[FATAL] ADMIN_PASSWORD_HASH or JWT_SECRET is not set in .env!');
        return res.status(500).json({
            error: 'SERVER_CONFIG_ERROR',
            message: 'Konfigurasi server tidak lengkap. Hubungi administrator.'
        });
    }

    if (!password) {
        return res.status(401).json({
            error: 'UNAUTHORIZED',
            message: 'Akses Ditolak. Password tidak diberikan.'
        });
    }

    // ─── SECURITY: Compare with bcrypt hash (timing-safe) ───────
    const isValid = await bcrypt.compare(password, passwordHash);
    if (!isValid) {
        logAudit('LOGIN_FAILED', 'Password salah', req);
        return res.status(401).json({
            error: 'UNAUTHORIZED',
            message: 'Akses Ditolak. Password salah atau tidak dikenali.'
        });
    }

    // Generate JWT token valid for 8 hours (reduced from 24h)
    const token = jwt.sign(
        { role: 'admin', system: 'CORTEX', timestamp: Date.now() },
        jwtSecret,
        { expiresIn: '8h' }
    );

    logAudit('LOGIN_SUCCESS', 'Admin login', req);
    res.json({
        success: true,
        message: 'Akses Diberikan. Selamat datang kembali, Administrator.',
        token: token
    });
});

module.exports = router;
