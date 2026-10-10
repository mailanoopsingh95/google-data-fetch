import * as XLSX from 'xlsx'
import { DealerResult } from './types'

export function generateExcelBuffer(results: DealerResult[]): Buffer {
  const rows = results.map((r, i) => ({
    '#': i + 1,
    Rating: r.rating ?? '',
    Name: r.name ?? '',
    Company: r.company,
    Phone: r.phone ?? '',
    City: r.city ?? '',
    Pincode: r.pincode ?? '',
    'Source URL': r.sourceUrl,
  }))

  const worksheet = XLSX.utils.json_to_sheet(rows)

  const colWidths = [
    { wch: 4 },
    { wch: 8 },
    { wch: 20 },
    { wch: 30 },
    { wch: 18 },
    { wch: 15 },
    { wch: 10 },
    { wch: 50 },
  ]
  worksheet['!cols'] = colWidths

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Dealers')

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  return Buffer.from(buffer)
}
