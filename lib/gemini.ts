import { GoogleGenerativeAI } from '@google/generative-ai'
import { DealerResult } from './types'

const API_KEY = process.env.GEMINI_API_KEY || ''

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null

const model = genAI
  ? genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    })
  : null

const EXTRACTION_PROMPT = `You are a data extraction assistant. Extract dealer information from the webpage text below.

Return a JSON object with these exact fields:
{
  "rating": number | null,
  "name": string | null,
  "company": string,
  "phone": string | null,
  "city": string | null,
  "pincode": string | null
}

Rules:
- rating: a number from 0 to 5 (use decimal like 4.2). null if not found.
- name: a person's name if visible on the page. null if not found.
- company: the business or company name. Required.
- phone: a phone number including country code if available. null if not found.
- city: the city name from the address. null if not found.
- pincode: the postal/pin code. null if not found.

If no dealer information is found on this page, set company to the page title and all other fields to null.

Page text:`

// Rate limiter: ensure at least 3s between calls to stay within per-minute quota
let lastCallTime = 0
const MIN_GAP_MS = 3000

async function rateLimitedCall<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const wait = Math.max(0, MIN_GAP_MS - (now - lastCallTime))
  if (wait > 0) {
    await new Promise(resolve => setTimeout(resolve, wait))
  }
  lastCallTime = Date.now()
  return fn()
}

function fallbackExtract(pageText: string, url: string, index: number): DealerResult {
  const phoneMatch = pageText.match(/\+?91[-.\s]?[6-9]\d{9}|\b[6-9]\d{9}\b/)
  const pinMatch = pageText.match(/\b[1-9][0-9]{5}\b/)
  const ratingMatch = pageText.match(/(\d+(?:\.\d+)?)\s*(?:out\s*of\s*5|star|rating)/i)
  const nameMatch = pageText.match(/^(?:About|Contact|Welcome to)\s+(.+)$/m)

  const hostname = safeHostname(url)

  return {
    id: `d-${index}-${Date.now()}`,
    rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
    name: nameMatch?.[1]?.trim() || null,
    company: hostname,
    phone: phoneMatch?.[0] || null,
    city: null,
    pincode: pinMatch?.[0] || null,
    sourceUrl: url,
  }
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export async function extractDealerData(
  pageText: string,
  url: string,
  index: number
): Promise<DealerResult> {
  if (!model) {
    return fallbackExtract(pageText, url, index)
  }

  try {
    const result = await rateLimitedCall(() =>
      model.generateContent(EXTRACTION_PROMPT + '\n\n' + pageText)
    )
    const text = result.response.text()

    const parsed = JSON.parse(text)

    return {
      id: `d-${index}-${Date.now()}`,
      rating: typeof parsed.rating === 'number' ? Math.min(5, Math.max(0, parsed.rating)) : null,
      name: parsed.name || null,
      company: parsed.company || safeHostname(url),
      phone: parsed.phone || null,
      city: parsed.city || null,
      pincode: parsed.pincode || null,
      sourceUrl: url,
    }
  } catch (error: any) {
    const is429 = error?.status === 429 || error?.message?.includes('429')

    if (is429) {
      console.warn(`[v0] Gemini rate limited for ${url}, using regex fallback`)
      return fallbackExtract(pageText, url, index)
    }

    console.error(`[v0] Gemini extraction failed for ${url}:`, error?.message || error)
    return fallbackExtract(pageText, url, index)
  }
}
