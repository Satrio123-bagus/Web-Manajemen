require('dotenv').config({ path: __dirname + '/../.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Database connection on startup
require('./models/dbStore');

// ─── SECURITY MIDDLEWARE ────────────────────────────────
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200, // ~13 request/menit — cukup untuk penggunaan normal, cegah scraping
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

// ─── AUTH MIDDLEWARE ────────────────────────────────────
const authMiddleware = require('./middleware/auth');

// ─── LOGIN RATE LIMITER (Brute-Force Protection) ───────
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Max 5 login attempts per 15 minutes per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'LOGIN_RATE_LIMIT // Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
});

// ─── MOUNT ROUTES ───────────────────────────────────────
app.use('/api/auth', loginLimiter, require('./routes/auth'));
app.use('/api/items', authMiddleware, require('./routes/items'));
app.use('/api/barang', authMiddleware, require('./routes/barang'));
app.use('/api', authMiddleware, require('./routes/sales')); // covers /api/sell and /api/transactions
app.use('/api/notifications', authMiddleware, require('./routes/notifications'));
app.use('/api/analytics', authMiddleware, require('./routes/analytics'));
app.use('/api/terminal/history', authMiddleware, require('./routes/history'));

const aiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 AI requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'RATE_LIMIT_EXCEEDED // AI Engine Cooling Down. Try again in a minute.' },
});

app.use('/api/terminal', authMiddleware, aiLimiter, require('./routes/terminal'));
app.use('/api/chat', authMiddleware, aiLimiter, require('./routes/chat'));
// ─── SERVE FRONTEND (PRODUCTION) ───────────────────────
const DIST_PATH = path.join(__dirname, '../../frontend/dist');
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
