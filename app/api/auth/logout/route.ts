import { NextRequest, NextResponse } from 'next/server'
import { clearAuthCookie } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    await clearAuthCookie()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Logout error:', error)
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 400 }
    )
  }
}
