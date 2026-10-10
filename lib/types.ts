import { z } from 'zod'

// ============ Authentication ============
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  password: z.string(),
  name: z.string(),
  company: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type User = z.infer<typeof UserSchema>

// ============ Leads ============
export const LeadSourceEnum = z.enum([
  'JUSTDIAL',
  'INDIAMART',
  'TRADEINDIA',
  'SULEKHA',
  'MANUAL',
])

export type LeadSource = z.infer<typeof LeadSourceEnum>

export const LeadStatusEnum = z.enum([
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'UNQUALIFIED',
  'NEGOTIATING',
  'WON',
  'LOST',
])

export type LeadStatus = z.infer<typeof LeadStatusEnum>

export const LeadSchema = z.object({
  id: z.string(),
  userId: z.string(),
  companyName: z.string(),
  industry: z.string(),
  source: LeadSourceEnum,
  status: LeadStatusEnum,
  score: z.number().min(0).max(100),
  website: z.string().url().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  crawledAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type Lead = z.infer<typeof LeadSchema>

// ============ Contacts ============
export const ContactRoleEnum = z.enum([
  'CEO',
  'FOUNDER',
  'MANAGER',
  'SALES',
  'MARKETING',
  'OPERATIONS',
  'HR',
  'FINANCE',
  'TECHNICAL',
  'OTHER',
])

export type ContactRole = z.infer<typeof ContactRoleEnum>

export const ContactSchema = z.object({
  id: z.string(),
  leadId: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: ContactRoleEnum.optional(),
  decisionMakerScore: z.number().min(0).max(100),
  source: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type Contact = z.infer<typeof ContactSchema>

// ============ Tasks & Automation ============
export const TaskStatusEnum = z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELED'])

export type TaskStatus = z.infer<typeof TaskStatusEnum>

export const TaskTypeEnum = z.enum([
  'CRAWL_WEBSITE',
  'SEND_EMAIL',
  'SEND_SMS',
  'CLASSIFY_CONTACT',
  'EXPORT_LEADS',
])

export type TaskType = z.infer<typeof TaskTypeEnum>

export const TaskSchema = z.object({
  id: z.string(),
  userId: z.string(),
  leadId: z.string().optional(),
  type: TaskTypeEnum,
  status: TaskStatusEnum,
  result: z.unknown().optional(),
  error: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type Task = z.infer<typeof TaskSchema>

// ============ API Request/Response Schemas ============
export const CreateLeadRequestSchema = z.object({
  companyName: z.string(),
  industry: z.string(),
  source: LeadSourceEnum,
  website: z.string().url().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
})

export type CreateLeadRequest = z.infer<typeof CreateLeadRequestSchema>

export const UpdateLeadRequestSchema = z.object({
  companyName: z.string().optional(),
  industry: z.string().optional(),
  status: LeadStatusEnum.optional(),
  score: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
})

export type UpdateLeadRequest = z.infer<typeof UpdateLeadRequestSchema>

export const CreateContactRequestSchema = z.object({
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: ContactRoleEnum.optional(),
})

export type CreateContactRequest = z.infer<typeof CreateContactRequestSchema>

export const AuthRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export type AuthRequest = z.infer<typeof AuthRequestSchema>

export const RegisterRequestSchema = AuthRequestSchema.extend({
  name: z.string(),
  company: z.string(),
})

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>

// ============ Export Formats ============
export const ExportFormatEnum = z.enum(['CSV', 'JSON', 'XLSX'])
export type ExportFormat = z.infer<typeof ExportFormatEnum>

export const ExportLeadsRequestSchema = z.object({
  format: ExportFormatEnum,
  filters: z.object({
    status: LeadStatusEnum.optional(),
    minScore: z.number().optional(),
    source: LeadSourceEnum.optional(),
  }).optional(),
})

export type ExportLeadsRequest = z.infer<typeof ExportLeadsRequestSchema>

// ============ Dealer Search ============
export const DealerResultSchema = z.object({
  id: z.string(),
  rating: z.number().min(0).max(5).nullable(),
  name: z.string().nullable(),
  company: z.string(),
  phone: z.string().nullable(),
  city: z.string().nullable(),
  pincode: z.string().nullable(),
  sourceUrl: z.string().url(),
})

export type DealerResult = z.infer<typeof DealerResultSchema>

export const SearchRequestSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  limit: z.number().int().min(1).max(100).optional(),
})

export type SearchRequest = z.infer<typeof SearchRequestSchema>

export const ExportRequestSchema = z.object({
  results: z.array(DealerResultSchema),
})

export type ExportRequest = z.infer<typeof ExportRequestSchema>
