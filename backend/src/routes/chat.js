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
        
        // --- SMART CONTEXT INJECTION (KEYWORD FILTER) ---
        const words = pesan.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        let relevantItems = [];
        
        if (words.length > 0) {
            relevantItems = allItems.filter(item => {
                const searchStr = `${item.name} ${item.category} ${item.bab} ${item.sub_bab} ${item.id}`.toLowerCase();
                return words.some(w => searchStr.includes(w));
            });
        }
        
        // If no specific match or everything matched, just send top/recent items + low stock
        if (relevantItems.length === 0 || relevantItems.length > 50) {
             const lowStock = allItems.filter(i => i.stock < 5).slice(0, 10);
             const general = allItems.slice(0, 20); // Just a sample
             relevantItems = [...new Map([...lowStock, ...general].map(item => [item.id, item])).values()];
        }

        const systemPrompt = `You are the AI Assistant for the INSERT3COINS inventory system.
Personality: Cyber/Hacker tone — efficient, concise, and sharp.
You MUST answer strictly based on the inventory data provided below. Do not fabricate data.
Always respond in Bahasa Indonesia.

RELEVANT INVENTORY DATA (Partial Context):
${JSON.stringify(relevantItems, null, 2)}

Answer the operator's question using ONLY the data above. Be concise and precise.`;

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
