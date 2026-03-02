const { Pool } = require('pg');
const pgURI = 'postgresql://neondb_owner:npg_I9w6ahWPzVuv@ep-rough-violet-ai9mop1v-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString: pgURI, ssl: true });

async function checkCounts() {
    try {
        const tables = ['books', 'courses', 'church_videos', 'podcasts', 'kids_videos'];
        for (const table of tables) {
            const res = await pool.query(`SELECT COUNT(*) FROM ${table}`);
            console.log(`${table}: ${res.rows[0].count} rows`);
        }
        await pool.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkCounts();
