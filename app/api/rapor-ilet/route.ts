export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: Request) {
  const body = await req.json()
  const {
    trendyol_adet, trendyol_tutar,
    site_rb_adet, site_rb_tutar,
    site_935_adet, site_935_tutar,
    iade_trendyol_adet, iade_trendyol_tutar,
    iade_rb_adet, iade_rb_tutar,
    iade_935_adet, iade_935_tutar,
    brut_adet, brut_tutar,
    iade_adet, iade_tutar,
    net_adet, net_tutar,
    ay_net_adet, ay_net_tutar,
    ay_iade_adet, ay_iade_tutar,
    durum, mail_to, tarih, ay_label,
  } = body

  const fmt = (n: any) => Number(n || 0).toLocaleString('tr-TR')
  const ia = (v: any) => parseInt(v) || 0
  const fa = (v: any) => parseFloat(v) || 0

  const hasIade = ia(iade_adet) > 0

  const kanalSatir = (label: string, color: string,
    adet: any, tutar: any, i_adet: any, i_tutar: any) => {
    const hasKanalIade = ia(i_adet) > 0
    return `
      <tr><td style="padding:24px 48px;background:#FFFFFF;border-bottom:1px solid rgba(201,168,76,0.06);">
        <p style="margin:0 0 14px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:${color};">${label}</p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="${hasKanalIade ? '34%' : '50%'}">
            <p style="margin:0;font-size:11px;color:#7A7570;">Satış</p>
            <p style="margin:4px 0 0;font-size:22px;font-weight:300;color:#1A1410;">${adet || '0'} <span style="font-size:12px;color:#6A6460;">adet</span></p>
            <p style="margin:2px 0 0;font-size:13px;color:#1A1410;">${fmt(fa(tutar))} <span style="font-size:11px;color:#6A6460;">TL</span></p>
          </td>
          ${hasKanalIade ? `
          <td width="33%" style="padding-left:12px;border-left:1px solid rgba(168,48,64,0.15);">
            <p style="margin:0;font-size:11px;color:#C4364A;">İade</p>
            <p style="margin:4px 0 0;font-size:22px;font-weight:300;color:#C4364A;">-${i_adet} <span style="font-size:12px;">adet</span></p>
            <p style="margin:2px 0 0;font-size:13px;color:#C4364A;">-${fmt(fa(i_tutar))} <span style="font-size:11px;">TL</span></p>
          </td>
          <td width="33%" style="padding-left:12px;border-left:1px solid rgba(201,168,76,0.12);">
            <p style="margin:0;font-size:11px;color:#8B6914;">Net</p>
            <p style="margin:4px 0 0;font-size:22px;font-weight:300;color:#1A1410;">${ia(adet)-ia(i_adet)} <span style="font-size:12px;color:#6A6460;">adet</span></p>
            <p style="margin:2px 0 0;font-size:13px;color:#1A1410;">${fmt(fa(tutar)-fa(i_tutar))} <span style="font-size:11px;color:#6A6460;">TL</span></p>
          </td>` : ''}
        </tr></table>
      </td></tr>`
  }

  const html = `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Roberto Bravo — Günlük Satış Raporu</title></head>
<body style="margin:0;padding:0;background:#F8F5F0;font-family:'Georgia',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F5F0;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="padding:48px 48px 32px;background:#FFFFFF;border-bottom:1px solid rgba(201,168,76,0.15);">
    <p style="margin:0 0 8px;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#7A7570;">Roberto Bravo</p>
    <h1 style="margin:0 0 4px;font-size:36px;font-weight:300;color:#1A1410;letter-spacing:-0.5px;">Günlük Rapor</h1>
    <p style="margin:0;font-size:13px;color:#6A6460;">${tarih}</p>
  </td></tr>

  <!-- Aylık Net -->
  <tr><td style="padding:32px 48px;background:linear-gradient(135deg,#1A1610,#120F0C);border-bottom:1px solid rgba(201,168,76,0.1);">
    <p style="margin:0 0 18px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;">${ay_label || ''} — Aylık Net (İade Düşülmüş)</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="${ia(ay_iade_adet) > 0 ? '34%' : '50%'}" style="padding-right:16px;">
        <p style="margin:0 0 4px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#7A7570;">Net Satış</p>
        <p style="margin:0;font-size:44px;font-weight:300;color:#C9A84C;line-height:1;">${ay_net_adet || 0}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#7A7570;">adet</p>
      </td>
      <td width="${ia(ay_iade_adet) > 0 ? '33%' : '50%'}" style="padding-left:16px;border-left:1px solid rgba(201,168,76,0.1);">
        <p style="margin:0 0 4px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#7A7570;">Net Ciro</p>
        <p style="margin:0;font-size:44px;font-weight:300;color:#C9A84C;line-height:1;">${fmt(ay_net_tutar || 0)}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#7A7570;">TL (KDV Dahil)</p>
      </td>
      ${ia(ay_iade_adet) > 0 ? `
      <td width="33%" style="padding-left:16px;border-left:1px solid rgba(168,48,64,0.2);">
        <p style="margin:0 0 4px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#C4364A;">Toplam İade</p>
        <p style="margin:0;font-size:44px;font-weight:300;color:#C4364A;line-height:1;">${ay_iade_adet}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#C4364A;">${fmt(ay_iade_tutar || 0)} TL</p>
      </td>` : ''}
    </tr></table>
  </td></tr>

  <!-- Bugün Net -->
  <tr><td style="padding:28px 48px;background:#F4EFE8;border-bottom:1px solid rgba(139,105,20,0.15);">
    <p style="margin:0 0 14px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#8B6914;">Bugün</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="${hasIade ? '34%' : '50%'}">
        <p style="margin:0 0 4px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#7A7570;">Net Satış</p>
        <p style="margin:0;font-size:40px;font-weight:300;color:#1A1410;line-height:1;">${net_adet || 0}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#7A7570;">adet</p>
      </td>
      <td width="${hasIade ? '33%' : '50%'}" style="padding-left:16px;border-left:1px solid rgba(139,105,20,0.15);">
        <p style="margin:0 0 4px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#7A7570;">Net Ciro</p>
        <p style="margin:0;font-size:40px;font-weight:300;color:#1A1410;line-height:1;">${fmt(net_tutar || 0)}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#7A7570;">TL (KDV Dahil)</p>
      </td>
      ${hasIade ? `
      <td width="33%" style="padding-left:16px;border-left:1px solid rgba(168,48,64,0.2);">
        <p style="margin:0 0 4px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#C4364A;">İade</p>
        <p style="margin:0;font-size:40px;font-weight:300;color:#C4364A;line-height:1;">${iade_adet}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#C4364A;">${fmt(iade_tutar || 0)} TL</p>
      </td>` : ''}
    </tr></table>
  </td></tr>

  ${kanalSatir('Trendyol', '#8B6914', trendyol_adet, trendyol_tutar, iade_trendyol_adet, iade_trendyol_tutar)}
  ${kanalSatir('robertobravo.com', '#4A4540', site_rb_adet, site_rb_tutar, iade_rb_adet, iade_rb_tutar)}
  ${kanalSatir('935byrobertobravo.com', '#7A8A9A', site_935_adet, site_935_tutar, iade_935_adet, iade_935_tutar)}

  ${durum ? `
  <tr><td style="padding:28px 48px;background:#FFFFFF;border-bottom:1px solid rgba(201,168,76,0.06);">
    <p style="margin:0 0 12px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#6A6460;">Durum Notu</p>
    <p style="margin:0;font-size:13px;color:#4A4540;line-height:1.7;">${durum.replace(/\n/g, '<br>')}</p>
  </td></tr>` : ''}

  <!-- Footer -->
  <tr><td style="padding:24px 48px;background:#1A1410;">
    <p style="margin:0;font-size:10px;color:#9A9590;letter-spacing:2px;text-transform:uppercase;">Roberto Bravo — ${tarih}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

  try {
    const transporter = nodemailer.createTransport({
      host: 'mail-eu.smtp2go.com',
      port: 587,
      secure: false,
      auth: { user: '935byrobertobravo.com', pass: 'p79UAVZXh3x64NKk' }
    })
    await transporter.sendMail({
      from: '"Roberto Bravo" <rapor@935byrobertobravo.com>',
      to: mail_to,
      subject: `Roberto Bravo — Günlük Rapor · ${tarih}`,
      html
    })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Mail hatası:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
