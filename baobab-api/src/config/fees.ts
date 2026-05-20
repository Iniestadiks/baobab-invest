import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface Fees {
  // Collecte (prélevés à l'investissement)
  commission_baobab_collection: number  // 5% → admin
  payin_recovery: number                // 4% → récupère avance dépôt
  commission_mentor: number             // 2% → mentor
  commission_guarantee: number          // 2% → garantie (optionnel)

  // Mensualités
  payin_repayment: number               // 4% → compense Payin Fatou

  // Retrait
  withdrawal_fee_standard: number       // 3% → a investi
  withdrawal_fee_no_invest: number      // 7% → jamais investi

  // Taux retour minimum
  return_min: number                    // 22% sur besoin net

  // Délais de grâce (en mois)
  grace_period_agriculture: number      // 2 mois
  grace_period_other: number            // 1 mois
}

export const DEFAULT_FEES: Fees = {
  commission_baobab_collection: 5,
  payin_recovery: 4,
  commission_mentor: 2,
  commission_guarantee: 2,
  payin_repayment: 4,
  withdrawal_fee_standard: 3,
  withdrawal_fee_no_invest: 7,
  return_min: 22,
  grace_period_agriculture: 2,
  grace_period_other: 1,
}

// Clés affichées dans l'admin
export const FEE_LABELS: Record<string, string> = {
  commission_baobab_collection: 'Commission BAOBAB collecte (%)',
  payin_recovery:               'Récupération Payin investissement (%)',
  commission_mentor:            'Commission Mentor (%)',
  commission_guarantee:         'Assurance / Fonds garantie (%)',
  payin_repayment:              'Payin mensualités remboursement (%)',
  withdrawal_fee_standard:      'Frais retrait standard (%)',
  withdrawal_fee_no_invest:     'Frais retrait anti-abus (%)',
  return_min:                   'Taux retour minimum entrepreneur (%)',
  grace_period_agriculture:     'Délai grâce Agriculture/Élevage (mois)',
  grace_period_other:           'Délai grâce autres secteurs (mois)',
}

// Charger depuis la base — fallback sur DEFAULT_FEES
export async function getFees(): Promise<Fees> {
  try {
    const configs = await prisma.platformConfig.findMany()
    const map: Record<string, number> = {}
    configs.forEach(c => { map[c.key] = Number(c.value) })

    return {
      commission_baobab_collection: map.commission_baobab_collection ?? DEFAULT_FEES.commission_baobab_collection,
      payin_recovery:               map.payin_recovery               ?? DEFAULT_FEES.payin_recovery,
      commission_mentor:            map.commission_mentor             ?? DEFAULT_FEES.commission_mentor,
      commission_guarantee:         map.commission_guarantee          ?? DEFAULT_FEES.commission_guarantee,
      payin_repayment:              map.payin_repayment               ?? DEFAULT_FEES.payin_repayment,
      withdrawal_fee_standard:      map.withdrawal_fee_standard       ?? DEFAULT_FEES.withdrawal_fee_standard,
      withdrawal_fee_no_invest:     map.withdrawal_fee_no_invest      ?? DEFAULT_FEES.withdrawal_fee_no_invest,
      return_min:                   map.return_min                    ?? DEFAULT_FEES.return_min,
      grace_period_agriculture:     map.grace_period_agriculture      ?? DEFAULT_FEES.grace_period_agriculture,
      grace_period_other:           map.grace_period_other            ?? DEFAULT_FEES.grace_period_other,
    }
  } catch {
    return DEFAULT_FEES
  }
}
