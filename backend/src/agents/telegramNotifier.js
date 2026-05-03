// ─── TELEGRAM NOTIFIER ──────────────────────────────────────────────────────
// Kirim laporan/alert ke Telegram. Opsional — hanya aktif jika
// TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID di-set di .env
//
// Cara setup:
// 1. Chat @BotFather di Telegram → /newbot → dapatkan token
// 2. Chat bot kamu, lalu buka: https://api.telegram.org/bot<TOKEN>/getUpdates
// 3. Cari "chat":{"id": 123456789} → itu TELEGRAM_CHAT_ID kamu
// 4. Tambahkan ke .env:
//    TELEGRAM_BOT_TOKEN=123456:ABCdefGhIjKlMnOpQrStUvWxYz
//    TELEGRAM_CHAT_ID=123456789

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID_STR = process.env.TELEGRAM_CHAT_ID || '';
const CHAT_IDS = CHAT_ID_STR.split(',').map(id => id.trim()).filter(id => id.length > 0);

/**
 * Cek apakah Telegram notifier dikonfigurasi
 */
function isConfigured() {
    return BOT_TOKEN.length > 10 && CHAT_IDS.length > 0;
}

/**
 * Kirim pesan teks ke Telegram
 * @param {string} message — Pesan yang akan dikirim (max 4096 chars)
 * @returns {Promise<boolean>} true jika berhasil
 */
async function sendMessage(message) {
    if (!isConfigured()) {
        // Silent skip — tidak ada config, tidak ada error
        return false;
    }

    try {
        // Telegram max message length = 4096
        const truncated = message.length > 4000
            ? message.slice(0, 4000) + '\n\n... [dipotong karena terlalu panjang]'
            : message;

        // Loop untuk setiap ID yang didaftarkan
        const promises = CHAT_IDS.map(async (chatId) => {
            const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: truncated,
                    parse_mode: 'HTML',
                    disable_web_page_preview: true,
                }),
                signal: AbortSignal.timeout(10000),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                console.warn(`[TELEGRAM] Send failed to ${chatId}: ${res.status}`, errData.description || '');
                return false;
            }
            return true;
        });

        const results = await Promise.all(promises);
        const successCount = results.filter(r => r).length;

        if (successCount > 0) {
            console.log(`[TELEGRAM] Pesan terkirim ke ${successCount} akun.`);
        }
        return successCount > 0;
    } catch (err) {
        console.warn('[TELEGRAM] Error:', err.message);
        return false;
    }
}

/**
 * Kirim laporan harian ke Telegram
 */
async function sendReport(reportText) {
    // Escape karakter < dan > agar tidak error diparse sebagai HTML oleh Telegram
    const safeText = reportText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return sendMessage(safeText);
}

/**
 * Kirim alert stok rendah ke Telegram
 * @param {Array} items — Array item dengan stok rendah
 */
async function sendLowStockAlert(items) {
    if (!isConfigured() || items.length === 0) return false;

    const lines = items.map(i => `⚠️ [${i.id}] ${i.name} — Stok: ${i.stock}`);
    const message = `🚨 <b>PERINGATAN STOK RENDAH</b>\n\n${lines.join('\n')}\n\n📦 ${items.length} item perlu restock segera.`;

    return sendMessage(message);
}

module.exports = { isConfigured, sendMessage, sendReport, sendLowStockAlert };
