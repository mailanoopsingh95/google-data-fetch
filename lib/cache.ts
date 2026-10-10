interface CacheEntry<T> {
  data: T
  timestamp: number
}

const store = new Map<string, CacheEntry<unknown>>()

const DEFAULT_TTL = 24 * 60 * 60 * 1000

export function getCached<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > DEFAULT_TTL) {
    store.delete(key)
    return null
  }
  return entry.data as T
}

export function setCache<T>(key: string, data: T): void {
  store.set(key, { data, timestamp: Date.now() })
}

export function getCacheSize(): number {
  return store.size
}
