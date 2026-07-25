// @ts-nocheck
// Adaptateur PayDunya — enveloppe le service existant (src/services/paydunya.ts)
// sans le modifier, pour qu'il respecte l'interface commune PaymentProvider.
import * as paydunya from '../paydunya'
import type { PaymentProvider, PayinData, PayoutData } from './types'

export const paydunyaProvider: PaymentProvider = {
  key: 'paydunya',
  label: 'PayDunya',
  methods: ['mobile_money'],

  async initPayin(data: PayinData) {
    const raw = await paydunya.initPayin(data)
    return {
      success: raw?.response_code === '00',
      redirectUrl: raw?.response_text,  // URL de la page de paiement PayDunya
      token: raw?.token,
      raw,
    }
  },

  async checkPayin(token: string) {
    const raw = await paydunya.checkPayin(token)
    return {
      success: raw?.response_code === '00' && raw?.status === 'completed',
      status: raw?.status || 'unknown',
      raw,
    }
  },

  async initPayout(data: PayoutData) {
    const raw = await paydunya.initPayout(data)
    return { success: raw?.response_code === '00' || raw?.success === true, raw }
  },

  async checkBalance() {
    const raw = await paydunya.checkBalance()
    return { balance: Number(raw?.balance || 0), raw }
  },
}
