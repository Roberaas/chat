'use client'
import { useState } from 'react'
import { Info, X, ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  title: string
  items: string[]
  color?: string
  defaultOpen?: boolean
  storageKey?: string  // localStorage'a kaydet - bir kez kapattıktan sonra açılmaz
}

export default function InfoBox({ title, items, color = 'var(--blue)', defaultOpen = true, storageKey }: Props) {
  const [open, setOpen] = useState(() => {
    if (storageKey && typeof window !== 'undefined') {
      return localStorage.getItem(`info_${storageKey}`) !== 'closed'
    }
    return defaultOpen
  })

  function close() {
    if (storageKey) localStorage.setItem(`info_${storageKey}`, 'closed')
    setOpen(false)
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--tx3)', background: 'var(--s2)', border: '1px solid var(--bdr)', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', marginBottom: 12 }}>
      <Info size={12} style={{ color }} strokeWidth={2} />
      {title} — nasıl kullanılır?
      <ChevronDown size={11} />
    </button>
  )

  return (
    <div style={{ background: `${color}08`, border: `1px solid ${color}25`, borderRadius: 10, padding: '12px 14px', marginBottom: 14, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Info size={13} style={{ color, flexShrink: 0 }} strokeWidth={2} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color }}>{title}</span>
        <button onClick={close} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 6px', borderRadius: 5 }}>
          <X size={11} strokeWidth={2} />Kapat
        </button>
      </div>
      <ul style={{ paddingLeft: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 5 }} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
