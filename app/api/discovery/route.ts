import { NextRequest, NextResponse } from 'next/server'
import { discoverCompanies, advancedDiscovery } from '@/lib/discovery'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const industry = searchParams.get('industry')
    const location = searchParams.get('location')
    const advanced = searchParams.get('advanced') === 'true'

    if (!industry || !location) {
      return NextResponse.json(
        { error: 'Industry and location parameters are required' },
        { status: 400 }
      )
    }

    let result

    if (advanced) {
      result = await advancedDiscovery(industry, location)
    } else {
      const companies = await discoverCompanies(industry, location)
      result = {
        companies,
        totalFound: companies.length,
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[v0] Discovery error:', error)
    return NextResponse.json(
      { error: 'Failed to discover companies' },
      { status: 400 }
    )
  }
}
