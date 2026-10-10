'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface User {
  id: string
  name: string
  email: string
  company: string
  subscription_plan: string
  subscription_status: string
  quota_used: number
  created_at: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, company: string) => Promise<void>
  logout: () => Promise<void>
  authFetch: (url: string, options?: RequestInit) => Promise<Response>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Auto load token and user on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('bi_token')
      if (!storedToken) {
        setIsLoading(false)
        return
      }

      setToken(storedToken)
      try {
        const response = await fetch('/api/v1/auth/me', {
          headers: {
            'Authorization': `Bearer ${storedToken}`
          }
        })
        if (response.ok) {
          const userData = await response.json()
          setUser(userData)
        } else {
          // Token expired or invalid
          localStorage.removeItem('bi_token')
          setToken(null)
          setUser(null)
        }
      } catch (error) {
        console.error('[auth] Profile fetch failed:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const authFetch = async (
    url: string, 
    options: RequestInit = {}, 
    retries = 2
  ): Promise<Response> => {
    const storedToken = localStorage.getItem('bi_token')
    const headers = new Headers(options.headers || {})
    
    if (storedToken) {
      headers.set('Authorization', `Bearer ${storedToken}`)
    }
    
    try {
      const res = await fetch(url, {
        ...options,
        headers
      })
      
      // If Next.js proxy returns a 502/504 Gateway error (common during TCP reset)
      if ((res.status === 502 || res.status === 504) && retries > 0) {
        console.warn(`[authFetch] Gateway status ${res.status} for ${url}, retrying...`)
        await new Promise((resolve) => setTimeout(resolve, 300))
        return authFetch(url, options, retries - 1)
      }
      
      return res;
    } catch (err) {
      if (retries > 0) {
        console.warn(`[authFetch] Fetch connection failed for ${url}, retrying... Error:`, err)
        await new Promise((resolve) => setTimeout(resolve, 300))
        return authFetch(url, options, retries - 1)
      }
      throw err
    }
  }

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('username', email)
      params.append('password', password)

      const response = await fetch(`/api/v1/auth/login?${params.toString()}`, {
        method: 'POST'
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || 'Login failed')
      }

      const data = await response.json()
      localStorage.setItem('bi_token', data.access_token)
      setToken(data.access_token)
      setUser(data.user)
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (
    name: string,
    email: string,
    password: string
  ) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || 'Registration failed')
      }

      // Log in immediately after register
      await login(email, password)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    localStorage.removeItem('bi_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
