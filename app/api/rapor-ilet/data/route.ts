export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { searchParams } = new URL(req.url)
  const tarih = searchParams.get('tarih')
  if (!tarih) return NextResponse.json({ error: 'tarih gerekli' }, { status: 400 })

  const ayBaslangic = tarih.substring(0, 7) + '-01'

  // Bugünün kaydı
  const { data: bugun } = await supabase
    .from('gunluk_satis')
    .select('*')
    .eq('tarih', tarih)
    .maybeSingle()

  // Bugün HARİÇ aylık toplam
  const { data: aylikRows } = await supabase
    .from('gunluk_satis')
    .select('trendyol_adet, trendyol_tutar, site_rb_adet, site_rb_tutar, site_935_adet, site_935_tutar, iade_trendyol_adet, iade_trendyol_tutar, iade_rb_adet, iade_rb_tutar, iade_935_adet, iade_935_tutar')
    .gte('tarih', ayBaslangic)
    .lt('tarih', tarih)

  const aylik = (aylikRows || []).reduce((acc, row) => ({
    trendyol_adet:       acc.trendyol_adet       + (row.trendyol_adet || 0),
    trendyol_tutar:      acc.trendyol_tutar       + parseFloat(row.trendyol_tutar || 0),
    site_rb_adet:        acc.site_rb_adet         + (row.site_rb_adet || 0),
    site_rb_tutar:       acc.site_rb_tutar        + parseFloat(row.site_rb_tutar || 0),
    site_935_adet:       acc.site_935_adet        + (row.site_935_adet || 0),
    site_935_tutar:      acc.site_935_tutar       + parseFloat(row.site_935_tutar || 0),
    iade_trendyol_adet:  acc.iade_trendyol_adet   + (row.iade_trendyol_adet || 0),
    iade_trendyol_tutar: acc.iade_trendyol_tutar  + parseFloat(row.iade_trendyol_tutar || 0),
    iade_rb_adet:        acc.iade_rb_adet         + (row.iade_rb_adet || 0),
    iade_rb_tutar:       acc.iade_rb_tutar        + parseFloat(row.iade_rb_tutar || 0),
    iade_935_adet:       acc.iade_935_adet        + (row.iade_935_adet || 0),
    iade_935_tutar:      acc.iade_935_tutar       + parseFloat(row.iade_935_tutar || 0),
  }), {
    trendyol_adet: 0, trendyol_tutar: 0,
    site_rb_adet: 0, site_rb_tutar: 0,
    site_935_adet: 0, site_935_tutar: 0,
    iade_trendyol_adet: 0, iade_trendyol_tutar: 0,
    iade_rb_adet: 0, iade_rb_tutar: 0,
    iade_935_adet: 0, iade_935_tutar: 0,
  })

  return NextResponse.json({ bugun, aylik })
}
