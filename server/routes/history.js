const express = require('express');
const router = express.Router();
const { stmts } = require('../services/dbStore');

router.delete('/', (req, res) => {
    const sessionId = req.headers['x-session-id'] || 'default';
    stmts.clearConversation.run(sessionId);
    res.json({ message: 'CONVERSATION_MEMORY_CLEARED', session: sessionId });
});

module.exports = router;
