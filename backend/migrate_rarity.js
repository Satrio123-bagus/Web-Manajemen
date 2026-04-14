/**
 * One-time migration script: COMMON/RARE → BIASA, LEGENDARY → LANGKA
 * Jalankan sekali di VPS: node backend/migrate_rarity.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'inventory.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

// Migrasi: COMMON & RARE → BIASA
const toCommon = db.prepare(`UPDATE items SET rarity = 'BIASA' WHERE rarity IN ('COMMON', 'RARE')`);
const r1 = toCommon.run();
console.log(`✔ ${r1.changes} item diubah ke BIASA (dari COMMON/RARE)`);

// Migrasi: LEGENDARY → LANGKA
const toLangka = db.prepare(`UPDATE items SET rarity = 'LANGKA' WHERE rarity = 'LEGENDARY'`);
const r2 = toLangka.run();
console.log(`✔ ${r2.changes} item diubah ke LANGKA (dari LEGENDARY)`);

db.close();
console.log('✅ Migrasi selesai. Database siap dengan tipe BIASA/LANGKA.');
