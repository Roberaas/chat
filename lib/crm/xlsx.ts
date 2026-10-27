import ExcelJS from 'exceljs'

export type SheetDef = { name: string; columns: { header: string; key: string; width?: number; fmt?: string }[]; rows: Record<string, unknown>[] }

const TR_DATE = 'dd.mm.yyyy'
const TR_DATETIME = 'dd.mm.yyyy hh:mm'

export async function buildXlsx(sheets: SheetDef[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Roberto CRM'; wb.created = new Date()
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.columns = s.columns.map(c => ({ header: c.header, key: c.key, width: c.width || Math.max(12, c.header.length + 4), style: c.fmt ? { numFmt: c.fmt } : undefined }))
    ws.getRow(1).font = { bold: true }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFE6D2' } }
    for (const r of s.rows) ws.addRow(r)
    if (s.rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.columns.length } }
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}

export const dateFmt = TR_DATE
export const dateTimeFmt = TR_DATETIME
export const toDate = (v: unknown): Date | null => { if (!v) return null; const d = new Date(String(v)); return isNaN(d.getTime()) ? null : d }

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    const o = v as any
    if (o.richText) return o.richText.map((t: any) => t.text).join('')
    if ('result' in o) return cellText(o.result)
    if (o.text !== undefined) return String(o.text)
    if (o.hyperlink) return String(o.hyperlink)
    return ''
  }
  return String(v).trim()
}

/** İlk sayfayı başlık + satırlar (metin) olarak okur. Boş satırlar atlanır; satır numarası (Excel) korunur. */
export async function parseXlsx(buf: Buffer, maxRows = 20000): Promise<{ headers: string[]; rows: { row: number; cells: string[] }[]; tooMany: boolean }> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  const ws = wb.worksheets[0]
  if (!ws) return { headers: [], rows: [], tooMany: false }
  const width = Math.min(ws.columnCount, 60)
  const headers: string[] = []
  const head = ws.getRow(1)
  for (let c = 1; c <= width; c++) headers.push(cellText(head.getCell(c).value))
  const rows: { row: number; cells: string[] }[] = []
  let tooMany = false
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const cells: string[] = []
    let any = false
    for (let c = 1; c <= width; c++) { const t = cellText(row.getCell(c).value); if (t) any = true; cells.push(t) }
    if (!any) continue
    if (rows.length >= maxRows) { tooMany = true; break }
    rows.push({ row: r, cells })
  }
  return { headers, rows, tooMany }
}

/** CSV hücresi: formül enjeksiyonuna karşı korumalı */
export const csvCell = (v: unknown) => {
  let s = v instanceof Date ? v.toISOString() : String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return `"${s.replace(/"/g, '""')}"`
}
