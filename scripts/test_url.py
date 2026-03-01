import requests
from bs4 import BeautifulSoup

url = "https://www.christianlib.com/category/%d8%a7%d9%84%d9%83%d8%aa%d8%a7%d8%a8-%d8%a7%d9%84%d9%85%d9%82%d8%af%d8%b3/"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}
response = requests.get(url, headers=headers)
print(f"Status: {response.status_code}")
soup = BeautifulSoup(response.content, 'html.parser')
articles = soup.select('article')
print(f"Articles found: {len(articles)}")
if len(articles) == 0:
    print(response.text[:500])
