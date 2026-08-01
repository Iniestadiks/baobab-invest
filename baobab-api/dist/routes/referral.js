"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const helpers_1 = require("../utils/helpers");
const router = (0, express_1.Router)();
// Mon code de parrainage + stats
router.get('/my', auth_1.authenticate, async (req, res) => {
    try {
        const user = await database_1.default.user.findUnique({
            where: { id: req.userId },
            select: { referralCode: true, referralCount: true, referralEarned: true, firstName: true }
        });
        if (!user) {
            res.status(404).json({ success: false });
            return;
        }
        // Générer code si absent
        if (!user.referralCode) {
            const code = Math.random().toString(36).substring(2, 8).toUpperCase();
            await database_1.default.user.update({ where: { id: req.userId }, data: { referralCode: code } });
            user.referralCode = code;
        }
        // Filleuls — avec statut du bonus (payé ou en attente de conditions)
        const referrals = await database_1.default.user.findMany({
            where: { referredBy: req.userId },
            select: { firstName: true, createdAt: true, totalInvested: true, referralBonusPaid: true }
        });
        // Montant du bonus — réglable dans l'admin, pas codé en dur
        const bonusConfig = await database_1.default.platformConfig.findUnique({ where: { key: 'referral_bonus_amount' } });
        const bonusPerReferral = bonusConfig?.value ?? 2000;
        const activeConfig = await database_1.default.platformConfig.findUnique({ where: { key: 'referral_program_active' } });
        const programActive = (activeConfig?.value ?? 1) === 1;
        (0, helpers_1.successResponse)(res, {
            referralCode: user.referralCode,
            referralCount: user.referralCount || referrals.filter(r => r.referralBonusPaid).length,
            referralEarned: user.referralEarned || 0,
            bonusPerReferral,
            programActive,
            referrals,
            shareLink: `${process.env.FRONTEND_URL || 'http://46.202.132.161:3000'}/auth/register?ref=${user.referralCode}`,
        });
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
// Appliquer un code de parrainage (appelé au register)
router.post('/apply', auth_1.authenticate, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            res.status(400).json({ success: false, message: 'Code requis' });
            return;
        }
        const parrain = await database_1.default.user.findFirst({ where: { referralCode: code.toUpperCase() } });
        if (!parrain) {
            res.status(404).json({ success: false, message: 'Code invalide' });
            return;
        }
        if (parrain.id === req.userId) {
            res.status(400).json({ success: false, message: 'Vous ne pouvez pas vous parrainer vous-même' });
            return;
        }
        const me = await database_1.default.user.findUnique({ where: { id: req.userId } });
        if (me?.referredBy) {
            res.status(400).json({ success: false, message: 'Vous avez déjà un parrain' });
            return;
        }
        // Enregistrer UNIQUEMENT le lien parrain/filleul — AUCUN bonus versé ici.
        // Le bonus n'est payé que plus tard, quand : le filleul a vérifié son KYC
        // ET fait son 1er investissement, ET le parrain a lui-même déjà investi.
        // Voir services/referralService.ts (déclenché depuis investments.ts).
        await database_1.default.user.update({
            where: { id: req.userId },
            data: { referredBy: parrain.id }
        });
        await database_1.default.notification.create({
            data: {
                userId: parrain.id,
                title: '🌱 Nouveau filleul inscrit !',
                body: `${me?.firstName || 'Un filleul'} a rejoint KORAPACT avec votre code. Le bonus sera crédité dès que vous aurez tous les deux investi.`,
                type: 'REFERRAL_PENDING',
                data: { filleulId: req.userId }
            }
        });
        (0, helpers_1.successResponse)(res, {}, 'Code appliqué ! Le bonus de parrainage sera versé dès que le filleul et le parrain auront investi.');
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
exports.default = router;
//# sourceMappingURL=referral.js.map