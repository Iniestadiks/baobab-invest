// Registre central des prestataires de paiement.
// L'admin active/désactive chaque prestataire dans la table
// payment_provider_configs — ce fichier ne fait que lire cette config
// et exposer les instances correspondantes.
import { PrismaClient } from '@prisma/client'
import { paydunyaProvider } from './paydunya-adapter'
import { kiakiapayProvider } from './kiakiapay-adapter'
import { stripeProvider } from './stripe-adapter'
import type { PaymentProvider } from './types'

const prisma = new PrismaClient()

const ALL_PROVIDERS: Record<string, PaymentProvider> = {
  paydunya: paydunyaProvider,
  kiakiapay: kiakiapayProvider,
  stripe: stripeProvider,
}

const DEFAULT_CONFIGS = [
  // "methods" = libellé affiché à l'utilisateur (pas le nom du prestataire) —
  // chaque agrégateur affiche ensuite ses propres options précises sur sa page de paiement.
  { key: 'paydunya', label: 'Mobile Money', methods: 'Wave, Orange Money, Free Money, Expresso', enabled: true, sortOrder: 1 },
  { key: 'kiakiapay', label: 'Mobile Money (KiaKiaPay)', methods: 'Wave, Orange Money, MTN Money', enabled: false, sortOrder: 2 },
  { key: 'stripe', label: 'Carte bancaire', methods: 'Carte bancaire, Apple Pay, Google Pay', enabled: false, sortOrder: 3 },
]

// S'assure que les 3 lignes de config existent en base (appelé une fois au démarrage)
export async function ensurePaymentProviderConfigs() {
  for (const cfg of DEFAULT_CONFIGS) {
    await prisma.paymentProviderConfig.upsert({
      where: { key: cfg.key },
      update: {},
      create: cfg,
    })
  }
}

// Liste tous les prestataires ACTIVÉS par l'admin, avec leur config
export async function getEnabledProviders(): Promise<{ provider: PaymentProvider; methods: string[] }[]> {
  const configs = await prisma.paymentProviderConfig.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: 'asc' },
  })
  return configs
    .filter(c => ALL_PROVIDERS[c.key])
    .map(c => ({ provider: ALL_PROVIDERS[c.key], methods: c.methods.split(',') }))
}

// Récupère un prestataire précis par sa clé (vérifie qu'il est bien activé)
export async function getProvider(key: string): Promise<PaymentProvider | null> {
  const config = await prisma.paymentProviderConfig.findUnique({ where: { key } })
  if (!config || !config.enabled) return null
  return ALL_PROVIDERS[key] || null
}

// Liste complète pour l'admin (activés ET désactivés)
export async function getAllProviderConfigs() {
  return prisma.paymentProviderConfig.findMany({ orderBy: { sortOrder: 'asc' } })
}
