import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/crm/auth'
import { IMPORT_KINDS, type ImportKind } from '@/lib/crm/import-config'
import { buildXlsx } from '@/lib/crm/xlsx'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await apiGuard('data.import')
  if ('res' in g) return g.res
  const kind = req.nextUrl.searchParams.get('kind') as ImportKind
  const cfg = IMPORT_KINDS[kind]
  if (!cfg) return NextResponse.json({ ok: false, error: 'Geçersiz tür' }, { status: 400 })
  const buf = await buildXlsx([
    { name: cfg.label, columns: cfg.fields.map(f => ({ header: f.label + (f.required ? ' *' : ''), key: f.key, width: 22 })), rows: [Object.fromEntries(cfg.fields.map(f => [f.key, f.example]))] },
    { name: 'Açıklama', columns: [{ header: 'Sütun', key: 'a', width: 22 }, { header: 'Zorunlu', key: 'b', width: 10 }, { header: 'Not', key: 'c', width: 80 }],
      rows: [...cfg.fields.map(f => ({ a: f.label, b: f.required ? 'Evet' : 'Hayır', c: f.note || '' })), { a: '', b: '', c: 'İlk sayfanın 1. satırı başlıktır; 2. satırdaki örneği silip kendi verilerinizi yazın. En fazla 20.000 satır.' }] },
  ])
  return new NextResponse(new Uint8Array(buf), { headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="sablon-${kind}.xlsx"`, 'Cache-Control': 'no-store' } })
}
