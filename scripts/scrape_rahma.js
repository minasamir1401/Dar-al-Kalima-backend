const axios = require('axios');
const cheerio = require('cheerio');
const { Pool } = require('pg');
require('dotenv').config();

const pgURI = 'postgresql://neondb_owner:npg_I9w6ahWPzVuv@ep-rough-violet-ai9mop1v-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || pgURI,
    ssl: true
});

const BASE_URL = 'https://www.rahma-school.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

async function fetchPage(url) {
    try {
        const res = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 10000
        });
        return res.data;
    } catch (err) {
        console.error(`Failed to fetch ${url}: ${err.message}`);
        return null;
    }
}

function extractYoutubeId(html) {
    // Try iframe src
    const iframeMatch = html.match(/youtube\.com\/embed\/([^"?\s>]+)/);
    if (iframeMatch) return iframeMatch[1];

    // Try thumbnail URLs
    const thumbMatch = html.match(/ytimg\.com\/vi\/([^/]+)/);
    if (thumbMatch) return thumbMatch[1];

    // Try data attributes or other common patterns
    const genericMatch = html.match(/v=([^"&?\s]+)/);
    if (genericMatch) return genericMatch[1];

    return null;
}

async function scrapeLevel(cid, levelName) {
    console.log(`--- Scraping ${levelName} ---`);
    const html = await fetchPage(`${BASE_URL}/lessons.asp?cid=${cid}`);
    if (!html) return;

    const $ = cheerio.load(html);
    const gradeLinks = [];

    // The subagent said div.Item.ZoomIn.visible a
    $('div.Item.ZoomIn.visible a').each((i, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        if (href && (href.startsWith('/lessons/') || href.startsWith('lessons/'))) {
            gradeLinks.push({
                url: href.startsWith('http') ? href : BASE_URL + (href.startsWith('/') ? '' : '/') + href,
                name: text
            });
        }
    });

    console.log(`Found ${gradeLinks.length} grades in ${levelName}`);

    for (const grade of gradeLinks) {
        await scrapeGrade(grade.url, grade.name, levelName);
    }
}

async function scrapeGrade(url, gradeName, levelName) {
    console.log(`  Scraping Grade: ${gradeName}`);
    const html = await fetchPage(url);
    if (!html) return;

    const $ = cheerio.load(html);
    const subjectLinks = [];

    // The subagent said a.enrol_btn.cont_btn
    $('a.enrol_btn.cont_btn').each((i, el) => {
        const href = $(el).attr('href');
        if (href) {
            subjectLinks.push(href.startsWith('http') ? href : BASE_URL + (href.startsWith('/') ? '' : '/') + href);
        }
    });

    console.log(`    Found ${subjectLinks.length} subjects in ${gradeName}`);

    for (const subjectUrl of subjectLinks) {
        await scrapeSubject(subjectUrl, gradeName, levelName);
    }
}

async function scrapeSubject(url, gradeName, levelName) {
    // Check if this is a "Lesson Group" page or a direct lesson
    const html = await fetchPage(url);
    if (!html) return;

    const $ = cheerio.load(html);

    // If it's a group page, it might have a list of lessons in div#lessons-container
    const subLessons = [];
    $('div#lessons-container a').each((i, el) => {
        const href = $(el).attr('href');
        if (href) {
            subLessons.push(href.startsWith('http') ? href : BASE_URL + (href.startsWith('/') ? '' : '/') + href);
        }
    });

    if (subLessons.length > 0) {
        for (const lessonUrl of subLessons) {
            await scrapeDirectLesson(lessonUrl, gradeName, levelName);
        }
    } else {
        await scrapeDirectLesson(url, gradeName, levelName, html);
    }
}

async function scrapeDirectLesson(url, gradeName, levelName, preFetchedHtml = null) {
    const html = preFetchedHtml || await fetchPage(url);
    if (!html) return;

    const $ = cheerio.load(html);
    const title = $('h1').first().text().trim() || $('title').text().trim();
    const videoId = extractYoutubeId(html);

    // Find image (header image or thumbnail)
    let image = $('div.header img').attr('src');
    if (image && !image.startsWith('http')) image = BASE_URL + image;
    if (!image && videoId) image = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    // Category is basically the level + grade
    const category = levelName;
    const grade = gradeName;

    // Check for PDF links (rough search)
    let download_url = '';
    $('a[href$=".pdf"]').each((i, el) => {
        download_url = $(el).attr('href');
    });
    // Search for "تحميل" in text
    if (!download_url) {
        $('a:contains("تحميل")').each((i, el) => {
            const h = $(el).attr('href');
            if (h && (h.includes('drive.google.com') || h.includes('mediafire.com'))) {
                download_url = h;
                return false;
            }
        });
    }

    if (title && (videoId || download_url)) {
        await saveToDb({
            title,
            grade,
            image,
            download_url,
            video_id: videoId || '',
            category
        });
    }
}

async function saveToDb(data) {
    try {
        // Simple check to avoid duplicates by title and grade
        const check = await pool.query('SELECT id FROM subjects WHERE title=$1 AND grade=$2', [data.title, data.grade]);
        if (check.rows.length > 0) {
            // Update
            await pool.query(
                'UPDATE subjects SET image=$1, download_url=$2, video_id=$3, category=$4 WHERE id=$5',
                [data.image, data.download_url, data.video_id, data.category, check.rows[0].id]
            );
            console.log(`    ✅ Updated: ${data.title}`);
        } else {
            // Insert
            await pool.query(
                'INSERT INTO subjects (title, grade, image, download_url, video_id, category) VALUES ($1, $2, $3, $4, $5, $6)',
                [data.title, data.grade, data.image, data.download_url, data.video_id, data.category]
            );
            console.log(`    🆕 Inserted: ${data.title}`);
        }
    } catch (err) {
        console.error(`Error saving ${data.title}: ${err.message}`);
    }
}

async function main() {
    try {
        await scrapeLevel(1, 'المرحلة الابتدائية');
        await scrapeLevel(2, 'المرحلة الاعدادية');
        await scrapeLevel(3, 'المرحلة الثانوية');
        console.log('--- Scraping Completed ---');
        process.exit(0);
    } catch (err) {
        console.error('Final Error:', err);
        process.exit(1);
    }
}

main();
