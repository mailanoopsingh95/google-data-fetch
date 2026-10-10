interface StatCardProps {
  label: string
  value: string | number
  change?: string
  icon?: React.ReactNode
}

export function StatCard({ label, value, change, icon }: StatCardProps) {
  return (
    <div className="skeu-stat p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 font-semibold">{label}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">{value}</p>
          {change && <p className="text-xs text-green-600 dark:text-green-400 mt-1">{change}</p>}
        </div>
        {icon && <div className="text-blue-400 dark:text-blue-500 opacity-60">{icon}</div>}
      </div>
    </div>
  )
}
