"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const registry_1 = require("../services/payments/registry");
const fees_1 = require("../config/fees");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
function successResponse(res, data, message = 'Succès') {
    res.json({ success: true, message, data });
}
function errorResponse(res, message = 'Erreur serveur') {
    res.status(500).json({ success: false, message });
}
const API_URL = process.env.API_URL || 'http://46.202.132.161:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://46.202.132.161:3000';
// Initier un dépôt via PayDunya
router.post('/deposit', auth_1.authenticate, async (req, res) => {
    try {
        const { amount, provider: providerKey = 'paydunya' } = req.body;
        if (!amount || amount < 1000) {
            res.status(400).json({ success: false, message: 'Montant minimum 1 000 FCFA' });
            return;
        }
        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!user) {
            res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
            return;
        }
        const provider = await (0, registry_1.getProvider)(providerKey);
        if (!provider) {
            res.status(400).json({ success: false, message: `Prestataire "${providerKey}" non disponible ou désactivé` });
            return;
        }
        // Créer transaction en attente
        const tx = await prisma.walletTransaction.create({
            data: {
                userId: req.userId,
                type: 'DEPOSIT',
                amount,
                status: 'PENDING',
                providerKey: provider.key,
                description: `Depot via ${provider.label} — ${amount.toLocaleString()} FCFA`
            }
        });
        // Initier le paiement via le prestataire choisi (PayDunya, KiaKiaPay, Stripe...)
        const payin = await provider.initPayin({
            amount,
            description: `Depot wallet KORAPACT — ${amount.toLocaleString()} FCFA`,
            callbackUrl: `${API_URL}/api/wallet/webhook/${provider.key}`,
            returnUrl: `${FRONTEND_URL}/wallet/deposit?status=success&txId=${tx.id}`,
            cancelUrl: `${FRONTEND_URL}/wallet/deposit?status=cancel&txId=${tx.id}`,
            customerName: `${user.firstName} ${user.lastName}`,
            customerEmail: user.email,
            customerPhone: user.phone,
            customData: { txId: tx.id, userId: req.userId, type: 'DEPOSIT' }
        });
        if (payin.success) {
            await prisma.walletTransaction.update({
                where: { id: tx.id },
                data: { providerRef: payin.token || null }
            });
            successResponse(res, {
                paymentUrl: payin.redirectUrl,
                token: payin.token,
                txId: tx.id,
                provider: provider.key,
            }, 'Paiement initié');
        }
        else {
            await prisma.walletTransaction.update({ where: { id: tx.id }, data: { status: 'FAILED' } });
            res.status(400).json({ success: false, message: payin.raw?.response_text || payin.raw?.error || 'Erreur lors de l\'initiation du paiement' });
        }
    }
    catch (e) {
        console.error(e);
        errorResponse(res);
    }
});
// Webhook PayDunya — appelé automatiquement après paiement
router.post('/webhook/paydunya', async (req, res) => {
    try {
        const body = req.body || {};
        const data = body.data || body;
        if (!data?.invoice?.token) {
            res.status(400).json({ success: false });
            return;
        }
        const provider = await (0, registry_1.getProvider)('paydunya');
        if (!provider) {
            res.status(400).json({ success: false });
            return;
        }
        // Vérifier le paiement auprès du prestataire
        const confirmation = await provider.checkPayin(data.invoice.token);
        const raw = confirmation.raw;
        if (!confirmation.success || raw?.status !== 'completed') {
            res.json({ success: false, message: 'Paiement non complété' });
            return;
        }
        const customData = raw?.custom_data || {};
        const txId = customData.txId;
        const userId = customData.userId;
        const amount = raw?.invoice?.total_amount;
        // Calcul marge opérateur — frais sécurisés vs taux réel configuré
        const payinRealRate = await prisma.platformConfig.findUnique({ where: { key: 'payin_operator_real' } });
        const payinSecuredRate = await prisma.platformConfig.findUnique({ where: { key: 'payin_recovery' } });
        const realRate = payinRealRate?.value || 3.5;
        const securedRate = payinSecuredRate?.value || 4;
        const operatorMargin = Math.round(amount * (securedRate - realRate) / 100);
        if (!txId || !userId || !amount) {
            res.status(400).json({ success: false });
            return;
        }
        const tx = await prisma.walletTransaction.findUnique({ where: { id: txId } });
        if (!tx || tx.status === 'COMPLETED') {
            res.json({ success: true });
            return;
        }
        await prisma.$transaction(async (p) => {
            await p.walletTransaction.update({
                where: { id: txId },
                data: { status: 'COMPLETED', processedAt: new Date() }
            });
            await p.wallet.update({
                where: { userId },
                data: {
                    balance: { increment: amount },
                    depositBalance: { increment: amount },
                    totalDeposited: { increment: amount },
                }
            });
            await p.notification.create({
                data: {
                    userId,
                    title: 'Depot confirme',
                    body: `${amount.toLocaleString()} FCFA ont ete credites sur votre wallet KORAPACT.`,
                    type: 'DEPOSIT_CONFIRMED',
                    data: JSON.stringify({ amount, txId })
                }
            });
        });
        // Enregistrer marge opérateur sur dépôt si positive
        if (operatorMargin > 0) {
            await prisma.platformRevenue.create({
                data: {
                    type: 'OPERATOR_MARGIN',
                    amount: operatorMargin,
                    description: `Marge opérateur dépôt — sécurisé ${securedRate}% vs réel ${realRate}% — ${amount.toLocaleString()} FCFA`
                }
            });
        }
        res.json({ success: true });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ success: false });
    }
});
// Vérifier manuellement un paiement (depuis le frontend après retour)
router.post('/deposit/verify/:txId', auth_1.authenticate, async (req, res) => {
    try {
        const tx = await prisma.walletTransaction.findUnique({ where: { id: req.params.txId } });
        if (!tx || tx.userId !== req.userId) {
            res.status(404).json({ success: false, message: 'Transaction introuvable' });
            return;
        }
        if (tx.status === 'COMPLETED') {
            successResponse(res, { status: 'COMPLETED', amount: tx.amount }, 'Depot confirme');
            return;
        }
        successResponse(res, { status: tx.status }, 'En attente de confirmation');
    }
    catch (e) {
        errorResponse(res);
    }
});
// Demande de retrait via PayDunya Payout
router.post('/withdraw', auth_1.authenticate, async (req, res) => {
    try {
        const { amount, phoneNumber, operator, provider: providerKey = 'paydunya' } = req.body;
        const minWithdraw = 5000;
        if (!amount || amount < minWithdraw) {
            res.status(400).json({ success: false, message: `Montant minimum de retrait : ${minWithdraw.toLocaleString()} FCFA` });
            return;
        }
        const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId } });
        if (!wallet || wallet.balance < amount) {
            res.status(400).json({ success: false, message: `Solde insuffisant. Disponible : ${wallet?.balance?.toLocaleString() || 0} FCFA` });
            return;
        }
        const provider = await (0, registry_1.getProvider)(providerKey);
        if (!provider || !provider.initPayout) {
            res.status(400).json({ success: false, message: `Prestataire "${providerKey}" non disponible pour les retraits` });
            return;
        }
        // Réserver les fonds immédiatement
        await prisma.wallet.update({
            where: { userId: req.userId },
            data: { balance: { decrement: amount } }
        });
        const tx = await prisma.walletTransaction.create({
            data: {
                userId: req.userId,
                type: 'WITHDRAWAL',
                amount,
                status: 'PENDING',
                phoneNumber,
                operator,
                providerKey: provider.key,
                description: `Retrait ${operator} — ${phoneNumber}`,
            }
        });
        // Règle retrait proportionnelle : 3% sur gains, 7% sur dépôts non investis
        const fees = await (0, fees_1.getFees)();
        const walletData = await prisma.wallet.findUnique({ where: { userId: req.userId } });
        const gainBal = walletData?.gainBalance || 0;
        const depositBal = walletData?.depositBalance || 0;
        // D'abord puiser dans les gains (3%), puis dans les dépôts (7%)
        const gainPart = Math.min(amount, gainBal);
        const depositPart = Math.max(0, amount - gainPart);
        const gainFee = Math.round(gainPart * fees.withdrawal_fee_standard / 100);
        const depositFee = Math.round(depositPart * fees.withdrawal_fee_no_invest / 100);
        const payoutFee = gainFee + depositFee;
        const netReceived = amount - payoutFee;
        const withdrawRate = amount > 0 ? ((payoutFee / amount) * 100).toFixed(1) : '0';
        const grossAmount = netReceived;
        // Créditer BAOBAB — si frais standard = 0%, BAOBAB absorbe le Payout réel 2%
        const adminW = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
        // Taux réel opérateur depuis config (configurable dans admin)
        const payoutRealConfig = await prisma.platformConfig.findUnique({ where: { key: 'payout_operator_real' } });
        const payoutSecuredConfig = await prisma.platformConfig.findUnique({ where: { key: 'payin_repayment' } });
        const payoutRealRate = payoutRealConfig?.value || 2.0;
        const payoutSecuredRate = payoutSecuredConfig?.value || 4.0;
        const realPayoutCost = Math.round(gainPart * payoutRealRate / 100);
        const payoutOperatorMargin = Math.round(gainPart * (payoutSecuredRate - payoutRealRate) / 100);
        if (adminW) {
            if (payoutFee > 0) {
                // Frais perçus sur dépôts anti-abus
                await prisma.wallet.update({
                    where: { userId: adminW.id },
                    data: { commissionBalance: { increment: payoutFee - realPayoutCost } }
                });
            }
            else if (realPayoutCost > 0) {
                // Retrait gratuit — BAOBAB absorbe le Payout réel depuis commissionBalance
                await prisma.wallet.update({
                    where: { userId: adminW.id },
                    data: { commissionBalance: { decrement: realPayoutCost } }
                });
            }
        }
        await prisma.platformRevenue.create({
            data: {
                type: 'WITHDRAWAL_FEE',
                amount: payoutFee - realPayoutCost,
                description: `Retrait — gains:${gainPart} gratuit (BAOBAB absorbe ${realPayoutCost} FCFA) + dépôts:${depositPart}@7% — ${phoneNumber || ''}`
            }
        });
        // Marge opérateur payout si positive
        if (payoutOperatorMargin > 0) {
            await prisma.platformRevenue.create({
                data: {
                    type: 'OPERATOR_MARGIN',
                    amount: payoutOperatorMargin,
                    description: `Marge opérateur retrait — sécurisé ${payoutSecuredRate}% vs réel ${payoutRealRate}% — gains: ${gainPart.toLocaleString()} FCFA`
                }
            });
        }
        // Décrémenter gainBalance et depositBalance
        await prisma.wallet.update({
            where: { userId: req.userId },
            data: {
                gainBalance: { decrement: gainPart },
                depositBalance: { decrement: depositPart },
            }
        });
        // Initier le payout via le prestataire choisi
        try {
            const payoutRes = await provider.initPayout({
                amount: grossAmount,
                phoneNumber,
                operator,
                description: `Retrait KORAPACT — ${amount.toLocaleString()} FCFA`
            });
            if (payoutRes.success) {
                await prisma.walletTransaction.update({
                    where: { id: tx.id },
                    data: { status: 'COMPLETED', processedAt: new Date() }
                });
                await prisma.wallet.update({
                    where: { userId: req.userId },
                    data: { totalWithdrawn: { increment: amount } }
                });
                await prisma.notification.create({
                    data: {
                        userId: req.userId,
                        title: 'Retrait confirme',
                        body: `${amount.toLocaleString()} FCFA ont ete envoyes sur votre ${operator} (${phoneNumber}).`,
                        type: 'WITHDRAWAL_CONFIRMED',
                        data: JSON.stringify({ amount })
                    }
                });
                successResponse(res, { txId: tx.id, status: 'COMPLETED' }, `${amount.toLocaleString()} FCFA envoyes sur votre ${operator}`);
            }
            else {
                // Payout échoué — rembourser le wallet et mettre en attente admin
                await prisma.wallet.update({ where: { userId: req.userId }, data: { balance: { increment: amount } } });
                await prisma.walletTransaction.update({ where: { id: tx.id }, data: { status: 'PENDING' } });
                // Notifier l'admin
                const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
                await prisma.notification.createMany({
                    data: admins.map(a => ({
                        userId: a.id,
                        title: 'Retrait a traiter manuellement',
                        body: `Retrait de ${amount.toLocaleString()} FCFA via ${operator} (${phoneNumber}) — ${provider.label}: ${payoutRes.raw?.response_text || 'echec'}`,
                        type: 'WITHDRAWAL_REQUEST',
                        data: JSON.stringify({ transactionId: tx.id })
                    }))
                });
                successResponse(res, { txId: tx.id, status: 'PENDING' }, 'Retrait en cours de traitement — sous 24h ouvrées');
            }
        }
        catch (payErr) {
            console.error('Payout error:', payErr);
            const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
            await prisma.notification.createMany({
                data: admins.map(a => ({
                    userId: a.id,
                    title: 'Retrait a traiter manuellement',
                    body: `Retrait de ${amount.toLocaleString()} FCFA via ${operator} — traitement manuel requis`,
                    type: 'WITHDRAWAL_REQUEST',
                    data: JSON.stringify({ transactionId: tx.id })
                }))
            });
            successResponse(res, { txId: tx.id, status: 'PENDING' }, 'Retrait enregistre — traitement sous 24h ouvrées');
        }
    }
    catch (e) {
        console.error(e);
        errorResponse(res);
    }
});
// Forcer confirmation — vérifier directement chez PayDunya
router.post('/deposit/force-confirm/:txId', auth_1.authenticate, async (req, res) => {
    try {
        const tx = await prisma.walletTransaction.findUnique({ where: { id: req.params.txId } });
        if (!tx || tx.userId !== req.userId || tx.type !== 'DEPOSIT') {
            res.status(404).json({ success: false });
            return;
        }
        if (tx.status === 'COMPLETED') {
            successResponse(res, { status: 'COMPLETED', amount: tx.amount });
            return;
        }
        // Extraire le token PayDunya depuis la description
        const tokenMatch = tx.description?.match(/token: (.+)/);
        if (tokenMatch) {
            const { checkPayin } = await Promise.resolve().then(() => __importStar(require('../services/paydunya')));
            const confirmation = await checkPayin(tokenMatch[1]);
            if (confirmation.status === 'completed') {
                await prisma.$transaction(async (p) => {
                    await p.walletTransaction.update({ where: { id: tx.id }, data: { status: 'COMPLETED', processedAt: new Date() } });
                    await p.wallet.update({ where: { userId: tx.userId }, data: { balance: { increment: tx.amount }, depositBalance: { increment: tx.amount }, totalDeposited: { increment: tx.amount } } });
                    await p.notification.create({
                        data: { userId: tx.userId, title: 'Depot confirme', body: `${tx.amount.toLocaleString()} FCFA credites sur votre wallet.`, type: 'DEPOSIT_CONFIRMED', data: JSON.stringify({ amount: tx.amount }) }
                    });
                });
                successResponse(res, { status: 'COMPLETED', amount: tx.amount }, 'Depot confirme');
                return;
            }
        }
        // Si pas de token ou pas complété — créditer quand même (mode test)
        if (process.env.PAYDUNYA_MODE === 'test') {
            await prisma.$transaction(async (p) => {
                await p.walletTransaction.update({ where: { id: tx.id }, data: { status: 'COMPLETED', processedAt: new Date() } });
                await p.wallet.update({ where: { userId: tx.userId }, data: { balance: { increment: tx.amount } } });
            });
            successResponse(res, { status: 'COMPLETED', amount: tx.amount }, 'Depot confirme (mode test)');
        }
        else {
            successResponse(res, { status: 'PENDING' }, 'En attente de confirmation PayDunya');
        }
    }
    catch (e) {
        console.error(e);
        errorResponse(res);
    }
});
// Admin — voir toutes les transactions
router.get('/admin/transactions', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { status, type } = req.query;
        const where = {};
        if (status && status !== 'ALL')
            where.status = status;
        if (type)
            where.type = type;
        const txs = await prisma.walletTransaction.findMany({
            where,
            include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } },
            orderBy: { createdAt: 'desc' },
            take: 200
        });
        successResponse(res, txs);
    }
    catch (e) {
        errorResponse(res);
    }
});
// Admin — approuver manuellement un retrait en attente
router.post('/admin/approve/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const tx = await prisma.walletTransaction.findUnique({
            where: { id: req.params.id },
            include: { user: true }
        });
        if (!tx || tx.status !== 'PENDING') {
            res.status(400).json({ success: false, message: 'Transaction introuvable ou déjà traitée' });
            return;
        }
        await prisma.$transaction(async (p) => {
            await p.walletTransaction.update({
                where: { id: tx.id },
                data: { status: 'COMPLETED', processedAt: new Date() }
            });
            if (tx.type === 'DEPOSIT') {
                await p.wallet.update({
                    where: { userId: tx.userId },
                    data: { balance: { increment: tx.amount } }
                });
                await p.notification.create({
                    data: {
                        userId: tx.userId,
                        title: 'Depot confirme',
                        body: `${tx.amount.toLocaleString()} FCFA ont ete credites sur votre wallet.`,
                        type: 'DEPOSIT_CONFIRMED',
                        data: JSON.stringify({ amount: tx.amount })
                    }
                });
            }
            else if (tx.type === 'WITHDRAWAL') {
                await p.wallet.update({
                    where: { userId: tx.userId },
                    data: { totalWithdrawn: { increment: tx.amount } }
                });
                await p.notification.create({
                    data: {
                        userId: tx.userId,
                        title: 'Retrait confirme',
                        body: `${tx.amount.toLocaleString()} FCFA ont ete envoyes sur votre ${tx.operator} (${tx.phoneNumber}).`,
                        type: 'WITHDRAWAL_CONFIRMED',
                        data: JSON.stringify({ amount: tx.amount })
                    }
                });
            }
        });
        successResponse(res, {}, 'Transaction validée');
    }
    catch (e) {
        console.error(e);
        errorResponse(res);
    }
});
// Admin — rejeter une demande
router.post('/admin/reject/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { reason } = req.body;
        const tx = await prisma.walletTransaction.findUnique({ where: { id: req.params.id } });
        if (!tx || tx.status !== 'PENDING') {
            res.status(400).json({ success: false, message: 'Transaction introuvable ou déjà traitée' });
            return;
        }
        await prisma.$transaction(async (p) => {
            await p.walletTransaction.update({
                where: { id: tx.id },
                data: { status: 'REJECTED', processedAt: new Date() }
            });
            if (tx.type === 'WITHDRAWAL') {
                await p.wallet.update({
                    where: { userId: tx.userId },
                    data: { balance: { increment: tx.amount } }
                });
            }
            await p.notification.create({
                data: {
                    userId: tx.userId,
                    title: tx.type === 'DEPOSIT' ? 'Depot rejete' : 'Retrait rejete',
                    body: `Votre ${tx.type === 'DEPOSIT' ? 'depot' : 'retrait'} de ${tx.amount.toLocaleString()} FCFA a ete rejete. Motif: ${reason || 'Non precise'}`,
                    type: 'TRANSACTION_REJECTED',
                    data: JSON.stringify({ amount: tx.amount, reason })
                }
            });
        });
        successResponse(res, {}, 'Transaction rejetée');
    }
    catch (e) {
        console.error(e);
        errorResponse(res);
    }
});
// GET /api/wallet/history — Historique transactions investisseur
router.get('/history', auth_1.authenticate, async (req, res) => {
    try {
        const { page = '1', limit = '20', type } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = { userId: req.userId };
        if (type)
            where.type = type;
        const [transactions, total, wallet] = await Promise.all([
            prisma.walletTransaction.findMany({
                where, skip, take: parseInt(limit),
                orderBy: { createdAt: 'desc' }
            }),
            prisma.walletTransaction.count({ where }),
            prisma.wallet.findUnique({ where: { userId: req.userId } })
        ]);
        successResponse(res, {
            transactions,
            total,
            pages: Math.ceil(total / parseInt(limit)),
            wallet: {
                balance: wallet?.balance || 0,
                depositBalance: wallet?.depositBalance || 0,
                gainBalance: wallet?.gainBalance || 0,
                totalDeposited: wallet?.totalDeposited || 0,
                totalWithdrawn: wallet?.totalWithdrawn || 0,
            }
        });
    }
    catch (e) {
        errorResponse(res);
    }
});
exports.default = router;
//# sourceMappingURL=wallet.js.map