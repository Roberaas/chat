export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { soru, veri, gecmis } = await req.json()

    const mesajlar = [
      {
        role: 'system',
        content: `Sen Roberto'sun — Roberto Bravo ve 935 by Roberto Bravo markalarının WhatsApp admin asistanısın. Kullanıcı adı Mert.

KARAKTER: Samimi, analitik, kısa ve öz.
DİL: Türkçe.
UZUNLUK: Basit sorularda 1-2 cümle. Analiz sorularında 3-4 cümle.

ANALİZ YAKLAŞIMI:
- Sadece rakam söyleme, yorumla.
- Trendi fark et: artıyor mu, azalıyor mu?
- Sorun görüyorsan belirt, öneri sun.

İKİ MARKA:
- robertobravo.com — 14 ayar altın ve pırlanta mücevher
- 935byrobertobravo.com — 925 ayar gümüş mücevher

Güncel dashboard verileri:
${veri}`
      },
      ...(gecmis || []),
      { role: 'user', content: soru }
    ]

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: mesajlar,
        max_tokens: 200,
        temperature: 0.7,
      })
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('OpenAI hata:', err)
      return NextResponse.json({ cevap: 'Yapay zeka bağlantısı kurulamadı.' })
    }

    const data = await res.json()
    const cevap = data.choices?.[0]?.message?.content || 'Anlayamadım, tekrar söyler misin?'
    return NextResponse.json({ cevap })
  } catch (e: any) {
    console.error('Asistan hata:', e.message)
    return NextResponse.json({ cevap: 'Bir hata oluştu, tekrar dener misin?' })
  }
}
