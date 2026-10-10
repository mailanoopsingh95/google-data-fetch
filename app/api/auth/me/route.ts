import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, verifyToken } from '@/lib/auth'
import { getUserById } from '@/lib/db'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'auth-token'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const user = await getUserById(decoded.userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        company: user.company,
      },
    })
  } catch (error) {
    console.error('[v0] Me error:', error)
    return NextResponse.json({ error: 'Failed to get user' }, { status: 400 })
  }
}
