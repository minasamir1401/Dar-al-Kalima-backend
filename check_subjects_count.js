require('dotenv').config();
const { Pool } = require('pg');

const pgURI = 'postgresql://neondb_owner:npg_I9w6ahWPzVuv@ep-rough-violet-ai9mop1v-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString: process.env.DATABASE_URL || pgURI, ssl: true });

async function check() {
    try {
        const total = await pool.query('SELECT COUNT(*) FROM subjects');
        const withVideo = await pool.query("SELECT COUNT(*) FROM subjects WHERE video_id IS NOT NULL AND video_id != ''");
        const withPlaylist = await pool.query("SELECT COUNT(*) FROM subjects WHERE lessons_data IS NOT NULL AND lessons_data != '[]'");
        const byGrade = await pool.query("SELECT grade, COUNT(*) as count FROM subjects GROUP BY grade ORDER BY count DESC");

        console.log('\n📊 Subjects Database Stats:');
        console.log(`  Total subjects:       ${total.rows[0].count}`);
        console.log(`  With video_id:        ${withVideo.rows[0].count}`);
        console.log(`  With lessons_data:    ${withPlaylist.rows[0].count}`);
        console.log('\n📚 By Grade:');
        byGrade.rows.forEach(r => console.log(`  ${r.grade || 'NULL'}: ${r.count}`));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

check();
