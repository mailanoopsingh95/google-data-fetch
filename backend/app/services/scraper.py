import re
import logging
import asyncio
from typing import Dict, List, Set, Any, Optional
from urllib.parse import urljoin, urlparse
import httpx
from bs4 import BeautifulSoup
from app.core.logging import SCRAPER_CALLS

logger = logging.getLogger("business_intel_api")

EMAIL_REGEX = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
PHONE_REGEX = re.compile(r'(?:\+?91[\s.-]?)?[6-9]\d{9}|\b\d{3,5}[\s.-]?\d{6,8}\b|\+?\d{1,4}[\s.-]?\d{7,10}')

SOCIAL_PLATFORMS = {
    "linkedin": re.compile(r'linkedin\.com/(?:company|in)/[\w-]+', re.IGNORECASE),
    "facebook": re.compile(r'facebook\.com/[\w.-]+', re.IGNORECASE),
    "twitter": re.compile(r'(?:twitter|x)\.com/[\w-]+', re.IGNORECASE),
    "instagram": re.compile(r'instagram\.com/[\w.-]+', re.IGNORECASE),
    "youtube": re.compile(r'youtube\.com/(?:c|channel|user)/[\w-]+', re.IGNORECASE),
}

PRIORITY_PATHS = [
    "/contact",
    "/contact-us",
    "/about",
    "/about-us",
    "/team",
    "/our-team",
    "/company",
]

class WebsiteScraper:
    def __init__(self, timeout: float = 6.0):
        self.timeout = timeout
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        self.playwright_semaphore = asyncio.Semaphore(2) # Limit concurrent headless browsers to prevent resource exhaustion

    async def crawl_site(self, base_url: str) -> Dict[str, Any]:
        """
        Crawls a website starting at base_url.
        Concurrently crawls the homepage and high-priority subpages (contact, about).
        Extracts emails, phone numbers, social media links, contact page, and tech stack.
        """
        if not base_url:
            return {}
            
        if not base_url.startswith(("http://", "https://")):
            base_url = "https://" + base_url

        parsed_url = urlparse(base_url)
        domain = parsed_url.netloc

        emails: Set[str] = set()
        phones: Set[str] = set()
        social_links: Set[str] = set()
        contact_page: Optional[str] = None
        tech_stack: Set[str] = set()
        about_summary_parts: List[str] = []

        # 1. Fetch homepage
        html_content, headers = await self._fetch_page(base_url)
        
        if not html_content:
            # Try playwright fallback for JavaScript heavy sites
            html_content = await self._fetch_page_playwright(base_url)
            headers = {}

        if not html_content:
            logger.warning(f"[scraper] Failed to fetch homepage for {base_url}")
            SCRAPER_CALLS.labels(status="failed").inc()
            return {}

        SCRAPER_CALLS.labels(status="success").inc()
        
        # Parse homepage
        soup = BeautifulSoup(html_content, "html.parser")
        
        # Tech stack detection
        tech_stack.update(self._detect_tech(html_content, headers))
        
        # Extract emails & phones
        emails.update(self._extract_emails(soup.get_text()))
        phones.update(self._extract_phones(soup.get_text()))
        
        # Find social links
        social_links.update(self._extract_socials(soup))
        
        # Find contact page and other priority paths
        links_to_crawl = set()
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            full_link = urljoin(base_url, href)
            link_path = urlparse(full_link).path.lower().rstrip("/")
            
            # Check if it belongs to the same domain
            if urlparse(full_link).netloc == domain:
                for path in PRIORITY_PATHS:
                    if path in link_path:
                        links_to_crawl.add(full_link)
                        if "contact" in link_path:
                            contact_page = full_link

        # 2. Concurrently fetch up to 3 priority links to enrich contact details
        links_list = list(links_to_crawl)[:3]
        if links_list:
            logger.info(f"[scraper] Crawling priority subpages: {links_list}")
            tasks = [self._fetch_page(link) for link in links_list]
            pages = await asyncio.gather(*tasks, return_exceptions=True)
            
            for page in pages:
                if isinstance(page, tuple) and page[0]:
                    sub_html, _ = page
                    sub_soup = BeautifulSoup(sub_html, "html.parser")
                    text = sub_soup.get_text()
                    emails.update(self._extract_emails(text))
                    phones.update(self._extract_phones(text))
                    social_links.update(self._extract_socials(sub_soup))
                    
                    # Gather about summaries
                    if "about" in sub_html.lower() or "who we are" in sub_html.lower():
                        paragraphs = [p.get_text().strip() for p in sub_soup.find_all("p") if len(p.get_text().strip()) > 30]
                        if paragraphs:
                            about_summary_parts.extend(paragraphs[:2])

        # If about summary is still empty, try to fetch some paragraphs from the homepage
        if not about_summary_parts:
            paragraphs = [p.get_text().strip() for p in soup.find_all("p") if len(p.get_text().strip()) > 30]
            if paragraphs:
                about_summary_parts.extend(paragraphs[:2])

        about_summary = " ".join(about_summary_parts)[:500] if about_summary_parts else None

        return {
            "emails": list(emails),
            "phones": list(phones),
            "social_links": list(social_links),
            "contact_page": contact_page or base_url,
            "about_summary": about_summary,
            "tech_stack": list(tech_stack),
        }

    async def _fetch_page(self, url: str) -> tuple[Optional[str], dict]:
        """Fetch a page asynchronously using httpx."""
        try:
            async with httpx.AsyncClient(headers=self.headers, follow_redirects=True, timeout=self.timeout) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    return res.text, dict(res.headers)
        except Exception as e:
            logger.debug(f"[scraper] Failed to fetch url {url}: {e}")
        return None, {}

    async def _fetch_page_playwright(self, url: str) -> Optional[str]:
        """Playwright fallback for JavaScript-rendered websites."""
        async with self.playwright_semaphore:
            try:
                from playwright.async_api import async_playwright
                async with async_playwright() as p:
                    # Browser configuration with error handling in case browser binaries aren't installed
                    try:
                        browser = await p.chromium.launch(headless=True)
                    except Exception as browser_err:
                        logger.warning(f"[scraper] Playwright chromium launch failed: {browser_err}. Browser binaries might not be installed.")
                        return None
                        
                    context = await browser.new_context(user_agent=self.headers["User-Agent"])
                    page = await context.new_page()
                    await page.goto(url, wait_until="networkidle", timeout=int(self.timeout * 1000))
                    content = await page.content()
                    await browser.close()
                    return content
            except Exception as e:
                logger.debug(f"[scraper] Playwright failed for {url}: {e}")
            return None

    def _extract_emails(self, text: str) -> List[str]:
        matches = EMAIL_REGEX.findall(text)
        exclude_domains = ["example.com", "test.com", "domain.com", "wix.com", "sentry.io"]
        valid_emails = []
        for email in matches:
            email_lower = email.lower()
            if not any(domain in email_lower for domain in exclude_domains):
                valid_emails.append(email)
        return list(set(valid_emails))

    def _extract_phones(self, text: str) -> List[str]:
        matches = PHONE_REGEX.findall(text)
        clean_phones = []
        for phone in matches:
            phone_sub = re.sub(r'[\s.-]', '', phone)
            if len(phone_sub) >= 10:  # Validate min phone length
                clean_phones.append(phone.strip())
        return list(set(clean_phones))[:5]

    def _extract_socials(self, soup: BeautifulSoup) -> List[str]:
        socials = set()
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            for platform, pattern in SOCIAL_PLATFORMS.items():
                if pattern.search(href):
                    # Ensure full url
                    if not href.startswith("http"):
                        href = "https://" + href.lstrip("/")
                    socials.add(href)
        return list(socials)

    def _detect_tech(self, html: str, headers: dict) -> List[str]:
        tech = set()
        
        # Check HTTP headers
        server = headers.get("server", "").lower()
        if "cloudflare" in server:
            tech.add("Cloudflare")
        if "litespeed" in server:
            tech.add("LiteSpeed Server")
            
        x_powered = headers.get("x-powered-by", "").lower()
        if "next.js" in x_powered or "next" in x_powered:
            tech.add("Next.js")
            tech.add("React")
        elif "express" in x_powered:
            tech.add("Express.js")
        elif "wp" in x_powered or "wordpress" in x_powered:
            tech.add("WordPress")
            
        # Check HTML content
        html_lower = html.lower()
        
        # CMS
        if "wp-content" in html_lower or "wp-includes" in html_lower:
            tech.add("WordPress")
            tech.add("PHP")
        if "shopify.com" in html_lower or "cdn.shopify.com" in html_lower or "shopify" in html_lower:
            tech.add("Shopify")
        if "wix.com" in html_lower or "wix-image" in html_lower:
            tech.add("Wix")
        if "static1.squarespace.com" in html_lower or "squarespace" in html_lower:
            tech.add("Squarespace")
        if "data-wf-site" in html_lower or "webflow" in html_lower:
            tech.add("Webflow")
            
        # Frameworks
        if "id=\"__next_data__\"" in html_lower or "_next/static" in html_lower:
            tech.add("Next.js")
            tech.add("React")
        elif "react-root" in html_lower or "data-reactroot" in html_lower or "react.production" in html_lower:
            tech.add("React")
        if "data-v-" in html_lower or "vue.runtime" in html_lower:
            tech.add("Vue.js")
        if "ng-version" in html_lower or "ng-app" in html_lower:
            tech.add("Angular")
        if "___gatsby" in html_lower:
            tech.add("Gatsby")
            tech.add("React")
            
        # UI libraries / analytics
        if "tailwind" in html_lower:
            tech.add("Tailwind CSS")
        if "bootstrap" in html_lower:
            tech.add("Bootstrap")
        if "googletagmanager.com" in html_lower or "google-analytics" in html_lower or "ua-" in html_lower or "g-" in html_lower:
            tech.add("Google Analytics")
            
        return list(tech)

scraper = WebsiteScraper()
