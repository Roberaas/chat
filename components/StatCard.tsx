import { LucideIcon } from 'lucide-react'

export default function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: string | number
  delta?: string
  icon: LucideIcon
  tone?: 'default' | 'moss' | 'ember'
}) {
  const tones = {
    default: 'bg-white border-cream-200',
    moss: 'bg-moss-50 border-moss-200',
    ember: 'bg-ember-400/10 border-ember-400/30',
  }

  return (
    <div
      className={`relative ${tones[tone]} border rounded-2xl p-6 transition-all hover:shadow-[0_8px_24px_-12px_rgba(34,32,26,0.15)]`}
    >
      <div className="flex items-start justify-between mb-6">
        <span className="text-xs uppercase tracking-[0.2em] text-ink-300 font-medium">
          {label}
        </span>
        <Icon className="w-4 h-4 text-ink-300" strokeWidth={1.5} />
      </div>
      <div className="font-display text-4xl text-ink-900 leading-none tracking-tight">
        {value}
      </div>
      {delta && (
        <div className="mt-3 text-xs text-ink-500 font-mono">{delta}</div>
      )}
    </div>
  )
}
