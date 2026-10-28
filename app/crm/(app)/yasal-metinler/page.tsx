import CrmTopBar from '@/components/crm/CrmTopBar'
import LegalTextsEditor from '@/components/crm/LegalTextsEditor'
import { requireCrm } from '@/lib/crm/auth'
import { createCrmServerClient } from '@/lib/crm/supabase/server'

export default async function YasalMetinlerPage() {
  await requireCrm('settings.manage')
  const { data } = await createCrmServerClient().from('legal_texts').select('code,title,body,version').order('code')
  return (
    <>
      <CrmTopBar title="Yasal Metinler" subtitle="KVKK aydınlatma ve ticari ileti izni" />
      <LegalTextsEditor initial={data || []} />
    </>
  )
}
