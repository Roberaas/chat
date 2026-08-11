import { LucideIcon } from 'lucide-react'

export default function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = 'default',
  sub,
}: {
  label: string
  value: string | number
  delta?: string
  icon: LucideIcon
  tone?: 'default' | 'gold' | 'ruby'
  sub?: string
}) {
  const styles = {
    default: { bg: '#1A1712', border: 'rgba(201,168,76,0.1)', iconColor: '#7A7468' },
    gold: { bg: 'rgba(201,168,76,0.06)', border: 'rgba(201,168,76,0.2)', iconColor: '#C9A84C' },
    ruby: { bg: 'rgba(139,38,53,0.08)', border: 'rgba(139,38,53,0.25)', iconColor: '#C4364A' },
  }
  const s = styles[tone]

  return (
    <div
      className="relative rounded-xl p-5 transition-all"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      <div className="flex items-start justify-between mb-4">
        <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9A928A', fontWeight: 500 }}>
          {label}
        </span>
        <Icon size={14} color={s.iconColor} strokeWidth={1.5} />
      </div>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 42, color: '#EDE8DF', lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 300 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: '#5A5550', marginTop: 6 }}>{sub}</div>
      )}
      {delta && (
        <div style={{ fontSize: 11, color: '#9A928A', fontFamily: 'JetBrains Mono, monospace', marginTop: 8 }}>
          {delta}
        </div>
      )}
    </div>
  )
}
