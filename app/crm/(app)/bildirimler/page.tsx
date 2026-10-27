'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Megaphone } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import { useCrm } from '@/components/crm/CrmProvider'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'
import { ROLE_LABEL } from '@/lib/crm/types'

type N = { id: string; type: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }
type A = { id: string; title: string; body: string; severity: string; audience_roles: string[] | null; sent_count: number; created_at: string }
const TYPE: Record<string, string> = { announcement: 'Duyuru', import: 'İçe aktarma', opportunity_won: 'Fırsat', service_high: 'Servis', integration_error: 'Entegrasyon', digest: 'Özet', task: 'Görev', appointment: 'Randevu' }
const SEV: Record<string, string> = { info: 'badge-muted', warning: 'badge-amber', critical: 'badge-red' }
const PAGE = 30

export default function BildirimlerPage() {
  const crm = useCrm()
  const supabase = createCrmBrowserClient()
  const [items, setItems] = useState<N[]>([])
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [type, setType] = useState('')
  const [more, setMore] = useState(false)
  const [anns, setAnns] = useState<A[]>([])
  const [roles, setRoles] = useState<{ code: string; name: string }[]>([])
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [f, setF] = useState({ title: '', body: '', severity: 'info', roles: [] as string[], stores: [] as string[] })
  const [msg, setMsg] = useState('')
  const canAnn = crm.can('announcements.manage')

  const load = useCallback(async (append = false) => {
    let q = supabase.from('notifications').select('id, type, title, body, link, read_at, created_at').order('created_at', { ascending: false }).range(append ? items.length : 0, (append ? items.length : 0) + PAGE - 1)
    if (onlyUnread) q = q.is('read_at', null)
    if (type) q = q.eq('type', type)
    const { data } = await q
    const rows = (data || []) as N[]
    setItems(append ? [...items, ...rows] : rows); setMore(rows.length === PAGE)
  }, [onlyUnread, type, items])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(false) }, [onlyUnread, type])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!canAnn) return
    supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(10).then(({ data }) => setAnns((data || []) as A[]))
    supabase.from('roles').select('code, name').order('sort_order').then(({ data }) => setRoles((data || []) as any))
    supabase.from('stores').select('id, name').order('name').then(({ data }) => setStores((data || []) as any))
  }, [canAnn])  // eslint-disable-line react-hooks/exhaustive-deps

  async function markAll() { await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null); load(false) }
  async function markOne(id: string) { await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id); setItems(it => it.map(x => x.id === id ? { ...x, read_at: new Date().toISOString() } : x)) }
  async function send() {
    if (!f.title.trim() || !f.body.trim()) { setMsg('Başlık ve mesaj zorunlu'); return }
    const { data, error } = await supabase.rpc('send_announcement', { p_title: f.title, p_body: f.body, p_severity: f.severity, p_roles: f.roles, p_stores: f.stores })
    if (error) { setMsg(error.message); return }
    setMsg(`${data} kullanıcıya gönderildi`); setF({ title: '', body: '', severity: 'info', roles: [], stores: [] })
    const { data: a } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(10); setAnns((a || []) as A[]); load(false)
  }
  const toggle = (arr: string[], v: string) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]
  const unread = items.filter(i => !i.read_at).length

  return (
    <>
      <CrmTopBar title="Bildirimler" subtitle={unread ? `${unread} okunmamış` : undefined} />
      <div style={{ padding: 22, maxWidth: 900, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {canAnn && (
          <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="card-title"><Megaphone size={14} style={{ verticalAlign: -2 }} /> Duyuru gönder</div>
            <input className="inp" placeholder="Başlık" maxLength={160} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
            <textarea className="inp" rows={3} placeholder="Mesaj" maxLength={2000} value={f.body} onChange={e => setF({ ...f, body: e.target.value })} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5, color: 'var(--tx2)' }}>
              <select className="inp" style={{ width: 130 }} value={f.severity} onChange={e => setF({ ...f, severity: e.target.value })}><option value="info">Bilgi</option><option value="warning">Uyarı</option><option value="critical">Kritik</option></select>
              <span>Alıcı roller (boş = herkes):</span>
              {roles.map(r => <label key={r.code} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={f.roles.includes(r.code)} onChange={() => setF({ ...f, roles: toggle(f.roles, r.code) })} />{ROLE_LABEL[r.code] || r.name}</label>)}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5, color: 'var(--tx2)' }}>
              <span>Mağaza / bayi (boş = hepsi):</span>
              {stores.map(s => <label key={s.id} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={f.stores.includes(s.id)} onChange={() => setF({ ...f, stores: toggle(f.stores, s.id) })} />{s.name}</label>)}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><button className="btn" onClick={send}>Gönder</button>{msg && <span style={{ fontSize: 12.5, color: 'var(--tx2)' }}>{msg}</span>}</div>
            {anns.length > 0 && <div style={{ borderTop: '1px solid var(--bdr)', paddingTop: 8 }}>
              <div style={{ fontSize: 11.5, color: 'var(--tx3)', marginBottom: 4 }}>Son duyurular</div>
              {anns.map(a => <div key={a.id} style={{ fontSize: 12.5, color: 'var(--tx2)', padding: '3px 0' }}><span className={`badge ${SEV[a.severity]}`}>{a.sent_count} kişi</span> <b style={{ color: 'var(--tx)' }}>{a.title}</b> · {new Date(a.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</div>)}
            </div>}
          </div>)}

        <div className="card" style={{ padding: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={!onlyUnread ? 'btn' : 'btn-ghost'} onClick={() => setOnlyUnread(false)}>Tümü</button>
          <button className={onlyUnread ? 'btn' : 'btn-ghost'} onClick={() => setOnlyUnread(true)}>Okunmamış</button>
          <select className="inp" style={{ width: 160 }} value={type} onChange={e => setType(e.target.value)}><option value="">Tüm türler</option>{Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <div style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={markAll}>Tümünü okundu yap</button>
        </div>
        <div className="card">
          {items.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Bildirim yok</div> : items.map(n => {
            const body = (<div style={{ padding: '11px 16px', background: n.read_at ? 'transparent' : 'var(--ac2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span className="badge badge-muted">{TYPE[n.type] || n.type}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: 'var(--tx)', fontWeight: n.read_at ? 400 : 600 }}>{n.title}</div>
                {n.body && <div style={{ fontSize: 12.5, color: 'var(--tx2)' }}>{n.body}</div>}
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--tx3)', whiteSpace: 'nowrap' }}>{new Date(n.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>)
            return <div key={n.id} style={{ borderTop: '1px solid var(--bdr)' }}>
              {n.link && n.link !== '/crm/bildirimler' ? <Link href={n.link} onClick={() => markOne(n.id)} style={{ textDecoration: 'none', display: 'block' }}>{body}</Link> : <div onClick={() => markOne(n.id)} style={{ cursor: 'pointer' }}>{body}</div>}
            </div>
          })}
          {more && <div style={{ padding: 12, textAlign: 'center' }}><button className="btn-ghost" onClick={() => load(true)}>Daha fazla</button></div>}
        </div>
      </div>
    </>
  )
}
