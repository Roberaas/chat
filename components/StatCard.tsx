'use client'
import { useEffect, useState } from 'react'

function useCountUp(target: number, duration = 1000) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const start = performance.now()
    let id = 0
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [target, duration])
  return val
}

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: string
  Icon?: any
  onClick?: () => void
  pulse?: boolean
}

export default function StatCard({ label, value, sub, accent = 'var(--ac)', Icon, onClick, pulse }: StatCardProps) {
  const str = String(value)
  const numeric = /^\d+$/.test(str) ? parseInt(str, 10) : null
  const animated = useCountUp(numeric ?? 0)

  return (
    <div
      className="kpi"
      onClick={onClick}
      style={{ borderLeft: `2.5px solid ${accent}`, cursor: onClick ? 'pointer' : 'default' }}
    >
      {pulse && (
        <div style={{ position: 'absolute', top: 10, right: 10, width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2.5s ease-in-out infinite' }} />
      )}
      <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: `radial-gradient(circle at top right, color-mix(in srgb, ${accent} 12%, transparent), transparent 70%)`, pointerEvents: 'none' }} />
      {Icon && (
        <div style={{ width: 34, height: 34, borderRadius: 9, background: `color-mix(in srgb, ${accent} 12%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <Icon size={15} style={{ color: accent }} strokeWidth={1.9} />
        </div>
      )}
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{numeric !== null ? animated : str}</p>
      {sub && <p className="kpi-sub">{sub}</p>}
    </div>
  )
}
