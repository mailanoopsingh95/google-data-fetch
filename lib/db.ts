import { User, Lead, Contact, Task, DealerResult } from './types'
import { getDb } from './db/index'
import { users, dealerResults } from './db/schema'
import { eq, inArray } from 'drizzle-orm'
import crypto from 'crypto'

export function generateId(): string {
  return crypto.randomUUID()
}

// ============ User Operations (PostgreSQL) ============
export async function createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
  const db = await getDb()
  const id = generateId()
  const now = new Date()

  await db.insert(users).values({
    id,
    email: user.email,
    password: user.password,
    name: user.name,
    company: user.company,
    createdAt: now,
    updatedAt: now,
  })

  return { ...user, id, createdAt: now, updatedAt: now }
}

export async function getUserById(id: string): Promise<User | null> {
  const db = await getDb()
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return rows[0] || null
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const db = await getDb()
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1)
  return rows[0] || null
}

// ============ Dealer Store (PostgreSQL) ============
export async function storeDealerResults(
  results: DealerResult[],
  query: string,
  userId: string
): Promise<void> {
  const db = await getDb()
  const now = new Date()

  for (const r of results) {
    try {
      await db.insert(dealerResults).values({
        id: r.id,
        url: r.sourceUrl,
        query,
        rating: r.rating,
        name: r.name,
        company: r.company,
        phone: r.phone,
        city: r.city,
        pincode: r.pincode,
        scrapedAt: now,
        userId,
      }).onConflictDoNothing()
    } catch {
      // Skip duplicates
    }
  }
}

export async function getExistingUrls(urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set()

  const db = await getDb()
  const existing = new Set<string>()

  for (let i = 0; i < urls.length; i += 100) {
    const batch = urls.slice(i, i + 100)
    const rows = await db
      .select({ url: dealerResults.url })
      .from(dealerResults)
      .where(inArray(dealerResults.url, batch))

    for (const row of rows) {
      existing.add(row.url)
    }
  }

  return existing
}

export async function countDealerResults(): Promise<number> {
  const db = await getDb()
  const rows = await db.select({ count: dealerResults.id }).from(dealerResults)
  return rows.length
}

// ============ Legacy: Lead Operations (in-memory, unused by dashboard) ============
let leads: Map<string, Lead> = new Map()
let contacts: Map<string, Contact> = new Map()
let tasks: Map<string, Task> = new Map()

export async function createLead(lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lead> {
  const id = generateId()
  const newLead: Lead = { ...lead, id, createdAt: new Date(), updatedAt: new Date() }
  leads.set(id, newLead)
  return newLead
}

export async function getLeadById(id: string): Promise<Lead | null> {
  return leads.get(id) || null
}

export async function getLeadsByUserId(userId: string): Promise<Lead[]> {
  return Array.from(leads.values()).filter(lead => lead.userId === userId)
}

export async function updateLead(id: string, updates: Partial<Lead>): Promise<Lead | null> {
  const lead = leads.get(id)
  if (!lead) return null
  const updated: Lead = { ...lead, ...updates, updatedAt: new Date() }
  leads.set(id, updated)
  return updated
}

export async function deleteLead(id: string): Promise<boolean> {
  return leads.delete(id)
}

export async function createContact(contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact> {
  const id = generateId()
  const newContact: Contact = { ...contact, id, createdAt: new Date(), updatedAt: new Date() }
  contacts.set(id, newContact)
  return newContact
}

export async function getContactById(id: string): Promise<Contact | null> {
  return contacts.get(id) || null
}

export async function getContactsByLeadId(leadId: string): Promise<Contact[]> {
  return Array.from(contacts.values()).filter(contact => contact.leadId === leadId)
}

export async function getContactsByUserId(userId: string): Promise<Contact[]> {
  return Array.from(contacts.values()).filter(contact => contact.userId === userId)
}

export async function updateContact(id: string, updates: Partial<Contact>): Promise<Contact | null> {
  const contact = contacts.get(id)
  if (!contact) return null
  const updated: Contact = { ...contact, ...updates, updatedAt: new Date() }
  contacts.set(id, updated)
  return updated
}

export async function deleteContact(id: string): Promise<boolean> {
  return contacts.delete(id)
}

export async function createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
  const id = generateId()
  const newTask: Task = { ...task, id, createdAt: new Date(), updatedAt: new Date() }
  tasks.set(id, newTask)
  return newTask
}

export async function getTaskById(id: string): Promise<Task | null> {
  return tasks.get(id) || null
}

export async function getTasksByUserId(userId: string): Promise<Task[]> {
  return Array.from(tasks.values()).filter(task => task.userId === userId)
}

export async function getLeadStats(userId: string) {
  const userLeads = Array.from(leads.values()).filter(lead => lead.userId === userId)
  const stats: Record<string, any> = {
    total: userLeads.length,
    byStatus: {},
    bySource: {},
    avgScore: 0,
    avgContacts: 0,
  }
  let totalScore = 0
  userLeads.forEach(lead => {
    stats.byStatus[lead.status] = (stats.byStatus[lead.status] || 0) + 1
    stats.bySource[lead.source] = (stats.bySource[lead.source] || 0) + 1
    totalScore += lead.score
  })
  if (userLeads.length > 0) stats.avgScore = Math.round(totalScore / userLeads.length)
  const userContacts = Array.from(contacts.values()).filter(c => c.userId === userId)
  if (userLeads.length > 0) stats.avgContacts = Math.round(userContacts.length / userLeads.length)
  return stats
}

export async function searchLeads(userId: string, query: string): Promise<Lead[]> {
  const userLeads = Array.from(leads.values()).filter(lead => lead.userId === userId)
  const lowerQuery = query.toLowerCase()
  return userLeads.filter(lead =>
    lead.companyName.toLowerCase().includes(lowerQuery) ||
    lead.industry.toLowerCase().includes(lowerQuery) ||
    lead.location?.toLowerCase().includes(lowerQuery)
  )
}
