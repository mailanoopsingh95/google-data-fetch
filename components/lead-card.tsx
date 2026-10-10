'use client'

import { Lead } from '@/lib/types'
import { Briefcase, MapPin, TrendingUp, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface LeadCardProps {
  lead: Lead
}

export function LeadCard({ lead }: LeadCardProps) {
  const statusColors: Record<string, string> = {
    NEW: 'bg-gradient-to-br from-amber-900 to-amber-950 text-amber-100 border border-amber-700',
    CONTACTED: 'bg-gradient-to-br from-orange-900 to-orange-950 text-orange-100 border border-orange-700',
    QUALIFIED: 'bg-gradient-to-br from-emerald-900 to-emerald-950 text-emerald-100 border border-emerald-700',
    UNQUALIFIED: 'bg-gradient-to-br from-red-900 to-red-950 text-red-100 border border-red-700',
    NEGOTIATING: 'bg-gradient-to-br from-yellow-900 to-yellow-950 text-yellow-100 border border-yellow-700',
    WON: 'bg-gradient-to-br from-green-900 to-green-950 text-green-100 border border-green-700',
    LOST: 'bg-gradient-to-br from-slate-900 to-slate-950 text-slate-100 border border-slate-700',
  }

  const sourceIcons: Record<string, string> = {
    JUSTDIAL: '📞',
    INDIAMART: '🏭',
    TRADEINDIA: '🤝',
    SULEKHA: '📋',
    MANUAL: '✏️',
  }

  return (
    <Link href={`/dashboard/leads/${lead.id}`}>
      <div className="skeu-card p-4 cursor-pointer transition-all group hover:shadow-lg hover:scale-105">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-amber-50 group-hover:text-amber-100 transition-colors line-clamp-1">
              {lead.companyName}
            </h3>
            <p className="text-sm text-amber-200/60 line-clamp-1">{lead.industry}</p>
          </div>
          <div className="ml-2 text-2xl">{sourceIcons[lead.source] || '🏢'}</div>
        </div>

        <div className="flex items-center gap-2 mb-3 text-xs text-amber-200/60">
          {lead.location && (
            <div className="flex items-center gap-1">
              <MapPin size={14} />
              <span>{lead.location}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <TrendingUp size={14} className="text-orange-400" />
            <span className="text-sm font-medium text-amber-50">{lead.score}</span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded border ${statusColors[lead.status] || ''}`}>
            {lead.status}
          </span>
        </div>

        {lead.website && (
          <div className="pt-3 border-t border-amber-700/30 flex items-center text-xs text-amber-300 group-hover:text-amber-100">
            <ExternalLink size={12} className="mr-1" />
            <span className="truncate">{lead.website}</span>
          </div>
        )}
      </div>
    </Link>
  )
}
