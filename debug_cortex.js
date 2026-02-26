const http = require('http');

function request(method, path, data) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        const req = http.request(options, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function run() {
    try {
        console.log('1. Checking Status...');
        const status = await request('GET', '/api/status');
        console.log('Status:', status.status, status.body);

        console.log('\n2. Sending Terminal Command: "Tambah A75C4185"...');
        const start = Date.now();
        const term = await request('POST', '/api/terminal', { command: 'Tambah A75C4185' });
        console.log('Time:', (Date.now() - start) + 'ms');
        console.log('Response:', term.status, term.body);
    } catch (err) {
        console.error('Fatal Error:', err);
    }
}

run();
