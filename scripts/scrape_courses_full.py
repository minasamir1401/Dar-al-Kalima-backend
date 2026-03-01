import requests
from bs4 import BeautifulSoup
import json
import time
import sys
import io

if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE_URL = "https://www.m3aarf.com"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

def get_categories():
    url = f"{BASE_URL}/certified/courses"
    categories = []
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(response.content, 'html.parser')
        # Based on subagent, categories are in the page. 
        # Let's find links that look like /certified/cat/
        links = soup.find_all('a', href=True)
        for link in links:
            if "/certified/cat/" in link['href']:
                categories.append({
                    "name": link.text.strip(),
                    "url": link['href'] if link['href'].startswith('http') else f"{BASE_URL}{link['href']}"
                })
    except Exception as e:
        print(f"Error getting categories: {e}")
    return categories

def scrape_category_courses(cat_info, max_pages=5):
    courses = []
    for page in range(1, max_pages + 1):
        url = f"{cat_info['url']}?p={page}"
        print(f"Scraping M3aarf: {cat_info['name']} - Page {page}")
        try:
            response = requests.get(url, headers=HEADERS, timeout=10)
            soup = BeautifulSoup(response.content, 'html.parser')
            cards = soup.select('.course-card-custom')
            if not cards:
                break
            
            for card in cards:
                title = card.select_one('h3').text.strip() if card.select_one('h3') else "No Title"
                link = card['href'] if card.has_attr('href') else ""
                if link and not link.startswith('http'): link = f"{BASE_URL}{link}"
                
                instructor = card.select_one('.channel_title').text.strip() if card.select_one('.channel_title') else "Unknown"
                lessons = card.select_one('.text-icon span').text.strip() if card.select_one('.text-icon span') else ""
                img_tag = card.select_one('img.card-img-top')
                image = img_tag['data-src'] if img_tag and img_tag.has_attr('data-src') else (img_tag['src'] if img_tag else "")
                
                courses.append({
                    "title": title,
                    "url": link,
                    "instructor": instructor,
                    "lessons": lessons,
                    "image": image,
                    "category": cat_info['name'],
                    "duration": "مشير في الصفحة" # Requires visiting each page, skipping for speed
                })
            time.sleep(0.1)
        except Exception as e:
            print(f"Error: {e}")
            break
    return courses

def main():
    cats = get_categories()
    print(f"Found {len(cats)} categories")
    all_courses = []
    # Deduplicate categories
    seen_urls = set()
    unique_cats = []
    for c in cats:
        if c['url'] not in seen_urls:
            seen_urls.add(c['url'])
            unique_cats.append(c)

    for cat in unique_cats: # Scrape ALL categories now
        all_courses.extend(scrape_category_courses(cat, max_pages=15)) # More pages per category
    
    with open("courses_data_full.json", "w", encoding="utf-8") as f:
        json.dump(all_courses, f, ensure_ascii=False, indent=4)
    print(f"Total courses scraped: {len(all_courses)}")

if __name__ == "__main__":
    main()
