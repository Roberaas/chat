import { redirect } from 'next/navigation'
import CrmShell from '@/components/crm/CrmShell'
import { getCrmContext } from '@/lib/crm/auth'
import { createCrmServerClient } from '@/lib/crm/supabase/server'

// MFA zorunlu roller (virgülle ayrılmış, env ile genişletilebilir)
const MFA_ROLES = (process.env.CRM_MFA_ROLES || 'super_admin').split(',').map(s => s.trim()).filter(Boolean)

export const dynamic = 'force-dynamic'

export default async function CrmAppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCrmContext()
  if (!ctx) redirect('/crm/login')
  if (!ctx.profile.is_active) redirect('/crm/login?e=pasif')
  if (ctx.profile.must_change_password) redirect('/crm/sifre')
  if (ctx.roles.some(r => MFA_ROLES.includes(r))) {
    const { data } = await createCrmServerClient().auth.mfa.getAuthenticatorAssuranceLevel()
    if (data?.currentLevel !== 'aal2') {
      // Kayıtlı faktör yoksa kayda, varsa giriş doğrulamasına yönlendir
      redirect(data?.nextLevel === 'aal2' ? '/crm/login' : '/crm/guvenlik?zorunlu=1')
    }
  }
  return <CrmShell ctx={ctx}>{children}</CrmShell>
}
