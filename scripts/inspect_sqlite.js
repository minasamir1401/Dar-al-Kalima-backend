const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('manaret_el_eman.db');
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    console.log('Tables:', tables);
    tables.forEach(t => {
        db.get(`SELECT count(*) as count FROM ${t.name}`, (err, row) => {
            console.log(`Table ${t.name} has ${row.count} records`);
        });
    });
});
