require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const compression = require('compression');
const { LRUCache } = require('lru-cache');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5000;
console.log('🚀 Server Version: v4.0 (Neon PostgreSQL Infrastructure)');

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
    ssl: true
});

pool.on('connect', () => console.log('✅ Connected to Neon PostgreSQL'));
pool.on('error', (err) => console.error('❌ PG Pool Error:', err));

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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/books', async (req, res) => {
    try {
        const { title, url, image, category, download_url } = req.body;
        const result = await pool.query(
            'INSERT INTO books (title, url, image, category, download_url) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [title, url, image, category, download_url]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/books/:id', async (req, res) => {
    try {
        const { title, url, image, category, download_url } = req.body;
        await pool.query(
            'UPDATE books SET title=$1, url=$2, image=$3, category=$4, download_url=$5 WHERE id=$6',
            [title, url, image, category, download_url, req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/books/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM books WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Courses
app.get('/api/courses', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM courses ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/courses', async (req, res) => {
    try {
        const { title, url, image, instructor, lessons, category, lessons_data } = req.body;
        const result = await pool.query(
            'INSERT INTO courses (title, url, image, instructor, lessons, category, lessons_data) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [title, url, image, instructor, lessons, category, lessons_data]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/courses/:id', async (req, res) => {
    try {
        const { title, url, image, instructor, lessons, category, lessons_data } = req.body;
        await pool.query(
            'UPDATE courses SET title=$1, url=$2, image=$3, instructor=$4, lessons=$5, category=$6, lessons_data=$7 WHERE id=$8',
            [title, url, image, instructor, lessons, category, lessons_data, req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/courses/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM courses WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Church Videos
app.get('/api/church-videos', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, title, video_id AS "videoId", collection FROM church_videos ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/church-videos', async (req, res) => {
    try {
        const { title, videoId, collection } = req.body;
        const result = await pool.query(
            'INSERT INTO church_videos (title, video_id, collection) VALUES ($1, $2, $3) RETURNING id',
            [title, videoId, collection]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/church-videos/:id', async (req, res) => {
    try {
        const { title, videoId, collection } = req.body;
        await pool.query(
            'UPDATE church_videos SET title=$1, video_id=$2, collection=$3 WHERE id=$4',
            [title, videoId, collection, req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/church-videos/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM church_videos WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Podcasts
app.get('/api/podcasts', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, series_title AS "seriesTitle", episode_title AS "episodeTitle", video_id AS "videoId" FROM podcasts ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/podcasts', async (req, res) => {
    try {
        const { seriesTitle, episodeTitle, videoId } = req.body;
        const result = await pool.query(
            'INSERT INTO podcasts (series_title, episode_title, video_id) VALUES ($1, $2, $3) RETURNING id',
            [seriesTitle, episodeTitle, videoId]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/podcasts/:id', async (req, res) => {
    try {
        const { seriesTitle, episodeTitle, videoId } = req.body;
        await pool.query(
            'UPDATE podcasts SET series_title=$1, episode_title=$2, video_id=$3 WHERE id=$4',
            [seriesTitle, episodeTitle, videoId, req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/podcasts/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM podcasts WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Kids Videos
app.get('/api/kids-videos', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, section_title AS "sectionTitle", title, video_id AS "videoId", icon, color FROM kids_videos ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/kids-videos', async (req, res) => {
    try {
        const { sectionTitle, title, videoId, icon, color } = req.body;
        const result = await pool.query(
            'INSERT INTO kids_videos (section_title, title, video_id, icon, color) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [sectionTitle, title, videoId, icon, color]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/kids-videos/:id', async (req, res) => {
    try {
        const { sectionTitle, title, videoId, icon, color } = req.body;
        await pool.query(
            'UPDATE kids_videos SET section_title=$1, title=$2, video_id=$3, icon=$4, color=$5 WHERE id=$6',
            [sectionTitle, title, videoId, icon, color, req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/kids-videos/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM kids_videos WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Subjects (المواد الدراسية)
app.get('/api/subjects', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM subjects ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/subjects', async (req, res) => {
    try {
        const { title, grade, image, download_url, video_id, category } = req.body;
        const result = await pool.query(
            'INSERT INTO subjects (title, grade, image, download_url, video_id, category) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [title, grade, image, download_url, video_id, category]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/subjects/:id', async (req, res) => {
    try {
        const { title, grade, image, download_url, video_id, category } = req.body;
        await pool.query(
            'UPDATE subjects SET title=$1, grade=$2, image=$3, download_url=$4, video_id=$5, category=$6 WHERE id=$7',
            [title, grade, image, download_url, video_id, category, req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/subjects/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM subjects WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// SMART & FAST DOWNLOAD PROXY
app.get('/api/download', async (req, res) => {
    let fileUrl = req.query.url;
    if (!fileUrl) return res.status(400).send('URL is required');

    if (linkCache.has(fileUrl)) {
        return startStreaming(linkCache.get(fileUrl), res);
    }

    try {
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
        if (!fileUrl.startsWith('http') && fileUrl.includes('%3A%2F%2F')) {
            fileUrl = decodeURIComponent(fileUrl);
        }

        if (!fileUrl.startsWith('http')) {
            console.error('❌ Malformed URL received:', fileUrl);
            return res.status(400).send('عذراً، هذا الرابط غير صالح (Malformed Link). يرجى تجربة كتاب آخر أو تحديث الصفحة.');
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

// SCRARE LESSONS from m3aarf
app.get('/api/courses/:id/scrape', async (req, res) => {
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
    } catch (scrapeErr) { res.status(500).json({ error: scrapeErr.message }); }
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

app.listen(PORT, '0.0.0.0', () => console.log(`Manaret El-Eman Cloud Server: http://localhost:${PORT}`));
