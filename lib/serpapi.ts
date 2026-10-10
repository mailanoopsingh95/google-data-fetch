const SERPAPI_KEY = process.env.SERPAPI_KEY || ''

if (!SERPAPI_KEY) {
  console.warn('[v0] SERPAPI_KEY not set — searches will return no results')
}

export interface SerpapiResult {
  title: string
  link: string
  snippet: string
}

export async function searchGoogle(query: string, limit: number = 10): Promise<SerpapiResult[]> {
  if (!SERPAPI_KEY) {
    console.error('[v0] SERPAPI_KEY is not configured')
    return []
  }

  const params = new URLSearchParams({
    q: query,
    api_key: SERPAPI_KEY,
    num: String(limit),
    engine: 'google',
  })

  const res = await fetch(`https://serpapi.com/search?${params}`, {
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    throw new Error(`SerpAPI error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()

  if (data.error) {
    throw new Error(`SerpAPI error: ${data.error}`)
  }

  return (data.organic_results || []).map((r: any) => ({
    title: r.title || '',
    link: r.link || '',
    snippet: r.snippet || '',
  })).filter((r: SerpapiResult) => r.link)
}
