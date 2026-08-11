import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const thread_ts = searchParams.get('thread_ts')
  const token = process.env.SLACK_BOT_TOKEN
  const channel = process.env.SLACK_CHANNEL_ID || 'C09FB0QLDMH'

  const res = await fetch(
    `https://slack.com/api/conversations.replies?channel=${channel}&ts=${thread_ts}&limit=10`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()

  // Ham veriyi döndür
  const raw = (data.messages || []).map((m: any) => ({
    ts: m.ts,
    text: m.text,
    username: m.username,
    user: m.user,
    bot_id: m.bot_id,
    subtype: m.subtype,
    blocks: m.blocks,
  }))

  return NextResponse.json({ raw })
}
