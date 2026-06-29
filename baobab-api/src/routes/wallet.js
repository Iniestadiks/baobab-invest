import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireAdmin } from '../middleware/auth';
import { initPayin, checkPayin, initPayout } from '../services/paydunya';
import { getFees } from '../config/fees';
const router = Router();
const prisma = new PrismaClient();
function successResponse(res, data, message = 'Succès') {
    res.json({ success: true, message, data });
}
function errorResponse(res, message = 'Erreur serveur') {
    res.status(500).json({ success: false, message });
}
const API_URL = process.env.API_URL || 'http://46.202.132.161:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://46.202.132.161:3000';
// Initier un dépôt via PayDunya
router.post('/deposit', authenticate, async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount < 1000) {
            res.status(400).json({ success: false, message: 'Montant minimum 1 000 FCFA' });
            return;
        }
        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!user) {
            res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
            return;
        }
        // Créer transaction en attente
        const tx = await prisma.walletTransaction.create({
            data: {
                userId: req.userId,
                type: 'DEPOSIT',
                amount,
                status: 'PENDING',
                description: `Depot via PayDunya — ${amount.toLocaleString()} FCFA`
            }
        });
        // Initier paiement PayDunya
        const paydunyaRes = await initPayin({
            amount,
            description: `Depot wallet KORAPACT — ${amount.toLocaleString()} FCFA`,
            callbackUrl: `${API_URL}/api/wallet/webhook/paydunya`,
            returnUrl: `${FRONTEND_URL}/wallet/deposit?status=success&txId=${tx.id}`,
            cancelUrl: `${FRONTEND_URL}/wallet/deposit?status=cancel&txId=${tx.id}`,
            customerName: `${user.firstName} ${user.lastName}`,
            customerEmail: user.email,
            customerPhone: user.phone,
            customData: { txId: tx.id, userId: req.userId, type: 'DEPOSIT' }
        });
        if (paydunyaRes.response_code === '00') {
            // Sauvegarder le token PayDunya
            await prisma.walletTransaction.update({
                where: { id: tx.id },
                data: { description: `Depot PayDunya — token: ${paydunyaRes.token}` }
            });
            successResponse(res, {
                paymentUrl: paydunyaRes.response_text,
                token: paydunyaRes.token,
                txId: tx.id
            }, 'Paiement initié');
        }
        else {
            await prisma.walletTransaction.update({ where: { id: tx.id }, data: { status: 'FAILED' } });
            res.status(400).json({ success: false, message: paydunyaRes.response_text || 'Erreur PayDunya' });
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
        // Vérifier le paiement
        const confirmation = await checkPayin(data.invoice.token);
        if (confirmation.status !== 'completed') {
            res.json({ success: false, message: 'Paiement non complété' });
            return;
        }
        const customData = confirmation.custom_data || {};
        const txId = customData.txId;
        const userId = customData.userId;
        const amount = confirmation.invoice?.total_amount;
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
router.post('/deposit/verify/:txId', authenticate, async (req, res) => {
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
router.post('/withdraw', authenticate, async (req, res) => {
    try {
        const { amount, phoneNumber, operator } = req.body;
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
                description: `Retrait ${operator} — ${phoneNumber}`,
            }
        });
        // Règle retrait proportionnelle : 3% sur gains, 7% sur dépôts non investis
        const fees = await getFees();
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
        // Initier le payout PayDunya automatiquement
        try {
            const payoutRes = await initPayout({
                amount: grossAmount,
                phoneNumber,
                operator,
                description: `Retrait KORAPACT — ${amount.toLocaleString()} FCFA`
            });
            if (payoutRes.response_code === '00') {
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
                        body: `Retrait de ${amount.toLocaleString()} FCFA via ${operator} (${phoneNumber}) — PayDunya: ${payoutRes.response_text}`,
                        type: 'WITHDRAWAL_REQUEST',
                        data: JSON.stringify({ transactionId: tx.id })
                    }))
                });
                successResponse(res, { txId: tx.id, status: 'PENDING' }, 'Retrait en cours de traitement — sous 24h ouvrées');
            }
        }
        catch (payErr) {
            console.error('PayDunya payout error:', payErr);
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
router.post('/deposit/force-confirm/:txId', authenticate, async (req, res) => {
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
            const { checkPayin } = await import('../services/paydunya');
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
router.get('/admin/transactions', authenticate, requireAdmin, async (req, res) => {
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
router.post('/admin/approve/:id', authenticate, requireAdmin, async (req, res) => {
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
router.post('/admin/reject/:id', authenticate, requireAdmin, async (req, res) => {
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
router.get('/history', authenticate, async (req, res) => {
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
export default router;
