// ─── CLASSIFY AGENT ─────────────────────────────────────────────────────────
// Agen klasifikasi produk otomatis. Saat item baru ditambahkan tanpa kategori
// (bab = "Unsorted"), Hermes otomatis menentukan bab, sub_bab, dan rarity.

const { stmts, refreshInventory } = require('../models/dbStore');
const hermes = require('./hermesClient');

const CLASSIFY_SYSTEM_PROMPT = `Kamu adalah sistem pakar klasifikasi untuk toko elektronik INSERT3COINS.

Tugasmu: Berikan klasifikasi MERK (bab) dan JENIS produk (sub_bab) berdasarkan NAMA produk, meskipun namanya hanya berupa kode alfanumerik.

ATURAN KODE SERI REMOT (HARI INI KAMU MENGHAFAL SEMUA INI):
1. PANASONIC: "A75C..." (AC), "N2QAYB..." (TV/Audio), "EUR..." (Audio)
2. SHARP: "YB...", "YK..." (AC), "CRMC-A..." (AC), "GA..." (AC), "GB..." (TV)
3. DAIKIN: "ARC..." (AC)
4. LG: "AKB..." (TV/AC), "6711A..." (AC), "AGF..." (TV), "MKJ..." (TV)
5. SAMSUNG: "AA59...", "BN59..." (TV), "DB93...", "DB90..." (AC), "ARH..." (AC)
6. SONY: "RM-...", "RMT-...", "RMF-..." (TV/Audio)
7. GREE: "YAW...", "YAP...", "YT...", "YAN..." (AC)
8. MIDEA / CHIGO: "ZH/...", "DG11...", "R51...", "RG..." (AC)
9. TCL: "RC..." (TV), "GY..." (AC)
10. CHANGHONG: "K-..." (AC - awalan K sering dipakai Changhong), "RL-...", "CH-..." (TV)
11. POLYTRON: "PRM...", "81I..." (TV/Audio/AC)
12. TOSHIBA: "WC-...", "WH-..." (AC), "CT-..." (TV)
13. AQUA / SANYO: "RCS-..." (AC)
14. UNIVERSAL / MULTI: Awalan "K-" yang diikuti ribuan (contoh: K-1028E, K-1088E) adalah Remote AC Universal (Chunghop/Joker). "RM-L..." adalah TV Universal.

ATURAN DEDUKSI MEREK CHINA/LOKAL:
Jika nama produk TIDAK mengandung kode seri jelas tapi hanya ada tipe AC seperti "05CR", "09CR", tebak itu brand China populer (Midea/Changhong/TCL) atau jika terdapat nama merknya langsung (contoh: "Remote AC Beko", "Remote TV Changhong L32"), LANGSUNG tangkap merk tersebut!

Aturan Output:
- "bab" = Merk utama (Panasonic, Sharp, LG, Samsung, Gree, Midea, TCL, Changhong, Polytron, Toshiba, Daikin, Universal, dll).
- "sub_bab" = "Remote AC", "Remote TV", "PCB Power", "Sensor", atau "Kapasitor".
- Hanya gunakan "Lainnya" jika kode benar-benar tidak bisa ditebak dan tidak ada tulisan merk sama sekali.

⚠️ PENTING: Jangan tentukan rarity (biarkan sistem menentukannya). Jawab HANYA dalam format JSON SAJA:
{"bab": "...", "sub_bab": "..."}`;

/**
 * Klasifikasi satu item berdasarkan namanya
 * @param {string} itemName — Nama produk
 * @returns {Promise<{bab: string, sub_bab: string, rarity: string}|null>}
 */
async function classifyItem(itemName) {
    if (!itemName || itemName.trim().length < 2) return null;

    // Cek ketersediaan Hermes
    let available = await hermes.isAvailable();
    if (!available) {
        console.warn('[CLASSIFY] Hermes model tidak tersedia. Mencoba pull model...');
        const pulled = await hermes.pullModel();
        if (!pulled) {
            console.error('[CLASSIFY] Gagal pull model. Hermes tidak aktif.');
            return null;
        }
        available = true;
    }

    const prompt = `Klasifikasikan produk ini:\nNama: "${itemName}"\n\nJawab dalam JSON: {"bab": "...", "sub_bab": "...", "rarity": "..."}`;

    try {
        const result = await hermes.generateJSON(prompt, {
            system: CLASSIFY_SYSTEM_PROMPT,
            temperature: 0.1,
            maxTokens: 80,
        });

        if (!result || !result.bab) {
            console.warn(`[CLASSIFY] Gagal klasifikasi "${itemName}" — respons tidak valid.`);
            return null;
        }

        // Hapus rarity dari hasil Hermes jika ada — rarity adalah hak pemilik toko
        delete result.rarity;

        console.log(`[CLASSIFY] "${itemName}" → Bab: ${result.bab}, Sub: ${result.sub_bab} (rarity tidak diubah)`);
        return result;
    } catch (err) {
        console.error(`[CLASSIFY] Error saat klasifikasi "${itemName}":`, err.message);
        return null;
    }
}

/**
 * Auto-classify item yang baru ditambahkan jika bab = "Unsorted"
 * Dipanggil setelah item baru dibuat di terminal.js atau items.js
 * @param {string} itemId — ID item yang baru dibuat
 */
async function autoClassifyIfNeeded(itemId) {
    try {
        console.log(`[CLASSIFY] ── Mulai klasifikasi untuk ID: ${itemId} ──`);
        
        const item = stmts.getItemById.get(itemId);
        if (!item) {
            console.error(`[CLASSIFY] ✗ Item ${itemId} tidak ditemukan di DB!`);
            return;
        }

        // Hanya klasifikasi jika bab masih "Unsorted" atau "Uncategorized"
        const needsClassify = !item.bab || item.bab === 'Unsorted' || item.bab === 'Uncategorized';
        if (!needsClassify) {
            console.log(`[CLASSIFY] ─ Item "${item.name}" sudah terklasifikasi (${item.bab}), skip.`);
            return;
        }

        console.log(`[CLASSIFY] → Mengirim "${item.name}" ke Hermes untuk analisis...`);

        const classification = await classifyItem(item.name);
        if (!classification) {
            console.error(`[CLASSIFY] ✗ Hermes gagal mengklasifikasi "${item.name}" — hasil null.`);
            return;
        }

        console.log(`[CLASSIFY] ← Hermes menjawab: bab="${classification.bab}", sub_bab="${classification.sub_bab}"`);

        // Update item di database — rarity TIDAK disentuh, diambil dari data existing
        // Rarity hanya boleh diubah oleh pemilik toko secara manual
        stmts.updateItem.run(
            item.name,
            classification.bab,     // category = bab
            item.price,
            item.stock,
            item.rarity,            // ← Pertahankan rarity dari DB, Hermes tidak boleh ubah ini
            item.status,
            classification.bab,
            classification.sub_bab,
            item.id
        );
        refreshInventory();

        const successMsg = `[HERMES] Analisis Selesai: "${item.name}" kini disorting ke Rak ${classification.bab} / ${classification.sub_bab}.`;
        console.log(`[CLASSIFY] ✓ "${item.name}" → ${classification.bab} / ${classification.sub_bab} | Rarity tetap: ${item.rarity}`);
        
        // Siarkan pembaruan langsung ke layar Terminal AI Manager melalui SSE
        const eventEmitter = require('../services/eventEmitter');
        console.log(`[CLASSIFY] 📡 Menyiarkan ke SSE...`);
        eventEmitter.emit('terminal_broadcast', {
            type: 'broadcast',
            timestamp: new Date().toISOString(),
            output: [successMsg]
        });
        console.log(`[CLASSIFY] ✓ Siaran SSE terkirim.`);

    } catch (err) {
        // Non-fatal — jangan crash backend jika klasifikasi gagal
        console.error('[CLASSIFY] Auto-classify error:', err.message);
    }
}

module.exports = { classifyItem, autoClassifyIfNeeded };
