import axios from 'axios'
import * as cheerio from 'cheerio'

export interface CrawledData {
  url: string
  emails: string[]
  phones: string[]
  names: string[]
  socialLinks: string[]
  content: string
}

// Email regex pattern
const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

// Phone regex patterns for Indian numbers
const PHONE_REGEX = [
  /\+?91[-.\s]?[6-9]\d{9}/g, // Indian mobile
  /\b[6-9]\d{9}\b/g, // Without country code
  /\(\d{3,4}\)\s?\d{3,4}\s?\d{3,4}/g, // Landline format
]

// Common name patterns
const NAME_REGEX = /[A-Z][a-z]+\s[A-Z][a-z]+/g

// Social media links
const SOCIAL_PATTERNS = {
  linkedin: /linkedin\.com\/(?:company|in)\/[\w-]+/gi,
  facebook: /facebook\.com\/[\w-]+/gi,
  twitter: /(?:twitter|x)\.com\/[\w]+/gi,
  instagram: /instagram\.com\/[\w.]+/gi,
}

// URLs to try based on priority
const CRAWL_PATHS = [
  '/contact',
  '/contact-us',
  '/about',
  '/about-us',
  '/team',
  '/company',
  '/services',
  '/our-team',
  '/',
]

/**
 * Extract emails from text
 */
export function extractEmails(text: string): string[] {
  const emails = text.match(EMAIL_REGEX) || []
  return [...new Set(emails)].filter(
    email =>
      !email.includes('example.com') &&
      !email.includes('test.com') &&
      !email.endsWith('@localhost')
  )
}

/**
 * Extract phone numbers from text
 */
export function extractPhones(text: string): string[] {
  const phones: string[] = []
  PHONE_REGEX.forEach(regex => {
    const matches = text.match(regex) || []
    phones.push(...matches)
  })
  return [...new Set(phones)].slice(0, 5) // Limit to 5
}

/**
 * Extract names from text
 */
export function extractNames(text: string): string[] {
  const names = text.match(NAME_REGEX) || []
  return [...new Set(names)].slice(0, 5) // Limit to 5
}

/**
 * Extract social media links
 */
export function extractSocialLinks(text: string): string[] {
  const links: string[] = []
  Object.entries(SOCIAL_PATTERNS).forEach(([, pattern]) => {
    const matches = text.match(pattern) || []
    links.push(...matches)
  })
  return [...new Set(links)]
}

/**
 * Fetch and parse a single page
 */
async function fetchPage(url: string, timeout = 5000): Promise<string> {
  try {
    const response = await axios.get(url, {
      timeout,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      maxRedirects: 5,
    })
    return response.data
  } catch (error) {
    console.error(`[v0] Failed to fetch ${url}:`, error instanceof Error ? error.message : 'Unknown error')
    return ''
  }
}

/**
 * Extract text content from HTML
 */
function extractTextContent(html: string): string {
  try {
    const $ = cheerio.load(html)
    // Remove script and style elements
    $('script, style, noscript').remove()
    // Get text content
    return $.text().replace(/\s+/g, ' ').trim()
  } catch (error) {
    return ''
  }
}

/**
 * Extract all links from a page
 */
function extractLinks(html: string, baseUrl: string): string[] {
  try {
    const $ = cheerio.load(html)
    const links: string[] = []

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')
      if (href) {
        try {
          const absoluteUrl = new URL(href, baseUrl).href
          // Only include same-domain links
          if (new URL(absoluteUrl).hostname === new URL(baseUrl).hostname) {
            links.push(absoluteUrl)
          }
        } catch {
          // Invalid URL, skip
        }
      }
    })

    return [...new Set(links)]
  } catch (error) {
    return []
  }
}

/**
 * Smart crawl: Start from homepage and intelligently follow links
 */
export async function smartCrawl(
  website: string,
  maxDepth: number = 3,
  maxPagesPerDepth: number = 3
): Promise<CrawledData[]> {
  if (!website.startsWith('http')) {
    website = 'https://' + website
  }

  const crawledPages = new Map<string, CrawledData>()
  const visited = new Set<string>()
  const priorityPaths = CRAWL_PATHS

  let pagesToCrawl = [website]
  let depth = 0

  while (depth < maxDepth && pagesToCrawl.length > 0) {
    const nextPages: string[] = []

    for (const url of pagesToCrawl.slice(0, maxPagesPerDepth)) {
      if (visited.has(url)) continue
      visited.add(url)

      console.log(`[v0] Crawling ${url} (depth: ${depth})`)
      
      const html = await fetchPage(url)
      if (!html) continue

      const text = extractTextContent(html)

      crawledPages.set(url, {
        url,
        emails: extractEmails(text),
        phones: extractPhones(text),
        names: extractNames(text),
        socialLinks: extractSocialLinks(text),
        content: text.substring(0, 5000), // Limit content
      })

      // Extract links to follow at next depth
      const links = extractLinks(html, url)
      const priorityLinks = links.filter(link => {
        const path = new URL(link).pathname
        return priorityPaths.some(p => path.includes(p))
      })

      // If priority links found, follow them. Otherwise follow any links
      nextPages.push(
        ...(priorityLinks.length > 0 ? priorityLinks : links).filter(
          link => !visited.has(link)
        )
      )
    }

    pagesToCrawl = nextPages
    depth++
  }

  return Array.from(crawledPages.values())
}

/**
 * Quick crawl: Only fetch specific paths
 */
export async function quickCrawl(website: string): Promise<CrawledData[]> {
  if (!website.startsWith('http')) {
    website = 'https://' + website
  }

  const baseUrl = new URL(website).origin
  const crawledPages: CrawledData[] = []

  for (const path of CRAWL_PATHS) {
    const url = baseUrl + path
    console.log(`[v0] Quick crawling ${url}`)
    
    const html = await fetchPage(url)
    if (!html) continue

    const text = extractTextContent(html)

    crawledPages.push({
      url,
      emails: extractEmails(text),
      phones: extractPhones(text),
      names: extractNames(text),
      socialLinks: extractSocialLinks(text),
      content: text.substring(0, 5000),
    })
  }

  return crawledPages
}
