const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

const BASE_URL = 'https://www.rahma-school.com';

async function testScrape() {
    try {
        const res = await axios.get(`${BASE_URL}/lessons.asp?cid=5`, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            }
        });

        const html = iconv.decode(res.data, 'win1256');
        const $ = cheerio.load(html);

        console.log("Searching for 'Item ZoomIn' class...");
        const items = $('.Item.ZoomIn');
        console.log(`Found ${items.length} items with class .Item.ZoomIn`);

        items.each((i, el) => {
            const title = $(el).find('h3').text().trim() || $(el).text().trim();
            const link = $(el).find('a').attr('href');
            console.log(`Item ${i + 1}: ${title} -> ${link}`);
        });

        if (items.length === 0) {
            console.log("Falling back to scanning all divs for content-like structures...");
            $('div').each((i, el) => {
                const className = $(el).attr('class');
                if (className && (className.includes('Item') || className.includes('Block'))) {
                    const text = $(el).text().trim().substring(0, 50);
                    if (text.length > 5) {
                        console.log(`Potential Div [${className}]: ${text}`);
                    }
                }
            });
        }
    } catch (err) {
        console.error("Scrape failed:", err.message);
    }
}

testScrape();
