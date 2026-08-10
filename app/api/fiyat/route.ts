import { NextResponse } from 'next/server'

export const revalidate = 60 // 1 dakika cache

export async function GET() {
  // Önce doviz.com dene (key gerektirmez)
  try {
    const res = await fetch('https://altin.doviz.com/api/v2/precious-metals', {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      next: { revalidate: 60 }
    })
    if (res.ok) {
      const data = await res.json()
      // gram-altin ve gram-gumus bul
      const altin = data.find((x: any) => x.code === 'gram-altin' || x.name?.toLowerCase().includes('gram altın'))
      const gumus = data.find((x: any) => x.code === 'gram-gumus' || x.name?.toLowerCase().includes('gram gümüş'))
      return NextResponse.json({ altin, gumus, kaynak: 'doviz.com', guncelleme: new Date().toISOString() })
    }
  } catch {}

  // Fallback: goldapi.io (ALTIN_API_KEY env ile)
  const key = process.env.ALTIN_API_KEY
  if (key) {
    try {
      const [altinRes, gumusRes] = await Promise.all([
        fetch('https://www.goldapi.io/api/XAU/TRY', { headers: { 'x-access-token': key } }),
        fetch('https://www.goldapi.io/api/XAG/TRY', { headers: { 'x-access-token': key } }),
      ])
      const [altinData, gumusData] = await Promise.all([altinRes.json(), gumusRes.json()])
      
      // gram fiyatı = price_gram_24k (24 ayar), 14 ayar için * 14/24
      return NextResponse.json({
        altin: {
          alis: altinData.price_gram_24k,
          satis: altinData.price_gram_24k * 1.005,
          degisim: altinData.ch_pct,
          ayar24: altinData.price_gram_24k,
          ayar14: altinData.price_gram_14k,
        },
        gumus: {
          alis: gumusData.price_gram_24k,
          satis: gumusData.price_gram_24k * 1.005,
          degisim: gumusData.ch_pct,
        },
        kaynak: 'goldapi.io',
        guncelleme: new Date().toISOString()
      })
    } catch {}
  }

  // Son fallback: metals.live ücretsiz (key gerektirmez)
  try {
    const res = await fetch('https://metals.live/api/spot', {
      next: { revalidate: 60 }
    })
    if (res.ok) {
      const data = await res.json()
      return NextResponse.json({ raw: data, kaynak: 'metals.live', guncelleme: new Date().toISOString() })
    }
  } catch {}

  return NextResponse.json({ hata: 'Fiyat alınamadı', guncelleme: new Date().toISOString() }, { status: 200 })
}
