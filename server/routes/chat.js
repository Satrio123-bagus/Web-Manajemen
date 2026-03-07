const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const { stmts } = require('../services/dbStore');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

router.post('/', async (req, res) => {
    const { pesan, sessionId } = req.body;
    const session = sessionId || 'session-1';

    if (!pesan || typeof pesan !== 'string') {
        return res.status(400).json({ error: 'INVALID_INPUT: field "pesan" (string) is required.' });
    }

    try {
        const items = stmts.getAllItems.all();
        const systemPrompt = `You are the AI Assistant for the INSERT3COINS inventory system.
Personality: Cyber/Hacker tone — efficient, concise, and sharp.
You MUST answer strictly based on the inventory data provided below. Do not fabricate data.
Always respond in Bahasa Indonesia.

INVENTORY DATA (JSON):
${JSON.stringify(items, null, 2)}

Answer the operator's question using ONLY the data above. Be concise.`;

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
        console.error('[CHAT GROQ ERROR]', err.message || err);
        res.status(500).json({
            error: 'AI_CHAT_FAILED',
            detail: err.message?.slice(0, 120) || 'Unknown error',
        });
    }
});

module.exports = router;
