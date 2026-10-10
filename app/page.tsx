'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function Page() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    }
  }, [isLoading, user, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-muted-foreground">Redirecting...</div>
    </div>
  )
}
