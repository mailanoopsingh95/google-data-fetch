import { pgTable, text, timestamp, real } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  company: text('company').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const dealerResults = pgTable('dealer_results', {
  id: text('id').primaryKey(),
  url: text('url').notNull().unique(),
  query: text('query').notNull(),
  rating: real('rating'),
  name: text('name'),
  company: text('company').notNull(),
  phone: text('phone'),
  city: text('city'),
  pincode: text('pincode'),
  scrapedAt: timestamp('scraped_at').defaultNow().notNull(),
  userId: text('user_id').notNull(),
})

export type UserRow = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type DealerRow = typeof dealerResults.$inferSelect
export type NewDealer = typeof dealerResults.$inferInsert
