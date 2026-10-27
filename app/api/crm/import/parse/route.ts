import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/crm/auth'
import { parseXlsx } from '@/lib/crm/xlsx'
import { IMPORT_KINDS, autoMap, type ImportKind } from '@/lib/crm/import-config'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const MAX_BYTES = 8 * 1024 * 1024

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status })

// Dosyayı okur (kaydetmez): başlıklar, otomatik sütun eşlemesi ve satırlar döner.
export async function POST(req: NextRequest) {
  const g = await apiGuard('data.import')
  if ('res' in g) return g.res
  const form = await req.formData().catch(() => null)
  const file = form?.get('file'); const kind = String(form?.get('kind') || '') as ImportKind
  if (!IMPORT_KINDS[kind]) return bad('Geçersiz tür')
  if (!(file instanceof File)) return bad('Dosya seçin')
  if (!/\.xlsx$/i.test(file.name)) return bad('Yalnızca .xlsx dosyası yükleyin (CSV için Excel ile "Farklı kaydet → .xlsx")')
  if (file.size > MAX_BYTES) return bad('Dosya 8 MB sınırını aşıyor')
  try {
    const parsed = await parseXlsx(Buffer.from(await file.arrayBuffer()))
    if (parsed.headers.every(h => !h)) return bad('İlk satırda sütun başlıkları bulunamadı')
    if (parsed.tooMany) return bad('En fazla 20.000 satır aktarılabilir; dosyayı bölün')
    if (parsed.rows.length === 0) return bad('Dosyada veri satırı yok')
    return NextResponse.json({ ok: true, headers: parsed.headers, mapping: autoMap(parsed.headers, kind), rows: parsed.rows })
  } catch {
    return bad('Dosya okunamadı; geçerli bir .xlsx olduğundan emin olun')
  }
}
