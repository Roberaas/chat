export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { searchParams } = new URL(req.url)
  const tarih = searchParams.get('tarih')
  if (!tarih) return NextResponse.json({ error: 'tarih gerekli' }, { status: 400 })

  const ayBaslangic = tarih.substring(0, 7) + '-01'

  const { data: bugun } = await supabase
    .from('gunluk_satis')
    .select('*')
    .eq('tarih', tarih)
    .maybeSingle()

  const { data: aylikRows, error } = await supabase
    .from('gunluk_satis')
    .select('*')
    .gte('tarih', ayBaslangic)
    .lt('tarih', tarih)

  if (error) console.error('[data] supabase error:', error)
  console.log('[data] tarih:', tarih, 'aylikRows:', aylikRows?.length, JSON.stringify(aylikRows))

  const zero = {
    trendyol_adet: 0, trendyol_tutar: 0,
    site_rb_adet: 0, site_rb_tutar: 0,
    site_935_adet: 0, site_935_tutar: 0,
    iade_trendyol_adet: 0, iade_trendyol_tutar: 0,
    iade_rb_adet: 0, iade_rb_tutar: 0,
    iade_935_adet: 0, iade_935_tutar: 0,
  }

  const aylik = (aylikRows || []).reduce((acc, row) => ({
    trendyol_adet:       acc.trendyol_adet       + (parseInt(row.trendyol_adet)       || 0),
    trendyol_tutar:      acc.trendyol_tutar       + (parseFloat(row.trendyol_tutar)    || 0),
    site_rb_adet:        acc.site_rb_adet         + (parseInt(row.site_rb_adet)        || 0),
    site_rb_tutar:       acc.site_rb_tutar        + (parseFloat(row.site_rb_tutar)     || 0),
    site_935_adet:       acc.site_935_adet        + (parseInt(row.site_935_adet)       || 0),
    site_935_tutar:      acc.site_935_tutar       + (parseFloat(row.site_935_tutar)    || 0),
    iade_trendyol_adet:  acc.iade_trendyol_adet   + (parseInt(row.iade_trendyol_adet)  || 0),
    iade_trendyol_tutar: acc.iade_trendyol_tutar  + (parseFloat(row.iade_trendyol_tutar) || 0),
    iade_rb_adet:        acc.iade_rb_adet         + (parseInt(row.iade_rb_adet)        || 0),
    iade_rb_tutar:       acc.iade_rb_tutar        + (parseFloat(row.iade_rb_tutar)     || 0),
    iade_935_adet:       acc.iade_935_adet        + (parseInt(row.iade_935_adet)       || 0),
    iade_935_tutar:      acc.iade_935_tutar       + (parseFloat(row.iade_935_tutar)    || 0),
  }), zero)

  return NextResponse.json({ bugun, aylik })
}
