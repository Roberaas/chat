import { NextResponse } from 'next/server'

export const revalidate = 60

function parseNum(str: string | undefined): number | null {
  if (!str) return null
  return parseFloat(str.replace(/\./g, '').replace(',', '.').replace('$', '')) || null
}

export async function GET() {
  try {
    const res = await fetch('https://finans.truncgil.com/today.json', {
      next: { revalidate: 60 }
    })
    if (!res.ok) throw new Error('API hatası')
    const data = await res.json()

    const usd = parseNum(data.USD?.Alış)
    const eur = parseNum(data.EUR?.Alış)
    const gramAltin = parseNum(data['gram-altin']?.Alış)
    const gramAltin14 = parseNum(data['14-ayar-altin']?.Alış)
    const gramAltinSatis = parseNum(data['gram-altin']?.Satış)
    const gramAltin14Satis = parseNum(data['14-ayar-altin']?.Satış)
    const altinDegisim = data['gram-altin']?.Değişim || null
    const gumusAlis = parseNum(data.gumus?.Alış)
    const gumusSatis = parseNum(data.gumus?.Satış)
    const gumusDegisim = data.gumus?.Değişim || null

    return NextResponse.json({
      altin: {
        alis: gramAltin,
        satis: gramAltinSatis,
        ayar14: gramAltin14,
        ayar14Satis: gramAltin14Satis,
        degisim: altinDegisim
      },
      gumus: {
        alis: gumusAlis,
        satis: gumusSatis,
        degisim: gumusDegisim
      },
      doviz: { usd, eur },
      kaynak: 'finans.truncgil.com',
      guncelleme: data.Update_Date || new Date().toISOString()
    })
  } catch {
    // Fallback: sadece döviz
    let usd = null, eur = null
    try {
      const [uRes, eRes] = await Promise.all([
        fetch('https://api.frankfurter.app/latest?from=USD&to=TRY'),
        fetch('https://api.frankfurter.app/latest?from=EUR&to=TRY'),
      ])
      const [uData, eData] = await Promise.all([uRes.json(), eRes.json()])
      usd = uData.rates?.TRY || null
      eur = eData.rates?.TRY || null
    } catch {}
    return NextResponse.json({ doviz: { usd, eur }, guncelleme: new Date().toISOString() })
  }
}
