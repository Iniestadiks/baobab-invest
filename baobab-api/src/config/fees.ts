import prisma from './database'

// Taux par défaut (fallback si la base est inaccessible)
const DEFAULTS: Record<string, number> = {
  commission_baobab_collection: 5,
  commission_mentor: 2,
  commission_guarantee: 2,
  commission_baobab_return: 5,
  paydunya_payin: 4,
  paydunya_payout: 3,
  return_min_with_mentor: 15,
  return_min_no_mentor: 17,
  investment_min: 5000,
  withdrawal_min: 5000,
}

// Cache en mémoire — rechargé toutes les 5 minutes
let cache: Record<string, number> = {}
let lastLoaded = 0

export async function getFees(): Promise<Record<string, number>> {
  const now = Date.now()
  if (now - lastLoaded < 5 * 60 * 1000 && Object.keys(cache).length > 0) {
    return cache
  }
  try {
    const configs = await prisma.platformConfig.findMany()
    cache = {}
    configs.forEach(c => { cache[c.key] = c.value })
    lastLoaded = now
    return cache
  } catch {
    return DEFAULTS
  }
}

export async function getFee(key: string): Promise<number> {
  const fees = await getFees()
  return fees[key] ?? DEFAULTS[key] ?? 0
}
