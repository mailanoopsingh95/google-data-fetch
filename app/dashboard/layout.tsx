'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { Sun, Moon, Bell } from 'lucide-react'

interface NavigationItem {
  name: string
  href: string
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isLoading, logout } = useAuth()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login?redirect=' + encodeURIComponent(pathname))
    }
  }, [isLoading, user, router, pathname])

  useEffect(() => {
    // Read preference on load
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light')
    
    setTheme(initialTheme)
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
    
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-muted-foreground flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium animate-pulse text-foreground/80">Loading dashboard...</span>
        </div>
      </div>
    )
  }

  if (!user) return null

  const navigation: NavigationItem[] = [
    { name: 'Overview', href: '/dashboard' },
    { name: 'Lead Discovery', href: '/dashboard/discover' },
  ]

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans antialiased transition-colors duration-200">
      
      {/* Top Header Navigation */}
      <header className="bg-card border-b border-border px-6 py-3.5 flex items-center justify-between sticky top-0 z-50 shadow-sm transition-colors duration-200">
        
        {/* Left Section: Logo & Pills */}
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-8.5 h-8.5 rounded-full bg-[#52b13c] flex items-center justify-center text-white shadow-md shadow-emerald-500/10 group-hover:scale-105 transition-transform">
              <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.5"/>
                <circle cx="12" cy="12" r="6" fill="currentColor"/>
              </svg>
            </div>
            <span className="text-lg font-bold text-foreground tracking-tight">Business Intel</span>
          </Link>

          {/* Navigation Pills */}
          <nav className="flex items-center bg-muted p-0.75 rounded-full border border-border/50">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`px-5 py-1.5 rounded-full font-medium text-[11px] uppercase tracking-wider transition-all duration-200 ${
                    isActive 
                      ? 'bg-foreground text-background shadow-sm font-semibold' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right Section: Theme Toggle, Notifications, Profile */}
        <div className="flex items-center gap-4">
          
          {/* Night Mode Icon */}
          <button 
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
            title="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4.5 h-4.5 text-amber-500" />
            ) : (
              <Moon className="w-4.5 h-4.5" />
            )}
          </button>
          
          {/* Notifications bell */}
          <button className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors relative">
            <Bell className="w-4.5 h-4.5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-card" />
          </button>

          {/* User profile picture */}
          <div className="flex items-center gap-3 pl-2 border-l border-border">
            <div className="w-8.5 h-8.5 rounded-full bg-muted border border-border text-foreground font-bold flex items-center justify-center text-xs shadow-sm uppercase">
              {user.name.charAt(0)}
            </div>
            <button 
              onClick={handleLogout}
              className="text-xs font-semibold text-muted-foreground hover:text-rose-600 transition-colors uppercase tracking-wider"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        {children}
      </main>

    </div>
  )
}
