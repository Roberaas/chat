'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CRM_MODULES } from '@/lib/crm/modules'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'
import { useCrm } from './CrmProvider'

export default function ModuleToggles() {
  const crm = useCrm()
  const router = useRouter()
  const supabase = createCrmBrowserClient()
  const canEdit = crm.isSuperAdmin || crm.can('settings.manage')
  const [on, setOn] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase.from('module_settings').select('module, enabled').then(({ data }) => {
      const m: Record<string, boolean> = {}
      ;(data || []).forEach((r: { module: string; enabled: boolean }) => { m[r.module] = r.enabled })
      setOn(m)
    })
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(key: string) {
    if (!canEdit) return
    setBusy(key); setErr('')
    const next = !(on[key] ?? true)
    const { error } = await supabase.from('module_settings').upsert({ module: key, enabled: next, updated_at: new Date().toISOString() })
    setBusy('')
    if (error) { setErr(error.message); return }
    setOn({ ...on, [key]: next })
    router.refresh()
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="card-title" style={{ marginBottom: 4 }}>Modüller</div>
      <p style={{ fontSize: 12.5, color: 'var(--tx3)', marginBottom: 12, lineHeight: 1.6 }}>
        Müşteri, sipariş, ürün, B2B, cari ve içe/dışa aktarma (veri) her zaman açıktır. Aşağıdaki modüller varsayılan olarak kapalıdır; açtığınızda menüde görünür ve ilgili arka plan işleri çalışır.
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        {CRM_MODULES.map(m => {
          const enabled = on[m.key] ?? true
          return (
            <div key={m.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTop: '1px solid var(--bdr)', paddingTop: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--tx)' }}>{m.label}</div>
                <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{m.desc}</div>
              </div>
              <button className={enabled ? 'btn' : 'btn-ghost'} disabled={!canEdit || busy === m.key} onClick={() => toggle(m.key)} style={{ minWidth: 76, justifyContent: 'center' }}>
                {busy === m.key ? '…' : enabled ? 'Açık' : 'Kapalı'}
              </button>
            </div>)
        })}
      </div>
      {err && <div className="toast toast-err" style={{ margin: '10px 0 0' }}>{err}</div>}
    </div>
  )
}
