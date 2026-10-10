import { NextRequest, NextResponse } from 'next/server'
import { getLeadById, updateLead, createContact, createTask } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { smartCrawl } from '@/lib/crawler'
import {
  classifyContactRole,
  calculateDecisionMakerScore,
} from '@/lib/classifier'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireAuth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const lead = await getLeadById(id)

    if (!lead || lead.userId !== userId) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    if (!lead.website) {
      return NextResponse.json(
        { error: 'Lead has no website to crawl' },
        { status: 400 }
      )
    }

    // Create task for background processing
    const task = await createTask({
      userId,
      leadId: id,
      type: 'CRAWL_WEBSITE',
      status: 'PENDING',
    })

    // Start crawling in background (don't await)
    crawlAndClassify(lead, userId).catch(err => {
      console.error('[v0] Crawl error:', err)
    })

    return NextResponse.json(
      {
        task,
        message: 'Crawling started in background',
      },
      { status: 202 }
    )
  } catch (error) {
    console.error('[v0] Crawl error:', error)
    return NextResponse.json(
      { error: 'Failed to start crawl' },
      { status: 400 }
    )
  }
}

async function crawlAndClassify(lead: any, userId: string) {
  try {
    console.log(`[v0] Starting crawl for ${lead.website}`)

    const crawledPages = await smartCrawl(lead.website, 3, 3)

    // Aggregate data from all pages
    const allEmails = new Set<string>()
    const allPhones = new Set<string>()
    const allNames = new Set<string>()

    crawledPages.forEach(page => {
      page.emails.forEach(e => allEmails.add(e))
      page.phones.forEach(p => allPhones.add(p))
      page.names.forEach(n => allNames.add(n))
    })

    // Update lead with crawl data
    const leadNotes = `Crawled ${crawledPages.length} pages\nEmails found: ${allEmails.size}\nPhones found: ${allPhones.size}\n\n${lead.notes || ''}`

    await updateLead(lead.id, {
      crawledAt: new Date(),
      notes: leadNotes,
    })

    // Create contacts from discovered emails and names
    const emailsArray = Array.from(allEmails)
    const namesArray = Array.from(allNames)

    for (let i = 0; i < Math.max(emailsArray.length, namesArray.length); i++) {
      const email = emailsArray[i]
      const name = namesArray[i] || `Contact ${i + 1}`
      const phone = Array.from(allPhones)[i]

      if (email || name) {
        const role = classifyContactRole(
          name,
          email || '',
          leadNotes
        )

        const decisionMakerScore = calculateDecisionMakerScore(
          role,
          name,
          email || '',
          leadNotes
        )

        await createContact({
          leadId: lead.id,
          userId,
          name,
          email: email || undefined,
          phone,
          role,
          decisionMakerScore,
          source: 'crawled',
        })
      }
    }

    console.log(
      `[v0] Crawl completed for ${lead.website}: ${allEmails.size} emails, ${allPhones.size} phones`
    )
  } catch (error) {
    console.error('[v0] Crawl and classify error:', error)
  }
}
