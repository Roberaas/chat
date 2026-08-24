'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { Menu, Search } from 'lucide-react'
import GlobalArama from '@/components/GlobalArama'
import VoiceAssistant from '@/components/VoiceAssistant'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-base)' }}>
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
          className="lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className={`fixed lg:sticky top-0 z-50 h-screen transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <Sidebar onClose={() => setOpen(false)} />
      </div>

      <GlobalArama />
      <VoiceAssistant />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', position: 'sticky', top: 0, zIndex: 30, background: 'rgba(245,243,239,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-dim)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setOpen(true)} className="lg:hidden"
              style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <Menu size={18} />
            </button>
            <div className="lg:hidden" style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, color: 'var(--text-primary)' }}>
              roberto<span style={{ color: 'var(--gold)' }}>.</span>
            </div>
          </div>

          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', background: 'var(--bg-card2)', border: '1px solid var(--border-dim)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}
            className="hidden sm:flex"
          >
            <Search size={13} />
            <span>Ara</span>
            <kbd style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--text-faint)' }}>Ctrl+K</kbd>
          </button>
        </div>

        <main style={{ flex: 1, overflowX: 'hidden' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
