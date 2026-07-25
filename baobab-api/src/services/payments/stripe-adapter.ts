// Adaptateur Stripe — STUB en attente de la clé API réelle.
// Une fois STRIPE_SECRET_KEY ajoutée dans .env, installer le package
// "stripe" (npm install stripe) et remplacer les corps de fonctions par
// de vrais appels (Checkout Session pour le payin, Transfers pour le
// payout). L'interface reste identique.
import type { PaymentProvider, PayinData, PayoutData } from './types'

const API_KEY = process.env.STRIPE_SECRET_KEY || ''

export const stripeProvider: PaymentProvider = {
  key: 'stripe',
  label: 'Stripe',
  methods: ['card'],

  async initPayin(data: PayinData) {
    if (!API_KEY) {
      return { success: false, raw: { error: 'Stripe non configuré — ajoutez STRIPE_SECRET_KEY dans .env' } }
    }
    // TODO: créer une Stripe Checkout Session ici
    return { success: false, raw: { error: 'Intégration Stripe à finaliser' } }
  },

  async checkPayin(token: string) {
    return { success: false, status: 'not_implemented', raw: {} }
  },
}
