import { NextRequest, NextResponse } from 'next/server'
import { UpdateLeadRequestSchema } from '@/lib/types'
import { getLeadById, updateLead, deleteLead } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

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

    return NextResponse.json(lead)
  } catch (error) {
    console.error('[v0] Get lead error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lead' },
      { status: 400 }
    )
  }
}

export async function PATCH(
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
    const parsed = UpdateLeadRequestSchema.parse(body)

    const updated = await updateLead(id, parsed)

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[v0] Update lead error:', error)
    return NextResponse.json(
      { error: 'Failed to update lead' },
      { status: 400 }
    )
  }
}

export async function DELETE(
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

    await deleteLead(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Delete lead error:', error)
    return NextResponse.json(
      { error: 'Failed to delete lead' },
      { status: 400 }
    )
  }
}
