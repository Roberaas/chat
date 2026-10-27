'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Contact, ShoppingBag, Gem, Target, Building2, CornerDownRight } from 'lucide-react'
import { useCrm } from '@/components/crm/CrmProvider'
import { crmNavFor } from '@/lib/crm/nav'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type R = { kind: string; id: string; title: string; sub: string; link: string }
const norm = (s: string) => s.toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
const KIND: Record<string, [string, any]> = { page: ['Sayfalar', CornerDownRight], customer: ['Müşteriler', Contact], order: ['Siparişler', ShoppingBag], product: ['Ürünler', Gem], opportunity: ['Fırsatlar', Target], b2b: ['B2B firmalar', Building2] }

export default function CrmSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const crm = useCrm()
  const [recs, setRecs] = useState<R[]>([])
  const pages: R[] = crmNavFor(crm).flatMap(g => g.items.map(it => ({ kind: 'page', id: it.href, title: it.label, sub: g.g, link: it.href })))
  const nq = norm(q.trim())
  const pageHits = nq ? pages.filter(p => norm(p.title + ' ' + p.sub).includes(nq)).slice(0, 6) : pages.slice(0, 8)
  const rows = [...pageHits, ...recs]
  const [i, setI] = useState(0)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => !o) }
      else if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])
  useEffect(() => { if (open) { setQ(''); setRecs([]); setI(0); setTimeout(() => ref.current?.focus(), 30) } }, [open])
  useEffect(() => {
    if (q.trim().length < 2) { setRecs([]); return }
    setBusy(true)
    const t = setTimeout(async () => {
      const { data } = await createCrmBrowserClient().rpc('global_search', { p_q: q })
      setRecs((data || []) as R[]); setI(0); setBusy(false)
    }, 220)
    return () => clearTimeout(t)
  }, [q])

  const go = (r: R) => { setOpen(false); router.push(r.link) }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(rows.length - 1, x + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(0, x - 1)) }
    else if (e.key === 'Enter' && rows[i]) go(rows[i])
  }
  let last = ''
  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(true)} style={{ gap: 8, color: 'var(--tx3)', padding: '6px 12px' }} aria-label="Ara">
        <Search size={14} /><span className="hide-sm">Ara</span><kbd className="hide-sm" style={{ fontSize: 11, border: '1px solid var(--bdr2)', borderRadius: 5, padding: '0 5px', color: 'var(--tx3)', fontFamily: 'inherit' }}>Ctrl K</kbd>
      </button>
      <style>{`@media(max-width:700px){.hide-sm{display:none!important}}`}</style>
      {open && (
        <div className="overlay" style={{ alignItems: 'flex-start', paddingTop: '12vh' }} onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="modal anim-pop" style={{ maxWidth: 600, padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--bdr)' }}>
              <Search size={16} style={{ color: 'var(--tx3)' }} />
              <input ref={ref} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey} placeholder="Sayfa, müşteri, sipariş, ürün, fırsat veya firma ara" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--tx)', fontSize: 15 }} />
              <kbd style={{ fontSize: 11, color: 'var(--tx3)' }}>Esc</kbd>
            </div>
            <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
              {q.trim().length < 2 && <div style={{ padding: '10px 18px 0', fontSize: 12, color: 'var(--tx3)' }}>Sayfa adı yazın ya da ad, telefon, e-posta, sipariş no, stok kodu ile kayıt arayın. Oklarla seçin, Enter ile açın.</div>}
              {q.trim().length >= 2 && !busy && rows.length === 0 && <div style={{ padding: 26, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>"{q}" için sonuç yok. Yazımı kontrol edin veya erişiminiz olmayan bir kayıt olabilir.</div>}
              {rows.map((r, n) => {
                const [label, Icon] = KIND[r.kind] || [r.kind, Search]
                const head = r.kind !== last; last = r.kind
                return (
                  <div key={r.kind + r.id}>
                    {head && <div style={{ padding: '10px 18px 4px', fontSize: 12, color: 'var(--tx3)' }}>{label}</div>}
                    <div onClick={() => go(r)} onMouseEnter={() => setI(n)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 18px', cursor: 'pointer', background: i === n ? 'var(--s3)' : 'transparent' }}>
                      <Icon size={15} style={{ color: 'var(--tx3)' }} />
                      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, color: 'var(--tx)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>{r.sub && <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{r.sub}</div>}</div>
                    </div>
                  </div>)
              })}
            </div>
          </div>
        </div>)}
    </>
  )
}
