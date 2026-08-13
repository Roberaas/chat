import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: Request) {
  const { trendyol_adet, trendyol_tutar, site_rb_adet, site_rb_tutar, site_935_adet, site_935_tutar, durum, mail_to, tarih } = await req.json()

  const total_adet = (parseInt(trendyol_adet) || 0) + (parseInt(site_rb_adet) || 0) + (parseInt(site_935_adet) || 0)
  const total_tutar = (parseFloat(trendyol_tutar) || 0) + (parseFloat(site_rb_tutar) || 0) + (parseFloat(site_935_tutar) || 0)

  const fmt = (n: number) => n.toLocaleString('tr-TR')

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Roberto Bravo — Günlük Satış Raporu</title>
</head>
<body style="margin:0;padding:0;background:#0A0805;font-family:'Georgia',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0805;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr><td style="padding:48px 48px 32px;background:#120F0C;border-bottom:1px solid rgba(201,168,76,0.15);">
        <p style="margin:0 0 8px;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#5A5550;">Roberto Bravo</p>
        <h1 style="margin:0 0 4px;font-size:36px;font-weight:300;color:#EDE8DF;letter-spacing:-0.5px;">Günlük Rapor</h1>
        <p style="margin:0;font-size:13px;color:#7A7468;">${tarih}</p>
      </td></tr>

      <!-- Toplam -->
      <tr><td style="padding:32px 48px;background:linear-gradient(135deg,#1A1610,#120F0C);border-bottom:1px solid rgba(201,168,76,0.1);">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%" style="padding-right:16px;">
              <p style="margin:0 0 4px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#5A5550;">Toplam Satış</p>
              <p style="margin:0;font-size:48px;font-weight:300;color:#C9A84C;line-height:1;">${total_adet}</p>
              <p style="margin:4px 0 0;font-size:11px;color:#5A5550;">adet</p>
            </td>
            <td width="50%" style="padding-left:16px;border-left:1px solid rgba(201,168,76,0.1);">
              <p style="margin:0 0 4px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#5A5550;">Toplam Ciro</p>
              <p style="margin:0;font-size:48px;font-weight:300;color:#C9A84C;line-height:1;">${fmt(total_tutar)}</p>
              <p style="margin:4px 0 0;font-size:11px;color:#5A5550;">TL</p>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Trendyol -->
      <tr><td style="padding:28px 48px;background:#120F0C;border-bottom:1px solid rgba(201,168,76,0.06);">
        <p style="margin:0 0 16px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;">Trendyol</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%">
              <p style="margin:0;font-size:11px;color:#5A5550;">Satış Adedi</p>
              <p style="margin:4px 0 0;font-size:24px;font-weight:300;color:#EDE8DF;">${trendyol_adet || '0'} <span style="font-size:13px;color:#7A7468;">adet</span></p>
            </td>
            <td width="50%">
              <p style="margin:0;font-size:11px;color:#5A5550;">Ciro</p>
              <p style="margin:4px 0 0;font-size:24px;font-weight:300;color:#EDE8DF;">${fmt(parseFloat(trendyol_tutar) || 0)} <span style="font-size:13px;color:#7A7468;">TL</span></p>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Site -->
      <tr><td style="padding:28px 48px;background:#120F0C;border-bottom:1px solid rgba(201,168,76,0.06);">
        <p style="margin:0 0 16px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#9A928A;">robertobravo.com</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%">
              <p style="margin:0;font-size:11px;color:#5A5550;">Satış Adedi</p>
              <p style="margin:4px 0 0;font-size:24px;font-weight:300;color:#EDE8DF;">${site_adet || '0'} <span style="font-size:13px;color:#7A7468;">adet</span></p>
            </td>
            <td width="50%">
              <p style="margin:0;font-size:11px;color:#5A5550;">Ciro</p>
              <p style="margin:4px 0 0;font-size:24px;font-weight:300;color:#EDE8DF;">${fmt(parseFloat(site_tutar) || 0)} <span style="font-size:13px;color:#7A7468;">TL</span></p>
            </td>
          </tr>
        </table>
      </td></tr>

      ${durum ? `<!-- Durum -->
      <tr><td style="padding:28px 48px;background:#120F0C;border-bottom:1px solid rgba(201,168,76,0.06);">
        <p style="margin:0 0 12px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#7A7468;">Durum Notu</p>
        <p style="margin:0;font-size:13px;color:#9A928A;line-height:1.7;">${durum.replace(/\n/g, '<br>')}</p>
      </td></tr>` : ''}

      <!-- Footer -->
      <tr><td style="padding:24px 48px;background:#0E0C0A;">
        <p style="margin:0;font-size:10px;color:#3A3530;letter-spacing:2px;text-transform:uppercase;">Roberto Bravo — ${tarih}</p>
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
