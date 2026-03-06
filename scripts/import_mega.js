const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'manaret_el_eman.db');
const booksJson = path.join(__dirname, '../books_data_full.json');
const coursesJson = path.join(__dirname, '../courses_data_full.json');

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Books Table
    db.run(`DROP TABLE IF EXISTS books`);
    db.run(`CREATE TABLE books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        url TEXT,
        image TEXT,
        category TEXT,
        download_url TEXT
    )`);

    if (fs.existsSync(booksJson)) {
        const books = JSON.parse(fs.readFileSync(booksJson, 'utf8'));
        const stmt = db.prepare('INSERT INTO books (title, url, image, category, download_url) VALUES (?, ?, ?, ?, ?)');
        books.forEach(b => stmt.run(b.title, b.url, b.image, b.category, b.download_url));
        stmt.finalize();
        console.log(`Imported ${books.length} books.`);
    }

    // Courses Table
    db.run(`DROP TABLE IF EXISTS courses`);
    db.run(`CREATE TABLE courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        url TEXT,
        image TEXT,
        instructor TEXT,
        lessons TEXT,
        category TEXT
    )`);

    if (fs.existsSync(coursesJson)) {
        const courses = JSON.parse(fs.readFileSync(coursesJson, 'utf8'));
        const stmtC = db.prepare('INSERT INTO courses (title, url, image, instructor, lessons, category) VALUES (?, ?, ?, ?, ?, ?)');
        courses.forEach(c => stmtC.run(c.title, c.url, c.image, c.instructor, c.lessons, c.category));
        stmtC.finalize();
        console.log(`Successfully Imported ${courses.length} courses total.`);
    }
});

db.close();
