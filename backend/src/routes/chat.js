const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const { stmts } = require('../models/dbStore');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

router.post('/', async (req, res) => {
    const { pesan, sessionId } = req.body;
    const session = sessionId || 'session-1';

    if (!pesan || typeof pesan !== 'string') {
        return res.status(400).json({ error: 'INVALID_INPUT: field "pesan" (string) is required.' });
    }

    if (pesan.length > 500) {
        return res.status(400).json({ error: 'INVALID_INPUT: Pesan terlalu panjang (maksimal 500 karakter).' });
    }

    try {
        const allItems = stmts.getAllItems.all();
        const allJobs = stmts.getProductionJobs.all();
        
        // --- SMART CONTEXT INJECTION (KEYWORD FILTER WITH SCORING) ---
        const stopWords = ['dimana', 'letak', 'ada', 'tolong', 'cek', 'stok', 'berapa', 'jual', 'tambah', 'hapus', 'ubah', 'jadi', 'ke', 'di', 'dari', 'buat', 'bikin', 'rakit', 'untuk', 'barang'];
        const words = pesan.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
        
        let relevantItems = [];
        let relevantJobs = [];
        if (words.length > 0) {
            // Scoring for Items (Gudang Utama)
            const scoredItems = allItems.map(item => {
                const searchStr = `${item.name} ${item.category} ${item.bab} ${item.sub_bab} ${item.id}`.toLowerCase();
                let score = 0;
                words.forEach(w => {
                    if (searchStr.includes(w)) {
                        score += 1;
                        if (/\d/.test(w)) score += 5; // Extra weight for numbers/model codes
                    }
                });
                return { item, score };
            }).filter(obj => obj.score > 0);
            
            scoredItems.sort((a, b) => b.score - a.score);
            relevantItems = scoredItems.map(obj => obj.item);

            // Scoring for Jobs (Papan Produksi/WIP)
            const scoredJobs = allJobs.map(job => {
                const searchStr = `${job.tipe_remote} ${job.merk} ${job.komponen} ${job.status} ${job.supplier}`.toLowerCase();
                let score = 0;
                words.forEach(w => {
                    if (searchStr.includes(w)) {
                        score += 1;
                        if (/\d/.test(w)) score += 5;
                    }
                });
                return { job, score };
            }).filter(obj => obj.score > 0);

            scoredJobs.sort((a, b) => b.score - a.score);
            relevantJobs = scoredJobs.map(obj => obj.job);
        }
        
        // If no specific match, just send top/recent items + low stock
        if (relevantItems.length === 0 && relevantJobs.length === 0) {
             const lowStock = allItems.filter(i => i.stock < 2).slice(0, 10);
             const general = allItems.slice(0, 20); // Just a sample
             relevantItems = [...new Map([...lowStock, ...general].map(item => [item.id, item])).values()];
             relevantJobs = allJobs.slice(0, 10);
        }

        const systemPrompt = `You are the AI Assistant for the INSERT3COINS inventory system.
Personality: Cyber/Hacker tone — efficient, concise, and sharp.
You MUST answer strictly based on the inventory data provided below. Do not fabricate data.
Always respond in Bahasa Indonesia.

--- DATA GUDANG UTAMA (BARANG JADI / LULUS QC) ---
${JSON.stringify(relevantItems.slice(0, 30), null, 2)}

--- DATA PAPAN PRODUKSI (BARANG MENTAH / PROSES CASING / SEDANG DI QC) ---
${JSON.stringify(relevantJobs.slice(0, 30), null, 2)}

Answer the operator's question using ONLY the data above. Be concise and precise. If they ask about barang Casing or mentah, refer to DATA PAPAN PRODUKSI.`;

        const chatCompletion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: pesan },
            ],
            temperature: 0.7,
            max_tokens: 500,
        });

        const aiResponse = chatCompletion.choices?.[0]?.message?.content || '[CORTEX] Tidak ada respons dari AI.';

        const ts = new Date().toISOString();
        stmts.insertConversation.run(session, 'user', pesan, ts);
        stmts.insertConversation.run(session, 'ai', aiResponse, ts);

        res.json({ balasan: aiResponse });
    } catch (err) {
        console.error('[CHAT GROQ ERROR]', err.stack || err);
        // ─── SECURITY: Don't leak internal error details to client ───
        res.status(500).json({
            error: 'AI_CHAT_FAILED',
            message: 'Terjadi kesalahan pada AI Engine. Coba lagi nanti.',
        });
    }
});

module.exports = router;
