// WhatsApp oturumlarını panel API'sinden okur/günceller (tarayıcıdan doğrudan veritabanı yok).
export async function getSessions(query = ''): Promise<{ data: any[] }> {
  try {
    const r = await fetch(`/api/sessions${query ? '?' + query : ''}`, { cache: 'no-store' })
    if (r.status === 401) { window.location.href = '/login'; return { data: [] } }
    const j = await r.json()
    return { data: j.sessions || [] }
  } catch { return { data: [] } }
}
export async function patchSession(phone: string, action: 'bildirim_gonderildi' | 'bota_don') {
  await fetch('/api/sessions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, action }) })
}
