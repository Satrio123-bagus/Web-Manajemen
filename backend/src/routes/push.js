// ─── PUSH NOTIFICATION ROUTES ────────────────────────────────────────────────
// Endpoints untuk mengelola Web Push subscriptions dari browser.

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { stmts } = require('../models/dbStore');
const { isPushConfigured, sendPushToAll } = require('../agents/pushNotifier');

// Rate limiter ketat untuk endpoint test — cegah penyalahgunaan token yang bocor
const pushTestLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,  // 10 menit
    max: 3,                     // Maksimal 3 test per 10 menit per IP
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    message: { error: 'RATE_LIMIT: Terlalu banyak test push. Coba lagi dalam 10 menit.' },
});

/**
 * GET /api/push/vapid-key
 * Kembalikan VAPID Public Key ke frontend (dibutuhkan untuk subscribe)
 */
router.get('/vapid-key', (_req, res) => {
    const key = process.env.VAPID_PUBLIC_KEY || '';
    if (!key) {
        return res.status(503).json({ error: 'Push notifications belum dikonfigurasi di server.' });
    }
    res.json({ publicKey: key });
});

/**
 * GET /api/push/status
 * Cek status push notification & jumlah subscriber
 */
router.get('/status', (_req, res) => {
    const subCount = stmts.countPushSubs.get();
    res.json({
        configured: isPushConfigured(),
        subscriberCount: subCount?.cnt || 0,
    });
});

/**
 * POST /api/push/subscribe
 * Simpan subscription baru dari browser
 * Body: { endpoint, keys: { p256dh, auth }, userAgent }
 */
router.post('/subscribe', (req, res) => {
    const { endpoint, keys, userAgent } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ error: 'Data subscription tidak lengkap.' });
    }

    // Validasi panjang endpoint — endpoint valid biasanya < 200 karakter
    if (typeof endpoint !== 'string' || endpoint.length > 500 || !endpoint.startsWith('https://')) {
        return res.status(400).json({ error: 'Endpoint subscription tidak valid.' });
    }

    // Validasi panjang keys
    if (keys.p256dh.length > 200 || keys.auth.length > 50) {
        return res.status(400).json({ error: 'Keys subscription tidak valid.' });
    }

    try {
        stmts.insertPushSub.run(endpoint, keys.p256dh, keys.auth, userAgent || req.headers['user-agent']);
        console.log(`[PUSH] Subscriber baru terdaftar: ${endpoint.slice(0, 40)}...`);
        res.json({ success: true, message: 'Subscription berhasil disimpan.' });
    } catch (err) {
        console.error('[PUSH] Gagal simpan subscription:', err.message);
        res.status(500).json({ error: 'Gagal menyimpan subscription.' });
    }
});

/**
 * POST /api/push/unsubscribe
 * Hapus subscription dari browser (saat pengguna matikan notif)
 * Body: { endpoint }
 */
router.post('/unsubscribe', (req, res) => {
    const { endpoint } = req.body;
    if (!endpoint || typeof endpoint !== 'string') {
        return res.status(400).json({ error: 'Endpoint diperlukan.' });
    }

    try {
        stmts.deletePushSub.run(endpoint);
        console.log(`[PUSH] Subscriber dihapus: ${endpoint.slice(0, 40)}...`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Gagal menghapus subscription.' });
    }
});

/**
 * POST /api/push/test
 * Kirim push test ke semua subscriber — dibatasi 3x/10 menit per IP
 */
router.post('/test', pushTestLimiter, async (_req, res) => {
    if (!isPushConfigured()) {
        return res.status(503).json({ error: 'VAPID keys belum dikonfigurasi.' });
    }

    try {
        const result = await sendPushToAll({
            title: '🧪 Test Notifikasi INSERT3COINS',
            body: 'Jika kamu melihat ini, push notification berhasil dikonfigurasi! 🎉',
            url: '/',
            tag: 'test',
        });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
