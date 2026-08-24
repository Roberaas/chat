export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim().toLowerCase()
  if (!q || q.length < 2) return NextResponse.json({ sonuclar: [] })

  const sonuclar: any[] = []

  // Paralel ara
  const [sessions, aboneler, gorevler, notlar, aramalar] = await Promise.all([
    db().from('wa_sessions_roberto').select('phone, musteri_yazdigi, last_intent, updated_at').ilike('phone', `%${q}%`).limit(5),
    db().from('abonelik').select('id, ad, soyad, iletisim, durum, haftalik_adet').or(`ad.ilike.%${q}%,soyad.ilike.%${q}%,iletisim.ilike.%${q}%`).limit(5),
    db().from('gorevler').select('id, baslik, aciklama, durum, oncelik').or(`baslik.ilike.%${q}%,aciklama.ilike.%${q}%`).limit(5),
    db().from('musteri_notlari').select('id, telefon, icerik, created_at').ilike('icerik', `%${q}%`).limit(3),
    db().from('arama_logu').select('id, telefon, musteri_adi, notlar').or(`musteri_adi.ilike.%${q}%,telefon.ilike.%${q}%`).limit(3),
  ])

  // WhatsApp
  for (const s of sessions.data || []) {
    sonuclar.push({ tip: 'musteri', id: s.phone, baslik: s.phone, alt: s.musteri_yazdigi || s.last_intent || '', link: '/konusmalar', meta: s.updated_at })
  }

  // Abonelik
  for (const a of aboneler.data || []) {
    sonuclar.push({ tip: 'abonelik', id: a.id, baslik: `${a.ad} ${a.soyad}`.trim(), alt: `${a.iletisim} · ${a.haftalik_adet} adet · ${a.durum}`, link: '/abonelikler', meta: a.durum })
  }

  // Görev
  for (const g of gorevler.data || []) {
    sonuclar.push({ tip: 'gorev', id: g.id, baslik: g.baslik, alt: g.aciklama || g.durum, link: '/calisma', meta: g.oncelik })
  }

  // Not
  for (const n of notlar.data || []) {
    sonuclar.push({ tip: 'not', id: n.id, baslik: n.icerik.slice(0, 60), alt: n.telefon, link: '/konusmalar', meta: n.created_at })
  }

  // Arama logu
  for (const a of aramalar.data || []) {
    sonuclar.push({ tip: 'arama', id: a.id, baslik: a.musteri_adi || a.telefon, alt: a.notlar || a.telefon, link: '/calisma', meta: '' })
  }

  return NextResponse.json({ sonuclar })
}
