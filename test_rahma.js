const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

async function testPlaylists() {
    const urlsToTest = [
        'https://www.rahma-school.com/lessons/%D8%AD%D9%84-%D8%AA%D9%82%D9%8A%D9%85%D8%A7%D8%AA-%D9%88%D8%A7%D9%84%D8%A7%D8%AF%D8%A7%D8%A1-%D8%A7%D9%84%D9%85%D9%86%D8%B2%D9%84%D9%8A-%D9%88%D8%A7%D9%84%D8%A7%D8%AF%D8%A7%D8%A1-%D8%A7%D9%84%D8%B5%D9%81%D9%8A-%D9%84%D8%BA%D8%A9-%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9-%D8%A7%D9%84%D8%B5%D9%81-%D8%A7%D9%84%D8%A3%D9%88%D9%84-%D8%A7%D9%84%D8%A5%D8%A8%D8%AA%D8%AF%D8%A7%D8%A6%D9%8A-%D8%AA%D8%B1%D9%85-%D8%AB%D8%A7%D9%86%D9%89-2025-%D8%AF%D8%B1%D8%B3-23956',
        'https://www.rahma-school.com/lessons/%D8%B4%D8%B1%D8%AD-%D9%85%D9%86%D9%87%D8%AC-%D9%83%D9%88%D9%86%D9%83%D8%AA-%D8%A8%D9%84%D8%B3-%D8%A7%D9%84%D8%B5%D9%81-%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%89-%D8%A7%D9%84%D8%A7%D8%A8%D8%AA%D8%AF%D8%A7%D8%A6%D9%89-online-%D8%A7%D9%84%D9%88%D8%AD%D8%AF%D8%A9-10-%D8%A7%D9%84%D9%88%D8%AD%D8%AF%D8%A9-11-%D8%A7%D9%84%D8%AF%D8%B1%D8%B3-1%D9%882%D9%883-%D8%AF%D8%B1%D8%B3-17540'
    ];

    for (const url of urlsToTest) {
        console.log('\n--- FETCHING:', decodeURIComponent(url).substring(0, 100) + '...');
        try {
            const res = await axios.get(url, { responseType: 'arraybuffer' });
            const html = iconv.decode(res.data, 'win1256');
            const $ = cheerio.load(html);

            console.log('Title:', $('title').text());
            const videos = [];

            // Check list container
            $('#lessons-container p.video, #lessons-container p.active.video').each((i, el) => {
                const a = $(el).find('a');
                if (a.length > 0) {
                    videos.push({ title: a.text().trim() || $(el).text().trim(), url: a.attr('href') });
                } else if ($(el).attr('onclick')) {
                    const match = $(el).attr('onclick').match(/href='([^']+)'/) || $(el).attr('onclick').match(/href=\"([^\"]+)\"/);
                    if (match) {
                        videos.push({ title: $(el).text().trim(), url: match[1] });
                    }
                }
            });

            console.log('Found playlist size:', videos.length);
            if (videos.length > 0) {
                console.log('First 3 items:', videos.slice(0, 3));
            }
        } catch (err) {
            console.error('Error fetching', err.message);
        }
    }
}

testPlaylists();
