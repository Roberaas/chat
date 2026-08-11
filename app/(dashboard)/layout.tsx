'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { Menu, Search } from 'lucide-react'
import GlobalArama from '@/components/GlobalArama'
import VoiceAssistant from '@/components/VoiceAssistant'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#0A0908' }}>
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          className="lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:sticky top-0 z-50 h-screen transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <Sidebar onClose={() => setOpen(false)} />
      </div>

      <GlobalArama />
      <VoiceAssistant />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', position: 'sticky', top: 0, zIndex: 30, background: 'rgba(10,9,8,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setOpen(true)}
              className="lg:hidden"
              style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B6760' }}
            >
              <Menu size={18} />
            </button>
            <div className="lg:hidden" style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, color: '#F5F0E8' }}>
              roberto<span style={{ color: '#C9A84C' }}>.</span>
            </div>
          </div>

          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', background: '#111009', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 8, fontSize: 12, color: '#6B6760', cursor: 'pointer', transition: 'border-color 0.2s' }}
            className="hidden sm:flex"
          >
            <Search size={13} />
            <span>Ara</span>
            <kbd style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#3A3730' }}>Ctrl+K</kbd>
          </button>
        </div>

        <main style={{ flex: 1, overflowX: 'hidden' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
