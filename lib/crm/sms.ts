import { createCrmAdminClient } from '@/lib/crm/supabase/admin'

export const normPhone = (x: string) => x.replace(/\D/g, '').replace(/^90/, '').replace(/^0/, '')

// Netgsm GET (2FA ile aynı kanal). Başarılı ise true.
export async function sendSms(rawPhone: string, message: string): Promise<boolean> {
  const p = normPhone(rawPhone)
  if (!/^\d{10}$/.test(p)) return false
  const url = `https://api.netgsm.com.tr/sms/send/get/?usercode=${encodeURIComponent(process.env.NETGSM_USERCODE || '')}&password=${encodeURIComponent(process.env.NETGSM_PASSWORD || '')}&gsmno=${p}&message=${encodeURIComponent(message)}&msgheader=${encodeURIComponent(process.env.NETGSM_MSGHEADER || '')}`
  try {
    const txt = (await (await fetch(url)).text()).trim()
    if (!/^0[0-9]/.test(txt)) { console.error('Netgsm mağaza:', txt); return false }
    return true
  } catch (e) { console.error('SMS hatası:', e); return false }
}

export const adminCrm = () => createCrmAdminClient()
