const axios = require('axios');
const fs = require('fs');

async function debugScrape() {
    const url = 'https://www.christianlib.com/35599.html/%d9%83%d8%aa%d8%a7%d8%a8-%d8%b9%d8%b8%d8%a7%d8%aa-%d8%a7%d9%84%d9%83%d9%86%d9%8a%d8%b3%d8%a9-%d8%a7%d9%84%d8%a3%d9%88%d9%84%d9%89-%d8%a7%d9%84%d8%b1%d8%b3%d8%a7%d9%84%d8%a9-%d8%a7%d9%84%d8%ab%d8%a7%d9%86%d9%8a%d8%a9-%d8%a5%d9%84%d9%89-%d8%a3%d9%87%d9%84-%d9%83%d9%88%d8%b1%d9%86%d8%ab%d9%88%d8%b3/';
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        fs.writeFileSync('raw_page.html', res.data);
        console.log('Saved to raw_page.html');
    } catch (e) {
        console.error('Error:', e.message);
    }
}

debugScrape();
