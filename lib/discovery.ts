import { LeadSource } from './types'

export interface DiscoveredCompany {
  name: string
  industry: string
  location: string
  website?: string
  source: LeadSource
}

// Simulated company database by industry and location
const SIMULATED_COMPANIES: Record<string, DiscoveredCompany[]> = {
  'technology-bangalore': [
    {
      name: 'TechVision Solutions',
      industry: 'Technology',
      location: 'Bangalore',
      website: 'https://techvisionsolutions.com',
      source: 'JUSTDIAL',
    },
    {
      name: 'Cloud Innovators Inc',
      industry: 'Cloud Computing',
      location: 'Bangalore',
      website: 'https://cloudinnovators.in',
      source: 'INDIAMART',
    },
    {
      name: 'Digital Transform Ltd',
      industry: 'Software Development',
      location: 'Bangalore',
      website: 'https://digitaltransform.co.in',
      source: 'TRADEINDIA',
    },
    {
      name: 'AI Systems Bangalore',
      industry: 'Artificial Intelligence',
      location: 'Bangalore',
      website: 'https://aisystemsbangalore.com',
      source: 'SULEKHA',
    },
    {
      name: 'Data Analytics Pro',
      industry: 'Data Science',
      location: 'Bangalore',
      website: 'https://dataanalyticspro.in',
      source: 'JUSTDIAL',
    },
  ],
  'manufacturing-pune': [
    {
      name: 'Precision Engineering Works',
      industry: 'Manufacturing',
      location: 'Pune',
      website: 'https://precisioneng.co.in',
      source: 'INDIAMART',
    },
    {
      name: 'AutoTech Pune',
      industry: 'Automotive',
      location: 'Pune',
      website: 'https://autotech-pune.com',
      source: 'TRADEINDIA',
    },
    {
      name: 'Industrial Solutions Ltd',
      industry: 'Industrial Equipment',
      location: 'Pune',
      website: 'https://industrialsolutions.in',
      source: 'SULEKHA',
    },
    {
      name: 'Smart Manufacturing Hub',
      industry: 'Industry 4.0',
      location: 'Pune',
      website: 'https://smartmfghub.com',
      source: 'JUSTDIAL',
    },
  ],
  'retail-delhi': [
    {
      name: 'Metro Retail Group',
      industry: 'Retail',
      location: 'Delhi',
      website: 'https://metroretail.in',
      source: 'JUSTDIAL',
    },
    {
      name: 'E-Commerce Delhi',
      industry: 'E-Commerce',
      location: 'Delhi',
      website: 'https://ecommercedelhi.com',
      source: 'INDIAMART',
    },
    {
      name: 'Fashion Forward India',
      industry: 'Fashion Retail',
      location: 'Delhi',
      website: 'https://fashionforwardindia.in',
      source: 'TRADEINDIA',
    },
    {
      name: 'Premium Goods Delhi',
      industry: 'Luxury Retail',
      location: 'Delhi',
      website: 'https://premiumgoodsdelhi.com',
      source: 'SULEKHA',
    },
  ],
  'healthcare-mumbai': [
    {
      name: 'HealthCare Excellence',
      industry: 'Healthcare',
      location: 'Mumbai',
      website: 'https://healthcareexcellence.in',
      source: 'JUSTDIAL',
    },
    {
      name: 'Medical Innovations Mumbai',
      industry: 'Medical Devices',
      location: 'Mumbai',
      website: 'https://medicalinnovations.co.in',
      source: 'INDIAMART',
    },
    {
      name: 'Pharma Solutions Ltd',
      industry: 'Pharmaceuticals',
      location: 'Mumbai',
      website: 'https://pharmasolutions.in',
      source: 'TRADEINDIA',
    },
    {
      name: 'Diagnostics Plus',
      industry: 'Diagnostics',
      location: 'Mumbai',
      website: 'https://diagnosticsplus.com',
      source: 'SULEKHA',
    },
  ],
  'finance-bangalore': [
    {
      name: 'FinTech Bangalore',
      industry: 'Financial Technology',
      location: 'Bangalore',
      website: 'https://fintechbangalore.com',
      source: 'JUSTDIAL',
    },
    {
      name: 'Investment Advisory Group',
      industry: 'Investment',
      location: 'Bangalore',
      website: 'https://investmentadvisory.in',
      source: 'TRADEINDIA',
    },
  ],
}

/**
 * Simulate company discovery from various sources
 */
export async function discoverCompanies(
  industry: string,
  location: string,
  source?: LeadSource
): Promise<DiscoveredCompany[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500))

  const key = `${industry.toLowerCase()}-${location.toLowerCase()}`
  let companies = SIMULATED_COMPANIES[key] || []

  // If specific source requested, filter
  if (source) {
    companies = companies.filter(c => c.source === source)
  }

  // If no results, generate some random companies
  if (companies.length === 0) {
    companies = generateRandomCompanies(industry, location, source)
  }

  return companies
}

/**
 * Generate simulated companies for any industry/location combo
 */
function generateRandomCompanies(
  industry: string,
  location: string,
  source?: LeadSource
): DiscoveredCompany[] {
  const companies: DiscoveredCompany[] = []
  const count = Math.floor(Math.random() * 3) + 2 // 2-4 companies

  const sources: LeadSource[] = ['JUSTDIAL', 'INDIAMART', 'TRADEINDIA', 'SULEKHA']
  const adjectives = [
    'Pro',
    'Global',
    'Smart',
    'Advanced',
    'Prime',
    'Elite',
    'Expert',
    'Ultimate',
  ]
  const suffixes = [
    'Solutions',
    'Services',
    'Ltd',
    'Inc',
    'Group',
    'Hub',
    'Works',
    'Systems',
  ]

  for (let i = 0; i < count; i++) {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)]
    const name = `${adj} ${industry} ${suffix}`
    const selectedSource =
      source || sources[Math.floor(Math.random() * sources.length)]

    companies.push({
      name,
      industry,
      location,
      website: `https://${name.toLowerCase().replace(/\s+/g, '')}.in`,
      source: selectedSource,
    })
  }

  return companies
}

/**
 * Advanced discovery with multiple sources
 */
export async function advancedDiscovery(
  industry: string,
  location: string
): Promise<{
  companies: DiscoveredCompany[]
  totalFound: number
  sources: Record<LeadSource, number>
}> {
  const sources: LeadSource[] = [
    'JUSTDIAL',
    'INDIAMART',
    'TRADEINDIA',
    'SULEKHA',
  ]
  const allCompanies: DiscoveredCompany[] = []
  const sourceCount: Record<LeadSource, number> = {
    JUSTDIAL: 0,
    INDIAMART: 0,
    TRADEINDIA: 0,
    SULEKHA: 0,
  }

  // Discover from each source in parallel
  const discoveries = await Promise.all(
    sources.map(s => discoverCompanies(industry, location, s))
  )

  discoveries.forEach((companies, index) => {
    const source = sources[index]
    allCompanies.push(...companies)
    sourceCount[source] = companies.length
  })

  return {
    companies: allCompanies,
    totalFound: allCompanies.length,
    sources: sourceCount,
  }
}

/**
 * Search companies by name
 */
export async function searchCompanies(
  query: string
): Promise<DiscoveredCompany[]> {
  const allCompanies = Object.values(SIMULATED_COMPANIES).flat()
  const queryLower = query.toLowerCase()

  return allCompanies.filter(
    company =>
      company.name.toLowerCase().includes(queryLower) ||
      company.industry.toLowerCase().includes(queryLower) ||
      company.location.toLowerCase().includes(queryLower)
  )
}
