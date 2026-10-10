import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'
import { initDatabase } from './init'

const connectionString = process.env.DATABASE_URL

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null
let _client: postgres.Sql | null = null

export async function getDb() {
  if (!_db) {
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set. Set it in .env file.')
    }
    _client = postgres(connectionString, { max: 5 })
    _db = drizzle(_client, { schema })
    await initDatabase(_client)
    console.log('[db] Database initialized')
  }
  return _db
}

export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.end()
    _client = null
    _db = null
  }
}
