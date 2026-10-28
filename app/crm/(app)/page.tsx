import CrmTopBar from '@/components/crm/CrmTopBar'
import CrmDashboard from '@/components/crm/CrmDashboard'
import { redirect } from 'next/navigation'
import { requireCrm } from '@/lib/crm/auth'
import { isStaffOnly } from '@/lib/crm/nav'

export default async function CrmHome() {
  const ctx = await requireCrm()
  if (isStaffOnly(ctx)) redirect('/crm/magaza-ekrani')
  await requireCrm('dashboard.read')
  return (
    <>
      <CrmTopBar title="Dashboard" subtitle={`${ctx.profile.first_name} ${ctx.profile.last_name}`} />
      <CrmDashboard />
    </>
  )
}
