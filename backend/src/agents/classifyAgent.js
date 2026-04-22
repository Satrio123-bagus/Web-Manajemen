// ─── CLASSIFY AGENT ─────────────────────────────────────────────────────────
// Agen klasifikasi produk otomatis. Saat item baru ditambahkan tanpa kategori
// (bab = "Unsorted"), Hermes otomatis menentukan bab, sub_bab, dan rarity.

const { stmts, refreshInventory } = require('../models/dbStore');
const hermes = require('./hermesClient');

const CLASSIFY_SYSTEM_PROMPT = `Kamu adalah sistem klasifikasi pakar untuk toko elektronik INSERT3COINS.

Tugasmu: Berikan klasifikasi MERK dan JENIS produk berdasarkan NAMA produk (meskipun namanya hanya berupa kode alfanumerik).

ATURAN KODE SERI REMOT (HAFALKAN INI):
- Awalan "A75C..." (contoh: A75C3223, A75C3560, dll) ADALAH remote buatan Panasonic.
- Awalan "YB..." (contoh: YB1FA, YB1F2, dll) ADALAH remote buatan Sharp.
- Awalan "ARC..." (contoh: ARC430A55) ADALAH remote buatan Daikin.
- Awalan "AKB..." atau "6711A..." ADALAH remote buatan LG.
- Awalan "ZH/..." atau "DG11..." ADALAH remote buatan Midea/Chigo.

Aturan Output:
- "bab" = Merk/Brand utama produk tersebut (wajib gunakan referensi kode seri di atas jika nama berupa kode. Jika tidak, ambil dari nama merk yang tertera di teks).
- "sub_bab" = Jenis produk. Jika berupa kode seri remote seperti di atas, wajib diset menjadi "Remote AC" atau "Remote TV".
- Jangan gunakan "Lainnya" kecuali kamu benar-benar buta tentang awalan kodenya.

⚠️ PENTING: Jangan tentukan rarity (biarkan sistem menentukannya). Jawab HANYA dalam format JSON SAJA, tanpa karakter tambahan apapun:
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
