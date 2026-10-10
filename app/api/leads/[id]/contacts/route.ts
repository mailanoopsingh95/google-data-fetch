import { NextRequest, NextResponse } from 'next/server'
import { CreateContactRequestSchema } from '@/lib/types'
import {
  getLeadById,
  createContact,
  getContactsByLeadId,
  deleteContact,
} from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import {
  classifyContactRole,
  calculateDecisionMakerScore,
} from '@/lib/classifier'

export async function GET(
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

    const contacts = await getContactsByLeadId(id)

    return NextResponse.json({ contacts })
  } catch (error) {
    console.error('[v0] Get contacts error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 400 }
    )
  }
}

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

    const body = await request.json()
    const parsed = CreateContactRequestSchema.parse(body)

    // Classify role
    const role = parsed.role ||
      classifyContactRole(parsed.name, parsed.email || '', lead.notes || '')

    // Calculate decision-maker score
    const decisionMakerScore = calculateDecisionMakerScore(
      role,
      parsed.name,
      parsed.email || '',
      lead.notes || ''
    )

    const contact = await createContact({
      leadId: id,
      userId,
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      role,
      decisionMakerScore,
      source: 'manual',
    })

    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    console.error('[v0] Create contact error:', error)
    return NextResponse.json(
      { error: 'Failed to create contact' },
      { status: 400 }
    )
  }
}
