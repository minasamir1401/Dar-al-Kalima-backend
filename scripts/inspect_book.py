import requests
from bs4 import BeautifulSoup

url = "https://www.christianlib.com/35608.html/%d9%83%d8%aa%d8%a7%d8%a8-%d8%af%d8%b1%d8%a7%d8%b3%d8%a9-%d8%a2%d8%a8%d8%a7%d8%a6%d9%8a%d8%a9-%d9%81%d9%8a-%d8%b3%d8%b1-%d8%a7%d9%84%d8%ab%d8%a7%d9%84%d9%88%d8%ab-%d8%a7%d9%84%d9%82%d8%af%d9%88%d8%b3/"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ar,en;q=0.5',
}

r = requests.get(url, headers=headers, timeout=15)
print("Status:", r.status_code)
# Print raw HTML to understand structure
print(r.text[:5000])
