require('dotenv').config();
const { Pool } = require('pg');

const pgURI = 'postgresql://neondb_owner:npg_I9w6ahWPzVuv@ep-rough-violet-ai9mop1v-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || pgURI,
    ssl: true
});

async function runMigration() {
    try {
        console.log("Connecting to Neon PostgreSQL...");
        const client = await pool.connect();
        console.log("Connected. Creating 'subjects' table if it doesn't exist...");

        await client.query(`
            CREATE TABLE IF NOT EXISTS subjects (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                grade TEXT,
                image TEXT,
                download_url TEXT,
                video_id TEXT,
                category TEXT
            )
        `);

        console.log("Table 'subjects' created/confirmed.");
        client.release();
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

runMigration();
