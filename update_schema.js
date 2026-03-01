const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'manaret_el_eman.db'));

db.serialize(() => {
    // 1. Create Church Videos Table
    db.run(`CREATE TABLE IF NOT EXISTS church_videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        videoId TEXT NOT NULL,
        collection TEXT NOT NULL
    )`);

    // 2. Create Podcasts Table
    db.run(`CREATE TABLE IF NOT EXISTS podcasts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seriesTitle TEXT NOT NULL,
        episodeTitle TEXT NOT NULL,
        videoId TEXT NOT NULL
    )`);

    // 3. Create Kids Videos Table
    db.run(`CREATE TABLE IF NOT EXISTS kids_videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sectionTitle TEXT NOT NULL,
        title TEXT NOT NULL,
        videoId TEXT NOT NULL,
        icon TEXT,
        color TEXT
    )`);

    console.log("New tables created successfully.");
});
db.close();
