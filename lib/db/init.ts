import postgres from 'postgres'

export async function initDatabase(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `)

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS dealer_results (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL UNIQUE,
      query TEXT NOT NULL,
      rating REAL,
      name TEXT,
      company TEXT NOT NULL,
      phone TEXT,
      city TEXT,
      pincode TEXT,
      scraped_at TIMESTAMP NOT NULL DEFAULT NOW(),
      user_id TEXT NOT NULL
    );
  `)

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_dealer_url ON dealer_results(url);
  `)
}
