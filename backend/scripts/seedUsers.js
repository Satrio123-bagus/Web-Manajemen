const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { stmts } = require('../src/models/dbStore');

async function seedUsers() {
    console.log('Seeding initial users...');

    const usersToSeed = [
        { username: 'admin', password: 'adminpassword', role: 'ADMIN' },
        { username: 'pekerja_ab', password: 'casingpassword', role: 'CASING' },
        { username: 'pekerja_c', password: 'mesinpassword', role: 'MESIN' },
    ];

    let count = 0;
    for (const user of usersToSeed) {
        const existingUser = stmts.getUserByUsername.get(user.username);
        if (!existingUser) {
            const hash = await bcrypt.hash(user.password, 10);
            const id = randomUUID();
            stmts.insertUser.run(id, user.username, hash, user.role);
            console.log(`Created user: ${user.username} (Role: ${user.role}) with password: ${user.password}`);
            count++;
        } else {
            console.log(`User ${user.username} already exists.`);
        }
    }

    console.log(`Seeding complete. Added ${count} users.`);
    process.exit(0);
}

seedUsers().catch(err => {
    console.error('Error seeding users:', err);
    process.exit(1);
});
