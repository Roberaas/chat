import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createHash } from 'crypto'

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function hashSifre(sifre: string): string {
  return createHash('sha256').update(sifre + 'roberto-salt-2024').digest('hex')
}

const ROL_YETKILER: Record<string, string[]> = {
  admin: ['tum_sayfalar'],
  operasyon: ['/', '/siparisler', '/musteriler', '/satis', '/abonelikler', '/odemeler', '/muhasebe', '/harita', '/calisma', '/raporlar'],
  destek: ['/', '/konusmalar', '/canli-destek', '/calisma'],
}

export async function POST(req: Request) {
  const { kullanici_adi, sifre } = await req.json()
  if (!kullanici_adi || !sifre) {
    return NextResponse.json({ ok: false, error: 'Kullanıcı adı ve şifre gerekli' })
  }

  const hashedSifre = hashSifre(sifre)

  // Önce hash ile dene, sonra düz metin (geçiş dönemi)
  let { data: kullanici } = await db()
    .from('kullanicilar')
    .select('*')
    .eq('kullanici_adi', kullanici_adi)
    .eq('sifre_hash', hashedSifre)
    .eq('aktif', true)
    .single()

  // Düz metin şifre ile dene (eski kayıtlar için)
  if (!kullanici) {
    const { data: eski } = await db()
      .from('kullanicilar')
      .select('*')
      .eq('kullanici_adi', kullanici_adi)
      .eq('sifre_hash', sifre)
      .eq('aktif', true)
      .single()
    
    if (eski) {
      // Şifreyi hash'e çevir
      await db().from('kullanicilar').update({ sifre_hash: hashedSifre }).eq('id', eski.id)
      kullanici = eski
    }
  }

  if (!kullanici) {
    return NextResponse.json({ ok: false, error: 'Hatalı kullanıcı adı veya şifre' })
  }

  await db().from('kullanicilar').update({ son_giris: new Date().toISOString() }).eq('id', kullanici.id)
  await db().from('aktivite_log').insert({
    kullanici_adi: kullanici.kullanici_adi,
    kullanici_ad: kullanici.ad,
    aksiyon: 'giris',
    sayfa: '/login',
    detay: 'Sisteme giriş yapıldı'
  })

  const yetkiler = kullanici.rol === 'admin' ? ROL_YETKILER.admin : (ROL_YETKILER[kullanici.rol] || ROL_YETKILER.destek)
  const cookieStore = await cookies()
  cookieStore.set('roberto-auth', JSON.stringify({
    id: kullanici.id, ad: kullanici.ad,
    kullanici_adi: kullanici.kullanici_adi,
    rol: kullanici.rol, yetkiler,
  }), { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 8, path: '/' })

  return NextResponse.json({ ok: true, kullanici: { ad: kullanici.ad, rol: kullanici.rol, yetkiler } })
}

export async function GET() {
  const cookieStore = await cookies()
  const auth = cookieStore.get('roberto-auth')
  if (!auth) return NextResponse.json({ ok: false })
  try {
    const data = JSON.parse(auth.value)
    return NextResponse.json({ ok: true, kullanici: data })
  } catch {
    return NextResponse.json({ ok: false })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  const auth = cookieStore.get('roberto-auth')
  if (auth) {
    try {
      const data = JSON.parse(auth.value)
      await db().from('aktivite_log').insert({
        kullanici_adi: data.kullanici_adi, kullanici_ad: data.ad,
        aksiyon: 'cikis', sayfa: '/login', detay: 'Sistemden çıkış yapıldı'
      })
    } catch {}
  }
  cookieStore.delete('roberto-auth')
  return NextResponse.json({ ok: true })
}
