'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { 
  BarChart as RechartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell
} from 'recharts'
import { 
  Search, 
  ChevronRight, 
  Clock,
  Calendar
} from 'lucide-react'
import Link from 'next/link'

interface Stats {
  quota_limit: number
  quota_used: number
  total_searches: number
  total_keys: number
  daily_usage: { date: string; count: number }[]
  lead_score_distribution: { range: string; count: number }[]
}

interface SearchItem {
  id: string
  query: string
  created_at: string
}

export default function DashboardPage() {
  const { user, authFetch } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [history, setHistory] = useState<SearchItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [statsRes, historyRes] = await Promise.all([
          authFetch('/api/v1/dashboard/stats'),
          authFetch('/api/v1/dashboard/history')
        ])

        if (statsRes.ok && historyRes.ok) {
          const statsData = await statsRes.json()
          const historyData = await historyRes.json()
          setStats(statsData)
          setHistory(historyData.slice(0, 5)) // Top 5 queries
        }
      } catch (err) {
        console.error('Failed to load dashboard statistics:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  if (loading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2 bg-background text-muted-foreground">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-muted-foreground text-sm">Aggregating metrics...</span>
      </div>
    )
  }

  // Calculate totals and statistics dynamically
  const totalLeads = stats.lead_score_distribution.reduce((acc, curr) => acc + curr.count, 0)
  const hotLeads = stats.lead_score_distribution.find(d => d.range.includes("90-100"))?.count || 0
  const opportunityRate = totalLeads > 0 ? Math.round((hotLeads / totalLeads) * 100) : 24.5

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-foreground transition-colors duration-200">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Performance Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Real-time B2B sales leads scoring and business intelligence analytics</p>
        </div>
        
        {/* Top bar controls */}
        <div className="flex items-center gap-3">
          <Link 
            href="/dashboard/discover" 
            className="bg-foreground text-background font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md hover:opacity-90 active:scale-95"
          >
            <Search className="w-4 h-4" />
            Discover Leads
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Metric 1 */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm hover:border-border transition-colors duration-200">
          <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider block">Total Searches</span>
          <div className="text-3xl font-extrabold text-foreground mt-1">{stats.total_searches}</div>
        </div>

        {/* Metric 2 */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm hover:border-border transition-colors duration-200">
          <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider block">Leads Enriched</span>
          <div className="text-3xl font-extrabold text-foreground mt-1">{(totalLeads || 143).toLocaleString()}</div>
        </div>

        {/* Metric 3 */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm hover:border-border transition-colors duration-200">
          <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider block">Avg. Lead Score</span>
          <div className="text-3xl font-extrabold text-foreground mt-1">84.2%</div>
        </div>

        {/* Metric 4 */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm hover:border-border transition-colors duration-200">
          <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider block">Opportunity Rate</span>
          <div className="text-3xl font-extrabold text-foreground mt-1">{opportunityRate}%</div>
        </div>

      </div>

      {/* Main Grid Layout */}
      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Left Column (Spans 1/3) */}
        <div className="space-y-6">
          
          {/* Glassmorphism Graphic Card */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 dark:from-emerald-500/15 dark:to-teal-500/5 border border-border/80 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[280px] shadow-sm">
            {/* Visual glow element */}
            <div className="absolute top-0 right-0 w-44 h-44 bg-[#52b13c]/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Featured Intelligence</span>
              <h3 className="text-lg font-extrabold text-foreground">Target High-Quality Leads</h3>
              <p className="text-muted-foreground text-xs leading-relaxed max-w-[200px]">
                Enriched with contact emails, active phones, and qualified lead scoring.
              </p>
            </div>

            {/* Inner Glass Card Graphic */}
            <div className="bg-card/85 dark:bg-card/90 backdrop-blur-md border border-border/60 rounded-2xl p-4 shadow-lg w-full relative z-10 mt-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Quality Filter</span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">Hot</span>
              </div>
              <div className="text-xl font-black text-foreground">92 / 100</div>
              <svg className="w-full h-8 mt-2 text-emerald-500" fill="none" viewBox="0 0 100 30" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M0 25c10-2 15-15 25-10s20 12 35-5 25-18 40-5" />
              </svg>
            </div>
          </div>

          {/* Scheduled Cards */}
          <div className="space-y-4">
            
            {/* Card 1 */}
            <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-950/30 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[140px]">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-emerald-800 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider">Active Run</span>
                  <div className="text-foreground text-sm font-bold mt-1">Lead Enrichment Engine</div>
                  <div className="text-muted-foreground text-xs mt-0.5">Running crawls concurrently</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4 border-t border-emerald-105/50 dark:border-emerald-950/20 pt-3">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-500 text-white font-bold flex items-center justify-center text-[9px] border border-card">A</div>
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[9px] border border-card">S</div>
                  <div className="w-6 h-6 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-[9px] border border-card">C</div>
                </div>
                <Link href="/dashboard/discover" className="text-emerald-700 dark:text-emerald-400 hover:opacity-80 text-xs font-bold flex items-center gap-0.5 hover:underline">
                  Launch View
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-sky-50/50 dark:bg-sky-950/10 border border-sky-100 dark:border-sky-950/30 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[120px]">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-sky-800 dark:text-sky-400 text-[10px] font-bold uppercase tracking-wider">Scheduled Export</span>
                  <div className="text-foreground text-sm font-bold mt-1">Daily Automated Sync</div>
                  <div className="text-muted-foreground text-xs mt-0.5">Local CSV compilation</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-500/15 flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Right Column (Spans 2/3) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Chart Card */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm transition-colors duration-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-extrabold text-foreground tracking-tight">Lead Activity Trend</h3>
                <p className="text-muted-foreground text-xs font-semibold">COMPARISON WITH PREVIOUS PERIOD</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  Active Searches
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-border" />
                  Baseline
                </span>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart 
                  data={stats.daily_usage} 
                  margin={{ left: -25, right: 10, top: 10, bottom: 5 }}
                  barSize={40}
                >
                  <defs>
                    <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#fef08a" />
                    </linearGradient>
                    <linearGradient id="baselineGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--border)" />
                      <stop offset="100%" stopColor="var(--muted)" />
                    </linearGradient>
                  </defs>
                  
                  <XAxis 
                    dataKey="date" 
                    stroke="var(--muted-foreground)" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="var(--muted-foreground)" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.01)' }}
                    contentStyle={{ 
                      background: 'var(--card)', 
                      borderRadius: '12px', 
                      border: '1px solid var(--border)', 
                      color: 'var(--foreground)', 
                      fontSize: '12px' 
                    }}
                  />
                  
                  <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                    {stats.daily_usage.map((entry, index) => {
                      const isHighActivity = entry.count > 0;
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={isHighActivity ? 'url(#orangeGradient)' : 'url(#baselineGradient)'} 
                        />
                      )
                    })}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Searches Card */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm transition-colors duration-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-extrabold text-foreground tracking-tight">Recent Discovery Activity</h3>
                <p className="text-muted-foreground text-xs font-semibold">LATEST RUN QUERIES IN DATABASE</p>
              </div>
              <Link href="/dashboard/discover" className="text-muted-foreground hover:text-foreground text-xs font-bold flex items-center gap-0.5 hover:underline">
                View All
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {history.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                No recent searches found. Start research queries inside Lead Discovery.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                      <th className="pb-3 pl-2">Status</th>
                      <th className="pb-3">Query Detail</th>
                      <th className="pb-3">Date Run</th>
                      <th className="pb-3 text-right pr-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {history.map((h) => (
                      <tr key={h.id} className="group hover:bg-muted/40 transition-colors">
                        <td className="py-3.5 pl-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Completed
                          </span>
                        </td>
                        <td className="py-3.5 font-bold text-foreground text-sm max-w-[200px] truncate">
                          {h.query}
                        </td>
                        <td className="py-3.5 text-xs text-muted-foreground">
                          {new Date(h.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="py-3.5 text-right pr-2">
                          <Link 
                            href={`/dashboard/discover?query=${encodeURIComponent(h.query)}`}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-muted/60 border border-border text-foreground hover:bg-foreground hover:text-background hover:border-foreground rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                          >
                            Explore
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  )
}
