export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

// Yalnızca admin (middleware ADMIN_ONLY). Sağlayıcı anahtarları sunucuda kalır.
export async function GET() {
  const out: any = { openai: { yapilandirildi: false }, netgsm: { yapilandirildi: false } }

  const adminKey = process.env.OPENAI_ADMIN_KEY
  if (adminKey) {
    out.openai.yapilandirildi = true
    try {
      const now = Math.floor(Date.now() / 1000)
      const start = now - 30 * 86400
      const h = { Authorization: `Bearer ${adminKey}` }
      const [c, u] = await Promise.all([
        fetch(`https://api.openai.com/v1/organization/costs?start_time=${start}&bucket_width=1d&limit=31`, { headers: h, cache: 'no-store' }),
        fetch(`https://api.openai.com/v1/organization/usage/completions?start_time=${start}&bucket_width=1d&limit=31`, { headers: h, cache: 'no-store' }),
      ])
      if (!c.ok) throw new Error(`costs ${c.status}`)
      const cj = await c.json()
      const gunler = (cj.data || []).map((b: any) => ({
        tarih: new Date(b.start_time * 1000).toISOString().slice(0, 10),
        usd: (b.results || []).reduce((s: number, r: any) => s + Number(r.amount?.value || 0), 0),
      }))
      let istek = 0, girdi = 0, cikti = 0
      if (u.ok) {
        const uj = await u.json()
        for (const b of uj.data || []) for (const r of b.results || []) {
          istek += r.num_model_requests || 0; girdi += r.input_tokens || 0; cikti += r.output_tokens || 0
        }
      }
      out.openai = { yapilandirildi: true, gunler, toplam_usd: gunler.reduce((s: number, g: any) => s + g.usd, 0), istek, girdi, cikti,
        aylik_limit_usd: Number(process.env.OPENAI_AYLIK_LIMIT_USD || 0) || null }
    } catch (e: any) { out.openai.hata = String(e.message || e).slice(0, 120) }
  }

  if (process.env.NETGSM_USERCODE && process.env.NETGSM_PASSWORD) {
    out.netgsm.yapilandirildi = true
    try {
      const body = new URLSearchParams({ usercode: process.env.NETGSM_USERCODE, password: process.env.NETGSM_PASSWORD, tip: '2' })
      const r = await fetch('https://api.netgsm.com.tr/balance/list/get', { method: 'POST', body, cache: 'no-store' })
      out.netgsm.ham = (await r.text()).trim().slice(0, 200)
    } catch { out.netgsm.hata = 'Bakiye alınamadı' }
  }
  return NextResponse.json(out)
}
