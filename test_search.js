const http = require('http');

function request(path) {
    return new Promise((resolve, reject) => {
        http.get({ hostname: 'localhost', port: 5000, path }, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        }).on('error', reject);
    });
}

async function run() {
    try {
        console.log('1. Searching for "a"...');
        const res = await request('/api/items?q=a');
        console.log('Status:', res.status);
        const items = JSON.parse(res.body);
        console.log('Found:', items.length, 'items');
        if (items.length > 0) console.log('First:', items[0].name);

        console.log('\n2. Searching for "NONEXISTENT_ITEM"...');
        const res2 = await request('/api/items?q=NONEXISTENT_ITEM');
        const items2 = JSON.parse(res2.body);
        console.log('Found:', items2.length, 'items (Expected 0)');

        console.log('\n3. Fetching ALL (no query)...');
        const res3 = await request('/api/items');
        const items3 = JSON.parse(res3.body);
        console.log('Found:', items3.length, 'items');
    } catch (err) {
        console.error('Error:', err);
    }
}

run();
