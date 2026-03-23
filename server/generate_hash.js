/**
 * Utility: Generate bcrypt hash untuk password admin baru.
 * 
 * Cara pakai:
 *   node generate_hash.js <password_baru>
 * 
 * Contoh:
 *   node generate_hash.js MyStr0ng!P@ssw0rd2026
 * 
 * Copy hash yang dihasilkan, lalu paste ke .env sebagai ADMIN_PASSWORD_HASH.
 */

const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
    console.error('❌ Gunakan: node generate_hash.js <password_baru>');
    process.exit(1);
}

const SALT_ROUNDS = 12;

bcrypt.hash(password, SALT_ROUNDS, (err, hash) => {
    if (err) {
        console.error('❌ Gagal membuat hash:', err.message);
        process.exit(1);
    }
    console.log('\n✅ Bcrypt Hash berhasil dibuat:\n');
    console.log(hash);
    console.log('\n📋 Copy hash di atas, lalu paste ke file .env sebagai:');
    console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
});
