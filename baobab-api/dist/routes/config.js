"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const express_1 = require("express");
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const helpers_1 = require("../utils/helpers");
const registry_1 = require("../services/payments/registry");
const router = (0, express_1.Router)();
// Route publique — prestataires de paiement ACTIVÉS (pour l'écran de dépôt utilisateur)
router.get('/payment-providers/public', async (req, res) => {
    try {
        const configs = await database_1.default.paymentProviderConfig.findMany({
            where: { enabled: true },
            orderBy: { sortOrder: 'asc' },
            select: { key: true, label: true, methods: true },
        });
        res.json({ success: true, data: configs });
    }
    catch (e) {
        res.status(500).json({ success: false });
    }
});
// Route publique
router.get('/public', async (req, res) => {
    try {
        const configs = await database_1.default.platformConfig.findMany({ orderBy: { key: 'asc' } });
        res.json({ success: true, data: configs });
    }
    catch (e) {
        res.status(500).json({ success: false });
    }
});
// Lire tous les taux (admin)
router.get('/', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const configs = await database_1.default.platformConfig.findMany({ orderBy: { key: 'asc' } });
        (0, helpers_1.successResponse)(res, configs);
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
// Sauver en BROUILLON seulement (pas encore actif)
router.patch('/:key', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { value } = req.body;
        const { key } = req.params;
        if (value === undefined || isNaN(Number(value))) {
            res.status(400).json({ success: false, message: 'Valeur invalide' });
            return;
        }
        // Champs système — jamais modifiables à la main, uniquement par le code
        // (compteur de dépense parrainage, mis à jour automatiquement à chaque
        // bonus versé). Passer par /referral/reopen pour le remettre à zéro.
        const readOnlyKeys = ['referral_budget_spent'];
        if (readOnlyKeys.includes(key)) {
            res.status(403).json({ success: false, message: 'Ce champ est géré automatiquement par le système, non modifiable manuellement' });
            return;
        }
        const pctKeys = [
            'commission_baobab_collection', 'commission_mentor', 'commission_guarantee',
            'payin_recovery', 'payin_repayment', 'withdrawal_fee_standard', 'withdrawal_fee_no_invest',
            'return_min', 'fund_baobab_fee', 'payin_operator_real', 'payout_operator_real'
        ];
        const monthKeys = ['grace_period_agriculture', 'grace_period_other'];
        const amountKeys = ['investment_min', 'withdrawal_min', 'referral_bonus_amount', 'referral_budget_total'];
        const boolKeys = ['referral_program_active'];
        if (pctKeys.includes(key) && (Number(value) < 0 || Number(value) > 50)) {
            res.status(400).json({ success: false, message: 'Taux doit être entre 0 et 50%' });
            return;
        }
        if (monthKeys.includes(key) && (Number(value) < 0 || Number(value) > 12)) {
            res.status(400).json({ success: false, message: 'Délai doit être entre 0 et 12 mois' });
            return;
        }
        if (amountKeys.includes(key) && (Number(value) < 0 || Number(value) > 1000000)) {
            res.status(400).json({ success: false, message: 'Montant doit être entre 0 et 1 000 000 FCFA' });
            return;
        }
        if (boolKeys.includes(key) && ![0, 1].includes(Number(value))) {
            res.status(400).json({ success: false, message: 'Valeur doit être 0 (désactivé) ou 1 (activé)' });
            return;
        }
        // Sauver en brouillon uniquement
        const config = await database_1.default.platformConfig.update({
            where: { key },
            data: { draftValue: Number(value), updatedBy: req.userId }
        });
        (0, helpers_1.successResponse)(res, config, `"${config.label}" sauvegardé en brouillon — pas encore actif`);
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
// Confirmer et appliquer tous les brouillons
router.post('/confirm', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const drafts = await database_1.default.platformConfig.findMany({
            where: { draftValue: { not: null } }
        });
        if (drafts.length === 0) {
            res.status(400).json({ success: false, message: 'Aucun brouillon en attente' });
            return;
        }
        // Appliquer tous les brouillons → value
        for (const d of drafts) {
            await database_1.default.platformConfig.update({
                where: { key: d.key },
                data: { value: d.draftValue, draftValue: null }
            });
        }
        (0, helpers_1.successResponse)(res, { applied: drafts.length }, `${drafts.length} taux appliqués sur tous les futurs projets ✅`);
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
// Annuler les brouillons
router.post('/cancel-draft', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        await database_1.default.platformConfig.updateMany({
            where: { draftValue: { not: null } },
            data: { draftValue: null }
        });
        (0, helpers_1.successResponse)(res, {}, 'Brouillons annulés — taux actuels conservés');
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
// Réinitialiser aux valeurs par défaut
router.post('/reset', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const defaults = {
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
            // Clés utilisées ailleurs dans le code (wallet.ts, fund.ts) mais
            // absentes jusqu'ici — sans elles, ces réglages étaient invisibles
            // et impossibles à modifier depuis l'admin.
            fund_baobab_fee: 16,
            investment_min: 5000,
            withdrawal_min: 5000,
            payin_operator_real: 3.5,
            payout_operator_real: 2,
            // Parrainage — bonus versé UNIQUEMENT après KYC + 1er investissement du
            // filleul, ET que le parrain a lui-même déjà investi. Budget partagé
            // entre tous les parrainages, coupure auto quand épuisé.
            referral_bonus_amount: 2000,
            referral_budget_total: 200000,
            referral_budget_spent: 0,
            referral_program_active: 1,
        };
        for (const [key, value] of Object.entries(defaults)) {
            await database_1.default.platformConfig.upsert({
                where: { key },
                update: { value, draftValue: null },
                create: { key, value, label: key, description: key }
            });
        }
        (0, helpers_1.successResponse)(res, {}, 'Taux réinitialisés aux valeurs par défaut');
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
// ═══════════════════════════════════════════════════════
// PRESTATAIRES DE PAIEMENT — activation/désactivation admin
// ═══════════════════════════════════════════════════════
router.get('/payment-providers', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        await (0, registry_1.ensurePaymentProviderConfigs)();
        const configs = await (0, registry_1.getAllProviderConfigs)();
        (0, helpers_1.successResponse)(res, configs);
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
router.patch('/payment-providers/:key', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { enabled } = req.body;
        if (typeof enabled !== 'boolean') {
            res.status(400).json({ success: false, message: 'enabled doit être true ou false' });
            return;
        }
        const config = await database_1.default.paymentProviderConfig.update({
            where: { key: req.params.key },
            data: { enabled },
        });
        (0, helpers_1.successResponse)(res, config, `${config.label} ${enabled ? 'activé' : 'désactivé'}`);
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
// Réouvrir le programme de parrainage — remet le budget dépensé à zéro
// et réactive le programme (à utiliser après une coupure automatique
// pour épuisement de budget, ou pour relancer une campagne).
router.post('/referral/reopen', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        await database_1.default.platformConfig.upsert({
            where: { key: 'referral_budget_spent' },
            update: { value: 0, draftValue: null },
            create: { key: 'referral_budget_spent', value: 0, label: 'Budget parrainage dépensé (FCFA)', description: 'Compteur système — géré automatiquement' },
        });
        await database_1.default.platformConfig.upsert({
            where: { key: 'referral_program_active' },
            update: { value: 1, draftValue: null },
            create: { key: 'referral_program_active', value: 1, label: 'Programme de parrainage actif', description: '1 = actif, 0 = désactivé' },
        });
        (0, helpers_1.successResponse)(res, {}, 'Programme de parrainage réouvert — budget remis à zéro');
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
exports.default = router;
//# sourceMappingURL=config.js.map