// Adaptateur KiaKiaPay — STUB en attente des clés API réelles.
// Une fois les clés KIAKIAPAY_API_KEY / KIAKIAPAY_SECRET ajoutées dans .env,
// remplacer les corps de fonctions par de vrais appels à l'API KiaKiaPay
// (voir leur doc). L'interface reste identique, donc rien d'autre à changer.
import type { PaymentProvider, PayinData, PayoutData } from './types'

const API_KEY = process.env.KIAKIAPAY_API_KEY || ''

export const kiakiapayProvider: PaymentProvider = {
  key: 'kiakiapay',
  label: 'KiaKiaPay',
  methods: ['mobile_money'],

  async initPayin(data: PayinData) {
    if (!API_KEY) {
      return { success: false, raw: { error: 'KiaKiaPay non configuré — ajoutez KIAKIAPAY_API_KEY dans .env' } }
    }
    // TODO: appel réel à l'API KiaKiaPay
    return { success: false, raw: { error: 'Intégration KiaKiaPay à finaliser' } }
  },

  async checkPayin(token: string) {
    return { success: false, status: 'not_implemented', raw: {} }
  },

  async initPayout(data: PayoutData) {
    return { success: false, raw: { error: 'Intégration KiaKiaPay à finaliser' } }
  },
}
