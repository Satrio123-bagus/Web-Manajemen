const db = require('better-sqlite3')('backend/src/db/cortex.db');
console.log('--- INVENTORY (items) ---');
console.log(db.prepare(`SELECT name, stock FROM items WHERE name LIKE '%(Tanpa Mika)%' OR name LIKE '%(Tanpa Tutup)%' OR condition = 'WIP'`).all());
console.log('--- PRODUCTION BOARD (production_jobs) ---');
console.log(db.prepare(`SELECT merk, tipe_remote, komponen, status, alokasi FROM production_jobs WHERE status IN ('MENTAH', 'PROSES', 'QC_CEK')`).all());
