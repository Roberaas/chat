import { LucideIcon } from 'lucide-react'

export default function StatCard({
  label, value, delta, icon: Icon, tone = 'default', sub,
}: {
  label: string; value: string | number; delta?: string
  icon: LucideIcon; tone?: 'default' | 'gold' | 'ruby'; sub?: string
}) {
  const styles = {
    default: { bg: 'var(--bg-card)', border: 'var(--border-gold)', iconColor: 'var(--text-muted)' },
    gold: { bg: 'rgba(139,105,20,0.05)', border: 'rgba(139,105,20,0.2)', iconColor: 'var(--gold)' },
    ruby: { bg: 'rgba(139,38,53,0.06)', border: 'rgba(139,38,53,0.2)', iconColor: '#C4364A' },
  }
  const s = styles[tone]
  return (
    <div className="relative rounded-xl p-5 transition-all" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
      <div className="flex items-start justify-between mb-4">
        <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
        <Icon size={14} color={s.iconColor} strokeWidth={1.5} />
      </div>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 42, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 300 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
      {delta && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginTop: 8 }}>{delta}</div>}
    </div>
  )
}
