import requests
from bs4 import BeautifulSoup
import json
import time
import sys
import io
import re

if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE_URL = "https://www.christianlib.com"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
}

CATEGORIES = [
    {"name": "الكتاب المقدس", "path": "category/%D8%A7%D9%84%D9%83%D8%AA%D8%A7%D8%A8-%D8%A7%D9%84%D9%85%D9%82%D8%AF%D8%B3/"},
    {"name": "دفاعيات", "path": "category/%D8%A7%D9%84%D9%83%D8%AA%D8%A7%D8%A8-%D8%A7%D9%84%D9%85%D9%82%D8%AF%D8%B3/%D8%AF%D9%81%D8%A7%D8%B9%D9%8A%D8%A7%D8%AA-apologetics/"},
    {"name": "ابائيات", "path": "category/%D8%A7%D8%A8%D8%A7%D8%A6%D9%8A%D8%A7%D8%AA/"},
    {"name": "عقائد", "path": "category/%D9%83%D8%AA%D8%A0-%D9%84%D8%A7%D9%87%D9%88%D8%AA-%D9%88%D8%B9%D9%82%D9%8A%D8%AF%D8%A9-%D9%85%D8%B3%D9%8A%D8%ad%D9%8A%D8%A9-pdf/"},
    {"name": "روحية", "path": "category/%D8%B1%D9%88%D8%ad%D9%8A%D8%A9/"},
    {"name": "سير وروايات", "path": "category/%D8%B3%D9%8A%D8%B1-%D9%88-%D8%B1%D9%88%D8%A7%D9%8A%D8%A7%D8%AA/"},
    {"name": "تاريخ الكنيسة", "path": "category/%D8%AA%D8%A7%D8%B1%D9%8A%D8%AE-%D8%A7%D9%84%D9%83%D9%86%D9%8A%D8%B3%D8%A9/"},
    {"name": "طقوس", "path": "category/%D8%B7%D9%82%D9%88%D8%B3/"},
    {"name": "فلسفة ومشورة", "path": "category/%D9%81%D9%84%D8%B3%D9%81%D8%A9-%D9%88-%D8%B9%D9%84%D9%85-%D9%86%D9%81%D8%B3/"},
    {"name": "خدمة وتربية", "path": "category/%D8%A7%D9%84%D8%AA%D8%B1%D8%A8%D9%8A%D8%A9-%D9%88-%D8%A7%D9%84%D8%AE%D8%AF%D9%85%D8%A9-%D8%AA%D8%AD%D9%85%D9%8A%D9%84-pdf/"},
    {"name": "اسلاميات", "path": "category/%D8%A7%D8%B3%D9%84%D8%A7%D9%85%D9%8A%D8%A7%D8%AA/"},
    {"name": "كتب مجمعة", "path": "category/kotb-masi7ya-mogm3a/"}
]

def get_download_link(page_url, session):
    try:
        response = session.get(page_url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(response.content, 'html.parser')
        content = soup.select_one('.entry-content')
        if content:
            links = content.find_all('a', href=True)
            for link in links:
                href = link['href']
                if "mediafire.com" in href:
                    return href
                if ".pdf" in href.lower() and "christianlib.com" not in href:
                    return href
                # Look for links with text like "تحميل"
                if "تحميل" in link.text or "download" in link.text.lower():
                    if not href.startswith('javascript'):
                        return href
        return ""
    except:
        return ""

def scrape_full_books(max_pages_per_cat=10):
    all_books = []
    try:
        with open("books_data_full.json", "r", encoding="utf-8") as f:
            all_books = json.load(f)
            print(f"Loaded {len(all_books)} existing books.")
    except:
        pass

    seen_urls = {b['url'] for b in all_books}
    session = requests.Session()

    for cat in CATEGORIES:
        print(f"\n[+] Category: {cat['name']}", flush=True)
        for page in range(1, max_pages_per_cat + 1):
            url = f"{BASE_URL}/{cat['path']}"
            if page > 1:
                url = f"{BASE_URL}/{cat['path']}page/{page}/"
            
            print(f"  [P{page}] {url}", end="\r", flush=True)
            try:
                response = session.get(url, headers=HEADERS, timeout=15)
                if response.status_code != 200:
                    break
                
                soup = BeautifulSoup(response.content, 'html.parser')
                articles = soup.select('article')
                if not articles:
                    break
                
                for art in articles:
                    title_tag = art.select_one('.entry-title a')
                    if not title_tag: continue
                    
                    book_url = title_tag['href']
                    if not book_url.startswith('http'): book_url = f"{BASE_URL}{book_url}"
                    if book_url in seen_urls: continue
                    
                    title = title_tag.text.strip()
                    img_tag = art.select_one('.post-thumbnail img') or art.select_one('.entry-content img')
                    image = img_tag['src'] if img_tag and img_tag.has_attr('src') else "https://via.placeholder.com/300x400?text=Book"
                    if image.startswith('//'): image = 'https:' + image
                    
                    # We'll get download links only for some to not hang, 
                    # OR we get them all since it's "Premium". 
                    # Let's get them but with a tiny sleep.
                    dw_url = get_download_link(book_url, session)
                    
                    all_books.append({
                        "title": title,
                        "url": book_url,
                        "image": image,
                        "download_url": dw_url,
                        "category": cat['name']
                    })
                    seen_urls.add(book_url)
                    time.sleep(0.05)
                
                # Save after each page
                with open("books_data_full.json", "w", encoding="utf-8") as f:
                    json.dump(all_books, f, ensure_ascii=False, indent=4)
                    
            except Exception as e:
                print(f"\n  [ERR] {e}")
                break
    print(f"\n[DONE] Finished. Total: {len(all_books)}")

if __name__ == "__main__":
    scrape_full_books(max_pages_per_cat=15)
