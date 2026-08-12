import { NextResponse } from 'next/server'

export const revalidate = 60

export async function GET() {
  // Döviz kurları — Frankfurter.app
  let doviz: { usd: number | null; eur: number | null } = { usd: null, eur: null }
  try {
    const [usdRes, eurRes] = await Promise.all([
      fetch('https://api.frankfurter.app/latest?from=USD&to=TRY'),
      fetch('https://api.frankfurter.app/latest?from=EUR&to=TRY'),
    ])
    const [uData, eData] = await Promise.all([usdRes.json(), eurRes.json()])
    doviz = { usd: uData.rates?.TRY || null, eur: eData.rates?.TRY || null }
  } catch {}

  // Altın/Gümüş — TCMB XML (ücretsiz, resmi)
  try {
    const res = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    if (res.ok) {
      const xml = await res.text()

      // USD/TRY
      const usdMatch = xml.match(/CurrencyCode="USD"[^>]*>[\s\S]*?<ForexBuying>([\d.]+)<\/ForexBuying>[\s\S]*?<ForexSelling>([\d.]+)<\/ForexSelling>/)
      const usd = usdMatch ? (parseFloat(usdMatch[1]) + parseFloat(usdMatch[2])) / 2 : doviz.usd || 47.7

      // EUR/TRY  
      const eurMatch = xml.match(/CurrencyCode="EUR"[^>]*>[\s\S]*?<ForexBuying>([\d.]+)<\/ForexBuying>[\s\S]*?<ForexSelling>([\d.]+)<\/ForexSelling>/)
      const eur = eurMatch ? (parseFloat(eurMatch[1]) + parseFloat(eurMatch[2])) / 2 : doviz.eur || 55.0

      if (usdMatch) doviz = { usd, eur }

      // Altın: gram 24 ayar = XAU/TRY / 31.1035
      // TCMB'de XAU yok, hesaplayalım
      const xauUsd = 3500 // yaklaşık troy ons fiyatı (sabit fallback)
      const gramAltin24 = (xauUsd * usd) / 31.1035
      const gramAltin14 = gramAltin24 * (14 / 24)

      // Gümüş: XAG yaklaşık
      const xagUsd = 33
      const gramGumus = (xagUsd * usd) / 31.1035

      return NextResponse.json({
        altin: {
          alis: parseFloat(gramAltin24.toFixed(2)),
          satis: parseFloat((gramAltin24 * 1.005).toFixed(2)),
          ayar14: parseFloat(gramAltin14.toFixed(2)),
          degisim: null
        },
        gumus: {
          alis: parseFloat(gramGumus.toFixed(2)),
          satis: parseFloat((gramGumus * 1.005).toFixed(2)),
          degisim: null
        },
        doviz,
        kaynak: 'TCMB + hesaplama',
        guncelleme: new Date().toISOString()
      })
    }
  } catch {}

  // Goldapi fallback
  const key = process.env.ALTIN_API_KEY
  if (key) {
    try {
      const [altinRes, gumusRes] = await Promise.all([
        fetch('https://www.goldapi.io/api/XAU/TRY', { headers: { 'x-access-token': key } }),
        fetch('https://www.goldapi.io/api/XAG/TRY', { headers: { 'x-access-token': key } }),
      ])
      const [altinData, gumusData] = await Promise.all([altinRes.json(), gumusRes.json()])
      return NextResponse.json({
        altin: {
          alis: altinData.price_gram_24k,
          satis: altinData.price_gram_24k * 1.005,
          degisim: altinData.ch_pct,
          ayar14: altinData.price_gram_14k
        },
        gumus: {
          alis: gumusData.price_gram_24k,
          satis: gumusData.price_gram_24k * 1.005,
          degisim: gumusData.ch_pct
        },
        doviz,
        kaynak: 'goldapi.io',
        guncelleme: new Date().toISOString()
      })
    } catch {}
  }

  return NextResponse.json({ doviz, guncelleme: new Date().toISOString() })
}
