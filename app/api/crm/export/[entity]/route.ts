import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/crm/auth'
import { createCrmServerClient } from '@/lib/crm/supabase/server'
import { isUuid } from '@/lib/crm/validate'
import { buildXlsx, csvCell, dateFmt, dateTimeFmt, toDate, type SheetDef } from '@/lib/crm/xlsx'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const MAX_ROWS = 50000
const PAGE = 1000

type Col = { header: string; key: string; width?: number; kind?: 'date' | 'datetime' | 'num' | 'bool' }
type Def = { perms: string[]; table: string; select: string; order: string; dateCol?: string; storeCol?: string; cols: Col[]; map: (r: any) => Record<string, unknown>; label: string }

const SRC: Record<string, string> = { walk_in: 'Mağaza', whatsapp: 'WhatsApp', ecommerce: 'E-ticaret', referral: 'Tavsiye', event: 'Etkinlik', social: 'Sosyal', phone: 'Telefon', other: 'Diğer' }
const ORD: Record<string, string> = { pending: 'Beklemede', paid: 'Ödendi', shipped: 'Kargoda', delivered: 'Teslim', cancelled: 'İptal', returned: 'İade' }
const TASK: Record<string, string> = { pending: 'Bekliyor', in_progress: 'Devam', done: 'Tamam', cancelled: 'İptal' }
const PRIO: Record<string, string> = { low: 'Düşük', normal: 'Normal', high: 'Yüksek' }
const TYPE: Record<string, string> = { dealer: 'Bayi', corporate: 'Kurumsal', wholesale: 'Toptan' }
const full = (c: any) => c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : ''

const DEFS: Record<string, Def> = {
  customers: {
    label: 'musteriler', perms: ['customers.export'], table: 'customers', order: 'customer_no', dateCol: 'registered_at', storeCol: 'store_id',
    select: 'customer_no, first_name, last_name, phone, email, city, source, is_vip, total_spent, order_count, last_purchase_at, registered_at, stores(name)',
    cols: [{ header: 'No', key: 'no', width: 9 }, { header: 'Ad', key: 'first', width: 16 }, { header: 'Soyad', key: 'last', width: 16 }, { header: 'Telefon', key: 'phone', width: 16 }, { header: 'E-posta', key: 'email', width: 26 }, { header: 'Şehir', key: 'city', width: 14 }, { header: 'Kaynak', key: 'source', width: 12 }, { header: 'VIP', key: 'vip', width: 6 }, { header: 'Toplam harcama', key: 'spent', width: 16, kind: 'num' }, { header: 'Sipariş', key: 'orders', width: 8, kind: 'num' }, { header: 'Son alışveriş', key: 'last_p', width: 13, kind: 'date' }, { header: 'Kayıt', key: 'reg', width: 13, kind: 'date' }, { header: 'Mağaza / Bayi', key: 'store', width: 20 }],
    map: r => ({ no: r.customer_no, first: r.first_name, last: r.last_name, phone: r.phone, email: r.email, city: r.city, source: SRC[r.source] || r.source, vip: r.is_vip ? 'Evet' : 'Hayır', spent: Number(r.total_spent), orders: r.order_count, last_p: toDate(r.last_purchase_at), reg: toDate(r.registered_at), store: r.stores?.name }),
  },
  orders: {
    label: 'siparisler', perms: ['reports.export'], table: 'orders', order: 'ordered_at', dateCol: 'ordered_at', storeCol: 'store_id',
    select: 'order_no, status, total, currency, ordered_at, source_system, stores(name), customers(first_name, last_name, phone)',
    cols: [{ header: 'Sipariş no', key: 'no', width: 16 }, { header: 'Müşteri', key: 'cust', width: 24 }, { header: 'Telefon', key: 'phone', width: 16 }, { header: 'Durum', key: 'st', width: 12 }, { header: 'Tutar', key: 'total', width: 14, kind: 'num' }, { header: 'Para birimi', key: 'cur', width: 10 }, { header: 'Tarih', key: 'dt', width: 17, kind: 'datetime' }, { header: 'Kaynak sistem', key: 'src', width: 14 }, { header: 'Mağaza / Bayi', key: 'store', width: 20 }],
    map: r => ({ no: r.order_no, cust: full(r.customers), phone: r.customers?.phone, st: ORD[r.status] || r.status, total: Number(r.total), cur: r.currency, dt: toDate(r.ordered_at), src: r.source_system, store: r.stores?.name }),
  },
  opportunities: {
    label: 'firsatlar', perms: ['reports.export'], table: 'opportunities', order: 'opp_no', dateCol: 'created_at', storeCol: 'store_id',
    select: 'opp_no, title, stage, amount, currency, expected_close_date, closed_at, lost_reason, created_at, stores(name), customers(first_name, last_name)',
    cols: [{ header: 'No', key: 'no', width: 8 }, { header: 'Başlık', key: 'title', width: 30 }, { header: 'Müşteri', key: 'cust', width: 22 }, { header: 'Aşama', key: 'stage', width: 14 }, { header: 'Tutar', key: 'amount', width: 14, kind: 'num' }, { header: 'Para birimi', key: 'cur', width: 10 }, { header: 'Beklenen kapanış', key: 'exp', width: 15, kind: 'date' }, { header: 'Kapanış', key: 'closed', width: 13, kind: 'date' }, { header: 'Kayıp nedeni', key: 'lost', width: 22 }, { header: 'Oluşturma', key: 'created', width: 13, kind: 'date' }, { header: 'Mağaza / Bayi', key: 'store', width: 20 }],
    map: r => ({ no: r.opp_no, title: r.title, cust: full(r.customers), stage: r.stage, amount: Number(r.amount), cur: r.currency, exp: toDate(r.expected_close_date), closed: toDate(r.closed_at), lost: r.lost_reason, created: toDate(r.created_at), store: r.stores?.name }),
  },
  tasks: {
    label: 'gorevler', perms: ['reports.export'], table: 'tasks', order: 'created_at', dateCol: 'created_at', storeCol: 'store_id',
    select: 'title, status, priority, due_at, completed_at, created_at, stores(name), customers(first_name, last_name)',
    cols: [{ header: 'Görev', key: 'title', width: 34 }, { header: 'Müşteri', key: 'cust', width: 22 }, { header: 'Durum', key: 'st', width: 12 }, { header: 'Öncelik', key: 'pr', width: 10 }, { header: 'Son tarih', key: 'due', width: 17, kind: 'datetime' }, { header: 'Tamamlanma', key: 'done', width: 17, kind: 'datetime' }, { header: 'Oluşturma', key: 'created', width: 13, kind: 'date' }, { header: 'Mağaza / Bayi', key: 'store', width: 20 }],
    map: r => ({ title: r.title, cust: full(r.customers), st: TASK[r.status] || r.status, pr: PRIO[r.priority] || r.priority, due: toDate(r.due_at), done: toDate(r.completed_at), created: toDate(r.created_at), store: r.stores?.name }),
  },
  products: {
    label: 'urunler', perms: ['products.read'], table: 'products', order: 'sku',
    select: 'sku, name, category, material, price, currency, status, source_system, collections(name)',
    cols: [{ header: 'Stok kodu', key: 'sku', width: 14 }, { header: 'Ürün adı', key: 'name', width: 34 }, { header: 'Kategori', key: 'cat', width: 14 }, { header: 'Malzeme', key: 'mat', width: 14 }, { header: 'Koleksiyon', key: 'col', width: 16 }, { header: 'Fiyat', key: 'price', width: 13, kind: 'num' }, { header: 'Para birimi', key: 'cur', width: 10 }, { header: 'Durum', key: 'st', width: 12 }, { header: 'Kaynak', key: 'src', width: 12 }],
    map: r => ({ sku: r.sku, name: r.name, cat: r.category, mat: r.material, col: r.collections?.name, price: r.price === null ? null : Number(r.price), cur: r.currency, st: r.status, src: r.source_system || 'Elle' }),
  },
  b2b: {
    label: 'b2b-firmalar', perms: ['b2b.read', 'reports.export'], table: 'business_accounts', order: 'account_no',
    select: 'account_no, name, type, status, tax_office, tax_no, city, phone, email',
    cols: [{ header: 'No', key: 'no', width: 8 }, { header: 'Firma', key: 'name', width: 32 }, { header: 'Tür', key: 'type', width: 10 }, { header: 'Durum', key: 'st', width: 10 }, { header: 'Vergi dairesi', key: 'to', width: 16 }, { header: 'Vergi no', key: 'tn', width: 14 }, { header: 'Şehir', key: 'city', width: 14 }, { header: 'Telefon', key: 'phone', width: 16 }, { header: 'E-posta', key: 'email', width: 26 }],
    map: r => ({ no: r.account_no, name: r.name, type: TYPE[r.type] || r.type, st: r.status, to: r.tax_office, tn: r.tax_no, city: r.city, phone: r.phone, email: r.email }),
  },
}

const bad = (m: string, s = 400) => NextResponse.json({ ok: false, error: m }, { status: s })
const colDef = (c: Col) => ({ header: c.header, key: c.key, width: c.width, fmt: c.kind === 'date' ? dateFmt : c.kind === 'datetime' ? dateTimeFmt : c.kind === 'num' ? '#,##0.00' : undefined })

export async function GET(req: NextRequest, props: { params: Promise<{ entity: string }> }) {
  const params = await props.params;
  const entity = params.entity
  const sp = req.nextUrl.searchParams
  const fmt = sp.get('format') === 'csv' ? 'csv' : 'xlsx'
  const store = sp.get('store');const from = sp.get('from');const to = sp.get('to')
  if (store && !isUuid(store)) return bad('Geçersiz mağaza')
  const okDate = (v: string | null) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v)
  if (!okDate(from) || !okDate(to)) return bad('Geçersiz tarih')

  const isReport = entity === 'report', isActivity = entity === 'activity'
  const def = DEFS[entity]
  if (!def && !isReport && !isActivity) return bad('Bilinmeyen veri türü', 404)

  const g = await apiGuard()
  if ('res' in g) return g.res
  const { ctx } = g
  const need = isReport ? ['dashboard.read', 'reports.export'] : isActivity ? ['activity.read'] : def.perms
  if (!need.every(p => ctx.isSuperAdmin || ctx.permissions.includes(p))) return bad('Yetkiniz yok', 403)

  const db = createCrmServerClient()
  const stamp = new Date().toISOString().slice(0, 10)
  let sheets: SheetDef[]
  let label: string
  let count = 0

  if (isReport) {
    const f = from ? `${from}T00:00:00+03:00` : new Date(Date.now() - 29 * 864e5).toISOString()
    const t = to ? `${to}T23:59:59+03:00` : new Date().toISOString()
    const { data, error } = await db.rpc('report_overview', { p_from: f, p_to: t, p_store: store })
    if (error) return bad(error.message, 400)
    const num = (k: string) => ({ header: k, key: k, width: 14, fmt: '#,##0.00' })
    sheets = [
      { name: 'Özet', columns: [{ header: 'Gösterge', key: 'k', width: 34 }, { header: 'Değer', key: 'v', width: 18 }], rows: Object.entries(data.kpi || {}).map(([k, v]) => ({ k, v })) },
      { name: 'Günlük', columns: [{ header: 'Gün', key: 'd', width: 12 }, { header: 'Yeni müşteri', key: 'customers' }, { header: 'Yeni fırsat', key: 'opps' }, { header: 'Kazanılan', key: 'won' }, { header: 'Sipariş', key: 'orders' }, { header: 'Ciro', key: 'revenue', fmt: '#,##0.00' }], rows: data.daily || [] },
      { name: 'Mağaza-Bayi', columns: [{ header: 'Ad', key: 'name', width: 26 }, { header: 'Tür', key: 'type' }, { header: 'Müşteri', key: 'customers' }, { header: 'Yeni', key: 'new' }, { header: 'Fırsat', key: 'opps_created' }, { header: 'Kazanılan', key: 'won' }, { header: 'Kazanılan tutar', key: 'won_amount', fmt: '#,##0.00' }, { header: 'Sipariş', key: 'orders' }, { header: 'Ciro', key: 'revenue', fmt: '#,##0.00' }, { header: 'Geciken görev', key: 'tasks_overdue' }], rows: data.by_store || [] },
      { name: 'Kullanıcılar', columns: [{ header: 'Ad', key: 'name', width: 24 }, { header: 'Rol', key: 'roles', width: 18 }, { header: 'Mağaza', key: 'stores', width: 24 }, { header: 'Müşteri ekledi', key: 'customers_created' }, { header: 'Etkileşim', key: 'interactions' }, { header: 'Fırsat', key: 'opps_created' }, { header: 'Kazanılan', key: 'won' }, { header: 'Kazanılan tutar', key: 'won_amount', fmt: '#,##0.00' }, { header: 'Görev tamam', key: 'tasks_done' }, { header: 'Geciken görev', key: 'tasks_overdue' }, { header: 'Randevu tamam', key: 'appointments_completed' }, { header: 'Gelmedi', key: 'no_show' }], rows: data.by_user || [] },
      { name: 'Satış hunisi', columns: [{ header: 'Aşama', key: 'label', width: 22 }, { header: 'Adet', key: 'count' }, { header: 'Tutar', key: 'amount', fmt: '#,##0.00' }], rows: data.funnel || [] },
    ]
    void num
    label = 'rapor'; count = (data.daily || []).length
  } else if (isActivity) {
    const rows: any[] = []
    let before: number | null = null
    for (let i = 0; i < 10; i++) {
      const { data, error } = await db.rpc('activity_feed', { p_limit: 500, p_before: before, p_store: store, p_from: from ? `${from}T00:00:00+03:00` : null, p_to: to ? `${to}T23:59:59+03:00` : null })
      if (error) return bad(error.message, 400)
      rows.push(...(data || []))
      if (!data || data.length < 500) break
      before = data[data.length - 1].id
    }
    sheets = [{ name: 'Aktivite', columns: [{ header: 'Tarih', key: 'at', width: 18, fmt: dateTimeFmt }, { header: 'Kullanıcı', key: 'who', width: 24 }, { header: 'Rol', key: 'role', width: 18 }, { header: 'İşlem', key: 'act', width: 10 }, { header: 'Tablo', key: 'tbl', width: 22 }, { header: 'Kayıt', key: 'rec', width: 38 }, { header: 'Mağaza', key: 'store', width: 18 }, { header: 'Değişen alanlar', key: 'chg', width: 34 }],
      rows: rows.map(r => ({ at: toDate(r.created_at), who: r.actor_name, role: r.actor_roles, act: r.action, tbl: r.table_name, rec: r.record_id, store: r.store_name, chg: (r.changed || []).join(', ') })) }]
    label = 'aktivite'; count = rows.length
  } else {
    const rows: any[] = []
    for (let off = 0; off < MAX_ROWS; off += PAGE) {
      let q: any = db.from(def.table).select(def.select).order(def.order).range(off, off + PAGE - 1)
      if (entity === 'customers') q = q.eq('status', 'active')
      if (store && def.storeCol) q = q.eq(def.storeCol, store)
      if (from && def.dateCol) q = q.gte(def.dateCol, `${from}T00:00:00+03:00`)
      if (to && def.dateCol) q = q.lte(def.dateCol, `${to}T23:59:59+03:00`)
      const { data, error } = await q
      if (error) return bad(error.message, 400)
      rows.push(...(data || []))
      if (!data || data.length < PAGE) break
    }
    sheets = [{ name: def.label, columns: def.cols.map(colDef), rows: rows.map(def.map) }]
    label = def.label; count = rows.length
  }

  // Denetim kaydı (kim, ne, kaç satır)
  await db.rpc('log_export', { p_what: entity, p_count: count })

  const fname = `${label}-${stamp}.${fmt}`
  if (fmt === 'csv') {
    const s = sheets[0]
    const lines = [s.columns.map(c => csvCell(c.header)).join(';'), ...s.rows.map(r => s.columns.map(c => {
      const v = r[c.key]; return csvCell(v instanceof Date ? v.toISOString().slice(0, 19).replace('T', ' ') : v)
    }).join(';'))]
    return new NextResponse('﻿' + lines.join('\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${fname}"`, 'Cache-Control': 'no-store' } })
  }
  const buf = await buildXlsx(sheets)
  return new NextResponse(new Uint8Array(buf), { headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${fname}"`, 'Cache-Control': 'no-store' } })
}
