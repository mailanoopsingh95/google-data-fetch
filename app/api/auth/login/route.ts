import { NextRequest, NextResponse } from 'next/server'
import { AuthRequestSchema } from '@/lib/types'
import { getUserByEmail } from '@/lib/db'
import { verifyPassword, createToken, setAuthCookie } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request
    const parsed = AuthRequestSchema.parse(body)

    // Find user
    const user = await getUserByEmail(parsed.email)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Verify password
    const validPassword = await verifyPassword(parsed.password, user.password)
    if (!validPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Create JWT token
    const token = createToken(user)

    // Set cookie
    await setAuthCookie(token)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        company: user.company,
      },
      token,
    })
  } catch (error) {
    console.error('[v0] Login error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 400 }
    )
  }
}
