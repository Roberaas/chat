'use client'
import { getSessions } from '@/lib/sessionsApi'
import { useEffect, useState } from 'react'

export type Me = { ad: string; rol: string; kullanici_adi?: string } | null

export function useMe() {
  const [me, setMe] = useState<Me>(null)
  useEffect(() => {
    fetch('/api/auth').then(r => r.json()).then(d => {
      if (d.ok && d.kullanici) setMe(d.kullanici)
    }).catch(() => {})
  }, [])
  return me
}

// Sidebar rozetleri: bugünkü konuşma sayısı + canlı destek kuyruğu
export function useCounts() {
  const [canli, setCanli] = useState(0)
  const [konusmalar, setKonusmalar] = useState(0)
  useEffect(() => {
    async function load() {
      const { data } = await getSessions('view=mini')
      const s = data || []
      setCanli(s.filter((x: any) => x.bulundugu_menu === 'canli').length)
      setKonusmalar(s.filter((x: any) => new Date(x.updated_at).toDateString() === new Date().toDateString()).length)
    }
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])
  return { canli, konusmalar }
}

export async function logout() {
  await fetch('/api/auth', { method: 'DELETE' })
  window.location.href = '/login?logout=1'
}
