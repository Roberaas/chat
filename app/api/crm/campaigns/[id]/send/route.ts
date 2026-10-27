import { NextResponse } from 'next/server'
import { apiGuard } from '@/lib/crm/auth'
import { createCrmServerClient } from '@/lib/crm/supabase/server'
import { providerFor, renderTemplate, sendMessage, type Channel } from '@/lib/crm/messaging'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BUDGET_MS = 45_000, BATCH = 25, CONCURRENCY = 5

// Kampanya gönderimi: istek başına ~45 sn çalışır, kalan varsa remaining > 0 döner (arayüz tekrar çağırır).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const g = await apiGuard('campaigns.send')
  if ('res' in g) return g.res
  if (!UUID.test(params.id)) return NextResponse.json({ ok: false, error: 'Geçersiz kampanya' }, { status: 400 })

  const db = createCrmServerClient()
  const { data: camp } = await db.from('campaigns').select('id, channel, status').eq('id', params.id).maybeSingle()
  if (!camp) return NextResponse.json({ ok: false, error: 'Kampanya bulunamadı' }, { status: 404 })
  if (!providerFor(camp.channel as Channel)) {
    return NextResponse.json({ ok: false, error: `${String(camp.channel).toUpperCase()} sağlayıcısı yapılandırılmamış. Ayarlar → Mesajlaşma bölümüne bakın.` }, { status: 409 })
  }

  const started = Date.now(); let sent = 0, failed = 0, retried = 0, remaining = 0
  while (Date.now() - started < BUDGET_MS) {
    const { data, error } = await db.rpc('campaign_claim', { p_campaign: params.id, p_limit: BATCH })
    if (error) {
      const forbidden = error.code === '42501'
      return NextResponse.json({ ok: false, error: error.message, sent, failed, retried }, { status: forbidden ? 403 : sent + failed > 0 ? 200 : 409 })
    }
    const rows = (data || []) as { customer_id: string; first_name: string; last_name: string; to_address: string; channel: Channel; subject: string | null; body: string }[]
    if (rows.length === 0) break
    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      await Promise.all(rows.slice(i, i + CONCURRENCY).map(async r => {
        const res = await sendMessage({ channel: r.channel, to: r.to_address, body: renderTemplate(r.body, r), subject: r.subject ? renderTemplate(r.subject, r) : null, customerId: r.customer_id, campaignId: params.id })
        await db.rpc('campaign_mark', { p_campaign: params.id, p_customer: r.customer_id, p_ok: res.ok, p_retry: !res.ok && !!res.retry, p_error: res.ok ? null : (res.error || 'Hata'), p_message_id: res.ok ? (res.id || null) : null })
        if (res.ok) sent++; else if (res.retry) retried++; else failed++
      }))
    }
  }
  const { count } = await db.from('campaign_recipients').select('customer_id', { count: 'exact', head: true }).eq('campaign_id', params.id).in('status', ['pending', 'sending'])
  remaining = count || 0
  return NextResponse.json({ ok: true, sent, failed, retried, remaining })
}
