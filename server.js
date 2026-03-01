require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const compression = require('compression');
const { LRUCache } = require('lru-cache');

const app = express();
const PORT = process.env.PORT || 5000;

// Bandwidth compression & Middleware
app.use(compression());
app.use(cors());
app.use(express.json());

// Optimization: Cache for resolved download links (1 hour expiry)
const linkCache = new LRUCache({
    max: 500,
    ttl: 1000 * 60 * 60
});

// MongoDB Connection (Hardcoded fallback for deployment reliability)
const defaultMongoURI = 'mongodb+srv://mina15g4y_db_user:hTZ4HjZuEKiaHL8Z@cluster0.8mkolt0.mongodb.net/dar_alkalam?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(process.env.MONGODB_URI || defaultMongoURI, {
    serverSelectionTimeoutMS: 5000,
    family: 4 // Force IPv4, prevents timeout bugs on Render with Node 18/20
})
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- Database Schemas ---
const bookSchema = new mongoose.Schema({
    title: String, url: String, image: String, category: String, download_url: String
});
const courseSchema = new mongoose.Schema({
    title: String, url: String, image: String, instructor: String, lessons: String, category: String, lessons_data: String
});
const churchVideoSchema = new mongoose.Schema({
    title: String, videoId: String, collection: String
});
const podcastSchema = new mongoose.Schema({
    seriesTitle: String, episodeTitle: String, videoId: String
});
const kidsVideoSchema = new mongoose.Schema({
    sectionTitle: String, title: String, videoId: String, icon: String, color: String
});

// Models
const Book = mongoose.model('Book', bookSchema);
const Course = mongoose.model('Course', courseSchema);
const ChurchVideo = mongoose.model('ChurchVideo', churchVideoSchema);
const Podcast = mongoose.model('Podcast', podcastSchema);
const KidsVideo = mongoose.model('KidsVideo', kidsVideoSchema);

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
        const books = await Book.find({});
        res.json(books.map(b => ({ ...b.toObject(), id: b._id })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/books', async (req, res) => {
    try {
        const book = await Book.create(req.body);
        res.json({ id: book._id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/books/:id', async (req, res) => {
    try {
        await Book.findByIdAndUpdate(req.params.id, req.body);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/books/:id', async (req, res) => {
    try {
        await Book.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Courses
app.get('/api/courses', async (req, res) => {
    try {
        const courses = await Course.find({});
        res.json(courses.map(c => ({ ...c.toObject(), id: c._id })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/courses/:id', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).send('Course not found');
        const courseObj = course.toObject();
        if (courseObj.lessons_data) {
            try { courseObj.lessons_data = JSON.parse(courseObj.lessons_data); }
            catch (e) { courseObj.lessons_data = []; }
        }
        res.json({ ...courseObj, id: course._id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/courses', async (req, res) => {
    try {
        const course = await Course.create(req.body);
        res.json({ id: course._id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/courses/:id', async (req, res) => {
    try {
        await Course.findByIdAndUpdate(req.params.id, req.body);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/courses/:id', async (req, res) => {
    try {
        await Course.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Search
app.get('/api/search', async (req, res) => {
    const q = req.query.q || '';
    try {
        const books = await Book.find({
            $or: [
                { title: { $regex: q, $options: 'i' } },
                { category: { $regex: q, $options: 'i' } }
            ]
        });
        res.json(books.map(b => ({ ...b.toObject(), id: b._id })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Church Videos
app.get('/api/church-videos', async (req, res) => {
    try {
        const videos = await ChurchVideo.find({});
        res.json(videos.map(v => ({ ...v.toObject(), id: v._id })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/church-videos', async (req, res) => {
    try {
        const video = await ChurchVideo.create(req.body);
        res.json({ id: video._id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/church-videos/:id', async (req, res) => {
    try {
        await ChurchVideo.findByIdAndUpdate(req.params.id, req.body);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/church-videos/:id', async (req, res) => {
    try {
        await ChurchVideo.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Podcasts
app.get('/api/podcasts', async (req, res) => {
    try {
        const podcasts = await Podcast.find({});
        res.json(podcasts.map(p => ({ ...p.toObject(), id: p._id })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/podcasts', async (req, res) => {
    try {
        const p = await Podcast.create(req.body);
        res.json({ id: p._id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/podcasts/:id', async (req, res) => {
    try {
        await Podcast.findByIdAndUpdate(req.params.id, req.body);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/podcasts/:id', async (req, res) => {
    try {
        await Podcast.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Kids Videos
app.get('/api/kids-videos', async (req, res) => {
    try {
        const videos = await KidsVideo.find({});
        res.json(videos.map(v => ({ ...v.toObject(), id: v._id })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/kids-videos', async (req, res) => {
    try {
        const v = await KidsVideo.create(req.body);
        res.json({ id: v._id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/kids-videos/:id', async (req, res) => {
    try {
        await KidsVideo.findByIdAndUpdate(req.params.id, req.body);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/kids-videos/:id', async (req, res) => {
    try {
        await KidsVideo.findByIdAndDelete(req.params.id);
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
        const response = await axios({
            method: 'get', url: fileUrl, responseType: 'stream',
            headers: { 'User-Agent': userAgent }, maxRedirects: 10, timeout: 10000
        });

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
            if (html.length > 500000) response.data.destroy();
        });
        await new Promise(resolve => response.data.on('end', resolve));

        const $ = cheerio.load(html);
        let foundLink = '';
        $('a[href]').each((i, el) => {
            const h = $(el).attr('href');
            if (h && (h.includes('mediafire.com') || (h.toLowerCase().endsWith('.pdf') && !h.includes(new URL(fileUrl).hostname)))) {
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
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).send('Course not found');

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

        course.lessons_data = JSON.stringify(lessons);
        await course.save();
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
