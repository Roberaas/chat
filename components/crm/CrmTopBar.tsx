'use client'
import type { ReactNode } from 'react'
import ThemeToggle from '@/components/ThemeToggle'
import CrmBell from '@/components/crm/CrmBell'
import CrmSearch from '@/components/crm/CrmSearch'

export default function CrmTopBar({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="topbar">
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <span className="tb-title">{title}</span>
        {subtitle && <span className="tb-sub">{subtitle}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {action}
        <CrmSearch />
        <CrmBell />
        <ThemeToggle />
      </div>
    </div>
  )
}
