import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export const DEFAULT_FEES = {
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
};
// Clés affichées dans l'admin
export const FEE_LABELS = {
    commission_baobab_collection: 'Commission BAOBAB collecte (%)',
    payin_recovery: 'Récupération Payin investissement (%)',
    commission_mentor: 'Commission Mentor (%)',
    commission_guarantee: 'Assurance / Fonds garantie (%)',
    payin_repayment: 'Payin mensualités remboursement (%)',
    withdrawal_fee_standard: 'Frais retrait standard (%)',
    withdrawal_fee_no_invest: 'Frais retrait anti-abus (%)',
    return_min: 'Taux retour minimum entrepreneur (%)',
    grace_period_agriculture: 'Délai grâce Agriculture/Élevage (mois)',
    grace_period_other: 'Délai grâce autres secteurs (mois)',
};
// Charger depuis la base — fallback sur DEFAULT_FEES
export async function getFees() {
    try {
        const configs = await prisma.platformConfig.findMany();
        const map = {};
        configs.forEach(c => { map[c.key] = Number(c.value); });
        return {
            commission_baobab_collection: map.commission_baobab_collection ?? DEFAULT_FEES.commission_baobab_collection,
            payin_recovery: map.payin_recovery ?? DEFAULT_FEES.payin_recovery,
            commission_mentor: map.commission_mentor ?? DEFAULT_FEES.commission_mentor,
            commission_guarantee: map.commission_guarantee ?? DEFAULT_FEES.commission_guarantee,
            payin_repayment: map.payin_repayment ?? DEFAULT_FEES.payin_repayment,
            withdrawal_fee_standard: map.withdrawal_fee_standard ?? DEFAULT_FEES.withdrawal_fee_standard,
            withdrawal_fee_no_invest: map.withdrawal_fee_no_invest ?? DEFAULT_FEES.withdrawal_fee_no_invest,
            return_min: map.return_min ?? DEFAULT_FEES.return_min,
            grace_period_agriculture: map.grace_period_agriculture ?? DEFAULT_FEES.grace_period_agriculture,
            grace_period_other: map.grace_period_other ?? DEFAULT_FEES.grace_period_other,
        };
    }
    catch {
        return DEFAULT_FEES;
    }
}
