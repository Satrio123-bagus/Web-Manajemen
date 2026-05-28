const express = require("express");
const router = express.Router();
const fs = require("fs/promises");
const path = require("path");

const CONFIG_FILE = path.join(__dirname, "../data/config.json");

// Helper to read config
const readConfig = async () => {
    try {
        const data = await fs.readFile(CONFIG_FILE, "utf8");
        return JSON.parse(data);
    } catch (e) {
        // If file doesn't exist, return default structure
        return { adminMessage: "" };
    }
};

// GET config
router.get("/", async (req, res) => {
    try {
        const config = await readConfig();
        res.json(config);
    } catch (e) {
        console.error("Error reading config:", e);
        res.status(500).json({ error: "Failed to read config" });
    }
});

// PUT config (update)
router.put("/", async (req, res) => {
    try {
        // We expect the whole config object to be sent
        // But let's merge it with existing config to be safe
        const existingConfig = await readConfig();
        const newConfig = { ...existingConfig, ...req.body };

        await fs.writeFile(CONFIG_FILE, JSON.stringify(newConfig, null, 4));
        res.json({ message: "Config updated successfully", config: newConfig });
    } catch (e) {
        console.error("Error saving config:", e);
        res.status(500).json({ error: "Failed to save config" });
    }
});

module.exports = router;
