'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { 
  Eye, 
  EyeOff, 
  Loader2,
  TrendingUp
} from 'lucide-react'

// Custom Logo double-comma shape SVG component
const LogoIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 9.5C10 7.57 8.43 6 6.5 6S3 7.57 3 9.5s1.57 3.5 3.5 3.5h1.2c-.3 1.35-1.5 2.5-3.2 2.9l.5 1.9c2.8-.7 4.8-2.8 5-5.8V9.5z" />
    <path d="M21 9.5C21 7.57 19.43 6 17.5 6S14 7.57 14 9.5s1.57 3.5 3.5 3.5h1.2c-.3 1.35-1.5 2.5-3.2 2.9l.5 1.9c2.8-.7 4.8-2.8 5-5.8V9.5z" />
  </svg>
)

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { register } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setIsLoading(false)
      return
    }

    try {
      await register(name, email, password)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc] overflow-x-hidden font-sans">
      
      {/* ================= LEFT HALF (Teal Panel) ================= */}
      <div className="w-full md:w-[42%] bg-[#0e7490] text-white p-8 md:p-12 flex flex-col justify-between relative overflow-hidden shrink-0 min-h-[500px] md:min-h-screen">
        {/* Subtle grid lines background overlay */}
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:30px_30px]" />
        
        {/* Logo and Headings */}
        <div className="space-y-8 z-10">
          <div className="flex items-center gap-2">
            <LogoIcon className="w-8 h-8 text-white" />
          </div>
          <div className="space-y-4 max-w-sm">
            <h1 className="text-3.5xl md:text-4xl font-extrabold tracking-tight leading-tight">
              Start Creating Impact Right Away
            </h1>
            <p className="text-cyan-100 text-sm md:text-base leading-relaxed opacity-90">
              From campaign automation to team collaboration, let's turn your ideas into measurable results
            </p>
          </div>
        </div>

        {/* Floating Graphics & Miniature Dashboard */}
        <div className="my-10 md:my-0 relative flex justify-center items-center h-[290px] z-10 select-none">
          {/* Mock Dashboard container */}
          <div className="w-[320px] bg-slate-900 border border-slate-800 text-slate-200 rounded-2xl p-4 shadow-[0_20px_40px_-5px_rgba(0,0,0,0.35)] relative z-25 transform rotate-1 hover:rotate-0 transition-transform duration-300">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <span className="text-[9px] text-slate-500 font-mono">dashboard.tvs</span>
            </div>

            {/* Core Stats Overview block */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                <span className="text-[8px] text-slate-500 block uppercase font-semibold">Total Leads</span>
                <span className="text-sm font-bold font-mono text-emerald-400">8,250</span>
              </div>
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                <span className="text-[8px] text-slate-500 block uppercase font-semibold">Conversion</span>
                <span className="text-sm font-bold font-mono text-cyan-400">4.2%</span>
              </div>
            </div>

            {/* Simulated Line Chart graphic */}
            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/50 h-24 flex items-end justify-between relative overflow-hidden">
              {/* SVG Line path representation */}
              <svg className="absolute inset-x-0 bottom-0 h-16 w-full text-cyan-500/25" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M0,80 Q20,30 40,60 T80,10 T100,20 L100,100 L0,100 Z" fill="currentColor" />
                <path d="M0,80 Q20,30 40,60 T80,10 T100,20" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400" />
              </svg>
              
              {/* Floating Badges inside dashboard mock */}
              <div className="absolute top-2 right-2 bg-slate-850 text-[8px] px-1.5 py-0.5 rounded border border-slate-800 text-slate-400 font-semibold flex items-center gap-0.5 shadow">
                <TrendingUp className="w-2 h-2 text-emerald-400" /> +12.4%
              </div>
            </div>

            {/* Float tags */}
            <div className="absolute -top-6 -left-6 bg-cyan-400 text-slate-950 font-bold px-2 py-1 rounded shadow-md text-[9px] z-10 animate-bounce">
              Robin hood
            </div>
            <div className="absolute -bottom-4 -left-2 bg-amber-400 text-slate-950 font-bold px-2.5 py-1 rounded-full shadow-md text-[9px] z-10">
              Marc Allister
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="z-10 pt-4">
          <p className="text-xs text-cyan-200 opacity-70">
            © TVS 2026. All Rights Reserved
          </p>
        </div>
      </div>

      {/* ================= RIGHT HALF (Registration Container) ================= */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 md:p-12 relative bg-slate-50/50">
        
        {/* Architect Guidelines Background grid */}
        <div className="absolute left-[25%] top-0 bottom-0 w-[1px] bg-slate-200/60 pointer-events-none" />
        <div className="absolute left-[50%] top-0 bottom-0 w-[1px] bg-slate-200/60 pointer-events-none" />
        <div className="absolute left-[75%] top-0 bottom-0 w-[1px] bg-slate-200/60 pointer-events-none" />
        
        {/* Top/Bottom Striped borders */}
        <div className="absolute top-0 left-0 right-0 h-8 bg-[repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0_8px,#f8fafc_8px,#f8fafc_16px)] border-b border-slate-200/80" />
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-[repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0_8px,#f8fafc_8px,#f8fafc_16px)] border-t border-slate-200/80" />

        {/* Skeuomorphic Glass Card container */}
        <div className="w-full max-w-[430px] bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden z-10 mt-6 mb-6">
          {/* Silver screw dots at 4 corners */}
          <div className="absolute top-4 left-4 w-1.5 h-1.5 rounded-full bg-slate-300 border border-slate-400/50 shadow-inner" />
          <div className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full bg-slate-300 border border-slate-400/50 shadow-inner" />
          <div className="absolute bottom-4 left-4 w-1.5 h-1.5 rounded-full bg-slate-300 border border-slate-400/50 shadow-inner" />
          <div className="absolute bottom-4 right-4 w-1.5 h-1.5 rounded-full bg-slate-300 border border-slate-400/50 shadow-inner" />
          
          <div className="flex flex-col items-center text-center space-y-4 mb-6">
            {/* Center Logo circular icon */}
            <div className="w-12 h-12 rounded-full bg-[#0e7490] flex items-center justify-center text-white shadow-md">
              <LogoIcon className="w-6 h-6" />
            </div>
            
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-slate-800">Create TVS Account</h2>
              <p className="text-slate-400 text-xs leading-relaxed max-w-[280px]">
                Drive growth with intelligent automation and effortless teamwork
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs text-center animate-shake">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label htmlFor="name" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Full name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-cyan-600 transition-colors placeholder:text-slate-350"
                placeholder="Michael Obelix"
                disabled={isLoading}
              />
            </div>

            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-cyan-600 transition-colors placeholder:text-slate-350"
                placeholder="michaelobelix2025@mail.com"
                disabled={isLoading}
              />
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-cyan-600 transition-colors placeholder:text-slate-350 pr-10"
                  placeholder="Create your password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[#1e293b] hover:bg-slate-850 text-white rounded-full font-semibold transition-colors flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registering Account...
                  </>
                ) : (
                  'Sign Up'
                )}
              </button>
            </div>
          </form>

          {/* Social Sign-In Google SSO */}
          <div className="mt-4">
            <button 
              type="button"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 hover:bg-slate-50 transition-colors rounded-full text-slate-700 text-sm font-semibold"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              Google
            </button>
          </div>

          {/* Card Footer: Sign In */}
          <div className="border-t border-slate-100 bg-slate-50/50 px-8 py-5 text-center text-sm rounded-b-[2.5rem] mt-6 -mx-8 -mb-8">
            <span className="text-slate-400">Already have an account? </span>
            <Link href="/login" className="font-bold text-[#0e7490] hover:underline">
              Sign In &gt;
            </Link>
          </div>

        </div>

        {/* Outer card footer agreement */}
        <p className="text-[10px] text-slate-400 text-center max-w-[280px] leading-relaxed z-10 select-none">
          by signing up, you agree to our <br />
          <Link href="#" className="underline hover:text-slate-600">Terms of Service</Link> and <Link href="#" className="underline hover:text-slate-600">Privacy Policy</Link>
        </p>

      </div>
    </div>
  )
}
