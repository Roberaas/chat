export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminDb } from '@/lib/serverDb'
import { verifySession, SESSION_COOKIE } from '@/lib/panelSession'

const ROL_YETKILER: Record<string, string[]> = {
  admin: ['tum_sayfalar'],
  operasyon: ['/', '/siparisler', '/musteriler', '/satis', '/abonelikler', '/odemeler', '/muhasebe', '/harita', '/calisma', '/raporlar'],
  destek: ['/', '/konusmalar', '/canli-destek', '/calisma'],
}

// Şifre ile doğrudan giriş kapatıldı: giriş yalnızca SMS doğrulamalı akıştan (otp-send → otp-verify) yapılır.
export async function POST() {
  return NextResponse.json({ ok: false, error: 'Bu giriş yöntemi kapatıldı. SMS doğrulamalı girişi kullanın.' }, { status: 410 })
}

export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ ok: false })
  return NextResponse.json({ ok: true, kullanici: { id: user.id, ad: user.ad, rol: user.rol, kullanici_adi: user.kullanici_adi, yetkiler: ROL_YETKILER[user.rol] || [] } })
}

export async function DELETE() {
  const cookieStore = await cookies()
  const user = await verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  if (user) {
    await adminDb().from('aktivite_log').insert({ kullanici_adi: user.kullanici_adi, kullanici_ad: user.ad, aksiyon: 'cikis', sayfa: '/login', detay: 'Sistemden çıkış yapıldı' })
  }
  cookieStore.delete(SESSION_COOKIE)
  cookieStore.delete('roberto-auth')
  return NextResponse.json({ ok: true })
}
