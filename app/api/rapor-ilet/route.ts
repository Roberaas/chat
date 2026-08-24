export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: Request) {
  const {
    trendyol_adet, trendyol_tutar, site_rb_adet, site_rb_tutar, site_935_adet, site_935_tutar,
    durum, mail_to, tarih, ay_label,
    ay_trendyol_adet, ay_trendyol_tutar, ay_rb_adet, ay_rb_tutar, ay_935_adet, ay_935_tutar,
    ay_toplam_adet, ay_toplam_tutar
  } = await req.json()

  const total_adet = (parseInt(trendyol_adet) || 0) + (parseInt(site_rb_adet) || 0) + (parseInt(site_935_adet) || 0)
  const total_tutar = (parseFloat(trendyol_tutar) || 0) + (parseFloat(site_rb_tutar) || 0) + (parseFloat(site_935_tutar) || 0)
  const fmt = (n: number) => Number(n).toLocaleString('tr-TR')

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Roberto Bravo — Günlük Satış Raporu</title>
</head>
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

      <!-- Aylık Kümülatif -->
      <tr><td style="padding:32px 48px;background:linear-gradient(135deg,#1A1610,#120F0C);border-bottom:1px solid rgba(201,168,76,0.1);">
        <p style="margin:0 0 18px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;">${ay_label || ''} — Aylık Toplam (Bugün Dahil)</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%" style="padding-right:16px;">
              <p style="margin:0 0 4px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#7A7570;">Toplam Satış</p>
              <p style="margin:0;font-size:48px;font-weight:300;color:#C9A84C;line-height:1;">${ay_toplam_adet || total_adet}</p>
              <p style="margin:4px 0 0;font-size:11px;color:#7A7570;">adet</p>
            </td>
            <td width="50%" style="padding-left:16px;border-left:1px solid rgba(201,168,76,0.1);">
              <p style="margin:0 0 4px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#7A7570;">Toplam Ciro</p>
              <p style="margin:0;font-size:48px;font-weight:300;color:#C9A84C;line-height:1;">${fmt(ay_toplam_tutar || total_tutar)}</p>
              <p style="margin:4px 0 0;font-size:11px;color:#7A7570;">TL (KDV Dahil)</p>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Bugün -->
      <tr><td style="padding:28px 48px;background:#F4EFE8;border-bottom:1px solid rgba(139,105,20,0.15);">
        <p style="margin:0 0 14px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#8B6914;">Bugün</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%">
              <p style="margin:0 0 4px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#7A7570;">Satış</p>
              <p style="margin:0;font-size:40px;font-weight:300;color:#1A1410;line-height:1;">${total_adet}</p>
              <p style="margin:4px 0 0;font-size:11px;color:#7A7570;">adet</p>
            </td>
            <td width="50%" style="padding-left:16px;border-left:1px solid rgba(139,105,20,0.15);">
              <p style="margin:0 0 4px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#7A7570;">Ciro</p>
              <p style="margin:0;font-size:40px;font-weight:300;color:#1A1410;line-height:1;">${fmt(total_tutar)}</p>
              <p style="margin:4px 0 0;font-size:11px;color:#7A7570;">TL (KDV Dahil)</p>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Trendyol -->
      <tr><td style="padding:28px 48px;background:#FFFFFF;border-bottom:1px solid rgba(201,168,76,0.06);">
        <p style="margin:0 0 16px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#8B6914;">Trendyol</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%">
              <p style="margin:0;font-size:11px;color:#7A7570;">Bugün Satış</p>
              <p style="margin:4px 0 0;font-size:24px;font-weight:300;color:#1A1410;">${trendyol_adet || '0'} <span style="font-size:13px;color:#6A6460;">adet</span></p>
            </td>
            <td width="50%">
              <p style="margin:0;font-size:11px;color:#7A7570;">Bugün Ciro</p>
              <p style="margin:4px 0 0;font-size:24px;font-weight:300;color:#1A1410;">${fmt(parseFloat(trendyol_tutar) || 0)} <span style="font-size:13px;color:#6A6460;">TL</span></p>
            </td>
          </tr>
          <tr><td colspan="2" style="padding-top:10px;">
            <p style="margin:0;font-size:10px;color:#9A9590;">Aylık: ${ay_trendyol_adet || 0} adet / ${fmt(ay_trendyol_tutar || 0)} TL</p>
          </td></tr>
        </table>
      </td></tr>

      <!-- Site RB -->
      <tr><td style="padding:28px 48px;background:#FFFFFF;border-bottom:1px solid rgba(201,168,76,0.06);">
        <p style="margin:0 0 16px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#4A4540;">robertobravo.com</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%">
              <p style="margin:0;font-size:11px;color:#7A7570;">Bugün Satış</p>
              <p style="margin:4px 0 0;font-size:24px;font-weight:300;color:#1A1410;">${site_rb_adet || '0'} <span style="font-size:13px;color:#6A6460;">adet</span></p>
            </td>
            <td width="50%">
              <p style="margin:0;font-size:11px;color:#7A7570;">Bugün Ciro</p>
              <p style="margin:4px 0 0;font-size:24px;font-weight:300;color:#1A1410;">${fmt(parseFloat(site_rb_tutar) || 0)} <span style="font-size:13px;color:#6A6460;">TL</span></p>
            </td>
          </tr>
          <tr><td colspan="2" style="padding-top:10px;">
            <p style="margin:0;font-size:10px;color:#9A9590;">Aylık: ${ay_rb_adet || 0} adet / ${fmt(ay_rb_tutar || 0)} TL</p>
          </td></tr>
        </table>
      </td></tr>

      <!-- Site 935 -->
      <tr><td style="padding:28px 48px;background:#FFFFFF;border-bottom:1px solid rgba(201,168,76,0.06);">
        <p style="margin:0 0 16px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#7A8A9A;">935byrobertobravo.com</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%">
              <p style="margin:0;font-size:11px;color:#7A7570;">Bugün Satış</p>
              <p style="margin:4px 0 0;font-size:24px;font-weight:300;color:#1A1410;">${site_935_adet || '0'} <span style="font-size:13px;color:#6A6460;">adet</span></p>
            </td>
            <td width="50%">
              <p style="margin:0;font-size:11px;color:#7A7570;">Bugün Ciro</p>
              <p style="margin:4px 0 0;font-size:24px;font-weight:300;color:#1A1410;">${fmt(parseFloat(site_935_tutar) || 0)} <span style="font-size:13px;color:#6A6460;">TL</span></p>
            </td>
          </tr>
          <tr><td colspan="2" style="padding-top:10px;">
            <p style="margin:0;font-size:10px;color:#9A9590;">Aylık: ${ay_935_adet || 0} adet / ${fmt(ay_935_tutar || 0)} TL</p>
          </td></tr>
        </table>
      </td></tr>

      ${durum ? `<!-- Durum -->
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
