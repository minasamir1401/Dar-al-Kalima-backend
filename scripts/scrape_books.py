import requests
from bs4 import BeautifulSoup
import json
import time
import re
import sys
import io

# Fix encoding issue for Windows console
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE_URL = "https://www.christianlib.com/"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

CATEGORIES = [
    {"name": "الكتاب المقدس", "path": "category/%d8%a7%d9%84%d9%83%d8%aa%d8%a7%d8%a8-%d8%a7%d9%84%d9%85%d9%82%d8%af%d8%b3/"},
    {"name": "ابائيات", "path": "category/%d8%a7%d8%a8%d8%a7%d8%a6%d9%8a%d8%a7%d8%aa/"},
    {"name": "عقائد", "path": "category/%d9%83%d8%aa%d8%a0-%d9%84%d8%a7%d9%87%d9%88%d8%aa-%d9%88%d8%b9%d9%82%d9%8a%d8%af%d8%a9-%d9%85%d8%b3%d9%8a%d8%ad%d9%8a%d8%a9-pdf/"},
    {"name": "روحية", "path": "category/%d8%b1%d9%88%d8%ad%d9%8a%d8%a9/"},
    {"name": "سير وروايات", "path": "category/%d8%b3%d9%8a%d8%b1-%d9%88-%d8%b1%d9%88%d8%a7%d9%8a%d8%a7%d8%aa/"}
]

def get_download_link(page_url):
    try:
        response = requests.get(page_url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(response.content, 'html.parser')
        content = soup.select_one('.entry-content')
        if content:
            links = content.find_all('a', href=True)
            for link in links:
                href = link['href']
                text = link.text.lower()
                if "mediafire.com" in href or "تحميل" in text or "كتاب" in text:
                    return href
        return ""
    except Exception as e:
        return ""

def scrape_category(cat_info, limit=8):
    url = f"{BASE_URL}{cat_info['path']}"
    books = []
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(response.content, 'html.parser')
        articles = soup.select('article')
        
        for art in articles[:limit]:
            title_tag = art.select_one('.entry-title a')
            img_tag = art.select_one('.post-thumbnail img')
            
            if title_tag:
                title = title_tag.text.strip()
                book_url = title_tag['href']
                image = img_tag['src'] if img_tag else "https://via.placeholder.com/300x200"
                
                print(f"Scraping book: {title}")
                download_url = get_download_link(book_url)
                
                books.append({
                    "title": title,
                    "url": book_url,
                    "image": image,
                    "download_url": download_url,
                    "category": cat_info['name']
                })
                time.sleep(0.1)
    except Exception as e:
        print(f"Error for {cat_info['name']}: {e}")
    
    return books

def main():
    all_books = []
    for cat in CATEGORIES:
        print(f"Starting category: {cat['name']}")
        all_books.extend(scrape_category(cat))
    
    with open("books_data.json", "w", encoding="utf-8") as f:
        json.dump(all_books, f, ensure_ascii=False, indent=4)
    print(f"Success! {len(all_books)} books saved.")

if __name__ == "__main__":
    main()
