// ─── HERMES CLIENT ──────────────────────────────────────────────────────────
// Wrapper untuk berkomunikasi dengan Ollama API (Hermes 3B lokal di VPS).
// Digunakan oleh agent scripts (report, classify, dll).

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://ollama:11434';
const MODEL_NAME = 'llama3.2:3b';
const TIMEOUT_MS = 120_000; // 2 menit — model 3B di CPU perlu waktu loading

/**
 * Cek apakah Ollama service hidup dan model tersedia
 * @returns {Promise<boolean>}
 */
async function isAvailable() {
    try {
        const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return false;
        const data = await res.json();
        const models = data.models || [];
        return models.some(m => m.name === MODEL_NAME || m.name.startsWith('llama3.2'));
    } catch {
        return false;
    }
}

/**
 * Pull model Hermes 3B jika belum tersedia (first-time setup)
 * @returns {Promise<boolean>} true jika berhasil
 */
async function pullModel() {
    try {
        console.log(`[HERMES] Pulling model ${MODEL_NAME}...`);
        const res = await fetch(`${OLLAMA_HOST}/api/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: MODEL_NAME, stream: false }),
            signal: AbortSignal.timeout(600_000), // 10 menit untuk download
        });
        if (!res.ok) {
            console.error(`[HERMES] Pull failed: ${res.status}`);
            return false;
        }
        console.log(`[HERMES] Model ${MODEL_NAME} berhasil di-download.`);
        return true;
    } catch (err) {
        console.error(`[HERMES] Pull error: ${err.message}`);
        return false;
    }
}

/**
 * Kirim prompt ke Hermes dan terima respons teks
 * @param {string} prompt — Prompt yang dikirim ke model
 * @param {object} options — Opsi tambahan
 * @param {string} options.system — System prompt (opsional)
 * @param {number} options.temperature — Kreativitas (default: 0.3)
 * @param {number} options.maxTokens — Batas token output (default: 1000)
 * @returns {Promise<string>} Respons teks dari Hermes
 */
async function generate(prompt, options = {}) {
    const { system, temperature = 0.3, maxTokens = 1000 } = options;

    const body = {
        model: MODEL_NAME,
        prompt,
        stream: false,
        options: {
            temperature,
            num_predict: maxTokens,
            num_ctx: 2048, // Batasi context window agar jauh lebih hemat RAM
        },
    };

    if (system) body.system = system;

    try {
        const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => 'unknown');
            throw new Error(`Ollama API error ${res.status}: ${errText}`);
        }

        const data = await res.json();
        const response = data.response || '';

        console.log(`[HERMES] Generated ${response.length} chars in ${Math.round((data.total_duration || 0) / 1e9)}s`);
        return response;
    } catch (err) {
        if (err.name === 'TimeoutError') {
            throw new Error(`[HERMES] Timeout: model tidak merespons dalam ${TIMEOUT_MS / 1000} detik.`);
        }
        throw err;
    }
}

/**
 * Kirim prompt ke Hermes dan minta respons JSON terstruktur
 * @param {string} prompt — Prompt dengan instruksi JSON
 * @param {object} options — Opsi generate
 * @returns {Promise<object|null>} Parsed JSON atau null jika gagal
 */
async function generateJSON(prompt, options = {}) {
    const response = await generate(prompt, { ...options, temperature: 0.1 });

    // Coba parse JSON dari respons (kadang model membungkus dalam ```json ... ```)
    try {
        // Coba langsung parse
        return JSON.parse(response.trim());
    } catch {
        // Coba ekstrak JSON dari markdown code block
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[1].trim());
            } catch {
                // fall through
            }
        }

        // Coba cari objek JSON pertama di respons
        const braceMatch = response.match(/\{[\s\S]*\}/);
        if (braceMatch) {
            try {
                return JSON.parse(braceMatch[0]);
            } catch {
                // fall through
            }
        }

        console.warn('[HERMES] Failed to parse JSON from response:', response.slice(0, 200));
        return null;
    }
}

module.exports = { isAvailable, pullModel, generate, generateJSON, MODEL_NAME, OLLAMA_HOST };
