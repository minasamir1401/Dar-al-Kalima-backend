const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

const sqlitePath = 'manaret_el_eman.db';
const pgURI = 'postgresql://neondb_owner:npg_I9w6ahWPzVuv@ep-rough-violet-ai9mop1v-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function migrate() {
    console.log('🚀 Starting Optimized Migration (Fix): SQLite to PostgreSQL...');

    const db = new sqlite3.Database(sqlitePath);
    const pool = new Pool({ connectionString: pgURI });

    const chunkArray = (arr, size) => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    };

    const runBatchInsert = async (tableName, targetColumns, sourceColumns, rows) => {
        if (rows.length === 0) return;

        const colNames = targetColumns.join(', ');
        const chunks = chunkArray(rows, 100);

        console.log(`⏳ Inserting ${rows.length} rows into ${tableName}...`);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const values = [];
            const placeholders = chunk.map((row, rowIdx) => {
                const rowPlaceholders = targetColumns.map((_, colIdx) => `$${rowIdx * targetColumns.length + colIdx + 1}`);
                sourceColumns.forEach(col => values.push(row[col]));
                return `(${rowPlaceholders.join(', ')})`;
            }).join(', ');

            const query = `INSERT INTO ${tableName} (${colNames}) VALUES ${placeholders}`;
            await pool.query(query, values);

            if ((i + 1) % 5 === 0 || i === chunks.length - 1) {
                console.log(`   ✅ Progress: ${Math.min((i + 1) * 100, rows.length)}/${rows.length}`);
            }
        }
    };

    const getSQLiteData = (query) => {
        return new Promise((resolve, reject) => {
            db.all(query, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    };

    try {
        await pool.query('TRUNCATE books, courses, church_videos, podcasts, kids_videos RESTART IDENTITY;');

        // 1. Books
        const books = await getSQLiteData('SELECT title, url, image, category, download_url FROM books');
        await runBatchInsert('books', ['title', 'url', 'image', 'category', 'download_url'], ['title', 'url', 'image', 'category', 'download_url'], books);

        // 2. Courses
        const courses = await getSQLiteData('SELECT title, url, image, instructor, lessons, category, lessons_data FROM courses');
        await runBatchInsert('courses', ['title', 'url', 'image', 'instructor', 'lessons', 'category', 'lessons_data'], ['title', 'url', 'image', 'instructor', 'lessons', 'category', 'lessons_data'], courses);

        // 3. Church Videos
        const videos = await getSQLiteData('SELECT title, videoId, collection FROM church_videos');
        await runBatchInsert('church_videos', ['title', 'video_id', 'collection'], ['title', 'videoId', 'collection'], videos);

        // 4. Podcasts
        const podcasts = await getSQLiteData('SELECT seriesTitle, episodeTitle, videoId FROM podcasts');
        await runBatchInsert('podcasts', ['series_title', 'episode_title', 'video_id'], ['seriesTitle', 'episodeTitle', 'videoId'], podcasts);

        // 5. Kids Videos
        const kids = await getSQLiteData('SELECT sectionTitle, title, videoId, icon, color FROM kids_videos');
        await runBatchInsert('kids_videos', ['section_title', 'title', 'video_id', 'icon', 'color'], ['sectionTitle', 'title', 'videoId', 'icon', 'color'], kids);

        console.log('🎊 MIGRATION FINISHED SUCCESSFULLY!');
    } catch (err) {
        console.error('❌ MIGRATION FAILED:', err);
    } finally {
        db.close();
        await pool.end();
        process.exit();
    }
}

migrate();
