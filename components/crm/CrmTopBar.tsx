'use client'
import type { ReactNode } from 'react'
import ThemeToggle from '@/components/ThemeToggle'

export default function CrmTopBar({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="topbar">
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)', letterSpacing: '-.15px', flexShrink: 0 }}>{title}</span>
        {subtitle && <span style={{ fontSize: 12, color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {action}
        <ThemeToggle />
      </div>
    </div>
  )
}
