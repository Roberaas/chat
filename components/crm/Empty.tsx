import type { ReactNode } from 'react'

export default function Empty({ Icon, title, desc, action }: { Icon?: any; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      {Icon && <div className="e-ic"><Icon size={20} strokeWidth={1.5} /></div>}
      <div className="e-t">{title}</div>
      {desc && <div className="e-d">{desc}</div>}
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  )
}
