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
// Liste tous les utilisateurs
router.get('/users', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { status, role, search } = req.query;
        const where = {};
        if (status && status !== 'ALL')
            where.kycStatus = status;
        if (role && role !== 'ALL')
            where.role = role;
        if (search)
            where.OR = [
                { firstName: { contains: String(search), mode: 'insensitive' } },
                { lastName: { contains: String(search), mode: 'insensitive' } },
                { email: { contains: String(search), mode: 'insensitive' } },
            ];
        const users = await database_1.default.user.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true, firstName: true, lastName: true, email: true,
                phone: true, role: true, city: true, country: true,
                kycStatus: true, kycDocumentUrl: true, kycSelfieUrl: true,
                kycRccmUrl: true, kycSubmittedAt: true, kycVerifiedAt: true,
                kycRejectedReason: true, kycDocumentExpiry: true, kycDocumentType: true,
                kycAttempts: true, kycNotes: true,
                isActive: true, isBanned: true, banReason: true,
                reputationScore: true, level: true, referralCode: true, referralCount: true,
                wallet: { select: { balance: true, escrowBalance: true, totalInvested: true } },
                city: true, country: true,
                createdAt: true,
            }
        });
        (0, helpers_1.successResponse)(res, users);
    }
    catch {
        (0, helpers_1.errorResponse)(res);
    }
});
// Valider KYC
router.post('/users/:id/verify-kyc', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const user = await database_1.default.user.update({
            where: { id: req.params.id },
            data: { kycStatus: 'VERIFIED', kycVerifiedAt: new Date() }
        });
        await database_1.default.notification.create({
            data: {
                userId: user.id,
                title: '✅ KYC Validé !',
                body: 'Ton identité a été vérifiée. Tu peux maintenant investir et retirer des fonds.',
                type: 'KYC_VERIFIED',
            }
        });
        (0, helpers_1.successResponse)(res, user, 'KYC validé');
    }
    catch {
        (0, helpers_1.errorResponse)(res);
    }
});
// Rejeter KYC
router.post('/users/:id/reject-kyc', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { reason } = req.body;
        const user = await database_1.default.user.update({
            where: { id: req.params.id },
            data: { kycStatus: 'REJECTED', kycRejectedReason: reason }
        });
        await database_1.default.notification.create({
            data: {
                userId: user.id,
                title: '❌ KYC Rejeté',
                body: `Raison : ${reason}. Merci de soumettre à nouveau tes documents.`,
                type: 'KYC_REJECTED',
            }
        });
        (0, helpers_1.successResponse)(res, user, 'KYC rejeté');
    }
    catch {
        (0, helpers_1.errorResponse)(res);
    }
});
// Bannir un utilisateur
router.post('/users/:id/ban', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { reason } = req.body;
        const user = await database_1.default.user.update({
            where: { id: req.params.id },
            data: { isBanned: true, isActive: false, banReason: reason, bannedAt: new Date() }
        });
        (0, helpers_1.successResponse)(res, user, 'Utilisateur banni');
    }
    catch {
        (0, helpers_1.errorResponse)(res);
    }
});
// Réhabiliter un utilisateur
router.post('/users/:id/unban', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const user = await database_1.default.user.update({
            where: { id: req.params.id },
            data: { isBanned: false, isActive: true, banReason: null, rehabilitationAt: new Date() }
        });
        (0, helpers_1.successResponse)(res, user, 'Utilisateur réhabilité');
    }
    catch {
        (0, helpers_1.errorResponse)(res);
    }
});
// Stats globales
router.get('/stats', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const [totalUsers, totalProjects, pendingReviewProjects, totalInvestments, pendingKyc, revenues, investmentsAgg, walletAgg, txPending, builders] = await Promise.all([
            database_1.default.user.count(),
            database_1.default.project.count(),
            database_1.default.project.count({ where: { status: 'PENDING_REVIEW' } }),
            database_1.default.investment.count(),
            database_1.default.user.count({ where: { kycStatus: 'PENDING' } }),
            database_1.default.platformRevenue.groupBy({ by: ['type'], _sum: { amount: true } }),
            database_1.default.investment.aggregate({ _sum: { amount: true, guaranteeContribution: true }, _count: true }),
            database_1.default.wallet.aggregate({
                where: { user: { role: 'ADMIN' } },
                _sum: { balance: true, commissionBalance: true, guaranteeBalance: true }
            }),
            database_1.default.walletTransaction.count({ where: { status: 'PENDING' } }),
            database_1.default.user.count({ where: { role: 'BUILDER' } }),
        ]);
        // Projets par statut
        const projectsByStatus = await database_1.default.project.groupBy({
            by: ['status'], _count: true, _sum: { raisedAmount: true, goalAmount: true }
        });
        // Investisseurs actifs
        const activeInvestors = await database_1.default.user.count({
            where: { role: 'INVESTOR', investments: { some: {} } }
        });
        // Revenus map
        const revenueMap = {};
        revenues.forEach((r) => { revenueMap[r.type] = r._sum.amount || 0; });
        const totalRevenuBAOBAB = (revenueMap.COMMISSION_COLLECTION || 0) + (revenueMap.PAYIN_RECOVERY || 0);
        const totalPayinRepayment = revenueMap.PAYIN_REPAYMENT || 0;
        const totalMentorCommission = revenueMap.MENTOR_COMMISSION || 0;
        const totalGuaranteeFund = revenueMap.GUARANTEE_FEE || 0;
        const totalLeve = investmentsAgg._sum.amount || 0;
        const totalAssurance = investmentsAgg._sum.guaranteeContribution || 0;
        // Taux de config
        const configRates = await database_1.default.platformConfig.findMany();
        const rateMap = {};
        configRates.forEach((c) => { rateMap[c.key] = c.value; });
        (0, helpers_1.successResponse)(res, {
            // Taux config
            baobabRate: rateMap.commission_baobab_collection || 6,
            payinRate: rateMap.payin_recovery || 4,
            payinRepayRate: rateMap.payin_repayment || 4,
            mentorRate: rateMap.commission_mentor || 2,
            guarRate: rateMap.commission_guarantee || 2,
            // Marges opérateur (sécurité)
            payinOperatorReal: 3.5, // taux réel max PayDunya payin
            payoutOperatorReal: 2.0, // taux réel max PayDunya payout
            // Utilisateurs
            totalUsers, activeInvestors, pendingKyc, builders,
            // Projets
            totalProjects, pendingReviewProjects,
            projectsByStatus,
            activeProjects: projectsByStatus.find((p) => p.status === 'ACTIVE')?._count || 0,
            fundedProjects: projectsByStatus.find((p) => p.status === 'FUNDED')?._count || 0,
            completedProjects: projectsByStatus.find((p) => p.status === 'COMPLETED')?._count || 0,
            // Investissements
            totalInvestments, totalLeve, totalAssurance,
            // Finances BAOBAB
            adminBalance: walletAgg._sum.balance || 0,
            commissionBalance: walletAgg._sum.commissionBalance || 0,
            guaranteeBalance: walletAgg._sum.guaranteeBalance || 0,
            totalRevenuBAOBAB,
            totalPayinRepayment,
            totalMentorCommission,
            totalGuaranteeFund,
            revenueTotal: totalRevenuBAOBAB + totalPayinRepayment,
            // Transactions
            txPending,
        });
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
// Changer le rôle d'un utilisateur
router.patch('/users/:userId/role', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        const validRoles = ['INVESTOR', 'ENTREPRENEUR', 'MENTOR', 'ADMIN'];
        if (!validRoles.includes(role)) {
            res.status(400).json({ success: false, message: 'Rôle invalide' });
            return;
        }
        const user = await database_1.default.user.update({
            where: { id: req.params.userId },
            data: { role }
        });
        (0, helpers_1.successResponse)(res, user, `Rôle modifié en ${role}`);
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
// Finances détaillées admin — par projet
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
                        guaranteeContribution: true, sharePercent: true, status: true
                    }
                },
                _count: { select: { investments: true } }
            }
        });
        (0, helpers_1.successResponse)(res, { projects });
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
router.get('/finances/details', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const projects = await database_1.default.project.findMany({
            include: {
                investments: { select: { amount: true, expectedReturn: true, guaranteeContribution: true, sharePercent: true, status: true, createdAt: true, user: { select: { firstName: true, lastName: true } } } },
                milestones: { include: { payments: { include: { supplier: { select: { companyName: true } } } } } },
                entrepreneur: { select: { firstName: true, lastName: true } },
                mentor: { select: { firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'desc' }
        });
        const fees = await database_1.default.platformConfig.findMany();
        const feeMap = {};
        fees.forEach((f) => { feeMap[f.key] = f.value; });
        // MODÈLE FINANCIER VALIDÉ
        const investorWallets = await database_1.default.wallet.findMany({
            where: { user: { role: 'INVESTOR' } },
            select: { escrowBalance: true, balance: true, gainBalance: true }
        });
        const totalEscrowInvestors = investorWallets.reduce((s, w) => s + w.escrowBalance, 0);
        const totalInvestorBalances = investorWallets.reduce((s, w) => s + w.balance, 0);
        const totalGainBalances = investorWallets.reduce((s, w) => s + w.gainBalance, 0);
        const projectsDetails = projects.map((p) => {
            const totalInvested = p.investments.reduce((s, i) => s + i.amount, 0);
            const baobabPct = feeMap.commission_baobab_collection || 6;
            const payinPct = feeMap.payin_recovery || 4;
            const mentorPct = feeMap.commission_mentor || 2;
            const payinRepayPct = feeMap.payin_repayment || 4;
            const fraisFixesPct = baobabPct + payinPct + (p.mentorId ? mentorPct : 0);
            // Calculs basés sur goalAmount réel du projet
            const baobabOnCollection = Math.round((p.goalAmount || 0) * baobabPct / 100);
            const mentorFee = p.mentorId ? Math.round((p.goalAmount || 0) * mentorPct / 100) : 0;
            const paydunyaPayin = Math.round((p.goalAmount || 0) * payinPct / 100); // coût absorbé
            // Assurance = somme réelle des guaranteeContribution (hors cagnotte)
            const guaranteeFee = p.investments.reduce((s, i) => s + (i.guaranteeContribution || 0), 0);
            // netAmount = depuis DB si dispo, sinon recalculé
            const netAmount = p.netAmount || Math.round((p.goalAmount || 0) * (1 - fraisFixesPct / 100));
            const cagnotteNette = netAmount;
            // Retour total sur netAmount
            const returnRate = p.expectedReturn || (feeMap.return_min || 24);
            const totalRemb = Math.round(netAmount * (1 + returnRate / 100));
            const payinOnRepayment = Math.round(totalRemb * payinRepayPct / 100);
            const baobabOnReturn = payinOnRepayment;
            // expectedReturn déjà calculés correctement à l'investissement
            const totalExpectedReturn = p.investments.reduce((s, i) => s + (i.expectedReturn || 0), 0);
            const netInvestors = totalExpectedReturn;
            // Fournisseurs
            const totalFournisseurs = p.milestones.reduce((s, m) => s + m.payments.filter((pay) => pay.status === 'COMPLETED').reduce((ss, pay) => ss + pay.amount, 0), 0);
            const fournisseursPending = p.milestones.reduce((s, m) => s + m.payments.filter((pay) => pay.status === 'PENDING').reduce((ss, pay) => ss + pay.amount, 0), 0);
            // Revenu BAOBAB = commission collecte UNIQUEMENT (payin = coût, pas revenu)
            const revenueNetBAOBABProjet = baobabOnCollection;
            return {
                id: p.id, title: p.title, sector: p.sector, status: p.status,
                entrepreneur: `${p.entrepreneur?.firstName} ${p.entrepreneur?.lastName}`,
                mentor: p.mentor ? `${p.mentor?.firstName} ${p.mentor?.lastName}` : null,
                goalAmount: p.goalAmount, netAmount, totalInvested, cagnotteNette,
                investorCount: p.investments.length, expectedReturn: p.expectedReturn,
                totalExpectedReturn, netInvestors, baobabOnCollection, mentorFee,
                guaranteeFee, paydunyaPayin, baobabOnReturn, paydunyaPayout: 0,
                revenueNetBAOBABProjet, totalFournisseurs, fournisseursPending,
                milestones: p.milestones.map((m) => ({
                    title: m.title, amount: m.amount, status: m.status,
                    payments: m.payments.map((pay) => ({
                        supplier: pay.supplier?.companyName, amount: pay.amount, status: pay.status
                    }))
                })),
                investors: p.investments.map((i) => ({
                    name: `${i.user?.firstName} ${i.user?.lastName}`,
                    amount: i.amount,
                    expectedReturn: i.expectedReturn || 0,
                    guaranteeContribution: i.guaranteeContribution || 0,
                    withInsurance: (i.guaranteeContribution || 0) > 0,
                    netReturn: i.expectedReturn || 0,
                    gain: (i.expectedReturn || 0) - i.amount - (i.guaranteeContribution || 0),
                    date: i.createdAt, status: i.status
                }))
            };
        });
        (0, helpers_1.successResponse)(res, {
            projects: projectsDetails,
            escrow: { totalEscrowInvestors, totalInvestorBalances, totalGainBalances }
        });
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
exports.default = router;
// Stats globales graphiques admin
router.get('/stats/charts', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const [users, projects, investments] = await Promise.all([
            database_1.default.user.findMany({ select: { role: true, createdAt: true, kycStatus: true } }),
            database_1.default.project.findMany({ select: { sector: true, status: true, raisedAmount: true, goalAmount: true, createdAt: true } }),
            database_1.default.investment.findMany({ select: { amount: true, expectedReturn: true, createdAt: true, status: true } })
        ]);
        // Inscriptions par mois
        const usersByMonth = {};
        users.forEach(u => {
            const key = new Date(u.createdAt).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
            usersByMonth[key] = (usersByMonth[key] || 0) + 1;
        });
        const usersTimeline = Object.entries(usersByMonth).map(([date, count]) => ({ date, count }));
        // Investissements par mois
        const investByMonth = {};
        investments.forEach(inv => {
            const key = new Date(inv.createdAt).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
            investByMonth[key] = (investByMonth[key] || 0) + inv.amount;
        });
        const investTimeline = Object.entries(investByMonth).map(([date, montant]) => ({ date, montant }));
        // Répartition par rôle
        const roleData = [
            { name: 'Investisseurs', value: users.filter(u => u.role === 'INVESTOR').length },
            { name: 'Entrepreneurs', value: users.filter(u => u.role === 'ENTREPRENEUR').length },
            { name: 'Mentors', value: users.filter(u => u.role === 'MENTOR').length },
        ];
        // Projets par secteur
        const sectorData = {};
        projects.forEach(p => {
            sectorData[p.sector] = (sectorData[p.sector] || 0) + 1;
        });
        const sectorChart = Object.entries(sectorData).map(([name, value]) => ({ name, value }));
        // KPIs globaux enrichis
        const fees = await database_1.default.platformConfig.findMany();
        const feeMap = {};
        fees.forEach((f) => { feeMap[f.key] = parseFloat(f.value); });
        const totalRaisedBrut = investments.reduce((s, i) => s + i.amount, 0);
        const fraisTaux = (feeMap.commission_baobab_collection || 6) + (feeMap.commission_mentor || 2) + (feeMap.commission_guarantee || 2);
        const totalCagnotteNette = Math.round(totalRaisedBrut * (1 - fraisTaux / 100));
        const totalExpectedReturn = investments.reduce((s, i) => s + (i.expectedReturn || 0), 0);
        const totalNetInvestors = Math.round(totalExpectedReturn * (1 - (0) / 100 - (feeMap.withdrawal_fee_standard || 3) / 100));
        const revs = await database_1.default.platformRevenue.findMany();
        const revByType = {};
        revs.forEach((r) => { revByType[r.type] = (revByType[r.type] || 0) + r.amount; });
        const revenuNetBAOBAB = (revByType['COMMISSION_COLLECTION'] || 0) - Math.abs(revByType['PAYDUNYA_FEE'] || 0);
        const activeProjects = projects.filter(p => p.status === 'ACTIVE').length;
        const fundedProjects = projects.filter(p => p.status === 'FUNDED').length;
        const completedProjects = projects.filter(p => p.status === 'COMPLETED').length;
        const kycVerified = users.filter(u => u.kycStatus === 'VERIFIED').length;
        const kycPending = users.filter(u => u.kycStatus === 'PENDING').length;
        const totalInvestors = users.filter(u => u.role === 'INVESTOR').length;
        const totalEntrepreneurs = users.filter(u => u.role === 'ENTREPRENEUR').length;
        const totalMentors = users.filter(u => u.role === 'MENTOR').length;
        const avgInvestment = investments.length > 0 ? Math.round(totalRaisedBrut / investments.length) : 0;
        // Investissements par mois avec brut et net
        const investByMonthBrut = {};
        const investByMonthNet = {};
        investments.forEach(inv => {
            const key = new Date(inv.createdAt).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
            investByMonthBrut[key] = (investByMonthBrut[key] || 0) + inv.amount;
            investByMonthNet[key] = (investByMonthNet[key] || 0) + Math.round(inv.amount * (1 - fraisTaux / 100));
        });
        const investTimelineEnriched = Object.keys(investByMonthBrut).map(date => ({
            date, montant: investByMonthBrut[date], net: investByMonthNet[date]
        }));
        (0, helpers_1.successResponse)(res, {
            usersTimeline, investTimeline: investTimelineEnriched, roleData, sectorChart,
            kpis: {
                totalUsers: users.length, totalRaised: totalRaisedBrut,
                totalCagnotteNette, totalExpectedReturn, totalNetInvestors,
                revenuNetBAOBAB, activeProjects, fundedProjects, completedProjects,
                kycVerified, kycPending, kycRate: Math.round((kycVerified / users.length) * 100),
                totalInvestments: investments.length, feeMap, totalInvestors, totalEntrepreneurs, totalMentors, avgInvestment
            }
        });
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
// Vérifier les projets sans post depuis 21 jours
router.post('/check-inactive-projects', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const twentyOneDaysAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
        const activeProjects = await database_1.default.project.findMany({
            where: { status: { in: ['ACTIVE', 'IN_PROGRESS'] } },
            include: {
                posts: { orderBy: { createdAt: 'desc' }, take: 1 },
                entrepreneur: { select: { firstName: true, lastName: true } },
                investments: { select: { userId: true } }
            }
        });
        let alertCount = 0;
        for (const project of activeProjects) {
            const lastPost = project.posts[0];
            const isInactive = !lastPost || new Date(lastPost.createdAt) < twentyOneDaysAgo;
            if (isInactive) {
                // Notifier l'entrepreneur
                await database_1.default.notification.create({
                    data: {
                        userId: project.entrepreneurId,
                        title: '⚠️ Rapport mensuel requis !',
                        body: `Ton projet "${project.title}" n'a pas eu de mise à jour depuis plus de 21 jours. Publie un rapport maintenant pour rassurer tes investisseurs et maintenir ton score de réputation.`,
                        type: 'INACTIVITY_ALERT',
                        data: { projectId: project.id }
                    }
                });
                // Réduire le score de réputation
                await database_1.default.user.update({
                    where: { id: project.entrepreneurId },
                    data: { reputationScore: { decrement: 5 } }
                });
                // Notifier les investisseurs
                const uniqueInvestors = [...new Set(project.investments.map(i => i.userId))];
                if (uniqueInvestors.length > 0) {
                    await database_1.default.notification.createMany({
                        data: uniqueInvestors.map(userId => ({
                            userId,
                            title: '📭 Pas de nouvelles du projet',
                            body: `Aucune mise à jour de "${project.title}" depuis 21 jours. L'équipe BAOBAB INVEST surveille la situation.`,
                            type: 'PROJECT_INACTIVITY',
                            data: { projectId: project.id }
                        }))
                    });
                }
                alertCount++;
            }
        }
        (0, helpers_1.successResponse)(res, { alertCount, projectsChecked: activeProjects.length }, `${alertCount} alerte(s) envoyée(s)`);
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
// Rembourser les investisseurs d'un projet terminé
router.post('/projects/:projectId/reimburse', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { note } = req.body;
        const project = await database_1.default.project.findUnique({
            where: { id: req.params.projectId },
            include: { investments: { include: { user: { include: { wallet: true } } } } }
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
        const fees = await database_1.default.platformConfig.findMany();
        const feeMap = {};
        fees.forEach((f) => { feeMap[f.key] = f.value; });
        const payinRepayPct = feeMap.payin_repayment || 4;
        const gracePeriod = project.gracePeriodMonths || 0;
        const netAmount = project.netAmount || Math.round((project.goalAmount || 0) * 0.90);
        const returnRate = project.expectedReturn || 24;
        const totalGross = Math.round(netAmount * (1 + returnRate / 100));
        const totalPayin = Math.round(totalGross * payinRepayPct / 100);
        const totalNet = totalGross - totalPayin;
        const durationMonths = project.durationMonths || 12;
        const monthlyGross = Math.ceil(totalGross / durationMonths);
        const monthlyNet = Math.floor(totalNet / durationMonths);
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
            }
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
                }
            });
        }
        await database_1.default.project.update({ where: { id: project.id }, data: { status: 'IN_PROGRESS' } });
        await database_1.default.notification.create({
            data: {
                userId: project.entrepreneurId,
                title: 'Écheancier de remboursement créé',
                body: `Votre projet "${project.title}" — première mensualité : ${monthlyGross.toLocaleString()} FCFA le ${startDate.toLocaleDateString('fr-FR')}.`,
                type: 'SCHEDULE_CREATED',
                data: JSON.stringify({ projectId: project.id, scheduleId: schedule.id })
            }
        });
        const investorIds = [...new Set(project.investments.map((i) => i.userId))];
        if (investorIds.length > 0) {
            await database_1.default.notification.createMany({
                data: investorIds.map((userId) => ({
                    userId,
                    title: 'Remboursement planifié',
                    body: `L'entrepreneur rembourse "${project.title}" — ${durationMonths} mensualités de ${monthlyGross.toLocaleString()} FCFA.`,
                    type: 'SCHEDULE_CREATED',
                    data: JSON.stringify({ projectId: project.id })
                }))
            });
        }
        (0, helpers_1.successResponse)(res, {
            scheduleId: schedule.id,
            totalGross, totalNet, monthlyGross, monthlyNet, durationMonths, gracePeriod, startDate
        }, `Échéancier créé — ${monthlyGross.toLocaleString()} FCFA/mois × ${durationMonths} mois`);
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
// Revenus de la plateforme BAOBAB INVEST
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
        // ── Revenus PURS BAOBAB (ce que BAOBAB gagne vraiment) ──
        const commissionCollecte = byType['COMMISSION_COLLECTION'] || 0; // 6% à la clôture
        const commissionFonds = byType['FUND_COMMISSION'] || 0; // 16% fonds solidaire
        const commissionRetrait = byType['WITHDRAWAL_FEE'] || 0; // frais retrait
        const revenusBrutsPurs = commissionCollecte + commissionFonds + commissionRetrait;
        // ── Marges opérateur (différence taux facturé - taux réel) — depuis config ──
        const payinRecovery = byType['PAYIN_RECOVERY'] || 0;
        const payinRepayment = byType['PAYIN_REPAYMENT'] || 0;
        const feesConfig = await database_1.default.platformConfig.findMany();
        const feeCfg = {};
        feesConfig.forEach((f) => { feeCfg[f.key] = parseFloat(f.value); });
        const payinFacure = feeCfg.payin_recovery || 4;
        const payinReel = feeCfg.payin_operator_real || 3.5;
        const payoutFacure = feeCfg.payin_repayment || 4;
        const payoutReel = feeCfg.payout_operator_real || 2;
        const coutPaydunyaReel = Math.round(payinRecovery * payinReel / payinFacure);
        const margePayin = Math.round(payinRecovery * (payinFacure - payinReel) / payinFacure);
        const margePayout = Math.round(payinRepayment * (payoutFacure - payoutReel) / payoutFacure);
        // ── Fonds séparés (pas des revenus BAOBAB directs) ──
        const totalGuaranteeFee = byType['GUARANTEE_FEE'] || 0; // 2% assurance (réservé)
        const totalMentorCommission = byType['MENTOR_COMMISSION'] || 0; // 2% mentor (reversé)
        const totalPayinRecovery = payinRecovery;
        const totalPayinRepayment = payinRepayment;
        // ── Total net réel BAOBAB ──
        const revenueNetBAOBAB = revenusBrutsPurs + margePayin + margePayout;
        const revenuBrutBAOBAB = revenusBrutsPurs; // pour compatibilité
        const coutPaydunya = coutPaydunyaReel;
        const totalOperatorMargin = margePayin + margePayout;
        const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0);
        (0, helpers_1.successResponse)(res, {
            revenues,
            totalRevenue,
            // Revenus purs BAOBAB
            commissionCollecte,
            commissionFonds,
            commissionRetrait,
            revenusBrutsPurs,
            // Marges opérateur
            margePayin,
            margePayout,
            totalOperatorMargin,
            coutPaydunyaReel,
            // Net réel
            revenueNetBAOBAB,
            revenuBrutBAOBAB,
            coutPaydunya,
            // Fonds séparés
            totalGuaranteeFee,
            totalMentorCommission,
            totalPayinRecovery,
            totalPayinRepayment,
            totalWithdrawalFee: commissionRetrait,
            byType,
            // Taux config pour affichage frontend
            payinFacure, payinReel, payoutFacure, payoutReel,
            byMonth: Object.entries(byMonth).map(([date, amount]) => ({ date, amount })),
            projectionAnnuelle: revenueNetBAOBAB * 12,
        });
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
// Jalons soumis en attente de validation admin
router.get('/milestones/pending', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const milestones = await database_1.default.milestone.findMany({
            where: { status: 'SUBMITTED' },
            include: {
                project: {
                    select: {
                        id: true, title: true, raisedAmount: true,
                        entrepreneur: { select: { id: true, firstName: true, lastName: true, email: true } }
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });
        (0, helpers_1.successResponse)(res, milestones);
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
// Approuver un jalon
router.patch('/milestones/:id/approve', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { adminNote } = req.body;
        const milestone = await database_1.default.milestone.findUnique({
            where: { id: req.params.id },
            include: { project: { select: { title: true, entrepreneurId: true } } }
        });
        if (!milestone) {
            res.status(404).json({ success: false, message: 'Jalon introuvable' });
            return;
        }
        const updated = await database_1.default.milestone.update({
            where: { id: req.params.id },
            data: { status: 'APPROVED', adminNote: adminNote || 'Approuvé', paidAt: new Date() }
        });
        // Notifier l'entrepreneur
        await database_1.default.notification.create({
            data: {
                userId: milestone.project.entrepreneurId,
                title: '✅ Jalon approuvé !',
                body: `Le jalon "${milestone.title}" (${milestone.amount.toLocaleString()} FCFA) a été validé. Les fonds vont être débloqués.`,
                type: 'MILESTONE_APPROVED',
                data: { projectId: milestone.projectId }
            }
        });
        (0, helpers_1.successResponse)(res, updated, 'Jalon approuvé');
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
// Rejeter un jalon
router.patch('/milestones/:id/reject', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { adminNote } = req.body;
        if (!adminNote) {
            res.status(400).json({ success: false, message: 'Raison de rejet obligatoire' });
            return;
        }
        const milestone = await database_1.default.milestone.findUnique({
            where: { id: req.params.id },
            include: { project: { select: { title: true, entrepreneurId: true } } }
        });
        if (!milestone) {
            res.status(404).json({ success: false, message: 'Jalon introuvable' });
            return;
        }
        const updated = await database_1.default.milestone.update({
            where: { id: req.params.id },
            data: { status: 'REJECTED', adminNote }
        });
        await database_1.default.notification.create({
            data: {
                userId: milestone.project.entrepreneurId,
                title: '❌ Jalon refusé',
                body: `Le jalon "${milestone.title}" a été refusé. Raison : ${adminNote}`,
                type: 'MILESTONE_REJECTED',
                data: { projectId: milestone.projectId }
            }
        });
        (0, helpers_1.successResponse)(res, updated, 'Jalon rejeté');
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
// Admin — détail complet d'un utilisateur
router.get('/users/:id/wallet', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const wallet = await database_1.default.wallet.findUnique({ where: { userId: req.params.id } });
        (0, helpers_1.successResponse)(res, wallet);
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
router.get('/users/:id/investments', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const investments = await database_1.default.investment.findMany({
            where: { userId: req.params.id },
            include: {
                project: {
                    select: {
                        title: true, sector: true, status: true, expectedReturn: true,
                        goalAmount: true, raisedAmount: true, netAmount: true,
                        durationMonths: true, currentPalier: true, disbursedP1: true,
                        disbursedP2: true, disbursedP3: true, gracePeriodMonths: true,
                        entrepreneur: { select: { firstName: true, lastName: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
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
            where: { entrepreneurId: req.params.id },
            include: {
                investments: { select: { amount: true, userId: true, returnedAmount: true, user: { select: { firstName: true, lastName: true } } } },
                mentor: { select: { firstName: true, lastName: true } },
                milestones: { select: { title: true, amount: true, status: true } },
                repaymentSchedules: { include: { payments: { orderBy: { monthNumber: 'asc' } } } }
            },
            orderBy: { createdAt: 'desc' }
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
            where: { userId: req.params.id },
            select: { projectId: true, amount: true, sharePercent: true }
        });
        const schedules = [];
        for (const inv of investments) {
            const schedule = await database_1.default.repaymentSchedule.findFirst({
                where: { projectId: inv.projectId },
                include: {
                    payments: { orderBy: { monthNumber: 'asc' } },
                    project: { select: { title: true, sector: true } }
                }
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
            where: { userId: req.params.id },
            orderBy: { createdAt: 'desc' }
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
            where: { userId: req.params.id },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        (0, helpers_1.successResponse)(res, notifs);
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
// GET /api/admin/mentors — Liste des mentors vérifiés
router.get('/mentors', auth_1.authenticate, async (req, res) => {
    try {
        const mentors = await database_1.default.user.findMany({
            where: { role: 'MENTOR', kycStatus: 'VERIFIED' },
            select: {
                id: true, firstName: true, lastName: true,
                reputationScore: true, level: true,
                profileImageUrl: true, country: true, city: true
            },
            orderBy: { reputationScore: 'desc' }
        });
        (0, helpers_1.successResponse)(res, mentors);
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
//# sourceMappingURL=admin.js.map