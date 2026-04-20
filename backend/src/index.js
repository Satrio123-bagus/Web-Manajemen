require('dotenv').config({ path: __dirname + '/../.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Database connection on startup
require('./models/dbStore');

// ─── SECURITY MIDDLEWARE ────────────────────────────────
// Helmet dengan CSP eksplisit — mencegah XSS, clickjacking, MIME sniffing
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc:     ["'self'"],
            scriptSrc:      ["'self'", "'unsafe-inline'", "https://static.cloudflareinsights.com"],
            styleSrc:       ["'self'", "'unsafe-inline'"],  // Tailwind perlu inline style
            imgSrc:         ["'self'", "data:", "blob:"],   // Untuk gambar base64 Vision
            connectSrc:     ["'self'", "https://static.cloudflareinsights.com", "https://cloudflareinsights.com"],
            fontSrc:        ["'self'", "https://fonts.gstatic.com"],
            objectSrc:      ["'none'"],           // Blokir Flash/plugin lama
            upgradeInsecureRequests: [],          // Paksa HTTP → HTTPS
        },
    },
    crossOriginEmbedderPolicy: false,   // Diperlukan agar gambar blob Vision bisa dimuat
    hsts: {
        maxAge: 31536000,   // 1 tahun
        includeSubDomains: true,
        preload: true,
    },
}));

// CORS: Hanya izinkan origin HTTPS yang terdaftar
// Di production: ALLOWED_ORIGINS=https://3coinsstock.com
// Di development: izinkan localhost (http ok karena lokal)
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
    origin: (origin, callback) => {
        // Izinkan request tanpa origin (curl, Postman, server-to-server)
        if (!origin) return callback(null, true);
        // Tolak origin yang menggunakan HTTP plaintext di production
        if (process.env.NODE_ENV === 'production' && origin.startsWith('http://')) {
            return callback(new Error(`CORS: Origin HTTP plaintext ditolak: ${origin}`), false);
        }
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`CORS: Origin tidak diizinkan: ${origin}`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'RATE_LIMIT_EXCEEDED // Too many requests, try again later.' },
});
app.use('/api/', limiter);

// Body size limit: 1MB default, 5MB HANYA untuk endpoint Vision
app.use((req, res, next) => {
    if (req.path.startsWith('/api/terminal/vision') || req.path.startsWith('/api/chat')) {
        express.json({ limit: '5mb' })(req, res, next);
    } else {
        express.json({ limit: '64kb' })(req, res, next);  // 64KB cukup untuk semua API lain
    }
});

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
app.use('/api/terminal/vision', authMiddleware, aiLimiter, require('./routes/vision'));
app.use('/api/chat', authMiddleware, aiLimiter, require('./routes/chat'));
app.use('/api/push', authMiddleware, require('./routes/push'));  // Web Push Notifications
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
    console.log(`  >> ARCHITECTURE: Modularized Routes ✓`);

    // ─── HERMES AGENT: Startup check + Cron scheduler ──────────────────
    const hermes = require('./agents/hermesClient');
    const { generateDailyReport } = require('./agents/reportAgent');
    const { detectAnomalies } = require('./agents/anomalyAgent');
    const push = require('./agents/pushNotifier');

    hermes.isAvailable().then(available => {
        if (available) {
            console.log(`  >> HERMES AGENT: Online ✓ (${hermes.MODEL_NAME})`);
        } else {
            console.log(`  >> HERMES AGENT: Offline (model akan di-pull saat pertama dipakai)`);
        }
    }).catch(() => {
        console.log(`  >> HERMES AGENT: Ollama belum tersedia, skip.`);
    });

    if (push.isPushConfigured()) {
        console.log(`  >> PUSH NOTIFIER: Active ✓`);
    }

    // Cron: Laporan harian setiap jam 00:00 WIB (UTC+7 = 17:00 UTC)
    cron.schedule('0 17 * * *', async () => {
        console.log('[CRON] Memulai pembuatan laporan harian...');
        try {
            const result = await generateDailyReport();
            if (result.success) {
                console.log('[CRON] ✓ Laporan harian berhasil dibuat.');
                // Kirim push notifikasi: laporan siap
                const preview = result.report ? result.report.slice(0, 120) + '...' : '';
                push.sendReportReadyPush(preview).catch(() => {});
            } else {
                console.warn('[CRON] ✗ Laporan gagal:', result.error);
            }
        } catch (err) {
            console.error('[CRON] Error:', err.message);
        }
    }, { timezone: 'UTC' });

    // Cron: Cek stok kritis setiap 6 jam → kirim push alert jika ada
    cron.schedule('0 */6 * * *', async () => {
        try {
            const { state } = require('./models/dbStore');
            const lowStock = state.inventory.filter(i => i.stock < 5);
            if (lowStock.length > 0) {
                console.log(`[CRON:STOCK] ${lowStock.length} item stok kritis → kirim push alert`);
                await push.sendLowStockPush(lowStock);
            }
        } catch (err) {
            console.error('[CRON:STOCK] Error:', err.message);
        }
    }, { timezone: 'UTC' });

    // Cron: Deteksi anomali transaksi setiap Senin jam 08:00 WIB (01:00 UTC)
    // Menganalisis 14 hari terakhir — memberi gambaran performa minggu yang baru selesai
    cron.schedule('0 1 * * 1', async () => {
        console.log('[CRON:ANOMALY] Memulai deteksi anomali mingguan...');
        try {
            const result = await detectAnomalies();
            if (result.anomalyCount > 0) {
                console.log(`[CRON:ANOMALY] ✓ ${result.anomalyCount} anomali ditemukan dan dilaporkan.`);
            } else {
                console.log('[CRON:ANOMALY] ✓ Tidak ada anomali signifikan, sistem normal.');
            }
        } catch (err) {
            console.error('[CRON:ANOMALY] Error:', err.message);
        }
    }, { timezone: 'UTC' });

    // Cron: Backup database setiap jam 01:00 WIB (UTC+7 = 18:00 UTC)
    cron.schedule('0 18 * * *', () => {
        const fs = require('fs');
        const path = require('path');
        const DB_SOURCE = path.join(__dirname, '../../data/inventory.db');
        const BACKUP_DIR = path.join(__dirname, '../../data/backups');
        const MAX_BACKUPS = 30;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupFile = path.join(BACKUP_DIR, `inventory_${timestamp}.db`);

        try {
            if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
            if (!fs.existsSync(DB_SOURCE)) { console.warn('[CRON:BACKUP] DB tidak ditemukan.'); return; }

            fs.copyFileSync(DB_SOURCE, backupFile);
            console.log(`[CRON:BACKUP] ✓ Database di-backup ke: ${backupFile}`);

            // Hapus backup lama jika melebihi MAX_BACKUPS
            const files = fs.readdirSync(BACKUP_DIR)
                .filter(f => f.startsWith('inventory_') && f.endsWith('.db'))
                .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
                .sort((a, b) => b.time - a.time);

            if (files.length > MAX_BACKUPS) {
                files.slice(MAX_BACKUPS).forEach(f => {
                    fs.unlinkSync(path.join(BACKUP_DIR, f.name));
                    console.log(`[CRON:BACKUP] 🗑️ Hapus backup lama: ${f.name}`);
                });
            }
            console.log(`[CRON:BACKUP] Total backup: ${Math.min(files.length, MAX_BACKUPS)}/${MAX_BACKUPS}`);
        } catch (err) {
            console.error('[CRON:BACKUP] Error:', err.message);
        }
    }, { timezone: 'UTC' });

    console.log(`  >> CRON: Laporan harian @ 00:00 WIB ✓`);
    console.log(`  >> CRON: Backup database @ 01:00 WIB ✓\n`);
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
