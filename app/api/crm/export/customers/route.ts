import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/crm/auth'
import { createCrmServerClient } from '@/lib/crm/supabase/server'
import { isUuid } from '@/lib/crm/validate'

export const dynamic = 'force-dynamic'
const cell = (v: unknown) => {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s   // CSV/Excel formül enjeksiyonuna karşı
  return `"${s.replace(/"/g, '""')}"`
}

// customers.export yetkisi + RLS: yalnızca erişilebilir müşteriler, KVKK gereği asgari alanlar
export async function GET(req: NextRequest) {
  const g = await apiGuard('customers.export')
  if ('res' in g) return g.res
  const store = req.nextUrl.searchParams.get('store')
  if (store && !isUuid(store)) return NextResponse.json({ ok: false, error: 'Geçersiz mağaza' }, { status: 400 })
  const db = createCrmServerClient()
  const rows: any[] = []
  for (let from = 0; from < 20000; from += 1000) {
    let q = db.from('customers').select('customer_no, first_name, last_name, phone, email, city, source, is_vip, total_spent, order_count, last_purchase_at, registered_at, stores(name)')
      .eq('status', 'active').order('customer_no').range(from, from + 999)
    if (store) q = q.eq('store_id', store)
    const { data, error } = await q
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  const head = ['No', 'Ad', 'Soyad', 'Telefon', 'E-posta', 'Şehir', 'Kaynak', 'VIP', 'Toplam harcama', 'Sipariş', 'Son alışveriş', 'Kayıt', 'Mağaza']
  const lines = [head.map(cell).join(';'), ...rows.map(r => [r.customer_no, r.first_name, r.last_name, r.phone, r.email, r.city, r.source, r.is_vip ? 'Evet' : 'Hayır', r.total_spent, r.order_count, r.last_purchase_at?.slice(0, 10), r.registered_at?.slice(0, 10), r.stores?.name].map(cell).join(';'))]
  // Dışa aktarma denetim kaydı (kullanıcı oturumuyla; audit_logs yalnız tetikleyiciyle yazılır → rpc ile)
  await db.rpc('log_export', { p_what: 'customers', p_count: rows.length })
  return new NextResponse('﻿' + lines.join('\n'), { headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="musteriler-${new Date().toISOString().slice(0, 10)}.csv"`,
    'Cache-Control': 'no-store',
  } })
}
