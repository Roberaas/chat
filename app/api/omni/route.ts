export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

export async function GET() {
  const client = getClient()
  const { data, error } = await client
    .from('OmniSocial')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ posts: [], error: error.message })
  return NextResponse.json({ posts: data || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { brand, platform, media_url, media_type, post_type, title, caption, hashtags, scheduled_at } = body

  if (!brand || !platform || !media_url || !media_type) {
    return NextResponse.json({ error: 'Zorunlu alanlar eksik' }, { status: 400 })
  }

  const client = getClient()
  const { data, error } = await client
    .from('OmniSocial')
    .insert([{
      brand,
      platform,
      media_url,
      media_type,
      post_type: post_type || 'post',
      title: title || null,
      caption: caption || null,
      hashtags: hashtags || null,
      scheduled_at: scheduled_at || null,
      status: 'bekliyor',
    }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'ID gerekli' }, { status: 400 })

  const client = getClient()
  const { error } = await client
    .from('OmniSocial')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID gerekli' }, { status: 400 })

  const client = getClient()
  const { error } = await client.from('OmniSocial').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
