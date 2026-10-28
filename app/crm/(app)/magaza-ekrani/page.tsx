import CrmTopBar from '@/components/crm/CrmTopBar'
import StoreScreen from '@/components/crm/StoreScreen'
import { requireCrm } from '@/lib/crm/auth'

export default async function MagazaEkraniPage() {
  await requireCrm('customers.register')
  return (
    <>
      <CrmTopBar title="Müşteri Kaydı" subtitle="Mağaza kayıt ve arama ekranı" />
      <StoreScreen />
    </>
  )
}
