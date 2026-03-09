require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const compression = require('compression');
const { LRUCache } = require('lru-cache');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');


// Gemini AI Setup - Key Rotation Support
const GEMINI_KEYS = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
].filter(k => k && k.length > 10);

if (GEMINI_KEYS.length === 0) {
    console.warn('⚠️ لم يتم العثور على أي مفتاح Gemini في البيئة!');
} else {
    console.log(`✅ تم تحميل ${GEMINI_KEYS.length} مفتاح Gemini`);
}

let currentKeyIndex = 0;
const getAiModel = () => {
    const key = GEMINI_KEYS[currentKeyIndex % GEMINI_KEYS.length];
    const client = new GoogleGenerativeAI(key);
    return { model: client.getGenerativeModel({ model: "gemini-2.0-flash" }), key };
};

// Groq Setup
let groq = null;
if (process.env.GROQ_API_KEY) {
    try {
        groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        console.log("✅ Groq AI Fallback Initialized");
    } catch (e) {
        console.error("❌ Failed to init Groq:", e.message);
    }
} else {
    console.warn("⚠️ Groq API Key is missing. Fallback is disabled.");
}

const AI_SYSTEM_PROMPT = `أنت خادم مسيحي أرثوذكسي قبطي غيور وحكيم جداً في تطبيق 'دار الكلمة'.
يجب أن تلتزم بهذه القواعد الصارمة في الرد:
1. اللغة: الرد باللغة العربية حصراً (العامية المصرية المهذبة أو الفصحى). يُمنع منعاً باتاً استخدام أي حرف أو كلمة إنجليزية حتى لو كانت شائعة (مثل born أو born أو born أو born)، استبدلها دائماً بكلمة عربية صحيحة (مثل "يولد").
2. الهوية والموقف: أنت تدافع عن الإيمان الأرثوذكسي القبطي بوضوح. إذا سأل أحد عن ترك الإيمان، رد بقوة ومحبة موضحاً أن "خارج الكنيسة لا يوجد خلاص" وأن هذا قرار يضيع الأبدية.
3. دقة التعبير: تجنب الركاكة في التعبير. بدلاً من "ترك ديني" قل "ترك الإيمان" أو "ترك كنيستك". تحدث بصيغة الخادم الذي يرشد ابنه أو أخيه.
4. التنسيق: اجعل الرسالة منظمة جداً. ابدأ بترحيب، ثم رتب أفكارك في فقرات واضحة، واستخدم آيات من الكتاب المقدس مع ذكر الشاهد (اسم السفر والفصل).
5. العقيدة: ركز على عمق الأسرار الكنسية مثل المعمودية والتناول، ووضح أن الكنيسة الأرثوذكسية هي حارسة الإيمان المسلم مرة للقديسين.
6. الخاتمة لابد أن تكون: 'تم تدريبي وبرمجتي بواسطة مينا سمير.'`;




const app = express();
const PORT = process.env.PORT || 5000;
console.log('🚀 Server Version: v4.2 (AI Support Updated)');

// Bandwidth compression & Middleware
app.use(compression());
app.use(cors());
app.use(express.json());

// Optimization: Cache for resolved download links (1 hour expiry)
const linkCache = new LRUCache({
    max: 500,
    ttl: 1000 * 60 * 60
});

// Neon PostgreSQL Connection
const pgURI = 'postgresql://neondb_owner:npg_I9w6ahWPzVuv@ep-rough-violet-ai9mop1v-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || pgURI,
    ssl: { rejectUnauthorized: false }
});

// Separate Pool for Chat Database
const chatPgURI = 'postgresql://neondb_owner:npg_BEYFkPRgV5h8@ep-cold-bird-adjc4zdj-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const chatPool = new Pool({
    connectionString: chatPgURI,
    ssl: { rejectUnauthorized: false }
});

pool.on('connect', () => console.log('✅ Connected to Main Neon PostgreSQL'));
chatPool.on('connect', () => console.log('✅ Connected to Chat Neon PostgreSQL'));
pool.on('error', (err) => console.error('❌ PG Pool Error:', err));

// Security Middleware: Admin Check
const checkAdmin = (req, res, next) => {
    const secret = req.headers['admin-secret'] || req.headers['Admin-Secret'];
    const expectedSecret = process.env.ADMIN_SECRET || 'admin2024';
    if (secret === expectedSecret) {
        next();
    } else {
        res.status(401).json({ error: 'غير مصرح لك بالقيام بهذا الإجراء' });
    }
};

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Serve static files from uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Helper for clean Arabic Filenames
function getCleanFileName(fileUrl, contentType) {
    try {
        let name = 'book';
        const urlStr = decodeURIComponent(fileUrl);
        const urlParts = new URL(urlStr).pathname.split('/');
        for (let i = urlParts.length - 1; i >= 0; i--) {
            if (urlParts[i] && urlParts[i].length > 3) {
                name = urlParts[i];
                break;
            }
        }
        name = name.replace(/\.html$/i, '').replace(/\/$/, '');
        if (!name.toLowerCase().endsWith('.pdf') && (contentType?.includes('pdf') || !name.includes('.'))) {
            name += '.pdf';
        }
        return name;
    } catch (e) {
        return 'document.pdf';
    }
}

// --- API Routes ---

// Books
app.get('/api/books', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM books ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'فشل جلب الكتب' }); }
});

app.post('/api/books', checkAdmin, async (req, res) => {
    try {
        const { title, url, image, category, download_url } = req.body;
        const result = await pool.query(
            'INSERT INTO books (title, url, image, category, download_url) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [title, url, image, category, download_url]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: 'فشل إضافة الكتاب' }); }
});

app.put('/api/books/:id', checkAdmin, async (req, res) => {
    try {
        const { title, url, image, category, download_url } = req.body;
        await pool.query(
            'UPDATE books SET title=$1, url=$2, image=$3, category=$4, download_url=$5 WHERE id=$6',
            [title, url, image, category, download_url, req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'فشل تحديث الكتاب' }); }
});

app.delete('/api/books/:id', checkAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM books WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'فشل حذف الكتاب' }); }
});

// Courses
app.get('/api/courses', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM courses ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'فشل جلب الكورسات' }); }
});

app.get('/api/courses/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM courses WHERE id=$1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).send('Course not found');
        const course = result.rows[0];
        if (course.lessons_data) {
            try { course.lessons_data = JSON.parse(course.lessons_data); }
            catch (e) { course.lessons_data = []; }
        }
        res.json(course);
    } catch (err) { res.status(500).json({ error: 'فشل جلب تفاصيل الكورس' }); }
});

app.post('/api/courses', checkAdmin, async (req, res) => {
    try {
        const { title, url, image, instructor, lessons, category, lessons_data } = req.body;
        const result = await pool.query(
            'INSERT INTO courses (title, url, image, instructor, lessons, category, lessons_data) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [title, url, image, instructor, lessons, category, lessons_data]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: 'فشل إضافة الكورس' }); }
});

app.put('/api/courses/:id', checkAdmin, async (req, res) => {
    try {
        const { title, url, image, instructor, lessons, category, lessons_data } = req.body;
        await pool.query(
            'UPDATE courses SET title=$1, url=$2, image=$3, instructor=$4, lessons=$5, category=$6, lessons_data=$7 WHERE id=$8',
            [title, url, image, instructor, lessons, category, lessons_data, req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'فشل تحديث الكورس' }); }
});

app.delete('/api/courses/:id', checkAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM courses WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'فشل حذف الكورس' }); }
});

// Search
app.get('/api/search', async (req, res) => {
    const q = req.query.q || '';
    try {
        const result = await pool.query(
            "SELECT * FROM books WHERE title ILIKE $1 OR category ILIKE $1 ORDER BY id DESC",
            [`%${q}%`]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'فشل البحث' }); }
});

// Church Videos
app.get('/api/church-videos', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, title, video_id AS "videoId", collection FROM church_videos ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'فشل جلب فيديوهات الميديا' }); }
});

app.post('/api/church-videos', checkAdmin, async (req, res) => {
    try {
        const { title, videoId, collection } = req.body;
        const result = await pool.query(
            'INSERT INTO church_videos (title, video_id, collection) VALUES ($1, $2, $3) RETURNING id',
            [title, videoId, collection]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: 'فشل إضافة الفيديو' }); }
});

app.put('/api/church-videos/:id', checkAdmin, async (req, res) => {
    try {
        const { title, videoId, collection } = req.body;
        await pool.query(
            'UPDATE church_videos SET title=$1, video_id=$2, collection=$3 WHERE id=$4',
            [title, videoId, collection, req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'فشل تحديث الفيديو' }); }
});

app.delete('/api/church-videos/:id', checkAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM church_videos WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'فشل حذف الفيديو' }); }
});

// Podcasts
app.get('/api/podcasts', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, series_title AS "seriesTitle", episode_title AS "episodeTitle", video_id AS "videoId" FROM podcasts ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'فشل جلب حلقات البودكاست' }); }
});

app.post('/api/podcasts', checkAdmin, async (req, res) => {
    try {
        const { seriesTitle, episodeTitle, videoId } = req.body;
        const result = await pool.query(
            'INSERT INTO podcasts (series_title, episode_title, video_id) VALUES ($1, $2, $3) RETURNING id',
            [seriesTitle, episodeTitle, videoId]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: 'فشل إضافة حلقة بودكاست' }); }
});

app.put('/api/podcasts/:id', checkAdmin, async (req, res) => {
    try {
        const { seriesTitle, episodeTitle, videoId } = req.body;
        await pool.query(
            'UPDATE podcasts SET series_title=$1, episode_title=$2, video_id=$3 WHERE id=$4',
            [seriesTitle, episodeTitle, videoId, req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'فشل تحديث الحلقة' }); }
});

app.delete('/api/podcasts/:id', checkAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM podcasts WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'فشل حذف الحلقة' }); }
});

// Kids Videos
app.get('/api/kids-videos', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, section_title AS "sectionTitle", title, video_id AS "videoId", icon, color FROM kids_videos ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'فشل جلب محتوى الأطفال' }); }
});

app.post('/api/kids-videos', checkAdmin, async (req, res) => {
    try {
        const { sectionTitle, title, videoId, icon, color } = req.body;
        const result = await pool.query(
            'INSERT INTO kids_videos (section_title, title, video_id, icon, color) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [sectionTitle, title, videoId, icon, color]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: 'فشل إضافة المحتوى' }); }
});

app.put('/api/kids-videos/:id', checkAdmin, async (req, res) => {
    try {
        const { sectionTitle, title, videoId, icon, color } = req.body;
        await pool.query(
            'UPDATE kids_videos SET section_title=$1, title=$2, video_id=$3, icon=$4, color=$5 WHERE id=$6',
            [sectionTitle, title, videoId, icon, color, req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'فشل تحديث المحتوى' }); }
});

app.delete('/api/kids-videos/:id', checkAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM kids_videos WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'فشل حذف المحتوى' }); }
});

// Subjects (المواد الدراسية)
app.get('/api/subjects', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM subjects ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'فشل جلب المواد الدراسية' }); }
});

app.post('/api/subjects', checkAdmin, async (req, res) => {
    try {
        const { title, grade, image, download_url, video_id, category } = req.body;
        const result = await pool.query(
            'INSERT INTO subjects (title, grade, image, download_url, video_id, category) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [title, grade, image, download_url, video_id, category]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: 'فشل إضافة المادة' }); }
});

app.put('/api/subjects/:id', checkAdmin, async (req, res) => {
    try {
        const { title, grade, image, download_url, video_id, category } = req.body;
        await pool.query(
            'UPDATE subjects SET title=$1, grade=$2, image=$3, download_url=$4, video_id=$5, category=$6 WHERE id=$7',
            [title, grade, image, download_url, video_id, category, req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'فشل تحديث المادة' }); }
});

app.delete('/api/subjects/:id', checkAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM subjects WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'فشل حذف المادة' }); }
});

// Site Settings
app.get('/api/settings/:key', async (req, res) => {
    try {
        const result = await pool.query('SELECT setting_value FROM site_settings WHERE setting_key=$1', [req.params.key]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Setting not found' });
        res.json(result.rows[0].setting_value);
    } catch (err) { res.status(500).json({ error: 'فشل جلب الإعدادات' }); }
});

app.put('/api/settings/:key', checkAdmin, async (req, res) => {
    try {
        const { setting_value } = req.body;
        await pool.query(
            `INSERT INTO site_settings (setting_key, setting_value) 
             VALUES ($1, $2) 
             ON CONFLICT (setting_key) 
             DO UPDATE SET setting_value = EXCLUDED.setting_value`,
            [req.params.key, JSON.stringify(setting_value)]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'فشل تحديث الإعدادات' }); }
});

// --- Chat System Endpoints ---

// Register / Login user
app.post('/api/chat/register', async (req, res) => {
    const { name, phone, gender } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'الاسم والرقم مطلوبان' });
    try {
        const result = await chatPool.query(
            `INSERT INTO chat_users (name, phone, gender) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, gender = EXCLUDED.gender 
             RETURNING *`,
            [name, phone, gender]
        );
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: 'فشل تسجيل المستخدم' }); }
});

// Find user by phone (Exact match)
app.get('/api/chat/users/:phone', async (req, res) => {
    try {
        const result = await chatPool.query('SELECT name, phone, gender FROM chat_users WHERE phone = $1', [req.params.phone.trim()]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'المستخدم غير موجود' });
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: 'فشل جلب بيانات المستخدم' }); }
});

// Search users by name or phone (Partial match)
app.get('/api/chat/search/:query', async (req, res) => {
    const { query } = req.params;
    try {
        const result = await chatPool.query(
            "SELECT name, phone, gender FROM chat_users WHERE phone LIKE $1 OR name ILIKE $1 LIMIT 10",
            [`%${query}%`]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'فشل البحث عن المستخدم' }); }
});

// Send message
app.post('/api/chat/messages', async (req, res) => {
    let { senderPhone, receiverPhone, message, imageUrl } = req.body;
    senderPhone = senderPhone?.trim();
    receiverPhone = receiverPhone?.trim();
    if (!senderPhone || !receiverPhone || (!message && !imageUrl)) return res.status(400).json({ error: 'بيانات ناقصة' });
    try {
        console.log(`✉️ Message from ${senderPhone} to ${receiverPhone}`);
        const result = await chatPool.query(
            'INSERT INTO chat_messages (sender_phone, receiver_phone, message, image_url) VALUES ($1, $2, $3, $4) RETURNING *',
            [senderPhone, receiverPhone, message || '', imageUrl || null]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('❌ Send Error:', err);
        res.status(500).json({ error: 'فشل إرسال الرسالة' });
    }
});

// Delete entire conversation
app.delete('/api/chat/conversations/:p1/:p2', async (req, res) => {
    const { p1, p2 } = req.params;
    try {
        await chatPool.query(
            'DELETE FROM chat_messages WHERE (sender_phone = $1 AND receiver_phone = $2) OR (sender_phone = $2 AND receiver_phone = $1)',
            [p1, p2]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('❌ Delete Conv Error:', err);
        res.status(500).json({ error: 'فشل حذف المحادثة' });
    }
});

// AI Chat Endpoint with Memory
app.post('/api/chat/ai', async (req, res) => {
    let { senderPhone, message } = req.body;
    senderPhone = senderPhone?.trim();
    if (!senderPhone || !message) return res.status(400).json({ error: 'بيانات ناقصة' });

    try {
        console.log(`🤖 AI Request from ${senderPhone}`);

        // 1. Fetch last 10 messages for context
        const historyRes = await chatPool.query(
            `SELECT sender_phone, message FROM chat_messages 
             WHERE (sender_phone = $1 AND receiver_phone = '999') 
                OR (sender_phone = '999' AND receiver_phone = $1) 
             ORDER BY created_at DESC LIMIT 5`,
            [senderPhone]
        );

        const history = historyRes.rows.reverse().map(row => ({
            role: row.sender_phone === '999' ? "model" : "user",
            parts: [{ text: row.message }]
        }));

        // Retry logic with key rotation for Gemini
        let aiResponse = null;
        let usedGroq = false;
        const maxAttempts = GEMINI_KEYS.length * 2;
        const fullHistoryGemini = [
            { role: "user", parts: [{ text: AI_SYSTEM_PROMPT }] },
            { role: "model", parts: [{ text: "أهلاً بك! أنا خادمك المساعد من دار الكلمة، وتحت أمرك في أي سؤال يخص إيماننا الأرثوذكسي القبطي الجميل. كيف أقدر أساعدك النهاردة؟ تم تدريبي وبرمجتي بواسطة مينا سمير." }] },
            ...history.map(h => ({ role: h.role, parts: [{ text: h.parts[0].text }] }))
        ];

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const { model, key } = getAiModel();
            try {
                console.log(`📡 Attempt ${attempt} using Gemini key ending in ...${key.slice(-4)}`);
                const session = model.startChat({ history: fullHistoryGemini });
                const result = await session.sendMessage(message);
                aiResponse = result.response.text().trim();
                break;
            } catch (e) {
                if (e.status === 429 && attempt < maxAttempts) {
                    currentKeyIndex++;
                    console.log(`⏳ Gemini Key ...${key.slice(-4)} rate limited. Rotating...`);
                    await new Promise(r => setTimeout(r, 1000));
                } else {
                    console.log("⚠️ All Gemini attempts failed, checking for Groq fallback...");
                    if (groq) {
                        try {
                            const groqHistory = history.map(h => ({
                                role: h.role === "model" ? "assistant" : "user",
                                content: h.parts[0].text
                            }));
                            const chatCompletion = await groq.chat.completions.create({
                                messages: [
                                    { role: "system", content: AI_SYSTEM_PROMPT },
                                    ...groqHistory,
                                    { role: "user", content: message }
                                ],
                                model: "llama-3.3-70b-versatile",
                                max_tokens: 500
                            });
                            aiResponse = chatCompletion.choices[0].message.content.trim();
                            usedGroq = true;
                            console.log("✅ Groq Fallback successful!");
                            break;
                        } catch (groqErr) {
                            console.error("❌ Groq Fallback failed:", groqErr);
                            throw e; // throw original Gemini error
                        }
                    } else {
                        console.warn("🛑 Groq not initialized, no fallback available.");
                        throw e;
                    }
                }
            }
        }


        // Ensure signature is present for branding
        const signature = "تم تدريبي وبرمجتي بواسطة مينا سمير.";
        if (!aiResponse.includes("مينا سمير")) {
            aiResponse += "\n\n" + signature;
        }

        // 2. Save User Message
        await chatPool.query(
            'INSERT INTO chat_messages (sender_phone, receiver_phone, message) VALUES ($1, $2, $3)',
            [senderPhone, '999', message]
        );

        // 3. Save AI Message
        const dbResult = await chatPool.query(
            'INSERT INTO chat_messages (sender_phone, receiver_phone, message) VALUES ($1, $2, $3) RETURNING *',
            ['999', senderPhone, aiResponse]
        );

        res.json(dbResult.rows[0]);
    } catch (err) {
        console.error('❌ AI Error:', err);

        // Final fallback: Give a friendly AI-style answer even if everything fails
        const fallbackMsg = "بصراحة، الطلبات كتير جداً دلوقتى وأنا محتاج آخد نفس بسيط لمدة دقائق. ارجع لى تانى وهتلاقيني تحت أمرك! تم تدريبي وبرمجتي بواسطة مينا سمير.";

        try {
            // Save User's message so it's not lost
            await chatPool.query(
                'INSERT INTO chat_messages (sender_phone, receiver_phone, message) VALUES ($1, $2, $3)',
                [senderPhone, '999', message]
            );

            // Save Fallback AI message
            const dbResult = await chatPool.query(
                'INSERT INTO chat_messages (sender_phone, receiver_phone, message) VALUES ($1, $2, $3) RETURNING *',
                ['999', senderPhone, fallbackMsg]
            );

            return res.json(dbResult.rows[0]);
        } catch (dbErr) {
            console.error('❌ DB Save Error during fallback:', dbErr);
            res.status(500).json({ error: 'الذكاء الاصطناعي مشغول حالياً، حاول مرة أخرى.' });
        }
    }
});


// Upload image for chat
app.post('/api/chat/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'لم يتم اختيار صورة' });
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
});

// Get messages between two users
app.get('/api/chat/messages/:myPhone/:theirPhone', async (req, res) => {
    try {
        const result = await chatPool.query(
            `SELECT * FROM chat_messages 
             WHERE (sender_phone = $1 AND receiver_phone = $2) 
                OR (sender_phone = $2 AND receiver_phone = $1) 
             ORDER BY created_at ASC`,
            [req.params.myPhone, req.params.theirPhone]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'فشل جلب الرسائل' }); }
});

// Get recent chats (users I talked to)
app.get('/api/chat/conversations/:phone', async (req, res) => {
    try {
        const result = await chatPool.query(
            `SELECT DISTINCT u.name, u.phone, u.gender
             FROM chat_users u
             JOIN chat_messages m ON (m.sender_phone = u.phone OR m.receiver_phone = u.phone)
             WHERE (m.sender_phone = $1 OR m.receiver_phone = $1) AND u.phone != $1`,
            [req.params.phone]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'فشل جلب المحادثات' }); }
});

// Delete message
app.delete('/api/chat/messages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🗑️ Attempting to delete message ID: ${id}`);
        // Check for image
        const msgResult = await chatPool.query('SELECT image_url FROM chat_messages WHERE id = $1', [id]);
        if (msgResult.rows.length > 0 && msgResult.rows[0].image_url) {
            const relPath = msgResult.rows[0].image_url.startsWith('/') ? msgResult.rows[0].image_url.substring(1) : msgResult.rows[0].image_url;
            const filePath = path.join(__dirname, relPath);
            console.log(`🖼️ Deleting file at: ${filePath}`);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('✅ File deleted from disk');
            } else {
                console.warn('⚠️ File not found on disk, skipping file delete');
            }
        }
        await chatPool.query('DELETE FROM chat_messages WHERE id = $1', [id]);
        console.log(`✅ Message ${id} deleted from DB`);
        res.json({ success: true });
    } catch (err) {
        console.error('❌ Delete Error:', err);
        res.status(500).json({ error: 'فشل حذف الرسالة' });
    }
});

// SMART & FAST DOWNLOAD PROXY
app.get('/api/download', async (req, res) => {
    let fileUrl = req.query.url;
    if (!fileUrl) return res.status(400).send('URL is required');

    // Security: Basic SSRF protection
    try {
        const parsedUrl = new URL(fileUrl.startsWith('http') ? fileUrl : decodeURIComponent(fileUrl));
        const allowedDomains = ['mediafire.com', 'archive.org', 'dropbox.com', 'google.com', 'youtube.com', 'ytimg.com', 'm3aarf.com', 'github.com', 'st-takla.org'];
        const isAllowed = allowedDomains.some(domain => parsedUrl.hostname.includes(domain));

        if (!isAllowed && parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return res.status(403).send('غير مسموح بهذا الرابط لأسباب أمنية.');
        }
    } catch (e) {
        return res.status(400).send('رابط غير صالح.');
    }

    if (linkCache.has(fileUrl)) {
        return startStreaming(linkCache.get(fileUrl), res);
    }

    try {
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
        if (!fileUrl.startsWith('http') && fileUrl.includes('%3A%2F%2F')) {
            fileUrl = decodeURIComponent(fileUrl);
        }

        if (!fileUrl.startsWith('http')) {
            return res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px; direction: rtl; background: #f9f9f9; min-height: 100vh;">
                <div style="background: white; padding: 30px; border-radius: 15px; display: inline-block; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                    <h2 style="color: #235787;">عذراً، الرابط يتطلب الدخول للمصدر</h2>
                    <p>هذا الكتاب يجب تحميله مباشرة من موقعه الأصلي. يرجى الرجوع لصفحة الكتاب والضغط على الرابط الأساسي.</p>
                    <button onclick="window.close()" style="display:inline-block; padding: 12px 25px; background: #235787; border: none; cursor: pointer; color: white; border-radius: 8px; font-weight: bold; margin-top: 15px;">إغلاق هذه النافذة</button>
                </div>
            </div>
            `);
        }

        const response = await axios({
            method: 'get', url: fileUrl, responseType: 'stream',
            headers: { 'User-Agent': userAgent }, maxRedirects: 10, timeout: 15000
        }).catch(err => { throw new Error(`Fetch failed: ${err.message}`); });

        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('text/html')) {
            const fileName = getCleanFileName(fileUrl, contentType);
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
            return response.data.pipe(res);
        }

        let html = '';
        response.data.on('data', chunk => {
            html += chunk;
            if (html.length > 1000000) response.data.destroy(); // Limit to 1MB
        });
        await new Promise(resolve => response.data.on('end', resolve));

        const $ = cheerio.load(html);
        let foundLink = '';
        const currentHostname = new URL(fileUrl).hostname;

        $('a[href]').each((i, el) => {
            const h = $(el).attr('href');
            if (h && (h.includes('mediafire.com') || (h.toLowerCase().endsWith('.pdf') && !h.includes(currentHostname)))) {
                foundLink = h;
                return false;
            }
        });

        if (foundLink && foundLink.includes('mediafire.com') && !foundLink.includes('download')) {
            try {
                const mfPage = await axios.get(foundLink, { headers: { 'User-Agent': userAgent }, timeout: 5000 });
                const mfHtml = mfPage.data;
                const mfSoup = cheerio.load(mfHtml);
                let direct = mfSoup('#downloadButton').attr('href') || mfSoup('a[aria-label="Download"]').attr('href');
                if (!direct) {
                    const match = mfHtml.match(/https?:\/\/download\d+\.mediafire\.com\/[^\/"]+/);
                    if (match) direct = match[0];
                }
                if (direct) foundLink = direct;
            } catch (e) { }
        }

        if (foundLink) {
            linkCache.set(fileUrl, foundLink);
            return startStreaming(foundLink, res);
        }

        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px; direction: rtl; background: #f9f9f9; min-height: 100vh;">
                <div style="background: white; padding: 30px; border-radius: 15px; display: inline-block; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                    <h2 style="color: #235787;">عذراً، الرابط يتطلب الدخول للمصدر</h2>
                    <p>لا يمكن التحميل المباشر لهذا الكتاب حالياً.</p>
                    <a href="${fileUrl}" target="_blank" style="display:inline-block; padding: 12px 25px; background: #235787; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 15px;">انقر هنا للتحميل من الموقع الأصلي</a>
                </div>
            </div>
        `);
    } catch (err) { res.status(500).send('حدث خطأ أثناء معالجة الطلب.'); }
});

// SCRAPE LESSONS from m3aarf
app.get('/api/courses/:id/scrape', checkAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM courses WHERE id=$1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).send('Course not found');
        const course = result.rows[0];

        const m3aarfUrl = course.url;
        const m3aarfIdMatch = m3aarfUrl.match(/\/certificate\/(\d+)/);
        if (!m3aarfIdMatch) throw new Error('Could not parse m3aarf ID from URL');
        const m3aarfId = m3aarfIdMatch[1];
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

        const firstPageUrl = `https://www.m3aarf.com/ajax/certificate/${m3aarfId}/lessons?page=1`;
        const firstRes = await axios.get(firstPageUrl, { headers: { 'User-Agent': userAgent } });
        let totalPages = firstRes.data.totalPages || 1;
        const lessons = [];

        for (let p = 1; p <= totalPages; p++) {
            const pageUrl = `https://www.m3aarf.com/ajax/certificate/${m3aarfId}/lessons?page=${p}`;
            const pageRes = await axios.get(pageUrl, { headers: { 'User-Agent': userAgent } });
            const $ = cheerio.load(pageRes.data.html);
            const pageLessons = [];
            $('.lesson-item').each((i, el) => {
                pageLessons.push({ title: $(el).find('h3').text().trim(), url: $(el).attr('href'), duration: $(el).find('span').text().trim() });
            });

            for (let i = 0; i < pageLessons.length; i += 10) {
                const chunk = pageLessons.slice(i, i + 10);
                await Promise.all(chunk.map(async (lesson) => {
                    try {
                        const lessonRes = await axios.get(lesson.url, { headers: { 'User-Agent': userAgent }, timeout: 4000 });
                        const videoIdMatch = lessonRes.data.match(/youtube\.com\/embed\/([^"?]+)/) ||
                            lessonRes.data.match(/v=([^"&?]+)/) ||
                            lessonRes.data.match(/ytimg\.com\/vi\/([^/]+)/);
                        if (videoIdMatch) {
                            lesson.videoId = videoIdMatch[1];
                            lessons.push(lesson);
                        }
                    } catch (e) { }
                }));
            }
        }

        await pool.query('UPDATE courses SET lessons_data=$1 WHERE id=$2', [JSON.stringify(lessons), req.params.id]);
        res.json({ success: true, lessonsCount: lessons.length });
    } catch (scrapeErr) { res.status(500).json({ error: 'فشل استخراج الدروس' }); }
});

async function startStreaming(url, res) {
    try {
        const streamRes = await axios({ method: 'get', url, responseType: 'stream', headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 30000 });
        const contentType = streamRes.headers['content-type'] || 'application/pdf';
        const fileName = getCleanFileName(url, contentType);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        streamRes.data.pipe(res);
    } catch (e) { res.status(500).send('فشل الاتصال بمزود الملف.'); }
}

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Manaret El-Eman Cloud Server: http://0.0.0.0:${PORT}`));
