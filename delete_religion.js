const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_I9w6ahWPzVuv@ep-rough-violet-ai9mop1v-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: true
});

async function run() {
    try {
        // First, show what will be deleted
        const preview = await pool.query(`
            SELECT id, title, subject_name, grade 
            FROM subjects 
            WHERE 
                subject_name ILIKE '%التربية الدينية الاسلامية%'
                OR subject_name ILIKE '%التربية الدينية الإسلامية%'
                OR subject_name ILIKE '%الدين الاسلامي%'
                OR subject_name ILIKE '%الدين الإسلامي%'
                OR title ILIKE '%التربية الدينية الاسلامية%'
                OR title ILIKE '%التربية الدينية الإسلامية%'
                OR title ILIKE '%الدين الاسلامي%'
            ORDER BY grade
        `);

        console.log(`\n🔍 سيتم حذف ${preview.rowCount} مادة:\n`);
        preview.rows.forEach(r => {
            console.log(`  - [${r.grade}] ${r.subject_name} | ${r.title.substring(0, 60)}`);
        });

        if (preview.rowCount === 0) {
            console.log('  لا يوجد محتوى ديني إسلامي للحذف.');
            process.exit(0);
        }

        // Execute deletion
        const res = await pool.query(`
            DELETE FROM subjects 
            WHERE 
                subject_name ILIKE '%التربية الدينية الاسلامية%'
                OR subject_name ILIKE '%التربية الدينية الإسلامية%'
                OR subject_name ILIKE '%الدين الاسلامي%'
                OR subject_name ILIKE '%الدين الإسلامي%'
                OR title ILIKE '%التربية الدينية الاسلامية%'
                OR title ILIKE '%التربية الدينية الإسلامية%'
                OR title ILIKE '%الدين الاسلامي%'
        `);

        console.log(`\n✅ تم حذف ${res.rowCount} مادة دينية إسلامية بنجاح!`);
        process.exit(0);
    } catch (e) {
        console.error('❌ خطأ:', e.message);
        process.exit(1);
    }
}

run();
