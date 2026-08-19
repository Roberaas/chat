import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

webpush.setVapidDetails(
  'mailto:mert.ilker@robertobravo.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(req: Request) {
  const { title, body, url, tag } = await req.json()

  const { data: subs } = await supabase.from('push_subscriptions').select('*')
  if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  const payload = JSON.stringify({ title, body, url: url || '/dashboard/canli-destek', tag })
  let sent = 0; const failed: string[] = []

  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      }, payload)
      sent++
    } catch (err: any) {
      // 410 Gone = subscription geçersiz, sil
      if (err.statusCode === 410 || err.statusCode === 404) {
        failed.push(sub.endpoint)
      }
    }
  }))

  // Geçersiz subscription'ları temizle
  if (failed.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', failed)
  }

  return NextResponse.json({ ok: true, sent, removed: failed.length })
}
