import jwt from 'jsonwebtoken'
import bcryptjs from 'bcryptjs'
import { cookies } from 'next/headers'
import { User } from './types'
import { getUserById } from './db'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production'
const COOKIE_NAME = 'auth-token'

export interface AuthToken {
  userId: string
  email: string
  iat: number
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, 10)
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash)
}

// Create JWT token
export function createToken(user: User): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

// Verify JWT token
export function verifyToken(token: string): AuthToken | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthToken
  } catch (error) {
    return null
  }
}

// Get current user from cookies
export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    if (!token) return null

    const decoded = verifyToken(token)
    if (!decoded) return null

    const user = await getUserById(decoded.userId)
    return user
  } catch (error) {
    return null
  }
}

// Set auth cookie
export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  })
}

// Clear auth cookie
export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

// Middleware to check authentication
export async function requireAuth(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    if (!token) return null

    const decoded = verifyToken(token)
    return decoded?.userId || null
  } catch (error) {
    return null
  }
}
