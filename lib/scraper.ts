import { chromium, Browser } from 'playwright'

let browserPromise: Promise<Browser> | null = null

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true })
  }
  return browserPromise
}

export async function scrapePageText(url: string, timeoutMs: number = 15000): Promise<string | null> {
  try {
    const browser = await getBrowser()
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })
    const page = await context.newPage()

    await page.goto(url, {
      timeout: timeoutMs,
      waitUntil: 'domcontentloaded',
    })

    await page.waitForTimeout(1500)

    const text = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script, style, noscript')
      scripts.forEach(s => s.remove())
      return document.body?.innerText || ''
    })

    await context.close()

    return text.replace(/\s+/g, ' ').trim().substring(0, 8000)
  } catch (error) {
    console.error(`[v0] Failed to scrape ${url}:`, error instanceof Error ? error.message : 'Unknown error')
    return null
  }
}

export async function cleanupBrowser(): Promise<void> {
  if (browserPromise) {
    try {
      const browser = await browserPromise
      await browser.close()
    } catch { }
    browserPromise = null
  }
}

process.on('exit', () => {
  cleanupBrowser()
})
