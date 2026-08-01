"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const helpers_1 = require("../utils/helpers");
const auth_2 = require("./auth");
const fees_1 = require("../config/fees");
const router = (0, express_1.Router)();
// ═══════════════════════════════════════════════════════
// HELPERS INTERNES
// ═══════════════════════════════════════════════════════
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string')
        return forwarded.split(',')[0].trim();
    return req.socket?.remoteAddress || 'unknown';
}
/** Logique cohérente : un utilisateur est bloqué si isBanned=true ET la date de réhabilitation n'est pas passée. */
function isBannedNow(isBanned, rehabilitationAt) {
    if (!isBanned)
        return false;
    if (rehabilitationAt && new Date() > rehabilitationAt)
        return false;
    return true;
}
function computeAccountStatus(user) {
    if (!user.isActive)
        return 'DISABLED';
    if (user.isBanned && user.rehabilitationAt && new Date() > user.rehabilitationAt)
        return 'ACTIVE'; // expiré
    if (user.isBanned && user.rehabilitationAt)
        return 'TEMP_BANNED';
    if (user.isBanned)
        return 'BANNED';
    if (!user.isEmailVerified)
        return 'UNVERIFIED';
    return 'ACTIVE';
}
// ═══════════════════════════════════════════════════════
// LISTE DES UTILISATEURS — recherche, filtres, tri, pagination
// ═══════════════════════════════════════════════════════
router.get('/users', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { search = '', role = '', status = '', kycStatus: kycFilter = '', sort = 'createdAt', order = 'desc', page = '1', limit = '20', } = req.query;
        const where = {
            role: { not: 'ADMIN' }, // Les admins ne sont pas listés ici
        };
        // Recherche texte
        if (search.trim()) {
            where.OR = [
                { firstName: { contains: search.trim(), mode: 'insensitive' } },
                { lastName: { contains: search.trim(), mode: 'insensitive' } },
                { email: { contains: search.trim(), mode: 'insensitive' } },
                { phone: { contains: search.trim() } },
            ];
        }
        // Filtre par rôle
        if (role && role !== 'ALL') {
            where.role = role;
        }
        // Filtre par statut de compte
        if (status && status !== 'ALL') {
            if (status === 'ACTIVE') {
                where.isActive = true;
                where.isBanned = false;
            }
            if (status === 'DISABLED') {
                where.isActive = false;
            }
            if (status === 'BANNED') {
                where.isBanned = true;
                where.rehabilitationAt = null;
            }
            if (status === 'TEMP_BANNED') {
                where.isBanned = true;
                where.rehabilitationAt = { not: null };
            }
            if (status === 'UNVERIFIED') {
                where.isEmailVerified = false;
                where.isActive = true;
                where.isBanned = false;
            }
        }
        // Filtre par statut KYC
        if (kycFilter && kycFilter !== 'ALL') {
            if (kycFilter === 'NOT_SUBMITTED') {
                where.kycStatus = null;
            }
            else {
                where.kycStatus = kycFilter;
            }
        }
        const take = Math.min(Math.max(Number(limit) || 20, 1), 100);
        const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
        // Tri autorisé
        const allowedSorts = {
            createdAt: true, firstName: true, lastName: true, email: true, totalInvested: true, reputationScore: true
        };
        const sortField = allowedSorts[sort] ? sort : 'createdAt';
        const sortOrder = order === 'asc' ? 'asc' : 'desc';
        const [users, total] = await Promise.all([
            database_1.default.user.findMany({
                where,
                skip,
                take,
                orderBy: { [sortField]: sortOrder },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    role: true,
                    city: true,
                    country: true,
                    kycStatus: true,
                    kycDocumentUrl: true,
                    kycSelfieUrl: true,
                    kycRccmUrl: true,
                    kycSubmittedAt: true,
                    kycVerifiedAt: true,
                    kycRejectedReason: true,
                    kycDocumentExpiry: true,
                    kycDocumentType: true,
                    kycAttempts: true,
                    kycNotes: true,
                    isActive: true,
                    isBanned: true,
                    banReason: true,
                    bannedAt: true,
                    rehabilitationAt: true,
                    isEmailVerified: true,
                    reputationScore: true,
                    level: true,
                    referralCode: true,
                    referralCount: true,
                    totalInvested: true,
                    createdAt: true,
                    wallet: { select: { balance: true, escrowBalance: true, totalInvested: true } },
                },
            }),
            database_1.default.user.count({ where }),
        ]);
        // Enrichir avec statut calculé
        const enriched = users.map(u => ({
            ...u,
            accountStatus: computeAccountStatus(u),
        }));
        (0, helpers_1.successResponse)(res, {
            users: enriched,
            total,
            page: Number(page),
            pages: Math.ceil(total / take),
            perPage: take,
        });
    }
    catch (e) {
        console.error('[ADMIN] Erreur GET /users:', e);
        (0, helpers_1.errorResponse)(res);
    }
});
// ═══════════════════════════════════════════════════════
// BANNISSEMENT — définitif ou temporaire
// ═══════════════════════════════════════════════════════
router.post('/users/:id/ban', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { reason, until } = req.body;
        const targetId = String(req.params.id);
        const adminId = req.userId;
        // Un admin ne peut pas se bannir lui-même
        if (targetId === adminId) {
            res.status(400).json({ success: false, message: 'Vous ne pouvez pas vous bloquer vous-même' });
            return;
        }
        const target = await database_1.default.user.findUnique({ where: { id: targetId } });
        if (!target) {
            res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
            return;
        }
        if (target.role === 'ADMIN') {
            res.status(403).json({ success: false, message: 'Impossible de bloquer un administrateur depuis ce panneau' });
            return;
        }
        const rehabilitationAt = until ? new Date(until) : null;
        if (rehabilitationAt && rehabilitationAt <= new Date()) {
            res.status(400).json({ success: false, message: 'La date de déblocage doit être dans le futur' });
            return;
        }
        const updated = await database_1.default.user.update({
            where: { id: targetId },
            data: {
                isBanned: true,
                isActive: rehabilitationAt ? true : false, // temporaire = reste actif techniquement, définitif = désactivé
                banReason: reason || 'Bloqué par un administrateur',
                bannedAt: new Date(),
                rehabilitationAt,
            },
        });
        await (0, auth_2.logAdminAction)(adminId, rehabilitationAt ? 'BAN_TEMP' : 'BAN_PERMANENT', targetId, `${reason || 'Aucune raison fournie'}${rehabilitationAt ? ` — jusqu'au ${rehabilitationAt.toLocaleDateString('fr-FR')}` : ''}`, getClientIp(req), req.headers['user-agent'] || 'unknown');
        const msg = rehabilitationAt
            ? `Utilisateur bloqué temporairement jusqu'au ${rehabilitationAt.toLocaleDateString('fr-FR')}`
            : 'Utilisateur bloqué définitivement';
        (0, helpers_1.successResponse)(res, { id: updated.id, accountStatus: computeAccountStatus(updated) }, msg);
    }
    catch (e) {
        console.error('[ADMIN] Erreur ban:', e);
        (0, helpers_1.errorResponse)(res);
    }
});
// ═══════════════════════════════════════════════════════
// DÉBLOCAGE
// ═══════════════════════════════════════════════════════
router.post('/users/:id/unban', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const targetId = String(req.params.id);
        const adminId = req.userId;
        const target = await database_1.default.user.findUnique({ where: { id: targetId } });
        if (!target) {
            res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
            return;
        }
        const updated = await database_1.default.user.update({
            where: { id: targetId },
            data: {
                isBanned: false,
                isActive: true,
                banReason: null,
                bannedAt: null,
                rehabilitationAt: null,
            },
        });
        await (0, auth_2.logAdminAction)(adminId, 'UNBAN', targetId, 'Utilisateur débloqué manuellement', getClientIp(req), req.headers['user-agent'] || 'unknown');
        (0, helpers_1.successResponse)(res, { id: updated.id, accountStatus: computeAccountStatus(updated) }, 'Utilisateur débloqué');
    }
    catch (e) {
        console.error('[ADMIN] Erreur unban:', e);
        (0, helpers_1.errorResponse)(res);
    }
});
// ═══════════════════════════════════════════════════════
// DÉSACTIVATION / RÉACTIVATION
// ═══════════════════════════════════════════════════════
router.patch('/users/:id/toggle-active', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const targetId = String(req.params.id);
        const adminId = req.userId;
        if (targetId === adminId) {
            res.status(400).json({ success: false, message: 'Vous ne pouvez pas vous désactiver vous-même' });
            return;
        }
        const target = await database_1.default.user.findUnique({ where: { id: targetId } });
        if (!target) {
            res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
            return;
        }
        if (target.role === 'ADMIN') {
            res.status(403).json({ success: false, message: 'Action non autorisée sur un administrateur' });
            return;
        }
        const newActive = !target.isActive;
        const updated = await database_1.default.user.update({
            where: { id: targetId },
            data: { isActive: newActive },
        });
        await (0, auth_2.logAdminAction)(adminId, newActive ? 'REACTIVATE' : 'DEACTIVATE', targetId, newActive ? 'Compte réactivé' : 'Compte désactivé', getClientIp(req), req.headers['user-agent'] || 'unknown');
        (0, helpers_1.successResponse)(res, { id: updated.id, isActive: updated.isActive }, newActive ? 'Compte réactivé' : 'Compte désactivé');
    }
    catch (e) {
        console.error('[ADMIN] Erreur toggle-active:', e);
        (0, helpers_1.errorResponse)(res);
    }
});
// ═══════════════════════════════════════════════════════
// SUPPRESSION SÉCURISÉE D'UN UTILISATEUR
// Un utilisateur avec des données financières ne peut pas être supprimé physiquement.
// On propose alors une anonymisation ou un blocage.
// ═══════════════════════════════════════════════════════
router.delete('/users/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const targetId = String(req.params.id);
        const adminId = req.userId;
        if (targetId === adminId) {
            res.status(400).json({ success: false, message: 'Vous ne pouvez pas supprimer votre propre compte' });
            return;
        }
        const target = await database_1.default.user.findUnique({ where: { id: targetId } });
        if (!target) {
            res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
            return;
        }
        if (target.role === 'ADMIN') {
            res.status(403).json({ success: false, message: 'Impossible de supprimer un administrateur depuis ce panneau' });
            return;
        }
        // Vérifier l'existence de données financières
        const [investCount, projectCount, txCount] = await Promise.all([
            database_1.default.investment.count({ where: { userId: targetId } }),
            database_1.default.project.count({ where: { OR: [{ entrepreneurId: targetId }, { mentorId: targetId }] } }),
            database_1.default.transaction.count({ where: { userId: targetId } }),
        ]);
        if (investCount > 0 || projectCount > 0 || txCount > 0) {
            res.status(409).json({
                success: false,
                message: `Impossible de supprimer : cet utilisateur a ${investCount} investissement(s), ${projectCount} projet(s) et ${txCount} transaction(s). Utilisez plutôt le blocage définitif ou l'anonymisation.`,
                canAnonymize: true,
            });
            return;
        }
        // Suppression physique en transaction — uniquement si aucune donnée financière
        await database_1.default.$transaction([
            database_1.default.notification.deleteMany({ where: { userId: targetId } }),
            database_1.default.message.deleteMany({ where: { OR: [{ fromUserId: targetId }, { toUserId: targetId }] } }),
            database_1.default.postReaction.deleteMany({ where: { userId: targetId } }),
            database_1.default.post.deleteMany({ where: { authorId: targetId } }),
            database_1.default.savingsPlan.deleteMany({ where: { userId: targetId } }),
            database_1.default.walletTransaction.deleteMany({ where: { userId: targetId } }),
            database_1.default.reputationEvent.deleteMany({ where: { userId: targetId } }),
            database_1.default.userBadge.deleteMany({ where: { userId: targetId } }),
            database_1.default.monthlyRanking.deleteMany({ where: { userId: targetId } }),
            database_1.default.fundBadge.deleteMany({ where: { userId: targetId } }),
            database_1.default.fundContribution.updateMany({ where: { userId: targetId }, data: { userId: null } }),
            database_1.default.builderProfile.deleteMany({ where: { userId: targetId } }),
            database_1.default.wallet.deleteMany({ where: { userId: targetId } }),
            database_1.default.user.delete({ where: { id: targetId } }),
        ]);
        await (0, auth_2.logAdminAction)(adminId, 'DELETE_USER', targetId, `Suppression physique — email: ${target.email}`, getClientIp(req), req.headers['user-agent'] || 'unknown');
        (0, helpers_1.successResponse)(res, {}, 'Utilisateur supprimé définitivement');
    }
    catch (e) {
        console.error('[ADMIN] Erreur delete user:', e);
        (0, helpers_1.errorResponse)(res);
    }
});
// ═══════════════════════════════════════════════════════
// ANONYMISATION — pour les comptes avec données financières
// ═══════════════════════════════════════════════════════
router.patch('/users/:id/anonymize', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const targetId = String(req.params.id);
        const adminId = req.userId;
        const target = await database_1.default.user.findUnique({ where: { id: targetId } });
        if (!target) {
            res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
            return;
        }
        if (target.role === 'ADMIN') {
            res.status(403).json({ success: false, message: 'Non autorisé' });
            return;
        }
        const anon = `anon_${Date.now()}`;
        await database_1.default.user.update({
            where: { id: targetId },
            data: {
                firstName: 'Utilisateur',
                lastName: 'Supprimé',
                email: `${anon}@deleted.korapact.com`,
                phone: anon,
                bio: null,
                profileImageUrl: null,
                city: null,
                country: 'SN',
                isActive: false,
                isBanned: true,
                banReason: 'Compte anonymisé à la demande de l\'utilisateur ou par décision administrative',
            },
        });
        await (0, auth_2.logAdminAction)(adminId, 'ANONYMIZE', targetId, 'Données personnelles anonymisées', getClientIp(req), req.headers['user-agent'] || 'unknown');
        (0, helpers_1.successResponse)(res, {}, 'Compte anonymisé — données personnelles effacées, historique financier conservé');
    }
    catch (e) {
        console.error('[ADMIN] Erreur anonymize:', e);
        (0, helpers_1.errorResponse)(res);
    }
});
// ═══════════════════════════════════════════════════════
// KYC — Valider
// ═══════════════════════════════════════════════════════
router.post('/users/:id/verify-kyc', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const user = await database_1.default.user.update({
            where: { id: String(req.params.id) },
            data: { kycStatus: 'VERIFIED', kycVerifiedAt: new Date() },
        });
        await database_1.default.notification.create({
            data: {
                userId: user.id,
                title: '✅ KYC Validé !',
                body: 'Ton identité a été vérifiée. Tu peux maintenant investir et retirer des fonds.',
                type: 'KYC_VERIFIED',
            },
        });
        await (0, auth_2.logAdminAction)(req.userId, 'KYC_VERIFY', user.id, 'KYC validé', getClientIp(req), req.headers['user-agent'] || 'unknown');
        (0, helpers_1.successResponse)(res, user, 'KYC validé');
    }
    catch (e) {
        console.error('[ADMIN] Erreur verify-kyc:', e);
        (0, helpers_1.errorResponse)(res);
    }
});
// ═══════════════════════════════════════════════════════
// KYC — Rejeter
// ═══════════════════════════════════════════════════════
router.post('/users/:id/reject-kyc', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason) {
            res.status(400).json({ success: false, message: 'Une raison de rejet est obligatoire' });
            return;
        }
        const user = await database_1.default.user.update({
            where: { id: String(req.params.id) },
            data: { kycStatus: 'REJECTED', kycRejectedReason: reason },
        });
        await database_1.default.notification.create({
            data: {
                userId: user.id,
                title: '❌ KYC Rejeté',
                body: `Raison : ${reason}. Merci de soumettre à nouveau tes documents.`,
                type: 'KYC_REJECTED',
            },
        });
        await (0, auth_2.logAdminAction)(req.userId, 'KYC_REJECT', user.id, `KYC rejeté — ${reason}`, getClientIp(req), req.headers['user-agent'] || 'unknown');
        (0, helpers_1.successResponse)(res, user, 'KYC rejeté');
    }
    catch (e) {
        console.error('[ADMIN] Erreur reject-kyc:', e);
        (0, helpers_1.errorResponse)(res);
    }
});
// ═══════════════════════════════════════════════════════
// STATS GLOBALES
// ═══════════════════════════════════════════════════════
router.get('/stats', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const [totalUsers, totalProjects, pendingReviewProjects, totalInvestments, pendingKyc, revenues, investmentsAgg, walletAgg, txPending, builders,] = await Promise.all([
            database_1.default.user.count(),
            database_1.default.project.count(),
            database_1.default.project.count({ where: { status: 'PENDING_REVIEW' } }),
            database_1.default.investment.count(),
            database_1.default.user.count({ where: { kycStatus: 'PENDING' } }),
            database_1.default.platformRevenue.groupBy({ by: ['type'], _sum: { amount: true } }),
            database_1.default.investment.aggregate({ _sum: { amount: true, guaranteeContribution: true }, _count: true }),
            database_1.default.wallet.aggregate({
                where: { user: { role: 'ADMIN' } },
                _sum: { balance: true, commissionBalance: true, guaranteeBalance: true },
            }),
            database_1.default.walletTransaction.count({ where: { status: 'PENDING' } }),
            database_1.default.user.count({ where: { role: 'BUILDER' } }),
        ]);
        const projectsByStatus = await database_1.default.project.groupBy({
            by: ['status'], _count: true, _sum: { raisedAmount: true, goalAmount: true },
        });
        const activeInvestors = await database_1.default.user.count({
            where: { role: 'INVESTOR', investments: { some: {} } },
        });
        const revenueMap = {};
        revenues.forEach(r => { revenueMap[r.type] = r._sum.amount || 0; });
        const totalRevenuBAOBAB = (revenueMap.COMMISSION_COLLECTION || 0) + (revenueMap.PAYIN_RECOVERY || 0);
        const totalLeve = investmentsAgg._sum.amount || 0;
        const totalAssurance = investmentsAgg._sum.guaranteeContribution || 0;
        const configRates = await database_1.default.platformConfig.findMany();
        const rateMap = {};
        configRates.forEach(c => { rateMap[c.key] = c.value; });
        (0, helpers_1.successResponse)(res, {
            baobabRate: rateMap.commission_baobab_collection || 6,
            payinRate: rateMap.payin_recovery || 4,
            payinRepayRate: rateMap.payin_repayment || 4,
            mentorRate: rateMap.commission_mentor || 2,
            guarRate: rateMap.commission_guarantee || 2,
            payinOperatorReal: 3.5,
            payoutOperatorReal: 2.0,
            totalUsers, activeInvestors, pendingKyc, builders,
            totalProjects, pendingReviewProjects, projectsByStatus,
            activeProjects: projectsByStatus.find(p => p.status === 'ACTIVE')?._count || 0,
            fundedProjects: projectsByStatus.find(p => p.status === 'FUNDED')?._count || 0,
            completedProjects: projectsByStatus.find(p => p.status === 'COMPLETED')?._count || 0,
            totalInvestments, totalLeve, totalAssurance,
            adminBalance: walletAgg._sum.balance || 0,
            commissionBalance: walletAgg._sum.commissionBalance || 0,
            guaranteeBalance: walletAgg._sum.guaranteeBalance || 0,
            totalRevenuBAOBAB,
            totalPayinRepayment: revenueMap.PAYIN_REPAYMENT || 0,
            totalMentorCommission: revenueMap.MENTOR_COMMISSION || 0,
            totalGuaranteeFund: revenueMap.GUARANTEE_FEE || 0,
            revenueTotal: totalRevenuBAOBAB + (revenueMap.PAYIN_REPAYMENT || 0),
            txPending,
        });
    }
    catch (e) {
        console.error('[ADMIN] Erreur stats:', e);
        (0, helpers_1.errorResponse)(res);
    }
});
// ═══════════════════════════════════════════════════════
// CHANGER LE RÔLE D'UN UTILISATEUR
// ═══════════════════════════════════════════════════════
router.patch('/users/:userId/role', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        const validRoles = ['INVESTOR', 'ENTREPRENEUR', 'MENTOR', 'BUILDER'];
        if (!role || !validRoles.includes(role)) {
            res.status(400).json({ success: false, message: 'Rôle invalide. Valeurs autorisées : INVESTOR, ENTREPRENEUR, MENTOR, BUILDER' });
            return;
        }
        if (String(req.params.userId) === req.userId) {
            res.status(400).json({ success: false, message: 'Vous ne pouvez pas modifier votre propre rôle' });
            return;
        }
        const user = await database_1.default.user.update({
            where: { id: String(req.params.userId) },
            data: { role: role },
        });
        await (0, auth_2.logAdminAction)(req.userId, 'CHANGE_ROLE', String(req.params.userId), `Rôle changé en ${role}`, getClientIp(req), req.headers['user-agent'] || 'unknown');
        (0, helpers_1.successResponse)(res, user, `Rôle modifié en ${role}`);
    }
    catch (e) {
        console.error('[ADMIN] Erreur change role:', e);
        (0, helpers_1.errorResponse)(res);
    }
});
// ═══════════════════════════════════════════════════════
// TOUS LES PROJETS (administration)
// ═══════════════════════════════════════════════════════
router.get('/projects/all', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const projects = await database_1.default.project.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                entrepreneur: { select: { firstName: true, lastName: true } },
                mentor: { select: { firstName: true, lastName: true } },
                investments: {
                    select: {
                        id: true, amount: true, expectedReturn: true,
                        guaranteeContribution: true, sharePercent: true, status: true,
                    },
                },
                _count: { select: { investments: true } },
            },
        });
        (0, helpers_1.successResponse)(res, { projects });
    }
    catch (e) {
        console.error('[ADMIN] Erreur projects/all:', e);
        (0, helpers_1.errorResponse)(res);
    }
});
// ═══════════════════════════════════════════════════════
// FINANCES DÉTAILLÉES PAR PROJET
// ═══════════════════════════════════════════════════════
router.get('/finances/details', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const projects = await database_1.default.project.findMany({
            include: {
                investments: {
                    select: {
                        amount: true, expectedReturn: true, guaranteeContribution: true,
                        sharePercent: true, status: true, createdAt: true,
                        user: { select: { firstName: true, lastName: true } },
                    },
                },
                milestones: {
                    include: {
                        payments: { include: { supplier: { select: { companyName: true } } } },
                    },
                },
                entrepreneur: { select: { firstName: true, lastName: true } },
                mentor: { select: { firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        const investorWallets = await database_1.default.wallet.findMany({
            where: { user: { role: 'INVESTOR' } },
            select: { escrowBalance: true, balance: true, gainBalance: true },
        });
        const totalEscrowInvestors = investorWallets.reduce((s, w) => s + w.escrowBalance, 0);
        const totalInvestorBalances = investorWallets.reduce((s, w) => s + w.balance, 0);
        const totalGainBalances = investorWallets.reduce((s, w) => s + w.gainBalance, 0);
        // IMPORTANT : taux FIGÉS par projet (getProjectFees), jamais recalculés
        // avec la config actuelle — sinon les chiffres de ce tableau (source pour
        // la comptabilité/déclarations fiscales) ne correspondent plus à ce qui
        // a réellement été prélevé/versé au moment de chaque transaction.
        const projectsDetails = await Promise.all(projects.map(async (p) => {
            const totalInvested = p.investments.reduce((s, i) => s + i.amount, 0);
            const projectFees = await (0, fees_1.getProjectFees)(p);
            const baobabPct = projectFees.commission_baobab_collection;
            const payinPct = projectFees.payin_recovery;
            const mentorPct = projectFees.commission_mentor;
            const payinRepayPct = projectFees.payin_repayment;
            const fraisFixesPct = baobabPct + payinPct + (p.mentorId ? mentorPct : 0);
            const baobabOnCollection = Math.round((p.goalAmount || 0) * baobabPct / 100);
            const mentorFee = p.mentorId ? Math.round((p.goalAmount || 0) * mentorPct / 100) : 0;
            const paydunyaPayin = Math.round((p.goalAmount || 0) * payinPct / 100);
            const guaranteeFee = p.investments.reduce((s, i) => s + (i.guaranteeContribution || 0), 0);
            const netAmount = p.netAmount || Math.round((p.goalAmount || 0) * (1 - fraisFixesPct / 100));
            const returnRate = p.expectedReturn || projectFees.return_min;
            const totalRemb = Math.round(netAmount * (1 + returnRate / 100));
            const payinOnRepayment = Math.round(totalRemb * payinRepayPct / 100);
            const totalExpectedReturn = p.investments.reduce((s, i) => s + (i.expectedReturn || 0), 0);
            const totalFournisseurs = p.milestones.reduce((s, m) => s + m.payments.filter(pay => pay.status === 'COMPLETED').reduce((ss, pay) => ss + pay.amount, 0), 0);
            const fournisseursPending = p.milestones.reduce((s, m) => s + m.payments.filter(pay => pay.status === 'PENDING').reduce((ss, pay) => ss + pay.amount, 0), 0);
            return {
                id: p.id, title: p.title, sector: p.sector, status: p.status,
                entrepreneur: `${p.entrepreneur?.firstName} ${p.entrepreneur?.lastName}`,
                mentor: p.mentor ? `${p.mentor.firstName} ${p.mentor.lastName}` : null,
                goalAmount: p.goalAmount, netAmount, totalInvested, cagnotteNette: netAmount,
                investorCount: p.investments.length, expectedReturn: p.expectedReturn,
                totalExpectedReturn, netInvestors: totalExpectedReturn,
                baobabOnCollection, mentorFee, guaranteeFee, paydunyaPayin,
                baobabOnReturn: payinOnRepayment, revenueNetBAOBABProjet: baobabOnCollection,
                totalFournisseurs, fournisseursPending,
                milestones: p.milestones.map(m => ({
                    title: m.title, amount: m.amount, status: m.status,
                    payments: m.payments.map(pay => ({
                        supplier: pay.supplier?.companyName,
                        amount: pay.amount, status: pay.status,
                    })),
                })),
                investors: p.investments.map(i => ({
                    name: `${i.user?.firstName} ${i.user?.lastName}`,
                    amount: i.amount, expectedReturn: i.expectedReturn || 0,
                    guaranteeContribution: i.guaranteeContribution || 0,
                    gain: (i.expectedReturn || 0) - i.amount - (i.guaranteeContribution || 0),
                    date: i.createdAt, status: i.status,
                })),
            };
        }));
        (0, helpers_1.successResponse)(res, {
            projects: projectsDetails,
            escrow: { totalEscrowInvestors, totalInvestorBalances, totalGainBalances },
        });
    }
    catch (e) {
        console.error('[ADMIN] Erreur finances/details:', e);
        (0, helpers_1.errorResponse)(res);
    }
});
// ═══════════════════════════════════════════════════════
// STATS GRAPHIQUES (protégées admin)
// ═══════════════════════════════════════════════════════
router.get('/stats/charts', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const [users, projects, investments] = await Promise.all([
            database_1.default.user.findMany({ select: { role: true, createdAt: true, kycStatus: true } }),
            database_1.default.project.findMany({ select: { sector: true, status: true, raisedAmount: true, goalAmount: true, createdAt: true } }),
            database_1.default.investment.findMany({ select: { amount: true, expectedReturn: true, createdAt: true, status: true } }),
        ]);
        const usersByMonth = {};
        users.forEach(u => {
            const key = new Date(u.createdAt).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
            usersByMonth[key] = (usersByMonth[key] || 0) + 1;
        });
        const investByMonthBrut = {};
        const investByMonthNet = {};
        const fees = await database_1.default.platformConfig.findMany();
        const feeMap = {};
        fees.forEach(f => { feeMap[f.key] = parseFloat(String(f.value)); });
        const fraisTaux = (feeMap.commission_baobab_collection || 6) + (feeMap.commission_mentor || 2) + (feeMap.commission_guarantee || 2);
        investments.forEach(inv => {
            const key = new Date(inv.createdAt).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
            investByMonthBrut[key] = (investByMonthBrut[key] || 0) + inv.amount;
            investByMonthNet[key] = (investByMonthNet[key] || 0) + Math.round(inv.amount * (1 - fraisTaux / 100));
        });
        const roleData = [
            { name: 'Investisseurs', value: users.filter(u => u.role === 'INVESTOR').length },
            { name: 'Entrepreneurs', value: users.filter(u => u.role === 'ENTREPRENEUR').length },
            { name: 'Mentors', value: users.filter(u => u.role === 'MENTOR').length },
        ];
        const sectorData = {};
        projects.forEach(p => { sectorData[p.sector] = (sectorData[p.sector] || 0) + 1; });
        const totalRaisedBrut = investments.reduce((s, i) => s + i.amount, 0);
        const activeProjects = projects.filter(p => p.status === 'ACTIVE').length;
        const fundedProjects = projects.filter(p => p.status === 'FUNDED').length;
        const completedProjects = projects.filter(p => p.status === 'COMPLETED').length;
        const kycVerified = users.filter(u => u.kycStatus === 'VERIFIED').length;
        const kycPending = users.filter(u => u.kycStatus === 'PENDING').length;
        const avgInvestment = investments.length > 0 ? Math.round(totalRaisedBrut / investments.length) : 0;
        const revs = await database_1.default.platformRevenue.findMany();
        const revByType = {};
        revs.forEach(r => { revByType[r.type] = (revByType[r.type] || 0) + r.amount; });
        const revenuNetBAOBAB = (revByType.COMMISSION_COLLECTION || 0) - Math.abs(revByType.PAYDUNYA_FEE || 0);
        (0, helpers_1.successResponse)(res, {
            usersTimeline: Object.entries(usersByMonth).map(([date, count]) => ({ date, count })),
            investTimeline: Object.keys(investByMonthBrut).map(date => ({
                date, montant: investByMonthBrut[date], net: investByMonthNet[date],
            })),
            roleData,
            sectorChart: Object.entries(sectorData).map(([name, value]) => ({ name, value })),
            kpis: {
                totalUsers: users.length,
                totalRaised: totalRaisedBrut,
                totalCagnotteNette: Math.round(totalRaisedBrut * (1 - fraisTaux / 100)),
                totalExpectedReturn: investments.reduce((s, i) => s + (i.expectedReturn || 0), 0),
                revenuNetBAOBAB,
                activeProjects, fundedProjects, completedProjects,
                kycVerified, kycPending,
                kycRate: users.length > 0 ? Math.round((kycVerified / users.length) * 100) : 0,
                totalInvestments: investments.length,
                feeMap,
                totalInvestors: users.filter(u => u.role === 'INVESTOR').length,
                totalEntrepreneurs: users.filter(u => u.role === 'ENTREPRENEUR').length,
                totalMentors: users.filter(u => u.role === 'MENTOR').length,
                avgInvestment,
            },
        });
    }
    catch (e) {
        console.error('[ADMIN] Erreur stats/charts:', e);
        (0, helpers_1.errorResponse)(res);
    }
});
// ═══════════════════════════════════════════════════════
// JOURNAUX D'AUDIT ADMIN
// ═══════════════════════════════════════════════════════
router.get('/audit-logs', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { page = '1', limit = '50' } = req.query;
        const take = Math.min(Number(limit) || 50, 200);
        const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
        const [logs, total] = await Promise.all([
            database_1.default.adminAuditLog.findMany({
                orderBy: { createdAt: 'desc' },
                skip,
                take,
                include: {
                    admin: { select: { firstName: true, lastName: true, email: true } },
                    targetUser: { select: { firstName: true, lastName: true, email: true } },
                },
            }),
            database_1.default.adminAuditLog.count(),
        ]);
        (0, helpers_1.successResponse)(res, { logs, total, page: Number(page), pages: Math.ceil(total / take) });
    }
    catch (e) {
        console.error('[ADMIN] Erreur audit-logs:', e);
        (0, helpers_1.errorResponse)(res);
    }
});
// ═══════════════════════════════════════════════════════
// DÉTAIL UTILISATEUR — wallet, investissements, projets, transactions
// ═══════════════════════════════════════════════════════
router.get('/users/:id/wallet', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const wallet = await database_1.default.wallet.findUnique({ where: { userId: String(req.params.id) } });
        (0, helpers_1.successResponse)(res, wallet);
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
router.get('/users/:id/investments', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const investments = await database_1.default.investment.findMany({
            where: { userId: String(req.params.id) },
            include: {
                project: {
                    select: {
                        title: true, sector: true, status: true, expectedReturn: true,
                        goalAmount: true, raisedAmount: true, netAmount: true,
                        durationMonths: true, currentPalier: true, disbursedP1: true,
                        disbursedP2: true, disbursedP3: true, gracePeriodMonths: true,
                        entrepreneur: { select: { firstName: true, lastName: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        (0, helpers_1.successResponse)(res, investments);
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
router.get('/users/:id/projects', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const projects = await database_1.default.project.findMany({
            where: { entrepreneurId: String(req.params.id) },
            include: {
                investments: { select: { amount: true, userId: true, returnedAmount: true, user: { select: { firstName: true, lastName: true } } } },
                mentor: { select: { firstName: true, lastName: true } },
                milestones: { select: { title: true, amount: true, status: true } },
                repaymentSchedules: { include: { payments: { orderBy: { monthNumber: 'asc' } } } },
            },
            orderBy: { createdAt: 'desc' },
        });
        (0, helpers_1.successResponse)(res, projects);
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
router.get('/users/:id/schedules', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const investments = await database_1.default.investment.findMany({
            where: { userId: String(req.params.id) },
            select: { projectId: true, amount: true, sharePercent: true },
        });
        const schedules = [];
        for (const inv of investments) {
            const schedule = await database_1.default.repaymentSchedule.findFirst({
                where: { projectId: inv.projectId },
                include: {
                    payments: { orderBy: { monthNumber: 'asc' } },
                    project: { select: { title: true, sector: true } },
                },
            });
            if (schedule)
                schedules.push({ ...schedule, sharePercent: inv.sharePercent, investedAmount: inv.amount });
        }
        (0, helpers_1.successResponse)(res, schedules);
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
router.get('/users/:id/transactions', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const txs = await database_1.default.walletTransaction.findMany({
            where: { userId: String(req.params.id) },
            orderBy: { createdAt: 'desc' },
        });
        (0, helpers_1.successResponse)(res, txs);
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
router.get('/users/:id/notifications', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const notifs = await database_1.default.notification.findMany({
            where: { userId: String(req.params.id) },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
        (0, helpers_1.successResponse)(res, notifs);
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
// ═══════════════════════════════════════════════════════
// MENTORS CERTIFIÉS
// ═══════════════════════════════════════════════════════
router.get('/mentors', auth_1.authenticate, async (req, res) => {
    try {
        const mentors = await database_1.default.user.findMany({
            where: { role: 'MENTOR', kycStatus: 'VERIFIED' },
            select: {
                id: true, firstName: true, lastName: true,
                reputationScore: true, level: true, profileImageUrl: true, country: true, city: true,
            },
            orderBy: { reputationScore: 'desc' },
        });
        (0, helpers_1.successResponse)(res, mentors);
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
// ═══════════════════════════════════════════════════════
// REVENUS PLATEFORME
// ═══════════════════════════════════════════════════════
router.get('/platform-revenues', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const revenues = await database_1.default.platformRevenue.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        const byType = {};
        revenues.forEach(r => { byType[r.type] = (byType[r.type] || 0) + r.amount; });
        const byMonth = {};
        revenues.forEach(r => {
            const key = new Date(r.createdAt).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
            byMonth[key] = (byMonth[key] || 0) + r.amount;
        });
        const feesConfig = await database_1.default.platformConfig.findMany();
        const feeCfg = {};
        feesConfig.forEach(f => { feeCfg[f.key] = parseFloat(String(f.value)); });
        const payinFacure = feeCfg.payin_recovery || 4;
        const payinReel = feeCfg.payin_operator_real || 3.5;
        const payoutFacure = feeCfg.payin_repayment || 4;
        const payoutReel = feeCfg.payout_operator_real || 2;
        const payinRecovery = byType.PAYIN_RECOVERY || 0;
        const payinRepayment = byType.PAYIN_REPAYMENT || 0;
        const margePayin = Math.round(payinRecovery * (payinFacure - payinReel) / payinFacure);
        const margePayout = Math.round(payinRepayment * (payoutFacure - payoutReel) / payoutFacure);
        const commissionCollecte = byType.COMMISSION_COLLECTION || 0;
        const commissionFonds = byType.FUND_COMMISSION || 0;
        const commissionRetrait = byType.WITHDRAWAL_FEE || 0;
        const revenusBrutsPurs = commissionCollecte + commissionFonds + commissionRetrait;
        const revenueNetBAOBAB = revenusBrutsPurs + margePayin + margePayout;
        (0, helpers_1.successResponse)(res, {
            revenues,
            totalRevenue: revenues.reduce((s, r) => s + r.amount, 0),
            commissionCollecte, commissionFonds, commissionRetrait, revenusBrutsPurs,
            margePayin, margePayout, totalOperatorMargin: margePayin + margePayout,
            coutPaydunyaReel: Math.round(payinRecovery * payinReel / payinFacure),
            revenueNetBAOBAB, revenuBrutBAOBAB: revenusBrutsPurs,
            totalGuaranteeFee: byType.GUARANTEE_FEE || 0,
            totalMentorCommission: byType.MENTOR_COMMISSION || 0,
            totalPayinRecovery: payinRecovery, totalPayinRepayment: payinRepayment,
            totalWithdrawalFee: commissionRetrait,
            byType, payinFacure, payinReel, payoutFacure, payoutReel,
            byMonth: Object.entries(byMonth).map(([date, amount]) => ({ date, amount })),
            projectionAnnuelle: revenueNetBAOBAB * 12,
        });
    }
    catch (e) {
        console.error('[ADMIN] Erreur platform-revenues:', e);
        (0, helpers_1.errorResponse)(res);
    }
});
// ═══════════════════════════════════════════════════════
// JALONS EN ATTENTE
// ═══════════════════════════════════════════════════════
router.get('/milestones/pending', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const milestones = await database_1.default.milestone.findMany({
            where: { status: 'SUBMITTED' },
            include: {
                project: {
                    select: {
                        id: true, title: true, raisedAmount: true,
                        entrepreneur: { select: { id: true, firstName: true, lastName: true, email: true } },
                    },
                },
            },
            orderBy: { updatedAt: 'desc' },
        });
        (0, helpers_1.successResponse)(res, milestones);
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
router.patch('/milestones/:id/approve', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { adminNote } = req.body;
        const milestone = await database_1.default.milestone.findUnique({
            where: { id: String(req.params.id) },
            include: { project: { select: { title: true, entrepreneurId: true } } },
        });
        if (!milestone) {
            res.status(404).json({ success: false, message: 'Jalon introuvable' });
            return;
        }
        const updated = await database_1.default.milestone.update({
            where: { id: String(req.params.id) },
            data: { status: 'APPROVED', adminNote: adminNote || 'Approuvé', paidAt: new Date() },
        });
        await database_1.default.notification.create({
            data: {
                userId: milestone.project.entrepreneurId,
                title: '✅ Jalon approuvé !',
                body: `Le jalon "${milestone.title}" (${milestone.amount.toLocaleString()} FCFA) a été validé.`,
                type: 'MILESTONE_APPROVED',
                data: { projectId: milestone.projectId },
            },
        });
        (0, helpers_1.successResponse)(res, updated, 'Jalon approuvé');
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
router.patch('/milestones/:id/reject', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { adminNote } = req.body;
        if (!adminNote) {
            res.status(400).json({ success: false, message: 'Raison de rejet obligatoire' });
            return;
        }
        const milestone = await database_1.default.milestone.findUnique({
            where: { id: String(req.params.id) },
            include: { project: { select: { title: true, entrepreneurId: true } } },
        });
        if (!milestone) {
            res.status(404).json({ success: false, message: 'Jalon introuvable' });
            return;
        }
        const updated = await database_1.default.milestone.update({
            where: { id: String(req.params.id) },
            data: { status: 'REJECTED', adminNote },
        });
        await database_1.default.notification.create({
            data: {
                userId: milestone.project.entrepreneurId,
                title: '❌ Jalon refusé',
                body: `Le jalon "${milestone.title}" a été refusé. Raison : ${adminNote}`,
                type: 'MILESTONE_REJECTED',
                data: { projectId: milestone.projectId },
            },
        });
        (0, helpers_1.successResponse)(res, updated, 'Jalon rejeté');
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
// ═══════════════════════════════════════════════════════
// REMBOURSEMENT — Créer un échéancier
// ═══════════════════════════════════════════════════════
router.post('/projects/:projectId/reimburse', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { note } = req.body;
        const project = await database_1.default.project.findUnique({
            where: { id: String(req.params.projectId) },
            include: { investments: { include: { user: { include: { wallet: true } } } } },
        });
        if (!project) {
            res.status(404).json({ success: false, message: 'Projet introuvable' });
            return;
        }
        if (!['FUNDED', 'ACTIVE'].includes(project.status)) {
            res.status(400).json({ success: false, message: 'Projet non éligible' });
            return;
        }
        const existing = await database_1.default.repaymentSchedule.findFirst({ where: { projectId: project.id } });
        if (existing) {
            res.status(400).json({ success: false, message: 'Échéancier déjà créé' });
            return;
        }
        // Taux FIGÉS à la création du projet — jamais recalculés en direct
        const fees = await (0, fees_1.getProjectFees)(project);
        const payinRepayPct = fees.payin_repayment || 4;
        const gracePeriod = project.gracePeriodMonths || 0;
        const netAmount = project.netAmount || Math.round((project.goalAmount || 0) * 0.90);
        const returnRate = Math.max(project.expectedReturn || 0, fees.return_min);
        const totalGross = Math.round(netAmount * (1 + returnRate / 100));
        const totalNet = Math.round(totalGross * (1 - payinRepayPct / 100));
        const durationMonths = project.durationMonths || 12;
        const monthlyGross = Math.ceil(totalGross / durationMonths);
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() + gracePeriod);
        const schedule = await database_1.default.repaymentSchedule.create({
            data: {
                projectId: project.id,
                totalAmount: totalGross,
                remainingAmount: totalGross,
                monthlyAmount: monthlyGross,
                totalMonths: durationMonths,
                paidMonths: 0,
                status: 'ACTIVE',
                nextDueDate: startDate,
                adminNote: note || null,
            },
        });
        for (let month = 1; month <= durationMonths; month++) {
            const dueDate = new Date();
            dueDate.setMonth(dueDate.getMonth() + gracePeriod + month - 1);
            await database_1.default.repaymentPayment.create({
                data: {
                    scheduleId: schedule.id,
                    projectId: project.id,
                    monthNumber: month,
                    amount: month === durationMonths ? totalGross - monthlyGross * (durationMonths - 1) : monthlyGross,
                    dueDate,
                    status: 'PENDING',
                },
            });
        }
        await database_1.default.project.update({ where: { id: project.id }, data: { status: 'IN_PROGRESS' } });
        await database_1.default.notification.create({
            data: {
                userId: project.entrepreneurId,
                title: 'Échéancier de remboursement créé',
                body: `Votre projet "${project.title}" — première mensualité : ${monthlyGross.toLocaleString()} FCFA.`,
                type: 'SCHEDULE_CREATED',
                data: JSON.stringify({ projectId: project.id, scheduleId: schedule.id }),
            },
        });
        const investorIds = [...new Set(project.investments.map(i => i.userId))];
        if (investorIds.length > 0) {
            await database_1.default.notification.createMany({
                data: investorIds.map(userId => ({
                    userId,
                    title: 'Remboursement planifié',
                    body: `L'entrepreneur rembourse "${project.title}" — ${durationMonths} mensualités.`,
                    type: 'SCHEDULE_CREATED',
                    data: JSON.stringify({ projectId: project.id }),
                })),
            });
        }
        (0, helpers_1.successResponse)(res, {
            scheduleId: schedule.id, totalGross, totalNet,
            monthlyGross, durationMonths, gracePeriod, startDate,
        }, `Échéancier créé — ${monthlyGross.toLocaleString()} FCFA/mois × ${durationMonths} mois`);
    }
    catch (e) {
        console.error('[ADMIN] Erreur reimburse:', e);
        (0, helpers_1.errorResponse)(res);
    }
});
// ═══════════════════════════════════════════════════════
// PROJETS INACTIFS
// ═══════════════════════════════════════════════════════
router.post('/check-inactive-projects', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const twentyOneDaysAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
        const activeProjects = await database_1.default.project.findMany({
            where: { status: { in: ['ACTIVE', 'IN_PROGRESS'] } },
            include: {
                investments: { select: { userId: true } },
                posts: { orderBy: { createdAt: 'desc' }, take: 1 },
            },
        });
        let alertCount = 0;
        for (const project of activeProjects) {
            const lastPost = project.posts[0];
            if (lastPost && lastPost.createdAt > twentyOneDaysAgo)
                continue;
            await database_1.default.user.update({
                where: { id: project.entrepreneurId },
                data: { reputationScore: { decrement: 5 } },
            });
            const uniqueInvestors = [...new Set(project.investments.map(i => i.userId))];
            if (uniqueInvestors.length > 0) {
                await database_1.default.notification.createMany({
                    data: uniqueInvestors.map(userId => ({
                        userId,
                        title: '📭 Pas de nouvelles du projet',
                        body: `Aucune mise à jour de "${project.title}" depuis 21 jours.`,
                        type: 'PROJECT_INACTIVITY',
                        data: { projectId: project.id },
                    })),
                });
            }
            alertCount++;
        }
        (0, helpers_1.successResponse)(res, { alertCount, projectsChecked: activeProjects.length }, `${alertCount} alerte(s) envoyée(s)`);
    }
    catch (e) {
        console.error('[ADMIN] Erreur check-inactive:', e);
        (0, helpers_1.errorResponse)(res);
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map