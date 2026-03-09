const { Pool } = require('pg');

const chatPgURI = 'postgresql://neondb_owner:npg_BEYFkPRgV5h8@ep-cold-bird-adjc4zdj-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const chatPool = new Pool({
    connectionString: chatPgURI,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const res = await chatPool.query('SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 20');
        console.log('Recent Messages:');
        res.rows.forEach(r => {
            console.log(`[${r.created_at.toISOString()}] ID: ${r.id} From: ${r.sender_phone} To: ${r.receiver_phone} Content: ${r.message || '(image)'}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
