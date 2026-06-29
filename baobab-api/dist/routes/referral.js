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
const REFERRAL_BONUS = 2500; // FCFA bonus pour le parrain
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
        // Filleuls
        const referrals = await database_1.default.user.findMany({
            where: { referredBy: req.userId },
            select: { firstName: true, createdAt: true, totalInvested: true }
        });
        (0, helpers_1.successResponse)(res, {
            referralCode: user.referralCode,
            referralCount: user.referralCount || referrals.length,
            referralEarned: user.referralEarned || 0,
            bonusPerReferral: REFERRAL_BONUS,
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
        // Vérifier si déjà parrainé
        const me = await database_1.default.user.findUnique({ where: { id: req.userId } });
        if (me?.referredBy) {
            res.status(400).json({ success: false, message: 'Vous avez déjà un parrain' });
            return;
        }
        // Appliquer le parrainage
        await database_1.default.$transaction([
            // Enregistrer le parrain
            database_1.default.user.update({
                where: { id: req.userId },
                data: { referredBy: parrain.id }
            }),
            // Créditer le bonus au parrain
            database_1.default.wallet.update({
                where: { userId: parrain.id },
                data: { balance: { increment: REFERRAL_BONUS } }
            }),
            // Mettre à jour stats parrain
            database_1.default.user.update({
                where: { id: parrain.id },
                data: { referralCount: { increment: 1 }, referralEarned: { increment: REFERRAL_BONUS } }
            }),
            // Notifier le parrain
            database_1.default.notification.create({
                data: {
                    userId: parrain.id,
                    title: '🎁 Nouveau filleul !',
                    body: `${me?.firstName} a rejoint BAOBAB INVEST avec votre code. Bonus de ${REFERRAL_BONUS.toLocaleString()} FCFA crédité !`,
                    type: 'REFERRAL_BONUS',
                    data: { amount: REFERRAL_BONUS }
                }
            })
        ]);
        (0, helpers_1.successResponse)(res, { bonus: REFERRAL_BONUS }, `Code appliqué ! ${parrain.firstName} a reçu ${REFERRAL_BONUS.toLocaleString()} FCFA de bonus.`);
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
exports.default = router;
//# sourceMappingURL=referral.js.map