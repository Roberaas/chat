'use client'
import { useEffect } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  open, title, message,
  confirmText = 'Evet, Sil',
  cancelText = 'İptal',
  danger = true,
  onConfirm, onCancel
}: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  if (!open) return null

  return (
    <div
      className="overlay"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
      style={{ zIndex: 10000 }}
    >
      <div style={{
        background: 'var(--s1)',
        border: '1px solid var(--bdr2)',
        borderRadius: 14,
        padding: '24px',
        width: '100%',
        maxWidth: 360,
        animation: 'popIn .2s cubic-bezier(.22,1,.36,1) both',
        boxShadow: '0 20px 60px rgba(0,0,0,.6)',
      }}>
        {/* İkon */}
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: danger ? 'var(--red2)' : 'var(--amber2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
        }}>
          {danger
            ? <Trash2 size={22} style={{ color: 'var(--red)' }} strokeWidth={2} />
            : <AlertTriangle size={22} style={{ color: 'var(--amber)' }} strokeWidth={2} />
          }
        </div>

        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx)', marginBottom: 8, letterSpacing: '-.2px' }}>
          {title}
        </p>
        <p style={{ fontSize: 13.5, color: 'var(--tx2)', lineHeight: 1.6, marginBottom: 22 }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            className="btn-ghost"
            style={{ flex: 1, justifyContent: 'center', padding: '10px' }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 6, padding: '10px',
              background: danger ? 'var(--red)' : 'var(--amber)',
              color: '#fff', border: 'none', borderRadius: 9,
              fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
              transition: 'opacity .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {danger ? <Trash2 size={14} strokeWidth={2.5} /> : <AlertTriangle size={14} strokeWidth={2.5} />}
            {confirmText}
          </button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--tx3)', textAlign: 'center', marginTop: 12 }}>
          Enter = onayla · Esc = iptal
        </p>
      </div>
    </div>
  )
}
