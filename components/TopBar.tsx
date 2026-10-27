'use client'
import { ReactNode } from 'react'
import NotificationBell from './NotificationBell'
import ThemeToggle from './ThemeToggle'

export default function TopBar({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: ReactNode
}) {
  return (
    <div className="topbar">
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)', letterSpacing: '-.15px', flexShrink: 0 }}>{title}</span>
        {subtitle && <span style={{ fontSize: 12, color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {action && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{action}</div>}
        <ThemeToggle />
        <NotificationBell />
      </div>
    </div>
  )
}
