'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import { Menu, Moon, Sun, Tv, Search } from 'lucide-react'
import GlobalArama from '@/components/GlobalArama'
import VoiceAssistant from '@/components/VoiceAssistant'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('roberto-dark')
    if (saved === 'true') {
      setDark(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  function toggleDark() {
    const next = !dark
    setDark(next)
    localStorage.setItem('roberto-dark', String(next))
    document.documentElement.classList.toggle('dark', next)
  }

  return (
    <div className={`min-h-screen flex ${dark ? 'bg-gray-950' : 'bg-cream-50'}`}>
      {/* Mobil overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-ink-900/50 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed lg:sticky top-0 z-50 h-screen transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <Sidebar onClose={() => setOpen(false)} dark={dark} />
      </div>

      <GlobalArama />
      <VoiceAssistant />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 sticky top-0 z-30 border-b ${dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-cream-200'}`}>
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="lg:hidden w-9 h-9 flex items-center justify-center text-ink-400 hover:text-ink-700">
              <Menu className="w-5 h-5" />
            </button>
            <div className={`font-display text-xl lg:hidden ${dark ? 'text-white' : 'text-ink-900'}`}>
              roberto<span className="text-moss-500">.</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-colors ${dark ? 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white' : 'bg-cream-50 border-cream-200 text-ink-400 hover:text-ink-700'}`}>
              <Search className="w-3.5 h-3.5" />
              <span>Ara</span>
              <kbd className="font-mono text-[10px] opacity-60">Ctrl+K</kbd>
            </button>
            <button onClick={toggleDark}
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${dark ? 'text-yellow-400 hover:bg-gray-800' : 'text-ink-400 hover:bg-cream-100'}`}
              title={dark ? 'Açık mod' : 'Koyu mod'}>
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <a href="/tv" target="_blank"
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${dark ? 'text-gray-400 hover:bg-gray-800' : 'text-ink-400 hover:bg-cream-100'}`}
              title="TV Modu">
              <Tv className="w-4 h-4" />
            </a>
          </div>
        </div>

        <main className={`flex-1 overflow-x-hidden transition-colors ${dark ? 'bg-gray-950 text-gray-100' : 'bg-cream-50 text-ink-900'}`}>
          {children}
        </main>
      </div>
    </div>
  )
}
