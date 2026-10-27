export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ')
}

// Sadece tarih: 20 Haz 2026
export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Tarih + saat: 20 Haz 2026, 14:35
export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' + dt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

// Kısa tarih+saat: 20.06.2026 14:35
export function fmtDateTimeShort(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + dt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

// Göreceli: Az önce, 5dk önce, 2sa önce, dün 14:35, 20 Haz 14:35
export function fmtRelative(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d)
  const now = new Date()
  const diffMs = now.getTime() - dt.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr  = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1)   return 'Az önce'
  if (diffMin < 60)  return `${diffMin}dk önce`
  if (diffHr  < 24)  return `${diffHr}sa önce · ${dt.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}`
  if (diffDay === 1) return `Dün ${dt.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}`
  if (diffDay < 7)   return `${dt.toLocaleDateString('tr-TR',{day:'numeric',month:'short'})} ${dt.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}`
  return fmtDateTime(d)
}

// Deadline için: "20 Haz, 14:35" veya sadece tarihse "20 Haz 2026"
export function fmtDeadline(d: string | null | undefined): string {
  if (!d) return '—'
  // Sadece tarih mi (YYYY-MM-DD)?
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return new Date(d + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  return fmtDateTime(d)
}
