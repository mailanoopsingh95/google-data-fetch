import { NextRequest, NextResponse } from 'next/server'
import { CreateLeadRequestSchema } from '@/lib/types'
import { createLead, getLeadsByUserId, searchLeads } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { classifyLead } from '@/lib/classifier'

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    let leads
    if (query) {
      leads = await searchLeads(userId, query)
    } else {
      leads = await getLeadsByUserId(userId)
    }

    return NextResponse.json({ leads })
  } catch (error) {
    console.error('[v0] Get leads error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 400 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = CreateLeadRequestSchema.parse(body)

    // Calculate initial score and tags
    const { score, tags } = classifyLead(
      parsed.companyName,
      parsed.industry,
      [], // No emails yet
      [] // No phones yet
    )

    const lead = await createLead({
      userId,
      companyName: parsed.companyName,
      industry: parsed.industry,
      source: parsed.source,
      status: 'NEW',
      score,
      website: parsed.website,
      location: parsed.location,
      notes: parsed.notes ? `${parsed.notes}\nTags: ${tags.join(', ')}` : `Tags: ${tags.join(', ')}`,
    })

    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    console.error('[v0] Create lead error:', error)
    return NextResponse.json(
      { error: 'Failed to create lead' },
      { status: 400 }
    )
  }
}
