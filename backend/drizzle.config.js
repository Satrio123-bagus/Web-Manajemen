/** @type { import("drizzle-kit").Config } */
module.exports = {
    schema: "./src/db/schema.js",
    out: "./src/db/migrations",
    dialect: "sqlite",
    dbCredentials: {
        url: "./data/inventory.db",
    },
};
