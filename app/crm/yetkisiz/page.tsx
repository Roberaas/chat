import Link from 'next/link'
import { Lock } from 'lucide-react'

export default function Yetkisiz() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
      <div className="card" style={{ padding: 32, maxWidth: 380, textAlign: 'center' }}>
        <Lock size={28} style={{ color: 'var(--tx3)', margin: '0 auto 12px' }} />
        <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx)', marginBottom: 6 }}>Bu sayfaya erişim yetkiniz yok</h1>
        <p style={{ fontSize: 13, color: 'var(--tx3)', marginBottom: 18 }}>Gerekli yetki için yöneticinizle iletişime geçin.</p>
        <Link href="/crm" className="btn" style={{ justifyContent: 'center' }}>CRM Ana Sayfa</Link>
      </div>
    </div>
  )
}
