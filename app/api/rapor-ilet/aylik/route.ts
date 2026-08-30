export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

export async function POST(req: Request) {
  const body = await req.json()
  const { mail_to, preview_only, reklam_kalemleri } = body
  // reklam_kalemleri: [{ grup: 'Altın', kalem: 'search', tutar: 23021 }, ...]

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
  const todayISO = now.toISOString().split('T')[0]
  const ayBaslangic = todayISO.substring(0, 7) + '-01'
  const ayLabel = now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })

  const { data: rows } = await supabase
    .from('gunluk_satis')
    .select('*')
    .gte('tarih', ayBaslangic)
    .lte('tarih', todayISO)
    .order('tarih', { ascending: true })

  const list = rows || []
  const sum = (key: string) => list.reduce((a, r) => a + (parseFloat(r[key]) || 0), 0)
  const fmt = (n: number) => n.toLocaleString('tr-TR')

  const brut_adet = sum('trendyol_adet') + sum('site_rb_adet') + sum('site_935_adet')
  const brut_tutar = sum('trendyol_tutar') + sum('site_rb_tutar') + sum('site_935_tutar')
  const iade_adet = sum('iade_trendyol_adet') + sum('iade_rb_adet') + sum('iade_935_adet')
  const iade_tutar = sum('iade_trendyol_tutar') + sum('iade_rb_tutar') + sum('iade_935_tutar')
  const net_adet = brut_adet - iade_adet
  const net_tutar = brut_tutar - iade_tutar

  const tr_adet = sum('trendyol_adet'), tr_tutar = sum('trendyol_tutar')
  const tr_i_adet = sum('iade_trendyol_adet'), tr_i_tutar = sum('iade_trendyol_tutar')
  const rb_adet = sum('site_rb_adet'), rb_tutar = sum('site_rb_tutar')
  const rb_i_adet = sum('iade_rb_adet'), rb_i_tutar = sum('iade_rb_tutar')
  const s935_adet = sum('site_935_adet'), s935_tutar = sum('site_935_tutar')
  const s935_i_adet = sum('iade_935_adet'), s935_i_tutar = sum('iade_935_tutar')

  // Reklam giderleri gruplandır
  const kalemleri: Array<{ grup: string; kalem: string; tutar: number }> = reklam_kalemleri || []
  const gruplar = [...new Set(kalemleri.map((k: any) => k.grup))]
  const toplamReklam = kalemleri.reduce((a: number, k: any) => a + (parseFloat(k.tutar) || 0), 0)

  const reklamBlok = gruplar.length > 0 ? `
  <tr><td style="padding:28px 48px;background:#FFFFFF;border-bottom:1px solid rgba(201,168,76,0.08);">
    <p style="margin:0 0 18px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#8B6914;">Dijital Reklam Harcamaları</p>
    ${gruplar.map(grup => {
      const items = kalemleri.filter((k: any) => k.grup === grup)
      const gtoplam = items.reduce((a: number, k: any) => a + (parseFloat(k.tutar) || 0), 0)
      return `<div style="margin-bottom:20px;">
        <p style="margin:0 0 10px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#4A4540;font-weight:600;">${grup}</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${items.map((k: any) => `<tr>
            <td style="padding:6px 0;font-size:12px;color:#6A6460;text-transform:capitalize;">${k.kalem}</td>
            <td style="padding:6px 0;font-size:13px;color:#1A1410;text-align:right;font-family:monospace;">${fmt(parseFloat(k.tutar)||0)} ₺</td>
          </tr>`).join('')}
          <tr style="border-top:1px solid rgba(201,168,76,0.15);">
            <td style="padding:8px 0 0;font-size:11px;color:#8B6914;font-weight:600;">Toplam</td>
            <td style="padding:8px 0 0;font-size:13px;color:#8B6914;text-align:right;font-weight:600;font-family:monospace;">${fmt(gtoplam)} ₺</td>
          </tr>
        </table>
      </div>`
    }).join('<hr style="border:none;border-top:1px solid rgba(201,168,76,0.1);margin:4px 0 20px;">')}
    <div style="margin-top:16px;padding:14px 18px;background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.2);border-radius:6px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:11px;color:#7A7570;letter-spacing:2px;text-transform:uppercase;">Toplam Reklam Gideri</td>
        <td style="font-size:18px;font-weight:300;color:#C9A84C;text-align:right;font-family:monospace;">${fmt(toplamReklam)} ₺</td>
      </tr></table>
    </div>
  </td></tr>` : ''

  const kanalBlok = (label: string, color: string, adet: number, tutar: number, i_adet: number, i_tutar: number) => `
    <td width="33%" style="padding:0 8px;vertical-align:top;">
      <p style="margin:0 0 6px;font-size:8px;letter-spacing:3px;text-transform:uppercase;color:${color};">${label}</p>
      <p style="margin:0;font-size:20px;font-weight:300;color:#1A1410;">${Math.round(adet)} <span style="font-size:11px;color:#6A6460;">adet</span></p>
      <p style="margin:2px 0 0;font-size:12px;color:#1A1410;">${fmt(tutar)} ₺</p>
      ${i_adet > 0 ? `<p style="margin:4px 0 0;font-size:11px;color:#C4364A;">İade: ${Math.round(i_adet)} / ${fmt(i_tutar)} ₺</p>` : ''}
    </td>`

  const html = `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><title>Roberto Bravo — Aylık Rapor</title></head>
<body style="margin:0;padding:0;background:#F8F5F0;font-family:'Georgia',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F5F0;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td style="padding:48px 48px 32px;background:#FFFFFF;border-bottom:1px solid rgba(201,168,76,0.15);">
    <p style="margin:0 0 8px;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#7A7570;">Roberto Bravo</p>
    <h1 style="margin:0 0 4px;font-size:36px;font-weight:300;color:#1A1410;">Aylık Rapor</h1>
    <p style="margin:0;font-size:13px;color:#6A6460;">${ayLabel}</p>
  </td></tr>

  <tr><td style="padding:32px 48px;background:linear-gradient(135deg,#1A1610,#120F0C);border-bottom:1px solid rgba(201,168,76,0.1);">
    <p style="margin:0 0 18px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;">${ayLabel} — Net Özet (İade Düşülmüş)</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="${iade_adet > 0 ? '34%' : '50%'}" style="padding-right:16px;">
        <p style="margin:0 0 4px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#7A7570;">Net Satış</p>
        <p style="margin:0;font-size:44px;font-weight:300;color:#C9A84C;line-height:1;">${Math.round(net_adet)}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#7A7570;">adet</p>
      </td>
      <td width="${iade_adet > 0 ? '33%' : '50%'}" style="padding:0 16px;border-left:1px solid rgba(201,168,76,0.1);">
        <p style="margin:0 0 4px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#7A7570;">Net Ciro</p>
        <p style="margin:0;font-size:44px;font-weight:300;color:#C9A84C;line-height:1;">${fmt(net_tutar)}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#7A7570;">₺</p>
      </td>
      ${iade_adet > 0 ? `<td width="33%" style="padding-left:16px;border-left:1px solid rgba(168,48,64,0.2);">
        <p style="margin:0 0 4px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#C4364A;">Toplam İade</p>
        <p style="margin:0;font-size:44px;font-weight:300;color:#C4364A;line-height:1;">${Math.round(iade_adet)}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#C4364A;">${fmt(iade_tutar)} ₺</p>
      </td>` : ''}
    </tr></table>
  </td></tr>

  <tr><td style="padding:28px 48px;background:#FFFFFF;border-bottom:1px solid rgba(201,168,76,0.08);">
    <p style="margin:0 0 16px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#8B6914;">Kanal Kırılımı</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      ${kanalBlok('Trendyol', '#8B6914', tr_adet, tr_tutar, tr_i_adet, tr_i_tutar)}
      ${kanalBlok('robertobravo.com', '#4A4540', rb_adet, rb_tutar, rb_i_adet, rb_i_tutar)}
      ${kanalBlok('935byrobertobravo.com', '#7A8A9A', s935_adet, s935_tutar, s935_i_adet, s935_i_tutar)}
    </tr></table>
  </td></tr>

  ${reklamBlok}

  <tr><td style="padding:24px 48px;background:#1A1410;">
    <p style="margin:0;font-size:10px;color:#9A9590;letter-spacing:2px;text-transform:uppercase;">Roberto Bravo — ${ayLabel}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

  if (preview_only) {
    return NextResponse.json({ ok: true, html, meta: { ayLabel, net_adet: Math.round(net_adet), net_tutar, iade_adet: Math.round(iade_adet), toplamReklam, gun_sayisi: list.length } })
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'mail-eu.smtp2go.com', port: 587, secure: false,
      auth: { user: '935byrobertobravo.com', pass: 'p79UAVZXh3x64NKk' }
    })
    await transporter.sendMail({
      from: '"Roberto Bravo" <rapor@935byrobertobravo.com>',
      to: mail_to,
      subject: `Roberto Bravo — Aylık Rapor · ${ayLabel}`,
      html
    })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
