import Link from 'next/link'
import CrmTopBar from '@/components/crm/CrmTopBar'
import { requireCrm } from '@/lib/crm/auth'
import { WHERE, ROLES, FIELDS } from '@/lib/crm/guide'

// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

const th = { padding: '8px 14px', textAlign: 'left' as const, color: 'var(--tx3)', fontSize: 11.5 }
const td = { padding: '9px 14px', fontSize: 12.5, color: 'var(--tx2)', verticalAlign: 'top' as const }

const STEPS: [string, string, string][] = [
  ['1', 'Mağaza / bayi / toptancıları tanımlayın', '/crm/magazalar'],
  ['2', 'Kullanıcıları ekleyin (rol + bağlı mağaza)', '/crm/kullanicilar'],
  ['3', 'Mevcut müşteri ve ürünleri Excel ile yükleyin', '/crm/iceaktar'],
  ['4', 'E-ticaret / POS / ERP bağlantısını kurun', '/crm/entegrasyonlar'],
  ['5', 'Otomasyon kurallarını gözden geçirin', '/crm/otomasyonlar'],
  ['6', 'Segment ve kampanyaları oluşturun', '/crm/segmentler'],
]

export default async function RehberPage() {
  await requireCrm()
  return (
    <>
      <CrmTopBar title="Rehber" subtitle="Hangi bilgi nereye girer, kim ne görür" />
      <div style={{ padding: 22, maxWidth: 1000, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Kurulum sırası</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {STEPS.map(([n, t, h]) => (
              <Link key={n} href={h} style={{ display: 'flex', gap: 10, alignItems: 'center', textDecoration: 'none', color: 'var(--tx)', fontSize: 13 }}>
                <span className="badge badge-muted">{n}</span>{t}
              </Link>))}
          </div>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
          <div className="card-title" style={{ padding: '14px 16px 6px' }}>Hangi bilgi nereye girer</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Bilgi</th><th style={th}>Nerede</th><th style={th}>Nasıl</th></tr></thead>
            <tbody>{WHERE.map(w => <tr key={w.what} style={{ borderTop: '1px solid var(--bdr)' }}><td style={{ ...td, color: 'var(--tx)', fontWeight: 600 }}>{w.what}</td><td style={td}>{w.where}</td><td style={td}>{w.how}</td></tr>)}</tbody>
          </table>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
          <div className="card-title" style={{ padding: '14px 16px 6px' }}>Roller: kim neyi görür</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Rol</th><th style={th}>Gördüğü veri</th><th style={th}>Yapabildiği</th></tr></thead>
            <tbody>{ROLES.map(r => <tr key={r.role} style={{ borderTop: '1px solid var(--bdr)' }}><td style={{ ...td, color: 'var(--tx)', fontWeight: 600 }}>{r.role}</td><td style={td}>{r.sees}</td><td style={td}>{r.can}</td></tr>)}</tbody>
          </table>
          <div style={{ padding: '10px 16px 14px', fontSize: 12.5, color: 'var(--tx3)' }}>Bayi / toptancı eklemek için: Mağazalar'da tür "Bayi" veya "Toptancı" olan kayıt açın, Kullanıcılar'da o mağazaya bağlı "Bayi / Toptancı Yöneticisi" ekleyin. Bu kişi giriş yapınca yalnız kendi müşterilerini görür ve kendi ekibini kendisi ekler.</div>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
          <div className="card-title" style={{ padding: '14px 16px 6px' }}>Entegrasyonla gelen veri alanları</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Veri</th><th style={th}>Alan</th><th style={th}>Zorunlu</th><th style={th}>Açıklama</th></tr></thead>
            <tbody>{FIELDS.map(f => <tr key={f.entity + f.field} style={{ borderTop: '1px solid var(--bdr)' }}><td style={td}>{f.entity}</td><td style={{ ...td, fontFamily: 'JetBrains Mono, monospace', color: 'var(--tx)' }}>{f.field}</td><td style={td}>{f.req}</td><td style={td}>{f.desc}</td></tr>)}</tbody>
          </table>
          <div style={{ padding: '10px 16px 14px', fontSize: 12.5 }}><Link href="/crm/entegrasyonlar" style={{ color: 'var(--ac)' }}>Entegrasyonlar sayfasında hazır şablon, örnek veri ve kurulum adımları var →</Link></div>
        </div>
      </div>
    </>
  )
}
