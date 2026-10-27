import Link from 'next/link'
import { Lock } from 'lucide-react'

export default async function ModulKapali({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
      <div className="card" style={{ padding: 32, maxWidth: 400, textAlign: 'center' }}>
        <Lock size={28} style={{ color: 'var(--tx3)', margin: '0 auto 12px' }} />
        <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx)', marginBottom: 6 }}>{m ? `"${m.slice(0, 60)}" modülü kapalı` : 'Bu modül kapalı'}</h1>
        <p style={{ fontSize: 13, color: 'var(--tx3)', marginBottom: 18 }}>Bu özellik şu an kullanıma açık değil. Açılması için yöneticinize başvurun (Ayarlar → Modüller).</p>
        <Link href="/crm/musteriler" className="btn" style={{ justifyContent: 'center' }}>Müşterilere dön</Link>
      </div>
    </div>
  )
}
