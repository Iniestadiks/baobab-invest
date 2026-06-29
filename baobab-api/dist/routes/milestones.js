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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const helpers_1 = require("../utils/helpers");
const router = (0, express_1.Router)();
// Créer des jalons pour un projet (entrepreneur)
router.post('/project/:projectId', auth_1.authenticate, (0, auth_1.requireRole)(['ENTREPRENEUR']), async (req, res) => {
    try {
        const { milestones } = req.body;
        const projectId = req.params.projectId;
        const project = await database_1.default.project.findUnique({
            where: { id: projectId },
            include: { milestones: true }
        });
        if (!project || project.entrepreneurId !== req.userId) {
            res.status(403).json({ success: false, message: 'Non autorisé' });
            return;
        }
        // Budget réellement disponible = montant levé - jalons déjà créés (hors rejetés)
        const dejaDepense = project.milestones
            .filter(m => !['REJECTED'].includes(m.status))
            .reduce((sum, m) => sum + m.amount, 0);
        const budgetDisponible = project.raisedAmount - dejaDepense;
        if (budgetDisponible <= 0) {
            res.status(400).json({ success: false, message: 'Budget épuisé — tous les fonds levés ont déjà été alloués aux jalons' });
            return;
        }
        const schema = zod_1.z.array(zod_1.z.object({
            title: zod_1.z.string().min(3),
            description: zod_1.z.string().min(10),
            amount: zod_1.z.number().min(1000),
            dueDate: zod_1.z.string().optional(),
        }));
        const data = schema.parse(milestones);
        // Vérifier que le total des nouveaux jalons ne dépasse pas le budget disponible
        const total = data.reduce((sum, m) => sum + m.amount, 0);
        if (total > budgetDisponible) {
            res.status(400).json({ success: false, message: `Total jalons (${total.toLocaleString()} FCFA) dépasse le budget disponible (${budgetDisponible.toLocaleString()} FCFA)` });
            return;
        }
        const created = await database_1.default.milestone.createMany({
            data: data.map(m => ({
                projectId,
                title: m.title,
                description: m.description,
                amount: m.amount,
                dueDate: m.dueDate ? new Date(m.dueDate) : null,
            }))
        });
        (0, helpers_1.successResponse)(res, { count: created.count }, `${created.count} jalon(s) créé(s)`, 201);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ success: false, message: error.errors[0].message });
            return;
        }
        (0, helpers_1.errorResponse)(res);
    }
});
// Lister les jalons d'un projet
// Budget disponible pour jalons
router.get('/project/:projectId/budget', auth_1.authenticate, async (req, res) => {
    try {
        const project = await database_1.default.project.findUnique({
            where: { id: req.params.projectId },
            include: {
                milestones: true,
                investments: { include: { user: { select: { id: true, firstName: true, lastName: true, profileImageUrl: true, city: true, level: true, totalInvested: true } } } }
            }
        });
        if (!project) {
            res.status(404).json({ success: false, message: 'Projet introuvable' });
            return;
        }
        const dejaAlloue = project.milestones
            .filter(m => !['REJECTED'].includes(m.status))
            .reduce((sum, m) => sum + m.amount, 0);
        const dejaApprouve = project.milestones
            .filter(m => ['APPROVED', 'PAID'].includes(m.status))
            .reduce((sum, m) => sum + m.amount, 0);
        const budgetDisponible = project.raisedAmount - dejaAlloue;
        // Investisseurs uniques
        const investorsMap = new Map();
        project.investments.forEach(inv => {
            if (!investorsMap.has(inv.userId)) {
                investorsMap.set(inv.userId, {
                    ...inv.user,
                    totalInvestedInProject: inv.amount,
                    investedAt: inv.createdAt,
                });
            }
            else {
                investorsMap.get(inv.userId).totalInvestedInProject += inv.amount;
            }
        });
        (0, helpers_1.successResponse)(res, {
            raisedAmount: project.raisedAmount,
            dejaAlloue,
            dejaApprouve,
            budgetDisponible,
            milestones: project.milestones,
            investors: Array.from(investorsMap.values()),
        });
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
router.get('/project/:projectId', auth_1.authenticate, async (req, res) => {
    try {
        const milestones = await database_1.default.milestone.findMany({
            where: { projectId: req.params.projectId },
            include: {
                payments: {
                    include: { supplier: { select: { companyName: true, mobileMoneyProvider: true } } }
                }
            },
            orderBy: { createdAt: 'asc' }
        });
        (0, helpers_1.successResponse)(res, milestones);
    }
    catch {
        (0, helpers_1.errorResponse)(res);
    }
});
// Entrepreneur soumet une demande de déblocage
router.post('/:id/request', auth_1.authenticate, (0, auth_1.requireRole)(['ENTREPRENEUR']), async (req, res) => {
    try {
        const { invoiceUrl, supplierId, description } = req.body;
        const milestone = await database_1.default.milestone.findUnique({
            where: { id: req.params.id },
            include: { project: true }
        });
        if (!milestone) {
            res.status(404).json({ success: false, message: 'Jalon introuvable' });
            return;
        }
        if (milestone.project.entrepreneurId !== req.userId) {
            res.status(403).json({ success: false, message: 'Non autorisé' });
            return;
        }
        if (milestone.status !== 'PENDING') {
            res.status(400).json({ success: false, message: 'Ce jalon a déjà été soumis ou traité' });
            return;
        }
        // Vérifier que le fournisseur existe et est vérifié
        if (supplierId) {
            const supplier = await database_1.default.supplier.findUnique({ where: { id: supplierId } });
            if (!supplier || !supplier.isVerified) {
                res.status(400).json({ success: false, message: 'Fournisseur non vérifié — utilise un fournisseur pré-enregistré' });
                return;
            }
        }
        const updated = await database_1.default.milestone.update({
            where: { id: req.params.id },
            data: {
                status: 'SUBMITTED',
                invoiceUrl: invoiceUrl || null,
                description: description || milestone.description,
            }
        });
        // Notifier l'admin
        const admins = await database_1.default.user.findMany({ where: { role: 'ADMIN' } });
        await database_1.default.notification.createMany({
            data: admins.map(a => ({
                userId: a.id,
                title: '📋 Demande de déblocage',
                body: `${milestone.project.title} — Jalon "${milestone.title}" : ${milestone.amount.toLocaleString()} FCFA`,
                type: 'MILESTONE_REQUEST',
                data: { milestoneId: milestone.id, projectId: milestone.projectId }
            }))
        });
        (0, helpers_1.successResponse)(res, updated, 'Demande de déblocage soumise — en attente de validation (48h)');
    }
    catch {
        (0, helpers_1.errorResponse)(res);
    }
});
// Admin approuve et déclenche le paiement fournisseur
router.post('/:id/approve', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { supplierId, adminNote } = req.body;
        const milestone = await database_1.default.milestone.findUnique({
            where: { id: req.params.id },
            include: { project: { include: { entrepreneur: true } } }
        });
        if (!milestone || milestone.status !== 'SUBMITTED') {
            res.status(400).json({ success: false, message: 'Jalon non trouvé ou non soumis' });
            return;
        }
        // Vérifier le fournisseur
        const supplier = supplierId ? await database_1.default.supplier.findUnique({ where: { id: supplierId } }) : null;
        if (supplierId && (!supplier || !supplier.isVerified)) {
            res.status(400).json({ success: false, message: 'Fournisseur non vérifié' });
            return;
        }
        // Transaction atomique avec calcul PayDunya Payout
        const { getFees } = await Promise.resolve().then(() => __importStar(require('../config/fees')));
        const fees = await getFees();
        const payoutRate = fees.withdrawal_fee_standard || 3;
        const paydunyaPayout = Math.round(milestone.amount * payoutRate / 100);
        const netSupplier = milestone.amount - paydunyaPayout;
        await database_1.default.$transaction(async (tx) => {
            await tx.milestone.update({
                where: { id: req.params.id },
                data: { status: 'APPROVED', adminNote: adminNote || 'Approuve', paidAt: new Date() }
            });
            if (supplierId) {
                await tx.milestonePayment.create({
                    data: { milestoneId: milestone.id, supplierId, amount: netSupplier, status: 'COMPLETED', paidAt: new Date() }
                });
            }
            // BAOBAB absorbe PayDunya Payout : debiter wallet admin
            const adminU = await tx.user.findFirst({ where: { role: 'ADMIN' } });
            if (adminU && paydunyaPayout > 0) {
                await tx.wallet.update({
                    where: { userId: adminU.id },
                    data: { balance: { decrement: paydunyaPayout }, commissionBalance: { decrement: paydunyaPayout } }
                });
                await tx.platformRevenue.create({
                    data: { type: 'PAYDUNYA_FEE', amount: -paydunyaPayout, projectId: milestone.projectId,
                        description: 'PayDunya Payout ' + payoutRate + '% jalon ' + milestone.title }
                });
            }
            await tx.notification.create({
                data: {
                    userId: milestone.project.entrepreneurId,
                    title: 'Jalon approuve !',
                    body: 'Le jalon ' + milestone.title + ' a ete approuve.' + (supplierId ? ' Paiement ' + netSupplier.toLocaleString() + ' FCFA envoye au fournisseur.' : ''),
                    type: 'MILESTONE_APPROVED',
                }
            });
        });
        // Notifier les investisseurs
        const investments = await database_1.default.investment.findMany({
            where: { projectId: milestone.projectId },
            select: { userId: true }
        });
        const uniqueInvestors = [...new Set(investments.map(i => i.userId))];
        await database_1.default.notification.createMany({
            data: uniqueInvestors.map(userId => ({
                userId,
                title: '🚀 Avancement projet',
                body: `${milestone.project.title} : le jalon "${milestone.title}" est validé et payé !`,
                type: 'MILESTONE_UPDATE',
            }))
        });
        (0, helpers_1.successResponse)(res, null, 'Jalon approuvé — paiement fournisseur déclenché');
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
// Admin rejette la demande
router.post('/:id/reject', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { adminNote } = req.body;
        const milestone = await database_1.default.milestone.findUnique({
            where: { id: req.params.id },
            include: { project: true }
        });
        if (!milestone) {
            res.status(404).json({ success: false, message: 'Jalon introuvable' });
            return;
        }
        await database_1.default.milestone.update({
            where: { id: req.params.id },
            data: { status: 'REJECTED', adminNote }
        });
        await database_1.default.notification.create({
            data: {
                userId: milestone.project.entrepreneurId,
                title: '❌ Jalon rejeté',
                body: `Le jalon "${milestone.title}" a été rejeté : ${adminNote}`,
                type: 'MILESTONE_REJECTED',
            }
        });
        (0, helpers_1.successResponse)(res, null, 'Jalon rejeté');
    }
    catch {
        (0, helpers_1.errorResponse)(res);
    }
});
// Système de remboursement investisseurs (fin de projet)
router.post('/project/:projectId/reimburse', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const project = await database_1.default.project.findUnique({
            where: { id: projectId },
            include: { investments: { include: { user: { include: { wallet: true } } } } }
        });
        if (!project) {
            res.status(404).json({ success: false, message: 'Projet introuvable' });
            return;
        }
        let totalReimbursed = 0;
        const results = [];
        for (const inv of project.investments) {
            if (!inv.user.wallet)
                continue;
            const totalReturn = inv.amount + inv.expectedReturn;
            const commission = inv.expectedReturn * 0.04;
            await database_1.default.$transaction([
                // Créditer le wallet de l'investisseur
                database_1.default.wallet.update({
                    where: { userId: inv.userId },
                    data: {
                        balance: { increment: totalReturn - commission },
                        escrowBalance: { decrement: inv.amount },
                        totalEarned: { increment: inv.expectedReturn - commission },
                    }
                }),
                // Mettre à jour l'investissement
                database_1.default.investment.update({
                    where: { id: inv.id },
                    data: { status: 'COMPLETED', returnedAmount: totalReturn - commission }
                }),
                // Transaction
                database_1.default.transaction.create({
                    data: {
                        userId: inv.userId,
                        type: 'RETURN',
                        amount: totalReturn - commission,
                        status: 'COMPLETED',
                        description: `Remboursement projet "${project.title}"`,
                    }
                }),
                // Notification
                database_1.default.notification.create({
                    data: {
                        userId: inv.userId,
                        title: '💰 Remboursement reçu !',
                        body: `Tu as reçu ${(totalReturn - commission).toLocaleString()} FCFA du projet "${project.title}"`,
                        type: 'REIMBURSEMENT',
                    }
                }),
            ]);
            totalReimbursed += totalReturn - commission;
            results.push({ investor: `${inv.user.firstName} ${inv.user.lastName}`, amount: totalReturn - commission });
        }
        // Clôturer le projet
        await database_1.default.project.update({
            where: { id: projectId },
            data: { status: 'COMPLETED' }
        });
        (0, helpers_1.successResponse)(res, { totalReimbursed, investors: results }, `✅ ${project.investments.length} investisseurs remboursés — ${totalReimbursed.toLocaleString()} FCFA distribués`);
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
exports.default = router;
//# sourceMappingURL=milestones.js.map