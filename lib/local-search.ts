import { scrapePageText } from './scraper'
import { extractDealerData } from './gemini'
import { DealerResult } from './types'

type DirectorySource = 'JUSTDIAL' | 'INDIAMART'

function searchUrl(query: string, source: DirectorySource): string {
  const q = encodeURIComponent(query)
  switch (source) {
    case 'JUSTDIAL':
      return `https://www.justdial.com/search?q=${q}`
    case 'INDIAMART':
      return `https://www.indiamart.com/search?q=${q}`
  }
}

function hasPhone(text: string): boolean {
  return /\+?91[-.\s]?[6-9]\d{9}|\b[6-9]\d{9}\b/.test(text)
}

function hasPincode(text: string): boolean {
  return /\b[1-9]\d{5}\b/.test(text)
}

function splitIntoEntries(text: string, source: DirectorySource): string[] {
  const sections = text.split(/\n{2,}/).map(s => s.trim()).filter(s => s.length > 30)

  if (source === 'JUSTDIAL') {
    return sections.filter(s => hasPhone(s) && hasPincode(s))
  }

  return sections.filter(s => hasPhone(s))
}

export async function searchDirectory(
  query: string,
  source: DirectorySource,
  indexOffset: number = 0
): Promise<DealerResult[]> {
  const url = searchUrl(query, source)

  const pageText = await scrapePageText(url, 30000)
  if (!pageText || pageText.length < 200) return []

  const entries = splitIntoEntries(pageText, source)
  if (entries.length === 0) return []

  const directoryDomains = ['justdial.com', 'indiamart.com']
  const isGeneric = (company: string) =>
    directoryDomains.some(d => company.includes(d))

  const results: DealerResult[] = []
  for (let i = 0; i < entries.length; i++) {
    const dealer = await extractDealerData(entries[i], url, indexOffset + i)
    if (dealer.company && !isGeneric(dealer.company)) {
      results.push(dealer)
    }
  }

  return results
}

export async function searchJustDial(query: string, offset?: number): Promise<DealerResult[]> {
  return searchDirectory(query, 'JUSTDIAL', offset)
}

export async function searchIndiaMART(query: string, offset?: number): Promise<DealerResult[]> {
  return searchDirectory(query, 'INDIAMART', offset)
}
