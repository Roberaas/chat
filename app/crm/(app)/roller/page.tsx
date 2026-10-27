import { Suspense } from 'react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import RoleEditor from '@/components/crm/RoleEditor'
import { requireCrm } from '@/lib/crm/auth'

// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

export default async function RollerPage() {
  const ctx = await requireCrm('settings.manage')
  return (
    <>
      <CrmTopBar title="Roller ve Yetkiler" subtitle="Rol oluştur, yetki ver, mağazaya bağla" />
      <Suspense fallback={null}><RoleEditor canEdit={ctx.isSuperAdmin} /></Suspense>
    </>
  )
}
