import type { ReactNode } from 'react'

export type KpiTone = 'ac' | 'gold' | 'green' | 'red' | 'amber' | 'blue'
const COLOR: Record<KpiTone, string> = { ac: 'var(--ac)', gold: 'var(--gold)', green: 'var(--green)', red: 'var(--red)', amber: 'var(--amber)', blue: 'var(--blue)' }

export function KpiStrip({ children }: { children: ReactNode }) { return <div className="kpis">{children}</div> }

export function Kpi({ label, value, sub, tone = 'ac' }: { label: string; value: string | number; sub?: string; tone?: KpiTone }) {
  return (
    <div className="kpi2">
      <div className="k-label"><i className="k-dot" style={{ background: COLOR[tone] }} />{label}</div>
      <div className="k-val">{typeof value === 'number' ? value.toLocaleString('tr-TR') : value}</div>
      {sub && <div className="k-sub">{sub}</div>}
    </div>
  )
}
