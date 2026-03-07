require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Database connection on startup
require('./services/dbStore');

// ─── SECURITY MIDDLEWARE ────────────────────────────────
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'RATE_LIMIT_EXCEEDED // Too many requests, try again later.' },
});
app.use('/api/', limiter);
app.use(express.json({ limit: '10kb' }));

// ─── HEALTH CHECK ENDPOINT ─────────────────────────────
app.get('/api/status', (req, res) => {
    res.json({ status: 'ONLINE', timestamp: new Date().toISOString() });
});

// ─── MOUNT ROUTES ───────────────────────────────────────
app.use('/api/items', require('./routes/items'));
app.use('/api', require('./routes/sales')); // covers /api/sell and /api/transactions
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/terminal/history', require('./routes/history'));
app.use('/api/terminal', require('./routes/terminal'));
app.use('/api/chat', require('./routes/chat'));

// ─── SERVE FRONTEND (PRODUCTION) ───────────────────────
const DIST_PATH = path.join(__dirname, '../client/dist');
app.use(express.static(DIST_PATH));
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(DIST_PATH, 'index.html'));
    } else {
        res.status(404).json({ error: 'API_ROUTE_NOT_FOUND' });
    }
});

// ─── STARTUP LOGIC ──────────────────────────────────────
let retryCount = 0;
const MAX_RETRIES = 3;
const server = app.listen(PORT, () => {
    retryCount = 0;
    console.log(`\n  >> INSERT3COINS API // PORT: ${PORT} // STATUS: ONLINE`);
    console.log(`  >> SECURITY: Helmet ✓ | Rate-Limit ✓ | CORS ✓`);
    console.log(`  >> ARCHITECTURE: Modularized Routes ✓\n`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        retryCount++;
        if (retryCount > MAX_RETRIES) {
            console.error(`\n  >> [ERROR] Port ${PORT} in use.`);
            process.exit(1);
        }
        setTimeout(() => { server.close(); server.listen(PORT); }, 3000);
    } else {
        console.error('  >> [ERROR] Server failed:', err.message);
        process.exit(1);
    }
});
