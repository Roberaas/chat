'use client'
import { useState } from 'react'

export type Series = { name: string; color: string; values: number[]; fmt?: (n: number) => string }

/** Hafif SVG çizgi grafiği (ek kütüphane yok). x etiketleri labels, hover ile değer. */
export function LineChart({ labels, series, height = 190 }: { labels: string[]; series: Series[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 640, H = height, L = 8, R = 8, T = 10, B = 22
  const n = labels.length
  if (n === 0) return <div style={{ padding: 30, textAlign: 'center', color: 'var(--tx3)', fontSize: 12.5 }}>Veri yok</div>
  const max = Math.max(1, ...series.flatMap(s => s.values))
  const x = (i: number) => L + (n === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1))
  const y = (v: number) => T + (1 - v / max) * (H - T - B)
  const fmt = (s: Series, v: number) => (s.fmt ? s.fmt(v) : v.toLocaleString('tr-TR'))
  const tick = Math.max(1, Math.ceil(n / 6))
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 14, padding: '0 4px 6px', fontSize: 11.5, color: 'var(--tx2)', flexWrap: 'wrap' }}>
        {series.map(s => <span key={s.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 9, height: 9, borderRadius: 3, background: s.color, display: 'inline-block' }} />{s.name}</span>)}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} onMouseLeave={() => setHover(null)}
        onMouseMove={e => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setHover(Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1))))) }}>
        {[0, 0.5, 1].map(f => <line key={f} x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke="var(--bdr)" strokeWidth={1} />)}
        {series.map(s => <polyline key={s.name} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />)}
        {labels.map((l, i) => i % tick === 0 ? <text key={i} x={x(i)} y={H - 6} fontSize={10} textAnchor="middle" fill="var(--tx3)">{l}</text> : null)}
        {hover !== null && <>
          <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--tx3)" strokeDasharray="3 3" />
          {series.map(s => <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r={3.5} fill={s.color} />)}
        </>}
      </svg>
      {hover !== null && (
        <div className="card" style={{ position: 'absolute', top: 24, left: `${Math.min(70, Math.max(0, (x(hover) / W) * 100 - 10))}%`, padding: '6px 10px', fontSize: 11.5, pointerEvents: 'none', zIndex: 5 }}>
          <div style={{ color: 'var(--tx3)', marginBottom: 2 }}>{labels[hover]}</div>
          {series.map(s => <div key={s.name} style={{ color: 'var(--tx)' }}><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: s.color, marginRight: 5 }} />{s.name}: <b>{fmt(s, s.values[hover])}</b></div>)}
        </div>)}
    </div>
  )
}

/** Yatay çubuk listesi */
export function HBars({ rows, color = 'var(--ac)', fmt }: { rows: { label: string; value: number; sub?: string }[]; color?: string; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map(r => r.value))
  if (!rows.length) return <div style={{ padding: 22, textAlign: 'center', color: 'var(--tx3)', fontSize: 12.5 }}>Veri yok</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '4px 16px 14px' }}>
      {rows.map(r => (
        <div key={r.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--tx2)', marginBottom: 3 }}>
            <span>{r.label}{r.sub && <span style={{ color: 'var(--tx3)' }}> · {r.sub}</span>}</span><b style={{ color: 'var(--tx)' }}>{fmt ? fmt(r.value) : r.value.toLocaleString('tr-TR')}</b>
          </div>
          <div style={{ height: 7, borderRadius: 4, background: 'var(--s2)' }}><div style={{ width: `${(r.value / max) * 100}%`, height: '100%', borderRadius: 4, background: color }} /></div>
        </div>))}
    </div>
  )
}
