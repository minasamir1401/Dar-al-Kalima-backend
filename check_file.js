const fs = require('fs');
const html = fs.readFileSync('raw_page.html', 'utf8');
const regex = /https?:\/\/[^\s'"]+mediafire[^\s'"]+/gi;
const matches = html.match(regex);
console.log('Matches:', matches);
