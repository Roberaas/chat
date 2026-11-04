export type Kural = {
  id?: number; ad: string; anahtar_kelimeler: string[]; eslesme: 'icerir' | 'tam'
  eylem: 'sabit_cevap' | 'yonerge' | 'canliya_aktar'; cevap?: string | null; yonerge?: string | null
  aktif: boolean; oncelik: number
}

export const norm = (s: string) =>
  (s || '').toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9Ѐ-ӿ؀-ۿ ]+/g, ' ').replace(/\s+/g, ' ').trim()

export function esle(mesaj: string, kurallar: Kural[]): Kural | null {
  const m = norm(mesaj)
  if (!m) return null
  const sirali = [...kurallar].filter(k => k.aktif).sort((a, b) => a.oncelik - b.oncelik || (a.id || 0) - (b.id || 0))
  for (const k of sirali) {
    for (const kw of k.anahtar_kelimeler || []) {
      const n = norm(kw)
      if (!n) continue
      if (k.eslesme === 'tam' ? m === n : (' ' + m + ' ').includes(' ' + n + ' ') || m.includes(n)) return k
    }
  }
  return null
}

export function dogrula(b: any): { ok: true; v: any } | { ok: false; error: string } {
  const ad = String(b?.ad || '').trim().slice(0, 120)
  const kws = (Array.isArray(b?.anahtar_kelimeler) ? b.anahtar_kelimeler : String(b?.anahtar_kelimeler || '').split(/\n|,/))
    .map((x: any) => String(x).trim()).filter(Boolean).slice(0, 50)
  const eylem = b?.eylem
  if (!ad) return { ok: false, error: 'Kural adı gerekli' }
  if (!kws.length) return { ok: false, error: 'En az bir anahtar kelime/ifade gerekli' }
  if (!['sabit_cevap', 'yonerge', 'canliya_aktar'].includes(eylem)) return { ok: false, error: 'Geçersiz eylem' }
  const cevap = String(b?.cevap || '').trim().slice(0, 2000)
  const yonerge = String(b?.yonerge || '').trim().slice(0, 2000)
  if (eylem === 'sabit_cevap' && !cevap) return { ok: false, error: 'Sabit cevap metni gerekli' }
  if (eylem === 'yonerge' && !yonerge) return { ok: false, error: 'GPT yönergesi gerekli' }
  return { ok: true, v: {
    ad, anahtar_kelimeler: kws, eslesme: b?.eslesme === 'tam' ? 'tam' : 'icerir', eylem,
    cevap: eylem === 'sabit_cevap' ? cevap : null, yonerge: eylem === 'yonerge' ? yonerge : null,
    aktif: b?.aktif !== false, oncelik: Number.isFinite(+b?.oncelik) ? Math.max(1, Math.min(9999, +b.oncelik)) : 100,
  } }
}
