import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const thread_ts = searchParams.get('thread_ts')
  const token = process.env.SLACK_BOT_TOKEN
  const channel = process.env.SLACK_CHANNEL_ID || 'C09FB0QLDMH'

  if (!token || !thread_ts) {
    return NextResponse.json({ messages: [] })
  }

  const res = await fetch(
    `https://slack.com/api/conversations.replies?channel=${channel}&ts=${thread_ts}&limit=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()

  if (!data.ok) {
    return NextResponse.json({ messages: [], error: data.error })
  }

  const messages = (data.messages || []).map((m: any) => {
    // blocks'tan gerçek metni çıkar
    let text = m.text || ''
    if (m.blocks?.length) {
      const parts: string[] = []
      for (const block of m.blocks) {
        if (block.type === 'rich_text') {
          for (const section of block.elements || []) {
            for (const el of section.elements || []) {
              if (el.type === 'text') parts.push(el.text)
            }
          }
        } else if (block.type === 'section' && block.text?.text) {
          parts.push(block.text.text)
        }
      }
      if (parts.length) text = parts.join('')
    }

    // Admin tespiti: username veya bot_profile.name 'admin' içeriyorsa admin
    const username = m.username || m.bot_profile?.name || ''
    const isAdmin = username === 'roberto-admin' || username.toLowerCase().includes('admin')

    return {
      ts: m.ts,
      text,
      user: m.user || m.bot_id || 'unknown',
      is_bot: !!m.bot_id,
      username,
      is_admin: isAdmin,
      _debug: { raw_username: m.username, bot_profile: m.bot_profile?.name, subtype: m.subtype },
    }
  })

  return NextResponse.json({ messages })
}

export async function POST(req: Request) {
  const { thread_ts, text } = await req.json()
  const token = process.env.SLACK_BOT_TOKEN
  const channel = process.env.SLACK_CHANNEL_ID || 'C09FB0QLDMH'

  if (!token || !thread_ts || !text) {
    return NextResponse.json({ ok: false, error: 'Eksik parametre' })
  }

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel,
      thread_ts,
      text,
      username: 'roberto-admin',
    }),
  })

  const data = await res.json()
  return NextResponse.json({ ok: data.ok, error: data.error })
}
