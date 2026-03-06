const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const { Pool } = require('pg');

// ===== CONFIG =====
const pgURI = 'postgresql://neondb_owner:npg_I9w6ahWPzVuv@ep-rough-violet-ai9mop1v-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString: process.env.DATABASE_URL || pgURI, ssl: true });
const BASE_URL = 'https://www.rahma-school.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36';
const CONCURRENCY = 30;
const MAX_PAGES = 8;

const levels = [
    { name: 'المرحلة الابتدائية', cid: 1, gradeKeyword: 'ابتدائي' },
    { name: 'المرحلة الإعدادية', cid: 2, gradeKeyword: 'إعدادي' },
    { name: 'المرحلة الثانوية', cid: 3, gradeKeyword: 'ثانوي' },
];

async function fetchHtml(url) {
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', headers: { 'User-Agent': UA }, timeout: 15000 });
        return iconv.decode(res.data, 'win1256');
    } catch { return null; }
}

function getYoutubeId(html) {
    if (!html) return null;
    const m = html.match(/(?:youtube\.com\/embed\/|youtu\.be\/|watch\?v=|[?&]v=)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
}

async function limitedConcurrency(tasks, limit) {
    let index = 0;
    async function runner() {
        while (index < tasks.length) {
            const i = index++;
            await tasks[i]();
        }
    }
    await Promise.all(Array.from({ length: limit }, runner));
}

async function scrapeLessonForVideo(url) {
    const html = await fetchHtml(url);
    if (!html) return { videoId: null, downloadUrl: null };
    const $ = cheerio.load(html);
    let downloadUrl = null;
    $('a[href$=".pdf"], a[href*="drive.google.com"], a[href*="mediafire.com"], a[href*="top4top"], a[href*="archive.org"]').each((_, el) => {
        const h = $(el).attr('href');
        if (h) { downloadUrl = h; return false; }
    });
    return { videoId: getYoutubeId(html), downloadUrl };
}

async function scrapeSubjectCourses(subjectUrl) {
    const items = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
        const pageUrl = page === 1 ? subjectUrl : `${subjectUrl}?p=${page}`;
        const html = await fetchHtml(pageUrl);
        if (!html) break;
        const $ = cheerio.load(html);
        let foundAny = false;

        $('.flex-container .Item, .Item.ZoomIn, div.Item').each((_, el) => {
            const a = $(el).find('a').first();
            const href = a.attr('href');
            let title = a.text().trim() || $(el).find('h3, .Title, .SubTitle').text().trim() || $(el).text().trim().substring(0, 150);
            const imgEl = $(el).find('img');
            const image = imgEl.attr('src') || imgEl.attr('data-src');

            if (href && title && title.length > 2) {
                foundAny = true;
                const fullUrl = href.startsWith('http') ? href : `${BASE_URL}/${href}`;
                const fullImage = image ? (image.startsWith('http') ? image : `${BASE_URL}/${image}`) : null;
                if (!items.find(i => i.url === fullUrl)) {
                    items.push({ title: title.substring(0, 250), url: fullUrl, image: fullImage });
                }
            }
        });

        if (!foundAny || (!html.includes('التالي') && !html.includes('pagination'))) break;
    }
    return items;
}

async function processCourse(courseItem, gradeText, levelName, subjectText) {
    const html = await fetchHtml(courseItem.url);
    if (!html) return;

    const $ = cheerio.load(html);
    const playlist = [];

    // First, check if it has a sidebar playlist
    $('#lessons-container p.video, #lessons-container p.active.video').each((i, el) => {
        const a = $(el).find('a');
        if (a.length > 0) {
            const sUrl = a.attr('href');
            playlist.push({
                title: a.text().trim() || $(el).text().trim(),
                url: sUrl.startsWith('http') ? sUrl : `${BASE_URL}/${sUrl}`,
                videoId: null,
                downloadUrl: null
            });
        } else if ($(el).attr('onclick')) {
            const onclickAttr = $(el).attr('onclick');
            const match = onclickAttr.match(/href='([^']+)'/) || onclickAttr.match(/href="([^"]+)"/);
            if (match) {
                const sUrl = match[1];
                playlist.push({
                    title: $(el).text().trim(),
                    url: sUrl.startsWith('http') ? sUrl : `${BASE_URL}/${sUrl}`,
                    videoId: null,
                    downloadUrl: null
                });
            }
        }
    });

    // If no playlist found, maybe the course page itself is just a single lesson
    if (playlist.length === 0) {
        playlist.push({
            title: courseItem.title,
            url: courseItem.url,
            videoId: getYoutubeId(html),
            downloadUrl: null
        });
    }

    // Now efficiently fetch video elements for the playlist
    const fetchTasks = playlist.map(item => async () => {
        // If it's the exact same URL we just fetched, we can reuse the HTML info
        if (item.url === courseItem.url) {
            item.videoId = getYoutubeId(html);
        } else {
            const details = await scrapeLessonForVideo(item.url);
            item.videoId = details.videoId;
            item.downloadUrl = details.downloadUrl;
        }
    });

    await limitedConcurrency(fetchTasks, 15);

    const firstVideoId = playlist.find(p => p.videoId)?.videoId || null;
    const downloadUrl = playlist.find(p => p.downloadUrl)?.downloadUrl || null;

    try {
        await pool.query(
            `INSERT INTO subjects (title, grade, image, download_url, video_id, category, subject_name, source_url, lessons_data) 
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) 
             ON CONFLICT (source_url) DO UPDATE 
             SET lessons_data = EXCLUDED.lessons_data, video_id = EXCLUDED.video_id, title = EXCLUDED.title`,
            [courseItem.title, gradeText, courseItem.image, downloadUrl, firstVideoId, levelName, subjectText, courseItem.url, JSON.stringify(playlist)]
        );
    } catch (e) {
        console.error('Save error for', courseItem.title, e.message);
    }
}

async function main() {
    console.log('🚀 Starting DEEP Rahma Scraper (Courses & Playlists)...\n');
    try { await pool.query('ALTER TABLE subjects ADD CONSTRAINT unique_source_url UNIQUE (source_url)'); } catch (e) { }

    const t0 = Date.now();
    let coursesProcessed = 0;

    for (const level of levels) {
        console.log(`\n📡 === ${level.name} ===`);
        const levelHtml = await fetchHtml(`${BASE_URL}/lessons.asp?cid=${level.cid}`);
        if (!levelHtml) continue;
        const $lv = cheerio.load(levelHtml);
        const gradeLinks = [];

        $lv('.flex-container .Item a, .Item.ZoomIn a, div.Item a, a[href*="قسم"]').each((_, el) => {
            const text = $lv(el).text().trim();
            const href = $lv(el).attr('href');
            if (href && text.includes(level.gradeKeyword)) {
                gradeLinks.push({ text, href: href.startsWith('http') ? href : `${BASE_URL}/${href}` });
            }
        });

        const uniqueGrades = Array.from(new Map(gradeLinks.map(g => [g.href, g])).values());
        console.log(`  📚 Found ${uniqueGrades.length} grades`);

        for (const grade of uniqueGrades) {
            console.log(`\n  📂 ${grade.text}`);
            const gradeHtml = await fetchHtml(grade.href);
            if (!gradeHtml) continue;
            const $gr = cheerio.load(gradeHtml);
            const subjectLinks = [];

            $gr('.flex-container .Item a, .Item.ZoomIn a, div.Item a').each((_, el) => {
                const text = $gr(el).text().trim();
                const href = $gr(el).attr('href');
                const isGrade = text.includes('ابتدائي') || text.includes('إعدادي') || text.includes('ثانوي') || text.includes('الصف');
                if (href && !isGrade && text.length > 2 && text.includes('مادة')) {
                    subjectLinks.push({ text, href: href.startsWith('http') ? href : `${BASE_URL}/${href}` });
                }
            });

            const uniqueSubjects = Array.from(new Map(subjectLinks.map(s => [s.href, s])).values());
            console.log(`    🔖 Found ${uniqueSubjects.length} subjects`);

            for (const subject of uniqueSubjects) {
                const courses = await scrapeSubjectCourses(subject.href);
                if (courses.length === 0) continue;
                console.log(`      📖 ${subject.text} -> Found ${courses.length} courses! Processing playlists...`);

                const tasks = courses.map(course => async () => {
                    await processCourse(course, grade.text, level.name, subject.text);
                    coursesProcessed++;
                });

                // Process courses concurently
                await limitedConcurrency(tasks, CONCURRENCY);
                console.log(`        ✅ Done: ${subject.text}`);
            }
        }
    }

    const elapsed = Math.round((Date.now() - t0) / 1000);
    console.log(`\n✨ Done in ${elapsed}s! Processed ${coursesProcessed} Full Courses/Playlists.`);
    pool.end();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
