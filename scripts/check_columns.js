const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('manaret_el_eman.db');

const tables = ['books', 'courses', 'church_videos', 'podcasts', 'kids_videos'];

tables.forEach(table => {
    db.all(`PRAGMA table_info(${table})`, (err, rows) => {
        console.log(`Schema for ${table}:`, rows.map(r => r.name));
    });
});
