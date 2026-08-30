export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

export async function POST(req: Request) {
  const body = await req.json()
  const { mail_to, preview_only } = body

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
  const todayISO = now.toISOString().split('T')[0]
  const d7ago = new Date(now)
  d7ago.setDate(d7ago.getDate() - 6)
  const d7agoISO = d7ago.toISOString().split('T')[0]

  const { data: rows } = await supabase
    .from('gunluk_satis')
    .select('*')
    .gte('tarih', d7agoISO)
    .lte('tarih', todayISO)
    .order('tarih', { ascending: false })

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

  const baslangic = d7ago.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
  const bitis = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  const aralik = `${baslangic} – ${bitis}`

  const gunSatiri = (row: any) => {
    const g_brut = (parseFloat(row.trendyol_adet)||0) + (parseFloat(row.site_rb_adet)||0) + (parseFloat(row.site_935_adet)||0)
    const g_tutar = (parseFloat(row.trendyol_tutar)||0) + (parseFloat(row.site_rb_tutar)||0) + (parseFloat(row.site_935_tutar)||0)
    const g_iade = (parseFloat(row.iade_trendyol_adet)||0) + (parseFloat(row.iade_rb_adet)||0) + (parseFloat(row.iade_935_adet)||0)
    const g_iade_t = (parseFloat(row.iade_trendyol_tutar)||0) + (parseFloat(row.iade_rb_tutar)||0) + (parseFloat(row.iade_935_tutar)||0)
    const tarihLabel = new Date(row.tarih + 'T00:00:00').toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' })
    return `<tr style="border-bottom:1px solid rgba(201,168,76,0.08);">
      <td style="padding:10px 0;font-size:12px;color:#6A6460;">${tarihLabel}</td>
      <td style="padding:10px 8px;font-size:13px;color:#1A1410;text-align:right;">${Math.round(g_brut)}</td>
      <td style="padding:10px 8px;font-size:13px;color:#1A1410;text-align:right;">${fmt(g_tutar)} ₺</td>
      <td style="padding:10px 0;font-size:12px;color:#C4364A;text-align:right;">${g_iade > 0 ? `-${Math.round(g_iade)} / ${fmt(g_iade_t)} ₺` : '—'}</td>
    </tr>`
  }

  const kanalBlok = (label: string, color: string, adet: number, tutar: number, i_adet: number, i_tutar: number) => `
    <td width="33%" style="padding:0 8px;vertical-align:top;">
      <p style="margin:0 0 6px;font-size:8px;letter-spacing:3px;text-transform:uppercase;color:${color};">${label}</p>
      <p style="margin:0;font-size:20px;font-weight:300;color:#1A1410;">${Math.round(adet)} <span style="font-size:11px;color:#6A6460;">adet</span></p>
      <p style="margin:2px 0 0;font-size:12px;color:#1A1410;">${fmt(tutar)} ₺</p>
      ${i_adet > 0 ? `<p style="margin:4px 0 0;font-size:11px;color:#C4364A;">İade: ${Math.round(i_adet)} / ${fmt(i_tutar)} ₺</p>` : ''}
    </td>`

  const html = `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><title>Roberto Bravo — Haftalık Rapor</title></head>
<body style="margin:0;padding:0;background:#F8F5F0;font-family:'Georgia',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F5F0;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td style="padding:48px 48px 32px;background:#FFFFFF;border-bottom:1px solid rgba(201,168,76,0.15);">
    <p style="margin:0 0 8px;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#7A7570;">Roberto Bravo</p>
    <h1 style="margin:0 0 4px;font-size:36px;font-weight:300;color:#1A1410;">Haftalık Rapor</h1>
    <p style="margin:0;font-size:13px;color:#6A6460;">${aralik}</p>
  </td></tr>

  <tr><td style="padding:32px 48px;background:linear-gradient(135deg,#1A1610,#120F0C);border-bottom:1px solid rgba(201,168,76,0.1);">
    <p style="margin:0 0 18px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;">7 Günlük Net Özet</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="33%" style="padding-right:16px;">
        <p style="margin:0 0 4px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#7A7570;">Net Satış</p>
        <p style="margin:0;font-size:44px;font-weight:300;color:#C9A84C;line-height:1;">${Math.round(net_adet)}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#7A7570;">adet</p>
      </td>
      <td width="33%" style="padding:0 16px;border-left:1px solid rgba(201,168,76,0.1);">
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

  <tr><td style="padding:28px 48px;background:#F9F6F1;border-bottom:1px solid rgba(201,168,76,0.08);">
    <p style="margin:0 0 14px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#8B6914;">Günlük Dağılım</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr style="border-bottom:1px solid rgba(201,168,76,0.15);">
        <th style="padding:0 0 8px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#7A7570;font-weight:400;text-align:left;">Tarih</th>
        <th style="padding:0 8px 8px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#7A7570;font-weight:400;text-align:right;">Brüt Adet</th>
        <th style="padding:0 8px 8px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#7A7570;font-weight:400;text-align:right;">Brüt Ciro</th>
        <th style="padding:0 0 8px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#C4364A;font-weight:400;text-align:right;">İade</th>
      </tr>
      ${list.map(gunSatiri).join('')}
    </table>
  </td></tr>

  <tr><td style="padding:24px 48px;background:#1A1410;">
    <p style="margin:0;font-size:10px;color:#9A9590;letter-spacing:2px;text-transform:uppercase;">Roberto Bravo — ${aralik}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

  if (preview_only) {
    return NextResponse.json({ ok: true, html, meta: { aralik, net_adet: Math.round(net_adet), net_tutar, iade_adet: Math.round(iade_adet), gun_sayisi: list.length } })
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'mail-eu.smtp2go.com', port: 587, secure: false,
      auth: { user: '935byrobertobravo.com', pass: 'p79UAVZXh3x64NKk' }
    })
    await transporter.sendMail({
      from: '"Roberto Bravo" <rapor@935byrobertobravo.com>',
      to: mail_to,
      subject: `Roberto Bravo — Haftalık Rapor · ${aralik}`,
      html
    })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
