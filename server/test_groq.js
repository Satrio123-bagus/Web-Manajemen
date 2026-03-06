require('dotenv').config({ path: __dirname + '/.env' });
const Groq = require('groq-sdk');

async function testGroqChat() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        console.error('[FAIL] GROQ_API_KEY is missing in .env');
        return;
    }

    console.log('[START] Testing Groq — Llama 3.3 70B Versatile...');
    const groq = new Groq({ apiKey });

    try {
        const chatCompletion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content: 'You are CORTEX, the Central Mainframe AI of the INSERT3COINS cyberpunk inventory store. Personality: cynical, efficient, robotic, dark cyberpunk tone. Always respond in Bahasa Indonesia.',
                },
                {
                    role: 'user',
                    content: 'Status report on the mainframe.',
                },
            ],
            temperature: 0.7,
            max_tokens: 300,
        });

        const text = chatCompletion.choices?.[0]?.message?.content || 'No response';

        console.log('[SUCCESS] Groq — Llama 3.3 70B Response:');
        console.log('-----------------------------------');
        console.log(text);
        console.log('-----------------------------------');
        console.log(`[INFO] Model: ${chatCompletion.model || 'unknown'}`);
        console.log(`[INFO] Tokens used: ${chatCompletion.usage?.total_tokens || 'N/A'}`);
    } catch (error) {
        console.error('[ERROR] Failed to connect to Groq:', error.message);
    }
}

testGroqChat();
