import { NextRequest } from 'next/server'
import { searchGoogle } from '@/lib/serpapi'
import { scrapePageText } from '@/lib/scraper'
import { extractDealerData } from '@/lib/gemini'
import { searchJustDial, searchIndiaMART } from '@/lib/local-search'
import { getCached, setCache } from '@/lib/cache'
import { storeDealerResults, getExistingUrls, countDealerResults } from '@/lib/db'
import { SearchRequestSchema, DealerResult } from '@/lib/types'
import crypto from 'crypto'
import { requireAuth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await requireAuth()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = SearchRequestSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.issues[0]?.message || 'Invalid query' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { query, limit } = parsed.data
  const cacheKey = crypto.createHash('sha256').update(`${query.toLowerCase().trim()}_limit_${limit ?? 10}`).digest('hex')

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch { }
      }

      try {
        const cached = getCached<DealerResult[]>(cacheKey)
        if (cached) {
          send('status', { message: `Returning ${cached.length} cached results` })
          for (const result of cached) {
            send('result', result)
          }
          send('done', { totalFound: cached.length, cached: true })
          return
        }

        const dealers: DealerResult[] = []

        // === Google search ===
        send('status', { message: 'Searching Google for dealers...' })
        const results = await searchGoogle(query, limit)

        if (results.length > 0) {
          send('status', { message: `Found ${results.length} results. Checking for already-scraped dealers...` })

          const allUrls = results.map(r => r.link)
          const existingUrls = await getExistingUrls(allUrls)
          const newResults = results.filter(r => !existingUrls.has(r.link))

          if (newResults.length === 0) {
            const total = await countDealerResults()
            send('status', { message: `All ${results.length} Google results were already scraped. You have ${total} dealers saved. Checking local directories...` })
          } else {
            send('status', {
              message: `${newResults.length} new dealer${newResults.length > 1 ? 's' : ''} found (${results.length - newResults.length} already scraped). Extracting data...`,
              skippedCount: results.length - newResults.length,
              newCount: newResults.length,
            })

            for (let i = 0; i < newResults.length; i++) {
              const url = newResults[i].link
              send('progress', {
                processed: i + 1,
                total: newResults.length,
                url,
                skippedCount: results.length - newResults.length,
              })

              const pageText = await scrapePageText(url)
              if (pageText) {
                const dealer = await extractDealerData(pageText, url, dealers.length)
                dealers.push(dealer)
                send('result', dealer)
              }
            }
          }
        } else {
          send('status', { message: 'No Google results. Checking local directories...' })
        }

        // === JustDial search ===
        send('status', { message: 'Searching JustDial for local dealers...' })
        const jdResults = await searchJustDial(query, dealers.length)
        if (jdResults.length > 0) {
          send('status', { message: `Found ${jdResults.length} dealers on JustDial` })
          for (const dealer of jdResults) {
            dealers.push(dealer)
            send('result', dealer)
          }
        } else {
          send('status', { message: 'No results from JustDial' })
        }

        // === IndiaMART search ===
        send('status', { message: 'Searching IndiaMART for local dealers...' })
        const imResults = await searchIndiaMART(query, dealers.length)
        if (imResults.length > 0) {
          send('status', { message: `Found ${imResults.length} dealers on IndiaMART` })
          for (const dealer of imResults) {
            dealers.push(dealer)
            send('result', dealer)
          }
        } else {
          send('status', { message: 'No results from IndiaMART' })
        }

        // Store all results in PostgreSQL
        if (dealers.length > 0) {
          await storeDealerResults(dealers, query, user)
          setCache(cacheKey, dealers)
        }

        const totalSaved = await countDealerResults()
        send('done', { totalFound: dealers.length, cached: false, totalSaved })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Search failed'
        send('error', { message })
      } finally {
        try { controller.close() } catch { }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
