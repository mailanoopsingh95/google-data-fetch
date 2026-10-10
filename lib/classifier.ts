import { ContactRole } from './types'

/**
 * Rule-based contact role classification
 * Classifies contacts based on name/title patterns, emails, and content
 */
export function classifyContactRole(
  name: string,
  email: string,
  context: string
): ContactRole {
  const nameAndEmail = `${name} ${email} ${context}`.toLowerCase()

  // Define patterns for each role
  const patterns: Record<ContactRole, RegExp[]> = {
    CEO: [
      /\bceo\b/,
      /\bchief executive\b/,
      /\bpresident\b/,
      /ceo@/,
      /president@/,
    ],
    FOUNDER: [
      /\bfounder\b/,
      /co.founder/,
      /founder@/,
      /\bco.?founder\b/,
    ],
    MANAGER: [
      /\bmanager\b/,
      /manager@/,
      /general manager/,
      /\bhead of\b/,
      /director@/,
    ],
    SALES: [
      /\bsales\b/,
      /sales@/,
      /\bsales (rep|manager|lead)\b/,
      /\bsmb\b/,
      /\bbusiness development\b/,
    ],
    MARKETING: [
      /\bmarketing\b/,
      /marketing@/,
      /\bcmo\b/,
      /\bmarcom\b/,
      /\bpromotion\b/,
    ],
    OPERATIONS: [
      /\boperations\b/,
      /operations@/,
      /\bcoo\b/,
      /supply chain/,
      /\bops\b/,
    ],
    HR: [
      /\bhr\b/,
      /\bhuman resource\b/,
      /hr@/,
      /\brecruitment\b/,
      /\bpeople\b/,
    ],
    FINANCE: [
      /\bfinance\b/,
      /finance@/,
      /\bcfo\b/,
      /accounting/,
      /\baccountant\b/,
    ],
    TECHNICAL: [
      /\btech\b/,
      /\bengineering\b/,
      /\bcto\b/,
      /developer/,
      /software/,
      /\bit\b/,
      /technical@/,
    ],
    OTHER: [/other/],
  }

  // Score each role
  for (const [role, rolePatterns] of Object.entries(patterns)) {
    for (const pattern of rolePatterns) {
      if (pattern.test(nameAndEmail)) {
        return role as ContactRole
      }
    }
  }

  return 'OTHER'
}

/**
 * Calculate decision-maker score for a contact
 * Higher score indicates more likely to be a decision maker
 */
export function calculateDecisionMakerScore(
  role: ContactRole | undefined,
  name: string,
  email: string,
  context: string
): number {
  let score = 50 // Start with neutral score

  // Role-based scoring
  const roleScores: Record<ContactRole, number> = {
    CEO: 100,
    FOUNDER: 100,
    MANAGER: 80,
    OPERATIONS: 75,
    FINANCE: 70,
    SALES: 65,
    MARKETING: 60,
    HR: 50,
    TECHNICAL: 40,
    OTHER: 30,
  }

  if (role && role in roleScores) {
    score = roleScores[role]
  }

  // Email domain scoring
  if (email.includes('@')) {
    const domain = email.split('@')[1]
    // Corporate emails are more likely decision makers
    if (domain && !domain.includes('gmail') && !domain.includes('yahoo')) {
      score += 10
    }
  }

  // Name pattern scoring
  const namePatterns = [
    { pattern: /^[a-z]+\.[a-z]+@/i, boost: 15 }, // First.Last@company format
    { pattern: /\b(director|head|lead|principal)\b/i, boost: 20 },
    { pattern: /\b(vice|deputy)\b/i, boost: 15 },
  ]

  const emailLower = email.toLowerCase()
  for (const { pattern, boost } of namePatterns) {
    if (pattern.test(emailLower)) {
      score += boost
    }
  }

  // Context scoring
  if (context.toLowerCase().includes('decision')) {
    score += 20
  }
  if (context.toLowerCase().includes('authority')) {
    score += 15
  }

  return Math.min(100, Math.max(0, score))
}

/**
 * Mock Ollama classification (rule-based)
 * In production, this would call a running Ollama instance
 */
export async function classifyWithOllama(
  name: string,
  email: string,
  context: string
): Promise<{
  role: ContactRole
  confidence: number
}> {
  // For now, use rule-based classification
  // In production with Ollama:
  // const response = await fetch('http://localhost:11434/api/generate', {
  //   method: 'POST',
  //   body: JSON.stringify({
  //     model: 'mistral',
  //     prompt: `Classify this contact's role...`,
  //   }),
  // })

  const role = classifyContactRole(name, email, context)
  const confidence = calculateDecisionMakerScore(role, name, email, context)

  return {
    role,
    confidence: confidence / 100,
  }
}

/**
 * Classify lead based on company data
 */
export function classifyLead(
  companyName: string,
  industry: string,
  emails: string[],
  phones: string[]
): {
  score: number
  tags: string[]
} {
  let score = 50 // Base score

  const tags: string[] = []

  // Company size estimation
  if (emails.length > 5) {
    score += 15
    tags.push('mid-size')
  } else if (emails.length > 1) {
    score += 5
    tags.push('small')
  }

  // Contact info completeness
  if (emails.length > 0) {
    score += 15
    tags.push('email-available')
  }
  if (phones.length > 0) {
    score += 10
    tags.push('phone-available')
  }

  // Industry scoring
  const highValueIndustries = [
    'technology',
    'finance',
    'healthcare',
    'manufacturing',
    'retail',
    'professional services',
  ]
  const industryLower = industry.toLowerCase()
  if (highValueIndustries.some(ind => industryLower.includes(ind))) {
    score += 10
    tags.push('high-value-industry')
  }

  // Company name indicators
  const companyLower = companyName.toLowerCase()
  if (
    /\b(pvt|limited|ltd|llc|inc|corporation|corp)\b/.test(companyLower)
  ) {
    score += 5
    tags.push('registered-entity')
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    tags,
  }
}
