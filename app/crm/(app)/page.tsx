import CrmTopBar from '@/components/crm/CrmTopBar'
import CrmDashboard from '@/components/crm/CrmDashboard'
import { requireCrm } from '@/lib/crm/auth'

// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

export default async function CrmHome() {
  const ctx = await requireCrm('dashboard.read')
  return (
    <>
      <CrmTopBar title="Dashboard" subtitle={`${ctx.profile.first_name} ${ctx.profile.last_name}`} />
      <CrmDashboard />
    </>
  )
}
