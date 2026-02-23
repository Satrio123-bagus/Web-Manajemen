require('dotenv').config({ path: __dirname + '/.env' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GOOGLE_API_KEY_HERE') {
        console.error('[FAIL] GOOGLE_API_KEY is missing or is still a placeholder.');
        return;
    }

    console.log('[START] Testing Gemini 3.1 Pro...');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro" });

    try {
        const chat = model.startChat({
            history: [
                { role: 'user', parts: [{ text: "You are CORTEX, the Central Mainframe AI of the INSERT3COINS cyberpunk inventory store. Personality: cynical, efficient, robotic, dark cyberpunk tone." }] },
                { role: 'model', parts: [{ text: '[CORTEX] Systems initialized. Awaiting operator input.' }] },
            ],
        });

        const result = await chat.sendMessage("Status report on the mainframe.");
        const response = await result.response;
        const text = response.text();

        console.log('[SUCCESS] Gemini 3.1 Pro Response:');
        console.log('-----------------------------------');
        console.log(text);
        console.log('-----------------------------------');
    } catch (error) {
        console.error('[ERROR] Failed to connect to Gemini 3.1 Pro:', error.message);
    }
}

testGemini();
