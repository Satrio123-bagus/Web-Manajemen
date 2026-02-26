module.exports = {
    apps: [
        {
            name: "server",
            script: "./server.js",
            cwd: "./server",
            watch: ["./server.js", "./.env"],
            ignore_watch: ["node_modules", "inventory.db*"],
            env: {
                NODE_ENV: "development",
                PORT: 8080,
            }
        },
        {
            name: "client",
            script: "./node_modules/vite/bin/vite.js",
            cwd: "./client",
            env: {
                NODE_ENV: "development",
            }
        }
    ]
};
