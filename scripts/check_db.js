const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'backend', 'manaret_el_eman.db'));

db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, tables) => {
    if (err) console.error(err);
    else {
        console.log('Tables:', tables.map(t => t.name).join(', '));
        tables.forEach(table => {
            db.all(`PRAGMA table_info(${table.name});`, (err, info) => {
                console.log(`\nTable Schema for ${table.name}:`);
                console.table(info);
            });
        });
    }
});
