'use client'
import { useCallback, useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'
import { ROLE_LABEL } from '@/lib/crm/types'

type U = { id: string; name: string; email: string; active: boolean; roles: string; stores: string; last_sign_in_at: string | null; last_seen_at: string | null; logins: number; actions: number; creates: number; updates: number; deletes: number; exports: number }
type F = { id: number; created_at: string; actor_id: string | null; actor_name: string; actor_roles: string | null; action: string; table_name: string; record_id: string | null; store_name: string | null; changed: string[] | null }
type L = { id: number; created_at: string; user_id: string; user_name: string }
const TABLE: Record<string, string> = {
  customers: 'müşteri', opportunities: 'fırsat', tasks: 'görev', appointments: 'randevu', orders: 'sipariş', service_requests: 'servis talebi',
  profiles: 'kullanıcı', stores: 'mağaza', user_roles: 'rol ataması', store_memberships: 'mağaza üyeliği', business_accounts: 'B2B firma',
  business_contacts: 'B2B kişi', business_opportunities: 'B2B fırsat', products: 'ürün', campaigns: 'kampanya', segments: 'segment',
  customer_interactions: 'etkileşim', customer_notes: 'not', customer_consents: 'iletişim izni', import_jobs: 'içe aktarma', integrations: 'entegrasyon',
  automation_rules: 'otomasyon kuralı', quotations: 'teklif', customers_export: 'müşteri listesi',
}
const ACT: Record<string, string> = { INSERT: 'oluşturdu', UPDATE: 'güncelledi', DELETE: 'sildi', EXPORT: 'dışa aktardı' }
const ACT_COLOR: Record<string, string> = { INSERT: 'badge-green', UPDATE: 'badge-amber', DELETE: 'badge-red', EXPORT: 'badge-muted' }
const dt = (s: string | null) => s ? new Date(s).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
const ago = (s: string | null) => {
  if (!s) return '—'
  const m = Math.floor((Date.now() - new Date(s).getTime()) / 60000)
  return m < 1 ? 'şimdi' : m < 60 ? `${m} dk önce` : m < 1440 ? `${Math.floor(m / 60)} sa önce` : `${Math.floor(m / 1440)} gün önce`
}
const iso = (d: Date) => d.toISOString().slice(0, 10)
const th = { padding: '8px 14px', whiteSpace: 'nowrap' as const }
const td = { padding: '9px 14px', whiteSpace: 'nowrap' as const }

export default function AktivitePage() {
  const supabase = createCrmBrowserClient()
  const [tab, setTab] = useState<'users' | 'feed' | 'logins'>('users')
  const [days, setDays] = useState('7')
  const [users, setUsers] = useState<U[]>([])
  const [feed, setFeed] = useState<F[]>([])
  const [logins, setLogins] = useState<L[]>([])
  const [actor, setActor] = useState(''); const [table, setTable] = useState(''); const [store, setStore] = useState('')
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [more, setMore] = useState(true)
  const [err, setErr] = useState('')

  const range = useCallback(() => ({ p_from: new Date(Date.now() - parseInt(days) * 864e5).toISOString(), p_to: new Date().toISOString() }), [days])

  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase.rpc('activity_users', range())
    if (error) { setErr(error.message); return }
    setErr(''); setUsers((data || []) as U[])
  }, [range])  // eslint-disable-line react-hooks/exhaustive-deps
  const loadFeed = useCallback(async (append = false) => {
    const before = append && feed.length ? feed[feed.length - 1].id : null
    const { data, error } = await supabase.rpc('activity_feed', { p_limit: 100, p_before: before, p_actor: actor || null, p_table: table || null, p_store: store || null, ...range() })
    if (error) { setErr(error.message); return }
    setErr(''); const rows = (data || []) as F[]
    setFeed(append ? [...feed, ...rows] : rows); setMore(rows.length === 100)
  }, [actor, table, store, range, feed])  // eslint-disable-line react-hooks/exhaustive-deps
  const loadLogins = useCallback(async () => {
    const { data, error } = await supabase.rpc('activity_logins', { p_limit: 200 })
    if (error) { setErr(error.message); return }
    setLogins((data || []) as L[])
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { supabase.from('stores').select('id, name').order('name').then(({ data }) => setStores((data || []) as any)) }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadUsers() }, [loadUsers])
  useEffect(() => { if (tab === 'feed') loadFeed(false) }, [tab, actor, table, store, days])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'logins') loadLogins() }, [tab, loadLogins])

  const online = (u: U) => u.last_seen_at && Date.now() - new Date(u.last_seen_at).getTime() < 5 * 60000
  const onlineCount = users.filter(online).length
  const roleText = (r: string) => r.split(',').filter(Boolean).map(x => ROLE_LABEL[x] || x).join(', ') || '—'

  return (
    <>
      <CrmTopBar title="Aktivite İzleme" subtitle={`${onlineCount} kişi çevrimiçi`} action={<a className="btn-ghost" style={{ textDecoration: 'none' }} href={`/api/crm/export/activity?from=${iso(new Date(Date.now() - parseInt(days) * 864e5))}&to=${iso(new Date())}${store ? `&store=${store}` : ''}`}><Download size={14} /> Excel</a>} />
      <div style={{ padding: 22, maxWidth: 1250, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card" style={{ padding: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {([['users', 'Kullanıcılar'], ['feed', 'Aktivite akışı'], ['logins', 'Girişler']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'btn' : 'btn-ghost'} onClick={() => setTab(k)}>{l}</button>)}
          <div style={{ flex: 1 }} />
          {tab !== 'logins' && <select className="inp" style={{ width: 140 }} value={days} onChange={e => setDays(e.target.value)}><option value="1">Son 24 saat</option><option value="7">Son 7 gün</option><option value="30">Son 30 gün</option><option value="90">Son 90 gün</option></select>}
        </div>
        {err && <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>}

        {tab === 'users' && (
          <div className="card" style={{ overflowX: 'auto' }}>
            {users.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Kullanıcı yok</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--tx3)', fontSize: 11.5 }}>{['Kullanıcı', 'Rol', 'Mağaza / Bayi', 'Son görülme', 'Son giriş', 'Giriş', 'İşlem', 'Ekleme', 'Güncelleme', 'Silme', 'Dışa aktarma'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>{users.map(u => (
                  <tr key={u.id} style={{ borderTop: '1px solid var(--bdr)', cursor: 'pointer', opacity: u.active ? 1 : 0.55 }} onClick={() => { setActor(u.id); setTab('feed') }}>
                    <td style={{ ...td, color: 'var(--tx)', fontWeight: 600 }}><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, marginRight: 8, background: online(u) ? 'var(--green)' : 'var(--s3, #666)' }} />{u.name}{!u.active && <span className="badge badge-muted" style={{ marginLeft: 6 }}>Pasif</span>}<div style={{ fontSize: 11, color: 'var(--tx3)', fontWeight: 400 }}>{u.email}</div></td>
                    <td style={td}>{roleText(u.roles)}</td>
                    <td style={{ ...td, maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.stores || '—'}</td>
                    <td style={td}>{ago(u.last_seen_at)}</td><td style={td}>{dt(u.last_sign_in_at)}</td>
                    <td style={td}>{u.logins}</td><td style={td}><b>{u.actions}</b></td><td style={td}>{u.creates}</td><td style={td}>{u.updates}</td>
                    <td style={{ ...td, color: u.deletes ? 'var(--red)' : undefined }}>{u.deletes}</td><td style={td}>{u.exports}</td></tr>))}</tbody>
              </table>)}
          </div>)}

        {tab === 'feed' && (<>
          <div className="card" style={{ padding: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select className="inp" style={{ width: 200 }} value={actor} onChange={e => setActor(e.target.value)}><option value="">Tüm kullanıcılar</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            <select className="inp" style={{ width: 180 }} value={table} onChange={e => setTable(e.target.value)}><option value="">Tüm kayıt türleri</option>{Object.entries(TABLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select className="inp" style={{ width: 180 }} value={store} onChange={e => setStore(e.target.value)}><option value="">Tüm mağaza / bayiler</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            {(actor || table || store) && <button className="btn-ghost" onClick={() => { setActor(''); setTable(''); setStore('') }}>Temizle</button>}
          </div>
          <div className="card">
            {feed.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Bu filtrede işlem yok</div> : feed.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 16px', borderTop: '1px solid var(--bdr)', fontSize: 13 }}>
                <span className={`badge ${ACT_COLOR[a.action] || 'badge-muted'}`} style={{ minWidth: 76, justifyContent: 'center' }}>{ACT[a.action] || a.action}</span>
                <div style={{ flex: 1, minWidth: 0, color: 'var(--tx2)' }}>
                  <b style={{ color: 'var(--tx)' }}>{a.actor_name}</b> <span style={{ color: 'var(--tx3)' }}>({roleText(a.actor_roles || '')})</span> · {TABLE[a.table_name] || a.table_name}
                  {a.store_name && <> · <span style={{ color: 'var(--tx3)' }}>{a.store_name}</span></>}
                  {a.changed && a.changed.length > 0 && <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>Değişen: {a.changed.join(', ')}</div>}
                </div>
                <span style={{ color: 'var(--tx3)', fontSize: 12, whiteSpace: 'nowrap' }}>{dt(a.created_at)}</span>
              </div>))}
            {more && feed.length > 0 && <div style={{ padding: 12, textAlign: 'center' }}><button className="btn-ghost" onClick={() => loadFeed(true)}>Daha fazla</button></div>}
          </div>
        </>)}

        {tab === 'logins' && (
          <div className="card">
            {logins.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Henüz giriş kaydı yok</div> : logins.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 16px', borderTop: '1px solid var(--bdr)', fontSize: 13, color: 'var(--tx2)' }}>
                <b style={{ color: 'var(--tx)' }}>{l.user_name}</b><span>{dt(l.created_at)}</span></div>))}
          </div>)}
      </div>
    </>
  )
}
