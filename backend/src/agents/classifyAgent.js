const { stmts, refreshInventory } = require("../models/dbStore");
const hermes = require("./hermesClient");
const fs = require("fs");
const path = require("path");

const RULES_FILE = path.join(__dirname, "..", "data", "prefixRules.json");

/**
 * Membaca prefix rules dari file JSON (dinamis, bisa diubah dari Settings)
 */
function loadPrefixRules() {
    try {
        const raw = fs.readFileSync(RULES_FILE, "utf-8");
        return JSON.parse(raw).rules || [];
    } catch (err) {
        console.warn(
            "[CLASSIFY] Gagal membaca prefixRules.json, gunakan fallback kosong."
        );
        return [];
    }
}

/**
 * Membangun system prompt klasifikasi secara dinamis dari prefixRules.json
 */
function buildClassifyPrompt() {
    const rules = loadPrefixRules();
    const highRules = rules.filter((r) => r.confidence === "high");
    const mediumRules = rules.filter((r) => r.confidence === "medium");
    const lowRules = rules.filter((r) => r.confidence === "low");

    const formatList = (arr) =>
        arr
            .map((r, i) => `${i + 1}. ${r.brand}: "${r.prefix}..." (${r.type})`)
            .join("\n");

    return `Kamu adalah sistem pakar klasifikasi untuk toko elektronik INSERT3COINS.

Tugasmu: Berikan klasifikasi MERK (bab) dan JENIS produk (sub_bab) berdasarkan NAMA produk, meskipun namanya hanya berupa kode alfanumerik.

ATURAN KODE SERI REMOT:

--- PREFIX YANG BISA DIPASTIKAN (100% akurat, langsung klasifikasi) ---
${highRules.length > 0 ? formatList(highRules) : "(Tidak ada)"}

--- PREFIX CUKUP YAKIN (auto-klasifikasi, tapi tandai medium) ---
${mediumRules.length > 0 ? formatList(mediumRules) : "(Tidak ada)"}

--- PREFIX AMBIGU (JANGAN langsung diasumsikan, tandai "confidence": "low") ---
${lowRules.length > 0 ? lowRules.map((r, i) => `${i + 1}. "${r.prefix}..." → Kemungkinan ${r.brand} (${r.type}), tapi BISA brand lain. Tandai "confidence": "low".`).join("\n") : "(Tidak ada)"}

ATURAN DEDUKSI MEREK CHINA/LOKAL:
Jika nama produk TIDAK mengandung kode seri jelas tapi hanya ada tipe AC seperti "05CR", "09CR", tebak itu brand China populer (Midea/Changhong/TCL) atau jika terdapat nama merknya langsung (contoh: "Remote AC Beko", "Remote TV Changhong L32"), LANGSUNG tangkap merk tersebut!

ATURAN SPARE PART (PENTING):
Jika nama produk mengandung kata deskriptif komponen seperti "Casing", "Sensor", "PCB", "Kapasitor", "Motor", "Fan", "Kompresor", "Thermistor", "Relay", "Trafo", "Board", "Display", "Panel":
- bab = HARUS Merk utama barang tersebut (contoh: Panasonic, Daikin, atau hasil deteksi prefix). JANGAN PERNAH menggunakan bab "Spare Part".
- sub_bab = "Sparepart".
- Contoh: "Casing A75C3568" → {"bab": "Panasonic", "sub_bab": "Sparepart", "confidence": "high"}
- Contoh: "Sensor Thermistor Daikin" → {"bab": "Daikin", "sub_bab": "Sparepart", "confidence": "high"}

Aturan Output:
- "bab" = Merk utama (Panasonic, Sharp, LG, Samsung, Gree, Midea, TCL, Changhong, Polytron, Toshiba, Daikin, Universal, dll).
- "sub_bab" = "Remote" (jika unit utuh), atau "Sparepart" (jika suku cadang).
- "confidence" = "high" (pasti benar), "medium" (cukup yakin), "low" (ambigu, perlu konfirmasi user).
- Hanya gunakan "Lainnya" jika kode benar-benar tidak bisa ditebak dan tidak ada tulisan merk sama sekali.

⚠️ PENTING: Jangan tentukan rarity (biarkan sistem menentukannya). Jawab HANYA dalam format JSON SAJA:
{"bab": "...", "sub_bab": "...", "confidence": "high|medium|low"}`;
}

/**
 * Klasifikasi satu item berdasarkan namanya
 * @param {string} itemName — Nama produk
 * @returns {Promise<{bab: string, sub_bab: string, rarity: string}|null>}
 */
async function classifyItem(itemName) {
    if (!itemName || itemName.trim().length < 2) return null;

    // --- 1. PRE-PROCESSOR DETERMINISTIK (HYBRID ENGINE) ---
    const lowerName = itemName.toLowerCase();

    // a. Deteksi Sub Bab (Sparepart vs Remote)
    const sparepartKeywords = ["casing", "pcb", "mesin", "tutup"];
    let detectedSubBab = "Remote"; // Default fallback
    if (sparepartKeywords.some((kw) => lowerName.includes(kw))) {
        detectedSubBab = "Sparepart";
    }

    // b. Deteksi Bab (Merek) berdasarkan prefixRules.json
    const rules = loadPrefixRules();
    let detectedBab = null;
    let ruleConfidence = "high";

    // Urutkan rule dari yang terpanjang ke yang terpendek agar rule spesifik ("RCS-") didahulukan dari yang pendek ("RC")
    const sortedRules = [...rules].sort(
        (a, b) => b.prefix.length - a.prefix.length
    );

    for (const rule of sortedRules) {
        if (lowerName.includes(rule.prefix.toLowerCase())) {
            detectedBab = rule.brand;
            ruleConfidence = rule.confidence || "high";
            // Jika bukan sparepart, setidaknya kita jadikan Remote AC atau Remote TV berdasarkan JSON
            if (detectedSubBab !== "Sparepart") {
                if (rule.type.toLowerCase().includes("tv"))
                    detectedSubBab = "Remote TV";
                else if (rule.type.toLowerCase().includes("ac"))
                    detectedSubBab = "Remote AC";
            }
            break; // Berhenti mencari, kecocokan mutlak ditemukan
        }
    }

    // Jika ketahuan 100% dari Node.js, langsung return (Hemat API dan bebas Halusinasi!)
    if (detectedBab) {
        console.log(
            `[CLASSIFY-HYBRID] Deteksi Deterministik berhasil: "${itemName}" → Bab: ${detectedBab}, Sub: ${detectedSubBab}, Confidence: ${ruleConfidence}`
        );
        return {
            bab: detectedBab,
            sub_bab: detectedSubBab,
            confidence: ruleConfidence,
        };
    }

    // --- 2. FALLBACK KE HERMES AI (JIKA ATURAN DETERMINISTIK GAGAL) ---
    // Cek ketersediaan Hermes
    let available = await hermes.isAvailable();
    if (!available) {
        console.warn(
            "[CLASSIFY] Hermes model tidak tersedia. Mencoba pull model..."
        );
        const pulled = await hermes.pullModel();
        if (!pulled) {
            console.error("[CLASSIFY] Gagal pull model. Hermes tidak aktif.");
            return null;
        }
        available = true;
    }

    const prompt = `Klasifikasikan produk ini:\nNama: "${itemName}"\n\nJawab dalam JSON: {"bab": "...", "sub_bab": "...", "rarity": "..."}`;

    try {
        const result = await hermes.generateJSON(prompt, {
            system: buildClassifyPrompt(),
            temperature: 0.1,
            maxTokens: 80,
        });

        if (!result || !result.bab) {
            console.warn(
                `[CLASSIFY] Gagal klasifikasi "${itemName}" — respons tidak valid.`
            );
            return null;
        }

        // Hapus rarity dari hasil Hermes jika ada — rarity adalah hak pemilik toko
        delete result.rarity;

        const confidence = result.confidence || "high";
        delete result.confidence; // Jangan simpan confidence ke DB

        console.log(
            `[CLASSIFY] "${itemName}" → Bab: ${result.bab}, Sub: ${result.sub_bab}, Confidence: ${confidence} (rarity tidak diubah)`
        );
        return { ...result, confidence };
    } catch (err) {
        console.error(
            `[CLASSIFY] Error saat klasifikasi "${itemName}":`,
            err.message
        );
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
        const needsClassify =
            !item.bab ||
            item.bab === "Unsorted" ||
            item.bab === "Uncategorized";
        if (!needsClassify) {
            console.log(
                `[CLASSIFY] ─ Item "${item.name}" sudah terklasifikasi (${item.bab}), skip.`
            );
            return;
        }

        console.log(
            `[CLASSIFY] → Mengirim "${item.name}" ke Hermes untuk analisis...`
        );

        const classification = await classifyItem(item.name);
        if (!classification) {
            console.error(
                `[CLASSIFY] ✗ Hermes gagal mengklasifikasi "${item.name}" — hasil null.`
            );
            return;
        }

        // Jika confidence rendah, JANGAN auto-klasifikasi. Biarkan user konfirmasi.
        if (classification.confidence === "low") {
            const warnMsg = `[HERMES] ⚠️ Prefix ambigu terdeteksi untuk "${item.name}". Kemungkinan: ${classification.bab} (${classification.sub_bab}). Silakan konfirmasi atau ubah manual jika salah.`;
            console.log(
                `[CLASSIFY] ⚠️ Confidence LOW untuk "${item.name}" — SKIP auto-classify, broadcast peringatan.`
            );

            const eventEmitter = require("../services/eventEmitter");
            eventEmitter.emit("terminal_broadcast", {
                type: "broadcast",
                timestamp: new Date().toISOString(),
                output: [warnMsg],
            });
            return; // Tidak mengubah database — user harus konfirmasi manual
        }

        console.log(
            `[CLASSIFY] ← Hermes menjawab: bab="${classification.bab}", sub_bab="${classification.sub_bab}", confidence="${classification.confidence}"`
        );

        // Update item di database — rarity TIDAK disentuh, diambil dari data existing
        // Rarity hanya boleh diubah oleh pemilik toko secara manual
        stmts.updateItem.run(
            item.name,
            classification.bab, // category = bab
            item.price,
            item.stock,
            item.rarity, // ← Pertahankan rarity dari DB, Hermes tidak boleh ubah ini
            item.status,
            classification.bab,
            classification.sub_bab,
            item.id,
            item.location || "Belum Ditentukan" // ← Pertahankan lokasi dari DB
        );
        refreshInventory();

        const successMsg = `[HERMES] Analisis Selesai: "${item.name}" kini disorting ke Rak ${classification.bab} / ${classification.sub_bab}.`;
        console.log(
            `[CLASSIFY] ✓ "${item.name}" → ${classification.bab} / ${classification.sub_bab} | Rarity tetap: ${item.rarity}`
        );

        // Siarkan pembaruan langsung ke layar Terminal AI Manager melalui SSE
        const eventEmitter = require("../services/eventEmitter");
        console.log(`[CLASSIFY] 📡 Menyiarkan ke SSE...`);
        eventEmitter.emit("terminal_broadcast", {
            type: "broadcast",
            timestamp: new Date().toISOString(),
            output: [successMsg],
        });
        console.log(`[CLASSIFY] ✓ Siaran SSE terkirim.`);
    } catch (err) {
        // Non-fatal — jangan crash backend jika klasifikasi gagal
        console.error("[CLASSIFY] Auto-classify error:", err.message);
    }
}

module.exports = { classifyItem, autoClassifyIfNeeded };
