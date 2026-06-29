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
const router = (0, express_1.Router)();
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
        const pctKeys = [
            'commission_baobab_collection', 'commission_mentor', 'commission_guarantee',
            'payin_recovery', 'payin_repayment', 'withdrawal_fee_standard', 'withdrawal_fee_no_invest',
            'return_min'
        ];
        const monthKeys = ['grace_period_agriculture', 'grace_period_other'];
        if (pctKeys.includes(key) && (Number(value) < 0 || Number(value) > 50)) {
            res.status(400).json({ success: false, message: 'Taux doit être entre 0 et 50%' });
            return;
        }
        if (monthKeys.includes(key) && (Number(value) < 0 || Number(value) > 12)) {
            res.status(400).json({ success: false, message: 'Délai doit être entre 0 et 12 mois' });
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
exports.default = router;
//# sourceMappingURL=config.js.map