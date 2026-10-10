import { NextRequest, NextResponse } from 'next/server'
import { getLeadStats } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stats = await getLeadStats(userId)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('[v0] Stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 400 }
    )
  }
}
