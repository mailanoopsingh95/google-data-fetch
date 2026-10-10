import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { ExportRequestSchema } from '@/lib/types'
import { generateExcelBuffer } from '@/lib/excel'

export async function POST(req: NextRequest) {
  const user = await requireAuth()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = ExportRequestSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid results data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (parsed.data.results.length === 0) {
    return new Response(JSON.stringify({ error: 'No results to export' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const buffer = generateExcelBuffer(parsed.data.results)

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="dealers-${Date.now()}.xlsx"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
