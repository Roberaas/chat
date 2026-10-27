'use client'
import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    let saved: 'dark' | 'light' = 'light'
    try { saved = (localStorage.getItem('roberto-theme') as 'dark' | 'light') || 'light' } catch {}
    setTheme(saved)
    document.documentElement.setAttribute('data-theme', saved)
    setMounted(true)
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('roberto-theme', next) } catch {}
  }

  if (!mounted) return <div style={{ width: 34, height: 34 }} />

  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
      style={{
        width: 34, height: 34, borderRadius: 9, background: 'var(--s2)',
        border: '1px solid var(--bdr)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', cursor: 'pointer', transition: 'all .15s', flexShrink: 0,
      }}
    >
      {theme === 'dark'
        ? <Sun size={15} style={{ color: 'var(--amber)' }} strokeWidth={2} />
        : <Moon size={15} style={{ color: 'var(--ac)' }} strokeWidth={2} />}
    </button>
  )
}
