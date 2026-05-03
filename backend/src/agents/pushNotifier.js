// ─── PUSH NOTIFIER ───────────────────────────────────────────────────────────
// Service untuk mengirim Web Push Notification ke browser pengguna.
// Menggunakan VAPID authentication (standar W3C Web Push Protocol).
//
// VAPID Keys dibuat sekali lalu disimpan di .env:
//   VAPID_PUBLIC_KEY=...
//   VAPID_PRIVATE_KEY=...
//   VAPID_CONTACT=mailto:admin@3coinsstock.com

const webpush = require('web-push');
const { stmts } = require('../models/dbStore');

// ─── Konfigurasi VAPID ────────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_CONTACT = process.env.VAPID_CONTACT || 'mailto:admin@3coinsstock.com';

let isConfigured = false;

// Inisialisasi web-push hanya jika VAPID keys tersedia
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    isConfigured = true;
    console.log('  >> PUSH NOTIFIER: VAPID configured ✓');
} else {
    console.log('  >> PUSH NOTIFIER: VAPID keys tidak ditemukan, push notifications dinonaktifkan.');
}

/**
 * Cek apakah push notifier sudah dikonfigurasi
 */
function isPushConfigured() {
    return isConfigured;
}

/**
 * Kirim notifikasi ke semua subscriber yang terdaftar
 * @param {object} payload - Konten notifikasi
 * @param {string} payload.title - Judul notifikasi
 * @param {string} payload.body - Isi pesan
 * @param {string} [payload.icon] - URL icon (opsional)
 * @param {string} [payload.url] - URL halaman tujuan saat diklik
 * @param {string} [payload.tag] - Tag untuk grouping notifikasi sejenis
 * @returns {Promise<{sent: number, failed: number}>}
 */
async function sendPushToAll(payload) {
    if (!isConfigured) return { sent: 0, failed: 0 };

    const subscriptions = stmts.getAllPushSubs.all();
    if (subscriptions.length === 0) return { sent: 0, failed: 0 };

    const notification = JSON.stringify({
        title: payload.title || 'INSERT3COINS',
        body: payload.body || '',
        icon: payload.icon || '/icon-192.png',
        badge: '/icon-192.png',
        url: payload.url || '/',
        tag: payload.tag || 'general',
        timestamp: Date.now(),
    });

    let sent = 0;
    let failed = 0;

    const results = await Promise.allSettled(
        subscriptions.map(async (sub) => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth,
                },
            };

            try {
                await webpush.sendNotification(pushSubscription, notification);
                sent++;
            } catch (err) {
                // 410 = subscription kadaluarsa (browser unsubscribe / user hapus izin)
                // 404 = endpoint tidak ditemukan
                if (err.statusCode === 410 || err.statusCode === 404) {
                    console.log(`[PUSH] Hapus subscription kadaluarsa: ${sub.endpoint.slice(0, 40)}...`);
                    stmts.deletePushSub.run(sub.endpoint);
                }
                failed++;
            }
        })
    );

    console.log(`[PUSH] Notifikasi terkirim: ${sent}/${subscriptions.length} (${failed} gagal)`);
    return { sent, failed };
}

// ─── Helper: Alert Spesifik ──────────────────────────────────────────────────

/**
 * Kirim alert stok kritis ke semua browser
 * @param {Array} lowStockItems - Array item dengan stok rendah
 */
async function sendLowStockPush(lowStockItems) {
    if (!isConfigured || lowStockItems.length === 0) return;

    const outOfStock = lowStockItems.filter(i => i.stock === 0);
    const critical = lowStockItems.filter(i => i.stock > 0 && i.stock < 2);

    let body = '';
    if (outOfStock.length > 0) {
        body += `🔴 Habis: ${outOfStock.map(i => i.name).join(', ')}\n`;
    }
    if (critical.length > 0) {
        body += `🟡 Kritis: ${critical.slice(0, 2).map(i => `${i.name} (${i.stock})`).join(', ')}`;
        if (critical.length > 2) body += ` +${critical.length - 2} lainnya`;
    }

    return sendPushToAll({
        title: `🚨 ${lowStockItems.length} Item Stok Kritis`,
        body: body.trim(),
        url: '/inventory',
        tag: 'low-stock',
    });
}

/**
 * Kirim notifikasi laporan harian siap
 * @param {string} reportSummary - Ringkasan singkat laporan
 */
async function sendReportReadyPush(reportSummary = '') {
    if (!isConfigured) return;
    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    return sendPushToAll({
        title: `📊 Laporan Harian Siap — ${today}`,
        body: reportSummary || 'Tap untuk melihat ringkasan inventori hari ini.',
        url: '/',
        tag: 'daily-report',
    });
}

/**
 * Kirim notifikasi operasi penting selesai (reindex, import massal, dll)
 * @param {string} message - Pesan singkat
 */
async function sendOperationDonePush(message) {
    if (!isConfigured) return;
    return sendPushToAll({
        title: '✅ Operasi Selesai',
        body: message,
        url: '/inventory',
        tag: 'operation',
    });
}

module.exports = {
    isPushConfigured,
    sendPushToAll,
    sendLowStockPush,
    sendReportReadyPush,
    sendOperationDonePush,
};
