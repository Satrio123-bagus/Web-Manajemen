// ─── CLASSIFY AGENT ─────────────────────────────────────────────────────────
// Agen klasifikasi produk otomatis. Saat item baru ditambahkan tanpa kategori
// (bab = "Unsorted"), Hermes otomatis menentukan bab, sub_bab, dan rarity.

const { stmts, refreshInventory } = require('../models/dbStore');
const hermes = require('./hermesClient');

const CLASSIFY_SYSTEM_PROMPT = `Kamu adalah sistem klasifikasi produk untuk toko elektronik INSERT3COINS yang menjual remote AC/TV dan komponen elektronik.

Tugasmu: Berikan klasifikasi MERK dan JENIS produk berdasarkan NAMA produk.

Aturan:
- "bab" = Merk/Brand utama (contoh: "Panasonic", "Daikin", "Samsung", "LG", "Sharp", "Mitsubishi")
- "sub_bab" = Jenis/Tipe produk (contoh: "Remote AC", "Remote TV", "PCB Power", "Sensor", "Capacitor")
- Jika merk tidak dikenali, gunakan bab = "Lainnya"
- Jika jenis produk tidak jelas, gunakan sub_bab = "Umum"

⚠️ PENTING: Jangan tentukan rarity. Rarity ditentukan oleh pemilik toko berdasarkan kondisi fisik dan ketersediaan barang di lapangan.

WAJIB jawab dalam format JSON SAJA, tanpa penjelasan:
{"bab": "...", "sub_bab": "..."}`;

/**
 * Klasifikasi satu item berdasarkan namanya
 * @param {string} itemName — Nama produk
 * @returns {Promise<{bab: string, sub_bab: string, rarity: string}|null>}
 */
async function classifyItem(itemName) {
    if (!itemName || itemName.trim().length < 2) return null;

    // Cek ketersediaan Hermes
    const available = await hermes.isAvailable();
    if (!available) {
        console.warn('[CLASSIFY] Hermes tidak tersedia, skip klasifikasi.');
        return null;
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
        const item = stmts.getItemById.get(itemId);
        if (!item) return;

        // Hanya klasifikasi jika bab masih "Unsorted" atau "Uncategorized"
        const needsClassify = !item.bab || item.bab === 'Unsorted' || item.bab === 'Uncategorized';
        if (!needsClassify) return;

        console.log(`[CLASSIFY] Item "${item.name}" perlu klasifikasi (bab: ${item.bab})...`);

        const classification = await classifyItem(item.name);
        if (!classification) return;

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
        eventEmitter.emit('terminal_broadcast', {
            type: 'broadcast',
            timestamp: new Date().toISOString(),
            output: [successMsg]
        });

    } catch (err) {
        // Non-fatal — jangan crash backend jika klasifikasi gagal
        console.error('[CLASSIFY] Auto-classify error:', err.message);
    }
}

module.exports = { classifyItem, autoClassifyIfNeeded };
