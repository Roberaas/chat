import { redirect } from 'next/navigation'
import CrmShell from '@/components/crm/CrmShell'
import { getCrmContext } from '@/lib/crm/auth'

// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

export const dynamic = 'force-dynamic'

// Hesap sayfaları: MFA zorunluluğundan muaf (kayıt buradan yapılır)
export default async function CrmAccountLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCrmContext()
  if (!ctx) redirect('/crm/login')
  if (!ctx.profile.is_active) redirect('/crm/login?e=pasif')
  if (ctx.profile.must_change_password) redirect('/crm/sifre')
  return <CrmShell ctx={ctx}>{children}</CrmShell>
}
