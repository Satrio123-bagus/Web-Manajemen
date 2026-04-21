const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    // ─── SECURITY: Reject all requests if JWT_SECRET is not configured ───
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error('[FATAL] JWT_SECRET is not set in .env! Rejecting all authenticated requests.');
        return res.status(500).json({
            error: 'SERVER_CONFIG_ERROR',
            message: 'Konfigurasi server tidak lengkap. Hubungi administrator.'
        });
    }

    // Read JWT Token from headers OR query params (for SSE EventSource)
    const authHeader = req.header('Authorization');
    const queryToken = req.query.token;
    
    if (!authHeader?.startsWith('Bearer ') && !queryToken) {
        return res.status(401).json({
            error: 'UNAUTHORIZED_ACCESS_BLOCKED',
            message: 'Akses Ditolak. Membutuhkan Token Autentikasi.'
        });
    }

    const token = queryToken || authHeader.replace('Bearer ', '');

    try {
        // Verify token
        const decoded = jwt.verify(token, jwtSecret);
        req.user = decoded; // attach user info
        next();
    } catch (err) {
        return res.status(401).json({
            error: 'INVALID_TOKEN_BREACH_DETECTED',
            message: 'Token Ditolak, Kadaluarsa, atau Manipulasi Terdeteksi.'
        });
    }
};

module.exports = authMiddleware;
