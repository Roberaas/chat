import { NextResponse } from 'next/server'

export const revalidate = 60

function parseNum(str: string | undefined): number | null {
  if (!str) return null
  return parseFloat(str.replace(/\./g, '').replace(',', '.').replace('$', '')) || null
}

function parseDeg(str: string | undefined): number | null {
  if (!str) return null
  const n = parseFloat(str.replace('%', '').replace(',', '.'))
  return isNaN(n) ? null : n
}

export async function GET() {
  try {
    const res = await fetch('https://finans.truncgil.com/today.json', { next: { revalidate: 60 } })
    if (!res.ok) throw new Error('API hatası')
    const d = await res.json()

    return NextResponse.json({
      altin: {
        gram:    { alis: parseNum(d['gram-altin']?.Alış),     satis: parseNum(d['gram-altin']?.Satış),     degisim: parseDeg(d['gram-altin']?.Değişim) },
        ayar14:  { alis: parseNum(d['14-ayar-altin']?.Alış),  satis: parseNum(d['14-ayar-altin']?.Satış),  degisim: parseDeg(d['14-ayar-altin']?.Değişim) },
        ceyrek:  { alis: parseNum(d['ceyrek-altin']?.Alış),   satis: parseNum(d['ceyrek-altin']?.Satış),   degisim: parseDeg(d['ceyrek-altin']?.Değişim) },
        yarim:   { alis: parseNum(d['yarim-altin']?.Alış),    satis: parseNum(d['yarim-altin']?.Satış),    degisim: parseDeg(d['yarim-altin']?.Değişim) },
        tam:     { alis: parseNum(d['tam-altin']?.Alış),      satis: parseNum(d['tam-altin']?.Satış),      degisim: parseDeg(d['tam-altin']?.Değişim) },
      },
      gumus:   { alis: parseNum(d['gumus']?.Alış),            satis: parseNum(d['gumus']?.Satış),          degisim: parseDeg(d['gumus']?.Değişim) },
      platin:  { alis: parseNum(d['gram-platin']?.Alış),      satis: parseNum(d['gram-platin']?.Satış),    degisim: parseDeg(d['gram-platin']?.Değişim) },
      doviz: {
        usd: { alis: parseNum(d.USD?.Alış), satis: parseNum(d.USD?.Satış), degisim: parseDeg(d.USD?.Değişim) },
        eur: { alis: parseNum(d.EUR?.Alış), satis: parseNum(d.EUR?.Satış), degisim: parseDeg(d.EUR?.Değişim) },
        gbp: { alis: parseNum(d.GBP?.Alış), satis: parseNum(d.GBP?.Satış), degisim: parseDeg(d.GBP?.Değişim) },
        rub: { alis: parseNum(d.RUB?.Alış), satis: parseNum(d.RUB?.Satış), degisim: parseDeg(d.RUB?.Değişim) },
        sar: { alis: parseNum(d.SAR?.Alış), satis: parseNum(d.SAR?.Satış), degisim: parseDeg(d.SAR?.Değişim) },
        aed: { alis: parseNum(d.AED?.Alış), satis: parseNum(d.AED?.Satış), degisim: parseDeg(d.AED?.Değişim) },
      },
      kaynak: 'finans.truncgil.com',
      guncelleme: d.Update_Date || new Date().toISOString()
    })
  } catch {
    return NextResponse.json({ hata: 'Fiyat alınamadı', guncelleme: new Date().toISOString() })
  }
}
