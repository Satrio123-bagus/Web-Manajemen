function validateItem(req, res, next) {
    const { name, category, price, stock, rarity, bab, sub_bab } = req.body;

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0 || name.length > 100)) {
        return res.status(400).json({ error: 'VALIDATION_FAILED: name must be a non-empty string (max 100 chars)' });
    }
    if (category !== undefined && (typeof category !== 'string' || category.trim().length === 0 || category.length > 50)) {
        return res.status(400).json({ error: 'VALIDATION_FAILED: category must be a non-empty string (max 50 chars)' });
    }
    if (bab !== undefined && (typeof bab !== 'string' || bab.trim().length === 0 || bab.length > 50)) {
        return res.status(400).json({ error: 'VALIDATION_FAILED: bab must be a non-empty string (max 50 chars)' });
    }
    if (sub_bab !== undefined && (typeof sub_bab !== 'string' || sub_bab.trim().length === 0 || sub_bab.length > 50)) {
        return res.status(400).json({ error: 'VALIDATION_FAILED: sub_bab must be a non-empty string (max 50 chars)' });
    }
    if (price !== undefined && (typeof price !== 'number' || price < 0 || !isFinite(price))) {
        return res.status(400).json({ error: 'VALIDATION_FAILED: price must be a non-negative number' });
    }
    if (stock !== undefined && (typeof stock !== 'number' || stock < 0 || !Number.isInteger(stock))) {
        return res.status(400).json({ error: 'VALIDATION_FAILED: stock must be a non-negative integer' });
    }
    if (rarity !== undefined && !['COMMON', 'RARE', 'LEGENDARY'].includes(rarity)) {
        return res.status(400).json({ error: 'VALIDATION_FAILED: rarity must be COMMON, RARE, or LEGENDARY' });
    }

    next();
}

module.exports = { validateItem };
