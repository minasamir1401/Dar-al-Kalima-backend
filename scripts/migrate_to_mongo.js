require('dotenv').config();
const mongoose = require('mongoose');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI || MONGODB_URI.includes('YOUR_PASSWORD')) {
    console.error("❌ ERROR: Please put your real password in backend/.env first!");
    process.exit(1);
}

// Schemas
const Book = mongoose.model('Book', new mongoose.Schema({ title: String, url: String, image: String, category: String, download_url: String }));
const Course = mongoose.model('Course', new mongoose.Schema({ title: String, url: String, image: String, instructor: String, lessons: String, category: String }));
const ChurchVideo = mongoose.model('ChurchVideo', new mongoose.Schema({ title: String, videoId: String, collection: String }));
const Podcast = mongoose.model('Podcast', new mongoose.Schema({ seriesTitle: String, episodeTitle: String, videoId: String }));
const KidsVideo = mongoose.model('KidsVideo', new mongoose.Schema({ sectionTitle: String, title: String, videoId: String, icon: String, color: String }));

async function migrate() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("✅ Connected to MongoDB Atlas");

        const db = new sqlite3.Database(path.join(__dirname, 'manaret_el_eman.db'));

        // Helper to migrate one table
        const migrateTable = (tableName, Model) => {
            return new Promise((resolve, reject) => {
                db.all(`SELECT * FROM ${tableName}`, async (err, rows) => {
                    if (err) return reject(err);
                    if (rows.length === 0) return resolve();

                    // Remove SQLite 'id' to let MongoDB generate its own _id
                    const cleanedRows = rows.map(r => {
                        const { id, ...rest } = r;
                        return rest;
                    });

                    await Model.insertMany(cleanedRows);
                    console.log(`✅ Migrated ${rows.length} records from ${tableName}`);
                    resolve();
                });
            });
        };

        await migrateTable('books', Book);
        await migrateTable('courses', Course);
        await migrateTable('church_videos', ChurchVideo);
        await migrateTable('podcasts', Podcast);
        await migrateTable('kids_videos', KidsVideo);

        console.log("\n🎊 MIGRATION COMPLETE! All your data is now on the cloud.");
        db.close();
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    }
}

migrate();
