const { Pool } = require('pg');

const chatDbURI = 'postgresql://neondb_owner:npg_BEYFkPRgV5h8@ep-cold-bird-adjc4zdj-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
    connectionString: chatDbURI,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        console.log('Connecting to Chat Database...');

        // 1. Users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chat_users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                phone TEXT UNIQUE NOT NULL,
                gender TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Created chat_users table');

        // 2. Messages table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                sender_phone TEXT NOT NULL,
                receiver_phone TEXT NOT NULL,
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Created chat_messages table');

        // 3. Index for performance
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_phones ON chat_messages(sender_phone, receiver_phone);`);
        console.log('✅ Created indexes');

    } catch (err) {
        console.error('❌ Error during chat migration:', err);
    } finally {
        await pool.end();
    }
}

main();
