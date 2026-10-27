import { Users, Store, ShieldCheck, UserCog } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import StatCard from '@/components/StatCard'
import { requireCrm } from '@/lib/crm/auth'
import { createCrmServerClient } from '@/lib/crm/supabase/server'
import { ROLE_LABEL } from '@/lib/crm/types'

export default async function CrmDashboard() {
  const ctx = await requireCrm('dashboard.read')
  const db = createCrmServerClient()
  // RLS: kullanıcı yalnızca erişebildiği mağaza/kullanıcıları sayar
  const [stores, users] = await Promise.all([
    db.from('stores').select('id', { count: 'exact', head: true }).eq('is_active', true),
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ])
  const name = `${ctx.profile.first_name} ${ctx.profile.last_name}`

  return (
    <>
      <CrmTopBar title="Dashboard" subtitle={name} />
      <div style={{ padding: 22, maxWidth: 1200, width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 18 }}>
          <StatCard label="Erişilebilir Mağaza" value={stores.count ?? 0} sub="aktif" Icon={Store} accent="var(--ac)" />
          <StatCard label="Aktif Kullanıcı" value={users.count ?? 0} sub="görebildiğiniz" Icon={Users} accent="var(--green)" />
          <StatCard label="Rol" value={ctx.roles.length} sub={ctx.roles.map(r => ROLE_LABEL[r] || r).join(', ') || '—'} Icon={ShieldCheck} accent="var(--blue)" />
          <StatCard label="Yetki" value={ctx.isSuperAdmin ? 'Tümü' : ctx.permissions.length} sub={ctx.scope === 'all' ? 'tüm mağazalar' : ctx.scope === 'stores' ? 'mağaza bazlı' : 'kendi portföyü'} Icon={UserCog} accent="var(--amber)" />
        </div>
        <div className="card" style={{ padding: 22 }}>
          <p className="card-title" style={{ marginBottom: 6 }}>CRM kurulum aşaması</p>
          <p style={{ fontSize: 13, color: 'var(--tx2)', lineHeight: 1.7 }}>
            Kullanıcı, rol ve mağaza altyapısı hazır. Müşteri, satış fırsatı, görev ve raporlama modülleri
            tamamlandıkça bu sayfa gerçek veritabanı sorgularıyla dolacak; veri yokken sıfır gösterilir.
          </p>
        </div>
      </div>
    </>
  )
}
