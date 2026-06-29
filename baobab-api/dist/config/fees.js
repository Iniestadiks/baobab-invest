"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEE_LABELS = exports.DEFAULT_FEES = void 0;
exports.getFees = getFees;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
exports.DEFAULT_FEES = {
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
exports.FEE_LABELS = {
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
async function getFees() {
    try {
        const configs = await prisma.platformConfig.findMany();
        const map = {};
        configs.forEach(c => { map[c.key] = Number(c.value); });
        return {
            commission_baobab_collection: map.commission_baobab_collection ?? exports.DEFAULT_FEES.commission_baobab_collection,
            payin_recovery: map.payin_recovery ?? exports.DEFAULT_FEES.payin_recovery,
            commission_mentor: map.commission_mentor ?? exports.DEFAULT_FEES.commission_mentor,
            commission_guarantee: map.commission_guarantee ?? exports.DEFAULT_FEES.commission_guarantee,
            payin_repayment: map.payin_repayment ?? exports.DEFAULT_FEES.payin_repayment,
            withdrawal_fee_standard: map.withdrawal_fee_standard ?? exports.DEFAULT_FEES.withdrawal_fee_standard,
            withdrawal_fee_no_invest: map.withdrawal_fee_no_invest ?? exports.DEFAULT_FEES.withdrawal_fee_no_invest,
            return_min: map.return_min ?? exports.DEFAULT_FEES.return_min,
            grace_period_agriculture: map.grace_period_agriculture ?? exports.DEFAULT_FEES.grace_period_agriculture,
            grace_period_other: map.grace_period_other ?? exports.DEFAULT_FEES.grace_period_other,
        };
    }
    catch {
        return exports.DEFAULT_FEES;
    }
}
//# sourceMappingURL=fees.js.map