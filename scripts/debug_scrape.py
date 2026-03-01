import requests
from bs4 import BeautifulSoup

url = "https://www.christianlib.com/"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}
response = requests.get(url, headers=headers)
print(f"Status: {response.status_code}")
soup = BeautifulSoup(response.content, 'html.parser')
articles = soup.find_all('article')
print(f"Found {len(articles)} articles")
if len(articles) == 0:
    print(response.text[:1000]) # Print start of page to see if it's a block
