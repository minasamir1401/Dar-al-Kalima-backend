const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../manaret_el_eman.db');
const jsonPath = path.join(__dirname, '../frontend/public/data/books.json');

const db = new sqlite3.Database(dbPath);

if (!fs.existsSync(jsonPath)) {
    console.error('books_data.json not found!');
    process.exit(1);
}

const books = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

db.serialize(() => {
    // Drop table and recreate it with the correct schema
    db.run(`DROP TABLE IF EXISTS books`);

    db.run(`CREATE TABLE books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        url TEXT,
        image TEXT,
        category TEXT,
        download_url TEXT
    )`);

    const stmt = db.prepare('INSERT INTO books (title, url, image, category, download_url) VALUES (?, ?, ?, ?, ?)');

    books.forEach(book => {
        stmt.run(book.title, book.url, book.image, book.category, book.download_url);
    });

    stmt.finalize();
    console.log('Database import complete.');
});

db.close();
