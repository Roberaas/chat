// Basit bellek-içi hız sınırı (instance başına).
const hits = new Map<string, number[]>()
export function rateLimit(key: string, limit = 60, windowMs = 60_000) {
  const now = Date.now()
  const arr = (hits.get(key) || []).filter(t => now - t < windowMs)
  if (arr.length >= limit) { hits.set(key, arr); return false }
  arr.push(now); hits.set(key, arr)
  if (hits.size > 5000) hits.clear()
  return true
}
