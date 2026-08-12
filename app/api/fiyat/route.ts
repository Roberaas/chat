import { NextResponse } from 'next/server'

export const revalidate = 60

export async function GET() {
  // Döviz — Frankfurter.app (izin verilmiş)
  let usd = 47.7, eur = 55.0
  try {
    const [uRes, eRes] = await Promise.all([
      fetch('https://api.frankfurter.app/latest?from=USD&to=TRY'),
      fetch('https://api.frankfurter.app/latest?from=EUR&to=TRY'),
    ])
    const [uData, eData] = await Promise.all([uRes.json(), eRes.json()])
    usd = uData.rates?.TRY || usd
    eur = eData.rates?.TRY || eur
  } catch {}

  // Altın/gümüş — metals-api via rapidapi (izin verilmiş olabilir)
  // Yoksa XAU/XAG spot fiyatını Frankfurter'dan al
  let gramAltin24 = 0, gramAltin14 = 0, gramGumus = 0
  try {
    // Frankfurter: XAU (troy ons) USD cinsinden
    const xauRes = await fetch('https://api.frankfurter.app/latest?from=XAU&to=USD')
    const xauData = await xauRes.json()
    const xauUsd = xauData.rates?.USD || 3500 // 1 troy ons = ? USD
    // 1 troy ons = 31.1035 gram
    gramAltin24 = (xauUsd * usd) / 31.1035
    gramAltin14 = gramAltin24 * (14 / 24)
    
    const xagRes = await fetch('https://api.frankfurter.app/latest?from=XAG&to=USD')
    const xagData = await xagRes.json()
    const xagUsd = xagData.rates?.USD || 33
    gramGumus = (xagUsd * usd) / 31.1035
  } catch {}

  const altin = gramAltin24 > 0 ? {
    alis: parseFloat(gramAltin24.toFixed(2)),
    satis: parseFloat((gramAltin24 * 1.005).toFixed(2)),
    ayar14: parseFloat(gramAltin14.toFixed(2)),
    degisim: null
  } : null

  const gumus = gramGumus > 0 ? {
    alis: parseFloat(gramGumus.toFixed(2)),
    satis: parseFloat((gramGumus * 1.005).toFixed(2)),
    degisim: null
  } : null

  return NextResponse.json({
    altin, gumus,
    doviz: { usd, eur },
    kaynak: 'frankfurter.app',
    guncelleme: new Date().toISOString()
  })
}
