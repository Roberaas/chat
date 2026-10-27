import { NextResponse } from 'next/server'
import { apiGuard } from '@/lib/crm/auth'
import { messagingStatus } from '@/lib/crm/messaging'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await apiGuard('campaigns.read')
  if ('res' in g) return g.res
  return NextResponse.json({ ok: true, channels: messagingStatus(), optout: !!process.env.CRM_OPTOUT_SECRET, iys: !!process.env.CRM_IYS_WEBHOOK_URL })
}
