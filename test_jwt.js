async function run() {
    try {
        console.log("1. Attempting login...");
        const loginRes = await fetch('http://localhost:8080/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: 'admin123' })
        });
        const loginData = await loginRes.json();
        console.log("Login Response:", loginData);

        if (!loginData.token) {
            console.error("No token received!");
            return;
        }

        console.log("\n2. Fetching /api/items with token...");
        const itemsRes = await fetch('http://localhost:8080/api/items', {
            headers: { 'Authorization': 'Bearer ' + loginData.token }
        });
        
        console.log("Items Status:", itemsRes.status);
        const itemsData = await itemsRes.text();
        console.log("Items Data:", itemsData);

    } catch (e) {
        console.error("Test failed:", e);
    }
}
run();
