'use client'

import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/lib/auth-context'
import { 
  Search, 
  Download, 
  Loader2, 
  Star, 
  Mail, 
  Phone, 
  Globe, 
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Info,
  Code
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

interface Business {
  id: string
  place_id: string
  business_name: string
  category: string
  address?: string
  latitude?: number
  longitude?: number
  rating?: number
  reviews_count: number
  phone?: string
  website?: string
  opening_hours?: any
  
  emails: string[]
  phones: string[]
  social_links: string[]
  contact_page?: string
  about_summary?: string
  tech_stack: string[]
  
  lead_score?: number
  worth_contacting?: boolean
  estimated_size?: string
  sales_opportunity_score?: number
  raw_places_response?: any
}

function DiscoverContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { authFetch } = useAuth()
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Business[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState('CSV')
  const [activeRawJson, setActiveRawJson] = useState<any | null>(null)

  // Google Sheets state
  const [exportType, setExportType] = useState<'file' | 'sheets'>('file')
  const [sheetsMode, setSheetsMode] = useState<'new' | 'existing'>('new')
  const [spreadsheetName, setSpreadsheetName] = useState('')
  const [spreadsheetId, setSpreadsheetId] = useState('')
  const [serviceAccountEmail, setServiceAccountEmail] = useState('mock-sheets-sync@sales-platform.iam.gserviceaccount.com')
  const [sheetsSyncing, setSheetsSyncing] = useState(false)
  const [sheetsSuccessUrl, setSheetsSuccessUrl] = useState<string | null>(null)
  const [sheetsSuccessMsg, setSheetsSuccessMsg] = useState<string | null>(null)
  const [searchStep, setSearchStep] = useState(0)
  const [worksheetName, setWorksheetName] = useState('')
  const [createWorksheet, setCreateWorksheet] = useState(false)
  const [worksheetList, setWorksheetList] = useState<string[]>([])
  const [loadingWorksheets, setLoadingWorksheets] = useState(false)
  const [loadWorksheetsError, setLoadWorksheetsError] = useState<string | null>(null)

  // Update search step interval during search queries
  useEffect(() => {
    let interval: any
    if (loading) {
      setSearchStep(0)
      interval = setInterval(() => {
        setSearchStep((prev) => {
          if (prev < 2) return prev + 1
          return prev
        })
      }, 5500) // increment step index every 5.5s
    } else {
      setSearchStep(0)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [loading])


  // Load service account email & saved spreadsheet link
  useEffect(() => {
    const fetchClientEmail = async () => {
      try {
        const res = await authFetch('/api/v1/dashboard/exports/google-sheets/client-email')
        if (res.ok) {
          const data = await res.json()
          if (data.client_email) {
            setServiceAccountEmail(data.client_email)
          }
        }
      } catch (err) {
        console.error('Failed to load Service Account email:', err)
      }
    }
    fetchClientEmail()

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('saved_spreadsheet_id')
      if (saved) {
        setSpreadsheetId(saved)
      }
    }
  }, [])

  // Load worksheets (tabs) dynamically from the selected spreadsheet
  useEffect(() => {
    const fetchTabs = async () => {
      const cleanId = spreadsheetId.trim()
      if (sheetsMode !== 'existing' || !cleanId || cleanId.length < 10) {
        setWorksheetList([])
        return
      }
      setLoadingWorksheets(true)
      setLoadWorksheetsError(null)
      try {
        const res = await authFetch(`/api/v1/dashboard/exports/google-sheets/tabs?spreadsheet_id=${encodeURIComponent(cleanId)}`)
        if (res.ok) {
          const data = await res.json()
          if (data.tabs && data.tabs.length > 0) {
            setWorksheetList(data.tabs)
            if (!worksheetName || !data.tabs.includes(worksheetName)) {
              setWorksheetName(data.tabs[0])
            }
          } else {
            setWorksheetList([])
          }
        } else {
          const errData = await res.json().catch(() => ({}))
          let errMsg = errData.detail || 'Could not list worksheets.'
          if (errMsg.toLowerCase().includes('not found') || errMsg.toLowerCase().includes('permission')) {
            errMsg = 'Spreadsheet is private or not found. Please ensure you share Editor access with the Service Account email below first.'
          }
          setLoadWorksheetsError(errMsg)
          setWorksheetList([])
        }
      } catch (err) {
        setLoadWorksheetsError('Failed to fetch spreadsheet worksheets.')
        setWorksheetList([])
      } finally {
        setLoadingWorksheets(false)
      }
    }

    const timer = setTimeout(() => {
      fetchTabs()
    }, 850)

    return () => clearTimeout(timer)
  }, [spreadsheetId, sheetsMode])

  const triggerSearch = async (searchTerm: string, currentLimit: number) => {
    setLoading(true)
    setError(null)
    setResults([])
    setSelectedIds(new Set())
    setSheetsSuccessUrl(null)
    setSheetsSuccessMsg(null)

    try {
      const res = await authFetch('/api/v1/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchTerm.trim(), limit: currentLimit })
      })

      if (res.ok) {
        const data = await res.json()
        setResults(data.results || [])
      } else {
        const errData = await res.json().catch(() => ({}))
        let errMsg = 'Search query failed'
        if (errData.detail) {
          if (typeof errData.detail === 'string') {
            errMsg = errData.detail
          } else if (Array.isArray(errData.detail)) {
            errMsg = errData.detail.map((d: any) => `${d.loc.join('.')}: ${d.msg}`).join(', ')
          } else {
            errMsg = JSON.stringify(errData.detail)
          }
        }
        setError(errMsg)
      }
    } catch (err) {
      setError('Network communication failure')
    } finally {
      setLoading(false)
    }
  }

  // Search execution from form
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanQuery = query.trim()
    if (!cleanQuery) return
    
    const params = new URLSearchParams(window.location.search)
    const currentQ = params.get('query')
    
    if (currentQ === cleanQuery) {
      // If query is identical, trigger search manually as router.push won't change the URL
      await triggerSearch(cleanQuery, limit)
    } else {
      // Let the useEffect search parameter hook handle triggering the search
      params.set('query', cleanQuery)
      router.push(`?${params.toString()}`)
    }
  }

  // Load query from URL parameters on mount/change
  useEffect(() => {
    const q = searchParams.get('query')
    if (q && !loading) {
      setQuery(q)
      triggerSearch(q, limit)
    }
  }, [searchParams])

  // Row selection helpers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(results.map(r => r.place_id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectRow = (placeId: string, checked: boolean) => {
    const next = new Set(selectedIds)
    if (checked) {
      next.add(placeId)
    } else {
      next.delete(placeId)
    }
    setSelectedIds(next)
  }

  const handleExportSelected = async () => {
    if (selectedIds.size === 0) return
    setExporting(true)
    setError(null)
    setSheetsSuccessUrl(null)
    setSheetsSuccessMsg(null)

    try {
      const res = await authFetch(`/api/v1/dashboard/exports?export_format=${exportFormat}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Array.from(selectedIds))
      })

      if (res.ok) {
        const data = await res.json()
        if (data.download_url) {
          const downloadUrl = `http://localhost:8000${data.download_url}`
          window.open(downloadUrl, '_blank')
        } else {
          setError('Export generated, but download URL is missing')
        }
      } else {
        const errData = await res.json().catch(() => ({}))
        let errMsg = 'Export failed'
        if (errData.detail) {
          if (typeof errData.detail === 'string') {
            errMsg = errData.detail
          } else if (Array.isArray(errData.detail)) {
            errMsg = errData.detail.map((d: any) => `${d.loc.join('.')}: ${d.msg}`).join(', ')
          } else {
            errMsg = JSON.stringify(errData.detail)
          }
        }
        setError(errMsg)
      }
    } catch (err) {
      setError('Export failed due to a connection error')
    } finally {
      setExporting(false)
    }
  }

  const handleGoogleSheetsSync = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedIds.size === 0) return
    setSheetsSyncing(true)
    setError(null)
    setSheetsSuccessUrl(null)
    setSheetsSuccessMsg(null)

    try {
      const res = await authFetch('/api/v1/dashboard/exports/google-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          place_ids: Array.from(selectedIds),
          mode: sheetsMode,
          spreadsheet_name: sheetsMode === 'new' ? (spreadsheetName || `Discovery Leads - ${query || 'Export'}`) : undefined,
          spreadsheet_id: sheetsMode === 'existing' ? spreadsheetId : undefined,
          worksheet_name: worksheetName.trim() || undefined,
          create_worksheet: sheetsMode === 'existing' ? createWorksheet : false
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success && data.spreadsheet_url) {
          setSheetsSuccessUrl(data.spreadsheet_url)
          setSheetsSuccessMsg(data.message || 'Successfully synced leads to Google Sheets!')
          
          // Persist spreadsheet ID/URL to localStorage for future use
          const savedUrlOrId = sheetsMode === 'existing' ? spreadsheetId : data.spreadsheet_url
          if (savedUrlOrId) {
            localStorage.setItem('saved_spreadsheet_id', savedUrlOrId)
            // Pre-fill input value so toggling modes retains it
            setSpreadsheetId(savedUrlOrId)
          }
        } else {
          setError(data.message || 'Sync succeeded but could not retrieve sheet URL')
        }
      } else {
        const errData = await res.json().catch(() => ({}))
        let errMsg = 'Google Sheets Sync failed'
        if (errData.detail) {
          if (typeof errData.detail === 'string') {
            errMsg = errData.detail
          } else if (Array.isArray(errData.detail)) {
            errMsg = errData.detail.map((d: any) => `${d.loc.join('.')}: ${d.msg}`).join(', ')
          } else {
            errMsg = JSON.stringify(errData.detail)
          }
        }
        setError(errMsg)
      }
    } catch (err) {
      setError('Sync failed due to a network communication error')
    } finally {
      setSheetsSyncing(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    if (score >= 50) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    return 'bg-rose-500/10 text-rose-600 dark:text-rose-450 border-rose-500/20'
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-foreground transition-colors duration-200">
      
      {/* Header */}
      <div className="flex flex-col space-y-1">
        <h1 className="text-3xl font-black tracking-tight text-foreground">
          Lead Discovery Engine
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Search for companies using Google Places API and automatically crawl website metadata with AI lead score qualifications.
        </p>
      </div>

      {/* Search Input Card */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm transition-colors duration-200">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <input
              type="text"
              placeholder="e.g. Restaurants in Delhi, Manufacturing in Gurgaon, Tech Agencies in Bangalore..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-muted border border-border rounded-xl pl-11 pr-4 py-3 text-foreground focus:outline-none focus:border-indigo-500 focus:bg-card transition-all placeholder:text-muted-foreground/60 text-sm"
              disabled={loading}
              required
            />
          </div>
          
          <div className="flex gap-4 w-full md:w-auto shrink-0 justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Limit:</span>
              <input
                type="number"
                min={1}
                max={100}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm focus:outline-none focus:border-indigo-500 focus:bg-card w-20 text-center font-bold"
                disabled={loading}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="bg-foreground text-background font-bold px-6 py-2.5 rounded-xl transition-all shadow-md hover:opacity-90 active:scale-95 flex items-center gap-2 disabled:opacity-50 min-w-[120px] justify-center text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Search'
              )}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-450 p-4 rounded-xl text-sm font-semibold">
          {error}
        </div>
      )}

      {/* Results Header Actions & Sync Panel */}
      {results.length > 0 && selectedIds.size > 0 && (
        <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4 animate-in slide-in-from-top duration-300">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/60 pb-3">
            <div>
              <h3 className="text-xs font-black uppercase text-muted-foreground tracking-wider">Export & Sync Center</h3>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                Configure how you want to download or link your {selectedIds.size} qualified leads
              </p>
            </div>
            <div className="text-xs text-muted-foreground font-semibold bg-muted px-3 py-1 rounded-full border border-border/40">
              Selected <strong className="text-foreground font-extrabold">{selectedIds.size}</strong> of {results.length}
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setExportType('file')
                setSheetsSuccessUrl(null)
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                exportType === 'file'
                  ? 'bg-foreground text-background shadow-sm'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Download File
            </button>
            <button
              type="button"
              onClick={() => {
                setExportType('sheets')
                setSheetsSuccessUrl(null)
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                exportType === 'sheets'
                  ? 'bg-foreground text-background shadow-sm'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Google Sheets Sync
            </button>
          </div>

          {/* File Download Form */}
          {exportType === 'file' && (
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-1 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-semibold">Format:</span>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="bg-muted border border-border rounded-xl px-3 py-1.5 text-foreground text-sm focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  <option value="CSV">CSV Format</option>
                  <option value="XLSX">Excel Format</option>
                  <option value="JSON">JSON Format</option>
                </select>
              </div>
              
              <button
                onClick={handleExportSelected}
                disabled={exporting}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-xl flex items-center gap-2 text-sm disabled:opacity-40 transition-all shadow-md active:scale-95"
              >
                {exporting ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Download className="w-4.5 h-4.5" />}
                Download File
              </button>
            </div>
          )}

          {/* Google Sheets Sync Form */}
          {exportType === 'sheets' && (
            <form onSubmit={handleGoogleSheetsSync} className="space-y-4 pt-1 animate-in fade-in duration-200">
              <div className="flex flex-wrap gap-6 items-center">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
                  <input
                    type="radio"
                    name="sheetsMode"
                    checked={sheetsMode === 'new'}
                    onChange={() => {
                      setSheetsMode('new')
                      setSheetsSuccessUrl(null)
                    }}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  Create New Spreadsheet
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
                  <input
                    type="radio"
                    name="sheetsMode"
                    checked={sheetsMode === 'existing'}
                    onChange={() => {
                      setSheetsMode('existing')
                      setSheetsSuccessUrl(null)
                    }}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  Append to Existing Sheet
                </label>
              </div>

              {sheetsMode === 'new' ? (
                <div className="max-w-md space-y-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Spreadsheet Name</label>
                    <input
                      type="text"
                      placeholder={`e.g. Discovery Leads - ${query || 'Export'}`}
                      value={spreadsheetName}
                      onChange={(e) => setSpreadsheetName(e.target.value)}
                      className="w-full bg-muted border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:border-indigo-500 focus:bg-card text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">First Worksheet (Tab) Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sheet1"
                      value={worksheetName}
                      onChange={(e) => setWorksheetName(e.target.value)}
                      className="w-full bg-muted border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:border-indigo-500 focus:bg-card text-xs font-semibold"
                    />
                  </div>
                </div>
              ) : (
                <div className="max-w-xl space-y-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Google Sheet URL or Spreadsheet ID</label>
                    <input
                      type="text"
                      placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                      value={spreadsheetId}
                      onChange={(e) => setSpreadsheetId(e.target.value)}
                      className="w-full bg-muted border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:border-indigo-500 focus:bg-card text-xs font-mono font-semibold"
                      required
                    />
                  </div>

                  {spreadsheetId.trim().length >= 10 && (
                    <div className="bg-muted/40 border border-border/80 p-4 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-black text-muted-foreground tracking-wider">Target Worksheet (Tab)</span>
                        {loadingWorksheets && (
                          <span className="text-[10px] text-indigo-600 font-bold flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Loading tabs...
                          </span>
                        )}
                      </div>

                      {loadWorksheetsError ? (
                        <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                          ⚠ {loadWorksheetsError}
                        </div>
                      ) : worksheetList.length > 0 ? (
                        <div className="space-y-3">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
                            <input
                              type="checkbox"
                              checked={createWorksheet}
                              onChange={(e) => {
                                setCreateWorksheet(e.target.checked)
                                if (e.target.checked) {
                                  setWorksheetName(`Sync - ${new Date().toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}`)
                                } else if (worksheetList.length > 0) {
                                  setWorksheetName(worksheetList[0])
                                }
                              }}
                              className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                            />
                            + Create a new worksheet tab in this spreadsheet
                          </label>

                          {createWorksheet ? (
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">New Worksheet Title</label>
                              <input
                                type="text"
                                placeholder="e.g. Mumbai Leads"
                                value={worksheetName}
                                onChange={(e) => setWorksheetName(e.target.value)}
                                className="w-full bg-muted border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:border-indigo-500 focus:bg-card text-xs font-semibold"
                                required
                              />
                            </div>
                          ) : (
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Select Worksheet tab</label>
                              <select
                                value={worksheetName}
                                onChange={(e) => setWorksheetName(e.target.value)}
                                className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-indigo-500 text-xs font-semibold"
                              >
                                {worksheetList.map(tab => (
                                  <option key={tab} value={tab}>{tab}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                  
                  {/* Share alert */}
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 p-3 rounded-xl text-xs space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      Action Required: Share Spreadsheet Access
                    </p>
                    <p className="opacity-90 font-medium">
                      You must share Editor permissions for your spreadsheet with the service account email below before exporting:
                    </p>
                    <code className="block bg-card px-3 py-1.5 rounded-lg border border-border select-all font-mono font-bold text-[10px] mt-1 break-all text-foreground text-center">
                      {serviceAccountEmail}
                    </code>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <button
                  type="submit"
                  disabled={sheetsSyncing}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2 rounded-xl flex items-center gap-2 text-sm disabled:opacity-40 transition-all shadow-md active:scale-95"
                >
                  {sheetsSyncing ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      Syncing to Sheets...
                    </>
                  ) : (
                    'Sync to Google Sheets'
                  )}
                </button>

                {sheetsSuccessUrl && (
                  <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-xl animate-in fade-in duration-300">
                    <span className="text-emerald-700 dark:text-emerald-400 text-xs font-bold">{sheetsSuccessMsg}</span>
                    <a
                      href={sheetsSuccessUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-lg flex items-center gap-1 transition-all shadow-sm hover:scale-[1.02] inline-flex"
                    >
                      Open Google Sheet
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      {/* Table Results */}
      {results.length > 0 && (
        <div className="border border-border bg-card rounded-3xl overflow-hidden shadow-sm animate-in fade-in duration-500 transition-colors duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground text-xs uppercase tracking-wider font-bold">
                  <th className="px-4 py-3.5 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === results.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-border text-indigo-600 focus:ring-indigo-500 focus:ring-offset-card"
                    />
                  </th>
                  <th className="px-4 py-3.5">Business / Category</th>
                  <th className="px-4 py-3.5">Contacts Info</th>
                  <th className="px-4 py-3.5">Tech & Stack</th>
                  <th className="px-4 py-3.5 text-center">Lead Score</th>
                  <th className="px-4 py-3.5 text-center">Opportunity</th>
                  <th className="px-4 py-3.5 text-center">Contact?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {results.map((b) => {
                  const isRowSelected = selectedIds.has(b.place_id)
                  
                  return (
                    <tr 
                      key={b.place_id} 
                      className={`hover:bg-muted/40 transition-colors align-top ${
                        isRowSelected ? 'bg-indigo-500/5' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-5 text-center">
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={(e) => handleSelectRow(b.place_id, e.target.checked)}
                          className="rounded border-border text-indigo-600 focus:ring-indigo-500 focus:ring-offset-card"
                        />
                      </td>

                      {/* Business name and category */}
                      <td className="px-4 py-5 space-y-1.5 max-w-[280px]">
                        <div className="font-extrabold text-foreground text-sm flex items-center gap-1.5">
                          <span className="truncate">{b.business_name}</span>
                          {b.raw_places_response && (
                            <button
                              onClick={() => setActiveRawJson(b.raw_places_response)}
                              className="text-muted-foreground hover:text-indigo-600 p-0.5 rounded hover:bg-muted transition-colors shrink-0"
                              title="View Raw Places JSON"
                            >
                              <Code className="w-3.5 h-3.5 inline align-middle" />
                            </button>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
                          <span className="bg-muted border border-border px-2 py-0.5 rounded-full capitalize">
                            {b.category}
                          </span>
                          {b.rating && (
                            <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                              <Star className="w-3 h-3 fill-currentColor" />
                              {b.rating} ({b.reviews_count})
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate" title={b.address}>
                          {b.address}
                        </div>
                        {b.about_summary && (
                          <div className="text-[11px] text-muted-foreground/80 pt-1 line-clamp-2 italic" title={b.about_summary}>
                            "{b.about_summary}"
                          </div>
                        )}
                      </td>

                      {/* Contacts Info */}
                      <td className="px-4 py-5 space-y-1.5 text-xs text-foreground/95 max-w-[240px] font-medium">
                        {/* Phone */}
                        {b.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <a href={`tel:${b.phone}`} className="hover:underline text-foreground">{b.phone}</a>
                          </div>
                        )}
                        {/* Email */}
                        {b.emails && b.emails.length > 0 ? (
                          <div className="flex items-start gap-1.5 text-indigo-600 dark:text-indigo-400">
                            <Mail className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />
                            <div className="flex flex-col">
                              {b.emails.map((e, idx) => (
                                <a key={idx} href={`mailto:${e}`} className="hover:underline font-semibold">{e}</a>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Mail className="w-3.5 h-3.5 shrink-0" />
                            <span>No email found</span>
                          </div>
                        )}
                        {/* Website */}
                        {b.website && (
                          <div className="flex items-center gap-1.5 pt-1 text-muted-foreground">
                            <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <a href={b.website} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-0.5 truncate max-w-[150px] text-foreground/80">
                              {b.website.replace(/(^\w+:|^)\/\//, '')}
                              <ExternalLink className="w-2.5 h-2.5 inline" />
                            </a>
                          </div>
                        )}
                      </td>

                      {/* Tech stack */}
                      <td className="px-4 py-5 max-w-[180px]">
                        {b.tech_stack && b.tech_stack.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {b.tech_stack.map((t, idx) => (
                              <span key={idx} className="bg-muted border border-border px-2 py-0.5 text-[9px] text-muted-foreground rounded font-mono font-semibold">
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">Static site</span>
                        )}
                      </td>

                      {/* Lead Score */}
                      <td className="px-4 py-5 text-center">
                        <span className={`inline-flex border px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${getScoreColor(b.lead_score)}`}>
                          {b.lead_score !== null && b.lead_score !== undefined ? `${b.lead_score}/100` : '---'}
                        </span>
                      </td>

                      {/* Opportunity Score */}
                      <td className="px-4 py-5 text-center">
                        <span className={`inline-flex border px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${getScoreColor(b.sales_opportunity_score)}`}>
                          {b.sales_opportunity_score !== null && b.sales_opportunity_score !== undefined ? `${b.sales_opportunity_score}/100` : '---'}
                        </span>
                      </td>

                      {/* Worth Contacting */}
                      <td className="px-4 py-5 text-center">
                        {b.worth_contacting ? (
                          <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 shadow-sm">
                            <ThumbsUp className="w-3 h-3" />
                            Yes
                          </span>
                        ) : (
                          <span className="bg-rose-500/10 text-rose-600 dark:text-rose-450 border border-rose-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                            <ThumbsDown className="w-3 h-3" />
                            No
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cool Progress Loader */}
      {loading && (
        <div className="border border-border rounded-3xl p-10 text-center bg-card max-w-md mx-auto flex flex-col items-center shadow-sm mt-12 transition-colors duration-200 space-y-6 animate-in fade-in duration-300">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-muted/30" />
            <div className="absolute inset-0 rounded-full border-4 border-t-indigo-650 border-r-indigo-500 animate-spin" />
            <div className="absolute inset-3 rounded-full bg-gradient-to-tr from-indigo-500/10 to-emerald-500/10 animate-pulse flex items-center justify-center">
              <Search className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-bounce" />
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base font-extrabold tracking-tight text-foreground">Enriching & Qualifying Prospects...</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Crawling websites and analyzing technologies concurrently. This can take up to 30 seconds.
            </p>
          </div>

          <div className="text-left w-full max-w-xs mx-auto border-t border-border/60 pt-5 space-y-3">
            <div className="flex items-center gap-3">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold transition-all ${
                searchStep >= 0 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20 font-extrabold' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {searchStep > 0 ? '✓' : '1'}
              </span>
              <span className={`text-xs font-semibold ${searchStep === 0 ? 'text-foreground font-extrabold' : searchStep > 0 ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                Querying Google Places Database
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold transition-all ${
                searchStep >= 1 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20 font-extrabold' 
                  : searchStep === 0 ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 animate-pulse' : 'bg-muted text-muted-foreground'
              }`}>
                {searchStep > 1 ? '✓' : '2'}
              </span>
              <span className={`text-xs font-semibold ${searchStep === 1 ? 'text-foreground font-extrabold' : searchStep > 1 ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                Crawling Site Metadata Concurrently
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold transition-all ${
                searchStep >= 2 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20 font-extrabold' 
                  : searchStep === 1 ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 animate-pulse' : 'bg-muted text-muted-foreground'
              }`}>
                {searchStep > 2 ? '✓' : '3'}
              </span>
              <span className={`text-xs font-semibold ${searchStep === 2 ? 'text-foreground font-extrabold' : 'text-muted-foreground/60'}`}>
                AI Scoring & Tech Stack Extraction
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && results.length === 0 && (
        <div className="border border-border rounded-3xl p-16 text-center bg-card max-w-xl mx-auto flex flex-col items-center shadow-sm mt-12 transition-colors duration-200">
          <div className="w-12 h-12 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground mb-4 shadow-sm">
            <Info className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black mb-1 text-foreground tracking-tight">No Leads Retrieved</h3>
          <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">
            Enter a search term above to crawl businesses (e.g. category + location) to start your lead research pipelines.
          </p>
        </div>
      )}

      {/* Raw JSON Inspect Modal Overlay */}
      {activeRawJson && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/40">
              <h3 className="font-bold text-foreground text-base">Raw Google Places Response Payload</h3>
              <button 
                onClick={() => setActiveRawJson(null)} 
                className="text-muted-foreground hover:text-foreground text-sm font-semibold transition-colors"
              >
                Close
              </button>
            </div>
            <pre className="p-6 overflow-y-auto text-xs font-mono text-emerald-600 dark:text-emerald-450 bg-muted/60 flex-1 whitespace-pre-wrap select-all border-b border-border">
              {JSON.stringify(activeRawJson, null, 2)}
            </pre>
            <div className="px-6 py-3 flex justify-end bg-muted/20">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(activeRawJson, null, 2));
                  alert('JSON payload copied to clipboard!');
                }}
                className="bg-foreground text-background hover:opacity-90 transition-all px-4 py-1.5 rounded-lg text-sm font-bold"
              >
                Copy JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2 bg-background text-muted-foreground">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-muted-foreground text-sm">Loading discovery portal...</span>
      </div>
    }>
      <DiscoverContent />
    </Suspense>
  )
}
