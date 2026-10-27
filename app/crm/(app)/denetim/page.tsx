import CrmTopBar from '@/components/crm/CrmTopBar'
import { requireCrm } from '@/lib/crm/auth'
import { createCrmServerClient } from '@/lib/crm/supabase/server'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

const ACTION: Record<string, string> = { INSERT: 'Oluşturma', UPDATE: 'Güncelleme', DELETE: 'Silme' }
const BADGE: Record<string, string> = { INSERT: 'badge-green', UPDATE: 'badge-blue', DELETE: 'badge-red' }

export default async function DenetimPage({ searchParams }: { searchParams: { sayfa?: string } }) {
  await requireCrm('audit.read')
  const page = Math.max(1, parseInt(searchParams.sayfa || '1') || 1)
  const size = 50
  const db = createCrmServerClient()
  const { data, count } = await db.from('audit_logs')
    .select('id, actor_id, action, table_name, record_id, created_at, old_data, new_data', { count: 'exact' })
    .order('id', { ascending: false }).range((page - 1) * size, page * size - 1)

  const ids = Array.from(new Set((data || []).map((r: any) => r.actor_id).filter(Boolean)))
  const { data: actors } = ids.length ? await db.from('profiles').select('id, first_name, last_name').in('id', ids) : { data: [] }
  const nameOf = new Map((actors || []).map((a: any) => [a.id, `${a.first_name} ${a.last_name}`]))
  const pages = Math.max(1, Math.ceil((count || 0) / size))

  return (
    <>
      <CrmTopBar title="Denetim Kaydı" subtitle={`${count ?? 0} kayıt`} />
      <div style={{ padding: 22, maxWidth: 1200, width: '100%', margin: '0 auto' }}>
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
              <thead><tr>{['Zaman', 'İşlemi Yapan', 'İşlem', 'Tablo', 'Kayıt'].map(h =>
                <th key={h} className="kpi-label" style={{ padding: '12px 18px', textAlign: 'left', marginBottom: 0, borderBottom: '1px solid var(--bdr)' }}>{h}</th>)}</tr></thead>
              <tbody>
                {(data || []).map((r: any) => (
                  <tr key={r.id}>
                    <td style={{ padding: '10px 18px', fontSize: 12, color: 'var(--tx3)', borderBottom: '1px solid var(--bdr)', fontFamily: 'JetBrains Mono, monospace' }}>{format(new Date(r.created_at), 'd MMM HH:mm:ss', { locale: tr })}</td>
                    <td style={{ padding: '10px 18px', fontSize: 13, borderBottom: '1px solid var(--bdr)' }}>{r.actor_id ? (nameOf.get(r.actor_id) || r.actor_id.slice(0, 8)) : <span style={{ color: 'var(--tx3)' }}>sistem</span>}</td>
                    <td style={{ padding: '10px 18px', borderBottom: '1px solid var(--bdr)' }}><span className={`badge ${BADGE[r.action] || 'badge-muted'}`}>{ACTION[r.action] || r.action}</span></td>
                    <td style={{ padding: '10px 18px', fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', borderBottom: '1px solid var(--bdr)' }}>{r.table_name}</td>
                    <td style={{ padding: '10px 18px', fontSize: 11.5, color: 'var(--tx3)', fontFamily: 'JetBrains Mono, monospace', borderBottom: '1px solid var(--bdr)' }}>{(r.record_id || '').slice(0, 13)}</td>
                  </tr>
                ))}
                {(data || []).length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Kayıt yok</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14, alignItems: 'center' }}>
          {page > 1 && <a className="btn-ghost" href={`/crm/denetim?sayfa=${page - 1}`}>← Önceki</a>}
          <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{page} / {pages}</span>
          {page < pages && <a className="btn-ghost" href={`/crm/denetim?sayfa=${page + 1}`}>Sonraki →</a>}
        </div>
      </div>
    </>
  )
}
