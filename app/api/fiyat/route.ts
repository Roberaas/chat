import { NextResponse } from 'next/server'

export const revalidate = 60

export async function GET() {
  // Döviz kurları
  let doviz: { usd: number | null; eur: number | null } = { usd: null, eur: null }
  try {
    const [usdRes, eurRes] = await Promise.all([
      fetch('https://api.frankfurter.app/latest?from=USD&to=TRY', { next: { revalidate: 60 } }),
      fetch('https://api.frankfurter.app/latest?from=EUR&to=TRY', { next: { revalidate: 60 } }),
    ])
    const [uData, eData] = await Promise.all([usdRes.json(), eurRes.json()])
    doviz = { usd: uData.rates?.TRY || null, eur: eData.rates?.TRY || null }
  } catch {}

  // Altın/gümüş — doviz.com
  try {
    const res = await fetch('https://altin.doviz.com/api/v2/precious-metals', {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      next: { revalidate: 60 }
    })
    if (res.ok) {
      const data = await res.json()
      const altin = data.find((x: any) => x.code === 'gram-altin' || x.name?.toLowerCase().includes('gram altın'))
      const gumus = data.find((x: any) => x.code === 'gram-gumus' || x.name?.toLowerCase().includes('gram gümüş'))
      return NextResponse.json({ altin, gumus, doviz, kaynak: 'doviz.com', guncelleme: new Date().toISOString() })
    }
  } catch {}

  // Fallback: goldapi.io
  const key = process.env.ALTIN_API_KEY
  if (key) {
    try {
      const [altinRes, gumusRes] = await Promise.all([
        fetch('https://www.goldapi.io/api/XAU/TRY', { headers: { 'x-access-token': key } }),
        fetch('https://www.goldapi.io/api/XAG/TRY', { headers: { 'x-access-token': key } }),
      ])
      const [altinData, gumusData] = await Promise.all([altinRes.json(), gumusRes.json()])
      return NextResponse.json({
        altin: { alis: altinData.price_gram_24k, satis: altinData.price_gram_24k * 1.005, degisim: altinData.ch_pct, ayar14: altinData.price_gram_14k },
        gumus: { alis: gumusData.price_gram_24k, satis: gumusData.price_gram_24k * 1.005, degisim: gumusData.ch_pct },
        doviz, kaynak: 'goldapi.io', guncelleme: new Date().toISOString()
      })
    } catch {}
  }

  // Altın/gümüş yok ama döviz var — sadece döviz döndür
  return NextResponse.json({ doviz, guncelleme: new Date().toISOString() })
}
