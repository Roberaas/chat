import { Suspense } from 'react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import RoleEditor from '@/components/crm/RoleEditor'
import { requireCrm } from '@/lib/crm/auth'

export default async function RollerPage() {
  const ctx = await requireCrm('settings.manage')
  return (
    <>
      <CrmTopBar title="Roller ve Yetkiler" subtitle="Rol oluştur, yetki ver, mağazaya bağla" />
      <Suspense fallback={null}><RoleEditor canEdit={ctx.isSuperAdmin} /></Suspense>
    </>
  )
}
