'use client'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ROLE_LABEL } from '@/lib/crm/types'

export type FeedItem = { id: number; created_at: string; actor_id: string | null; actor_name: string; actor_roles: string | null; action: string; table_name: string; record_id: string | null; store_name: string | null; changed: string[] | null; label?: string | null; detail?: Record<string, any> | null }

export const TABLE: Record<string, string> = {
  customers: 'müşteri', opportunities: 'fırsat', tasks: 'görev', appointments: 'randevu', orders: 'sipariş', service_requests: 'servis talebi',
  profiles: 'kullanıcı', stores: 'mağaza', user_roles: 'rol ataması', store_memberships: 'mağaza üyeliği', business_accounts: 'B2B firma',
  business_contacts: 'B2B kişi', business_opportunities: 'B2B fırsat', products: 'ürün', campaigns: 'kampanya', segments: 'segment',
  customer_interactions: 'etkileşim', customer_notes: 'not', customer_consents: 'iletişim izni', import_jobs: 'içe aktarma', integrations: 'entegrasyon',
  automation_rules: 'otomasyon kuralı', quotations: 'teklif', customers_export: 'müşteri listesi',
}
const VERB: Record<string, string> = { INSERT: 'ekledi', UPDATE: 'güncelledi', DELETE: 'sildi', EXPORT: 'dışa aktardı' }
const TONE: Record<string, string> = { INSERT: 'var(--green)', UPDATE: 'var(--amber)', DELETE: 'var(--red)', EXPORT: 'var(--blue)' }
const FIELD: Record<string, string> = {
  first_name: 'Ad', last_name: 'Soyad', name: 'Ad', title: 'Başlık', phone: 'Telefon', email: 'E-posta', status: 'Durum', stage: 'Aşama', amount: 'Tutar', total: 'Toplam',
  assigned_to: 'Atanan kişi', owner_id: 'Sahip', store_id: 'Mağaza', is_vip: 'VIP', is_active: 'Aktif', priority: 'Öncelik', due_at: 'Son tarih', city: 'Şehir',
  address: 'Adres', notes: 'Not', source: 'Kaynak', price: 'Fiyat', sku: 'Stok kodu', category: 'Kategori', birth_date: 'Doğum tarihi', segment: 'Segment', lost_reason: 'Kayıp nedeni',
}
const BOOL: Record<string, string> = { true: 'Evet', false: 'Hayır' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i
export const dt = (s: string | null) => s ? new Date(s).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
export const ago = (s: string | null) => {
  if (!s) return '—'
  const m = Math.floor((Date.now() - new Date(s).getTime()) / 60000)
  return m < 1 ? 'şimdi' : m < 60 ? `${m} dk önce` : m < 1440 ? `${Math.floor(m / 60)} sa önce` : `${Math.floor(m / 1440)} gün önce`
}
const show = (v: any) => v === null || v === undefined || v === '' ? '—' : typeof v === 'boolean' ? BOOL[String(v)] : typeof v === 'object' ? JSON.stringify(v) : UUID.test(String(v)) ? String(v).slice(0, 8) + '…' : String(v)
const initials = (n: string) => n.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase()
const roleText = (r: string | null) => (r || '').split(',').filter(Boolean).map(x => ROLE_LABEL[x] || x).join(', ')

export function FeedRow({ a, showStore = true }: { a: FeedItem; showStore?: boolean }) {
  const [open, setOpen] = useState(false)
  const d = a.detail && typeof a.detail === 'object' ? a.detail : null
  const entries = d ? Object.entries(d) : []
  const isDiff = a.action === 'UPDATE' && entries.length > 0 && entries.every(([, v]) => v && typeof v === 'object' && 'new' in (v as any))
  const hasDetail = entries.length > 0
  return (
    <div style={{ borderTop: '1px solid var(--bdr)' }}>
      <div onClick={() => hasDetail && setOpen(!open)} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 18px', cursor: hasDetail ? 'pointer' : 'default' }}>
        <div className="sb-av" style={{ width: 32, height: 32, fontSize: 13, marginTop: 1 }}>{initials(a.actor_name) || '?'}</div>
        <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--tx2)', lineHeight: 1.5 }}>
          <b style={{ color: 'var(--tx)', fontWeight: 600 }}>{a.actor_name}</b>{' '}
          <span style={{ color: TONE[a.action] || 'var(--tx2)', fontWeight: 500 }}>{TABLE[a.table_name] || a.table_name}{a.label ? ` "${a.label}"` : ''} {VERB[a.action] || a.action}</span>
          <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 1 }}>
            {[roleText(a.actor_roles), showStore ? a.store_name : null].filter(Boolean).join(' · ')}
            {a.changed && a.changed.length > 0 && <span> · Değişen: {a.changed.map(k => FIELD[k] || k).join(', ')}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--tx3)', whiteSpace: 'nowrap' }}>{ago(a.created_at)}<div style={{ fontSize: 11 }}>{dt(a.created_at)}</div></div>
        {hasDetail && <ChevronDown size={15} style={{ color: 'var(--tx3)', marginTop: 8, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />}
      </div>
      {open && hasDetail && (
        <div style={{ margin: '0 18px 14px 62px', border: '1px solid var(--bdr)', borderRadius: 9, overflow: 'hidden', fontSize: 12.5 }}>
          {entries.map(([k, v]) => (
            <div key={k} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 10, padding: '7px 12px', borderTop: '1px solid var(--bdr)' }}>
              <span style={{ color: 'var(--tx3)' }}>{FIELD[k] || k}</span>
              {isDiff
                ? <span><span style={{ color: 'var(--red)', textDecoration: 'line-through', opacity: .85 }}>{show((v as any).old)}</span> <span style={{ color: 'var(--tx3)' }}>→</span> <b style={{ color: 'var(--green)', fontWeight: 600 }}>{show((v as any).new)}</b></span>
                : <span style={{ color: 'var(--tx)' }}>{show(v)}</span>}
            </div>))}
        </div>)}
    </div>
  )
}
