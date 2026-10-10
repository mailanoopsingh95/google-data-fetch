import { NextRequest, NextResponse } from 'next/server'
import { RegisterRequestSchema } from '@/lib/types'
import { createUser, getUserByEmail } from '@/lib/db'
import { hashPassword, createToken, setAuthCookie } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request
    const parsed = RegisterRequestSchema.parse(body)

    // Check if user already exists
    const existingUser = await getUserByEmail(parsed.email)
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await hashPassword(parsed.password)

    // Create user
    const user = await createUser({
      email: parsed.email,
      password: hashedPassword,
      name: parsed.name,
      company: parsed.company,
    })

    // Create JWT token
    const token = createToken(user)

    // Set cookie
    await setAuthCookie(token)

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          company: user.company,
        },
        token,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[v0] Registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 400 }
    )
  }
}
