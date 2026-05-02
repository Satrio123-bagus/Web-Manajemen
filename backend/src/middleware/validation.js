const { z } = require('zod');

// Schema for item creation and updates
const itemSchema = z.object({
    name: z.string().min(1, 'Item name cannot be empty').max(100, 'Item name too long'),
    category: z.string().optional().default('MISC'),
    bab: z.string().optional().default('Uncategorized'),
    sub_bab: z.string().optional().default('Uncategorized'),
    price: z.preprocess((val) => Number(val), z.number().min(0, 'Price cannot be negative')),
    stock: z.preprocess((val) => Number(val), z.number().int('Stock must be an integer').min(0, 'Stock cannot be negative')),
    rarity: z.enum(['BIASA', 'LANGKA']).optional().default('BIASA'),
    status: z.string().optional().default('IN_STOCK'),
});

// Schema for selling items
const sellSchema = z.object({
    id: z.string().min(1, 'Item ID required'),
    quantity: z.preprocess((val) => Number(val), z.number().int('Quantity must be an integer').min(1, 'Must sell at least 1 unit').max(1000, 'Quantity too high for a single transaction')),
});

// Schema for assembling items
const assembleSchema = z.object({
    targetItemId: z.string().min(1, 'Target Item ID required'),
    quantity: z.preprocess((val) => Number(val), z.number().int('Quantity must be an integer').min(1, 'Must assemble at least 1 unit')),
    materials: z.array(z.object({
        id: z.string().min(1, 'Material Item ID required'),
        qty: z.preprocess((val) => Number(val), z.number().int('Material quantity must be an integer').min(1, 'Must use at least 1 unit of material'))
    })).min(1, 'At least one material is required')
});

// Middleware factory for validation
const validate = (schema) => (req, res, next) => {
    try {
        schema.parse(req.body);
        next();
    } catch (error) {
        return res.status(400).json({ error: `VALIDATION_FAILED: ${error.errors[0].message}` });
    }
};

module.exports = {
    itemSchema,
    sellSchema,
    assembleSchema,
    validate
};
