import Link from 'next/link'
import CrmTopBar from '@/components/crm/CrmTopBar'
import { requireCrm } from '@/lib/crm/auth'
import { API_REQS } from '@/lib/crm/guide'

// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

const th = { padding: '8px 14px', textAlign: 'left' as const, color: 'var(--tx3)', fontSize: 11.5 }
const td = { padding: '9px 14px', fontSize: 12.5, color: 'var(--tx2)', verticalAlign: 'top' as const }

export default async function AyarlarPage() {
  await requireCrm('integrations.manage')
  return (
    <>
      <CrmTopBar title="Ayarlar" subtitle="Entegrasyon için gerekli API bilgileri" />
      <div style={{ padding: 22, maxWidth: 1000, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ padding: 16, fontSize: 13, color: 'var(--tx2)', lineHeight: 1.7 }}>
          Bu liste, Pusula (ERP) ve Crealive (e-ticaret) sağlayıcılarından <b style={{ color: 'var(--tx)' }}>istenmesi gereken</b> API ve veri bilgilerini gösterir.
          Bilgiler gelince <Link href="/crm/entegrasyonlar" style={{ color: 'var(--ac)' }}>Entegrasyonlar</Link> sayfasındaki ilgili kartın "Kurulum" bölümünden bağlanır. Sağlayıcı webhook gönderemiyorsa n8n köprüsü kullanılır.
          Gizli anahtarlar veritabanına değil, Vercel ortam değişkenlerine yazılır.
        </div>
        {API_REQS.map(sys => (
          <div key={sys.system} className="card" style={{ overflowX: 'auto' }}>
            <div className="card-title" style={{ padding: '14px 16px 2px' }}>{sys.system}</div>
            <div style={{ padding: '0 16px 8px', fontSize: 12.5, color: 'var(--tx3)' }}>{sys.role}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Başlık</th><th style={th}>İstenecek API / bilgi</th><th style={th}>Ne için</th><th style={th}>Gereken alanlar</th></tr></thead>
              <tbody>{sys.asks.map(a => <tr key={a.group + a.item} style={{ borderTop: '1px solid var(--bdr)' }}><td style={{ ...td, color: 'var(--tx)', fontWeight: 600 }}>{a.group}</td><td style={td}>{a.item}</td><td style={td}>{a.why}</td><td style={td}>{a.fields}</td></tr>)}</tbody>
            </table>
          </div>))}
      </div>
    </>
  )
}
