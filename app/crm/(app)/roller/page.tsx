import { Check } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import { requireCrm } from '@/lib/crm/auth'
import { createCrmServerClient } from '@/lib/crm/supabase/server'
import { ROLE_LABEL } from '@/lib/crm/types'

const MODULE: Record<string, string> = { customers: 'Müşteri', opportunities: 'Fırsat', tasks: 'Görev', appointments: 'Randevu', orders: 'Sipariş', products: 'Ürün', service: 'Satış sonrası', campaigns: 'Kampanya', segments: 'Segment', consents: 'İzin', reports: 'Rapor', users: 'Kullanıcı', stores: 'Mağaza', settings: 'Ayar', audit: 'Denetim', b2b: 'B2B', data: 'Veri', integrations: 'Entegrasyon', dashboard: 'Dashboard', quotations: 'Teklif', activity: 'Aktivite', announcements: 'Duyuru' }

export default async function RollerPage() {
  await requireCrm('settings.manage')
  const db = createCrmServerClient()
  const [r, p, rp] = await Promise.all([
    db.from('roles').select('code, name, scope, sort_order').order('sort_order'),
    db.from('permissions').select('code, module, description').order('module').order('code'),
    db.from('role_permissions').select('role_code, permission_code'),
  ])
  const roles = r.data || [], perms = p.data || []
  const has = new Set((rp.data || []).map(x => `${x.role_code}|${x.permission_code}`))
  const mods = Array.from(new Set(perms.map(x => x.module)))
  return (
    <>
      <CrmTopBar title="Roller ve Yetkiler" subtitle={`${roles.length} rol · ${perms.length} yetki`} />
      <div style={{ padding: '24px 28px 40px', maxWidth: 1280, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--tx3)', maxWidth: 680 }}>Hangi rolün neyi yapabildiği. Süper Admin her şeyi yapar. Kapsam: "tümü" rolü her mağazayı, "mağaza" rolü yalnız bağlı olduğu mağaza ve bayiyi, "kendi" rolü yalnız kendisine atanan kayıtları görür. Veritabanı bu kuralları kendisi uygular.</div>
        <div className="card" style={{ overflow: 'auto', maxHeight: '74vh' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 13, minWidth: '100%' }}>
            <thead><tr>
              <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 3, background: 'var(--s1)', padding: '12px 18px', textAlign: 'left', minWidth: 260, borderBottom: '1px solid var(--bdr)' }}>Yetki</th>
              {roles.map(x => <th key={x.code} style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--s1)', padding: '12px 10px', fontWeight: 600, fontSize: 12, minWidth: 108, textAlign: 'center', borderBottom: '1px solid var(--bdr)' }}>{ROLE_LABEL[x.code] || x.name}<div style={{ fontWeight: 400, color: 'var(--tx3)', fontSize: 11 }}>{x.scope === 'all' ? 'tümü' : x.scope === 'stores' ? 'mağaza' : 'kendi'}</div></th>)}
            </tr></thead>
            <tbody>
              {mods.map(mod => [
                <tr key={`m-${mod}`}><td colSpan={roles.length + 1} style={{ padding: '10px 18px', background: 'var(--s2)', fontWeight: 600, fontSize: 12.5, color: 'var(--tx2)' }}>{MODULE[mod] || mod}</td></tr>,
                ...perms.filter(x => x.module === mod).map(x => (
                  <tr key={x.code}>
                    <td style={{ position: 'sticky', left: 0, background: 'var(--s1)', padding: '9px 18px', borderBottom: '1px solid var(--bdr)' }}><div style={{ color: 'var(--tx)' }}>{x.description}</div><code style={{ fontSize: 11 }}>{x.code}</code></td>
                    {roles.map(ro => <td key={ro.code} style={{ textAlign: 'center', borderBottom: '1px solid var(--bdr)' }}>{ro.code === 'super_admin' || has.has(`${ro.code}|${x.code}`) ? <Check size={15} style={{ color: 'var(--green)' }} strokeWidth={2.6} /> : <span style={{ color: 'var(--s5)' }}>–</span>}</td>)}
                  </tr>)),
              ])}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
