export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const body = await req.json()
  const {
    tarih,
    trendyol_adet, trendyol_tutar,
    site_rb_adet, site_rb_tutar,
    site_935_adet, site_935_tutar,
    iade_trendyol_adet, iade_trendyol_tutar,
    iade_rb_adet, iade_rb_tutar,
    iade_935_adet, iade_935_tutar,
    durum
  } = body

  const { error } = await supabase
    .from('gunluk_satis')
    .upsert({
      tarih,
      trendyol_adet, trendyol_tutar,
      site_rb_adet, site_rb_tutar,
      site_935_adet, site_935_tutar,
      iade_trendyol_adet: iade_trendyol_adet || 0,
      iade_trendyol_tutar: iade_trendyol_tutar || 0,
      iade_rb_adet: iade_rb_adet || 0,
      iade_rb_tutar: iade_rb_tutar || 0,
      iade_935_adet: iade_935_adet || 0,
      iade_935_tutar: iade_935_tutar || 0,
      durum,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tarih' })

  if (error) {
    console.error('Kaydet hatası:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
