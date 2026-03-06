const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'manaret_el_eman.db'));

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
];

function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await axios.get(url, {
                ...options,
                headers: { ...options.headers, 'User-Agent': getRandomUserAgent() }
            });
        } catch (err) {
            if (err.response && err.response.status === 429) {
                const waitTime = (i + 1) * 60000; // Wait 1 minute, then 2, then 3...
                console.log(`[Rate Limit] 429 encountered at ${url}. Waiting ${waitTime / 1000}s before retry ${i + 1}/${retries}...`);
                await wait(waitTime);
                continue;
            }
            if (i === retries - 1) throw err;
            await wait(2000);
        }
    }
}

async function scrapeCourse(course) {
    try {
        const m3aarfIdMatch = course.url.match(/\/certificate\/(\d+)/);
        if (!m3aarfIdMatch) return null;
        const m3aarfId = m3aarfIdMatch[1];
        const lessons = [];

        // 1. Get first page to find total pages
        const firstPageUrl = `https://www.m3aarf.com/ajax/certificate/${m3aarfId}/lessons?page=1`;
        const firstRes = await fetchWithRetry(firstPageUrl, { timeout: 10000 });
        let totalPages = firstRes.data.totalPages || 1;

        console.log(`\n[Course: ${course.title}] Total pages: ${totalPages}`);

        for (let p = 1; p <= totalPages; p++) {
            const pageUrl = `https://www.m3aarf.com/ajax/certificate/${m3aarfId}/lessons?page=${p}`;
            console.log(`  -> Scraping page ${p}/${totalPages}...`);
            const pageRes = await fetchWithRetry(pageUrl, { timeout: 10000 });
            const $ = cheerio.load(pageRes.data.html);

            const pageLessons = [];
            $('.lesson-item').each((i, el) => {
                pageLessons.push({
                    title: $(el).find('h3').text().trim(),
                    url: $(el).attr('href'),
                    duration: $(el).find('span').text().trim()
                });
            });

            // Process lessons slowly (one by one or small groups)
            for (const lesson of pageLessons) {
                try {
                    const lessonRes = await fetchWithRetry(lesson.url, { timeout: 7000 });
                    const videoIdMatch = lessonRes.data.match(/youtube\.com\/embed\/([^"?]+)/) ||
                        lessonRes.data.match(/v=([^"&?]+)/) ||
                        lessonRes.data.match(/ytimg\.com\/vi\/([^/]+)/);

                    if (videoIdMatch) {
                        lesson.videoId = videoIdMatch[1];
                        lessons.push(lesson);
                        process.stdout.write("."); // Progress marker
                    }
                    await wait(1500); // 1.5s delay between lesson pages
                } catch (e) {
                    console.error(`\n    ! Error lesson: ${lesson.title} - ${e.message}`);
                }
            }
            console.log(""); // New line after page lessons
        }
        return lessons;
    } catch (err) {
        console.error(`\nError scraping ${course.title}: ${err.message}`);
        return null;
    }
}

async function startFullScrape() {
    console.log("Starting Optimized Full Scrape...");

    db.all('SELECT id, title, url FROM courses WHERE lessons_data IS NULL OR lessons_data = ""', async (err, rows) => {
        if (err) {
            console.error(err.message);
            return;
        }

        console.log(`Found ${rows.length} pending courses.`);

        for (const course of rows) {
            console.log(`-----------------------------------`);
            console.log(`Processing ID ${course.id}: ${course.title}`);
            const lessons = await scrapeCourse(course);

            if (lessons && lessons.length > 0) {
                const lessonsJson = JSON.stringify(lessons);
                await new Promise((resolve) => {
                    db.run('UPDATE courses SET lessons_data = ? WHERE id = ?', [lessonsJson, course.id], (updErr) => {
                        if (updErr) console.error(`Error saving: ${updErr.message}`);
                        else console.log(`[Success] Saved ${lessons.length} lessons.`);
                        resolve();
                    });
                });
            } else {
                console.log(`[Skip/Fail] No lessons data saved.`);
            }

            console.log("Waiting 5s before next course...");
            await wait(5000); // 5s break between courses
        }

        console.log("\nFULL SCRAPE COMPLETE!");
        db.close();
    });
}

startFullScrape();
