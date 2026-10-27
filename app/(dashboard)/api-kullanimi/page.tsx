'use client'
import { useEffect, useState } from 'react'
import TopBar from '@/components/TopBar'
import StatCard from '@/components/StatCard'

type Gun = { tarih: string; usd: number }
const nf = (n: number) => n.toLocaleString('tr-TR')

export default function ApiKullanimiPage() {
  const [d, setD] = useState<any>(null)
  const [load, setLoad] = useState(true)
  useEffect(() => { fetch('/api/kullanim').then(r => r.json()).then(setD).finally(() => setLoad(false)) }, [])
  const o = d?.openai, n = d?.netgsm
  const gunler: Gun[] = o?.gunler || []
  const max = Math.max(0.0001, ...gunler.map(g => g.usd))
  const bugun = gunler[gunler.length - 1]?.usd || 0
  const ay = new Date().toISOString().slice(0, 7)
  const ayToplam = gunler.filter(g => g.tarih.startsWith(ay)).reduce((s, g) => s + g.usd, 0)
  const limit = o?.aylik_limit_usd as number | null
  return (
    <>
      <TopBar title="API Kullanımı" subtitle="OpenAI harcaması ve SMS bakiyesi" />
      <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {load && <div style={{ color: 'var(--tx3)' }}>Yükleniyor…</div>}
        {!load && !o?.yapilandirildi && (
          <div className="card" style={{ padding: 18, fontSize: 13.5 }}>
            OpenAI verisi için Vercel&apos;e <b>OPENAI_ADMIN_KEY</b> (platform.openai.com → Settings → Admin keys, salt okunur) ekleyin.
            İsteğe bağlı: <b>OPENAI_AYLIK_LIMIT_USD</b> ile aylık bütçe çubuğu gösterilir.
          </div>
        )}
        {o?.hata && <div className="toast toast-err" style={{ margin: 0 }}>OpenAI: {o.hata}</div>}
        {o?.yapilandirildi && !o.hata && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
              <StatCard label="Bugün" value={`$${bugun.toFixed(2)}`} />
              <StatCard label="Bu ay" value={`$${ayToplam.toFixed(2)}`} />
              <StatCard label="Son 30 gün" value={`$${o.toplam_usd.toFixed(2)}`} />
              <StatCard label="İstek (30 gün)" value={nf(o.istek)} />
              <StatCard label="Girdi / çıktı token" value={`${nf(o.girdi)} / ${nf(o.cikti)}`} />
            </div>
            {limit && (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 13, marginBottom: 8 }}>Aylık bütçe: ${ayToplam.toFixed(2)} / ${limit} ({Math.round(ayToplam / limit * 100)}%)</div>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--bg3, #2a2a35)' }}>
                  <div style={{ width: `${Math.min(100, ayToplam / limit * 100)}%`, height: 8, borderRadius: 4, background: ayToplam / limit > .8 ? '#ef4444' : 'var(--ac, #7c6af7)' }} />
                </div>
              </div>
            )}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Günlük harcama (USD)</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
                {gunler.map(g => (
                  <div key={g.tarih} title={`${g.tarih}: $${g.usd.toFixed(2)}`} style={{ flex: 1, height: `${Math.max(2, g.usd / max * 100)}%`, background: 'var(--ac, #7c6af7)', borderRadius: 2 }} />
                ))}
              </div>
            </div>
          </>
        )}
        {n?.yapilandirildi && (
          <div className="card" style={{ padding: 16, fontSize: 13.5 }}>
            <b>Netgsm bakiye yanıtı:</b> <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{n.ham || n.hata}</span>
          </div>
        )}
      </div>
    </>
  )
}
