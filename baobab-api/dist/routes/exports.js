"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
function toCSV(headers, rows) {
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
}
router.get('/investor', auth_1.authenticate, async (req, res) => {
    try {
        const { from, to } = req.query;
        const where = { userId: req.userId };
        if (from)
            where.createdAt = { ...where.createdAt, gte: new Date(String(from)) };
        if (to)
            where.createdAt = { ...where.createdAt, lte: new Date(String(to)) };
        const investments = await database_1.default.investment.findMany({
            where, include: { project: { select: { title: true, sector: true, expectedReturn: true, status: true } } },
            orderBy: { createdAt: 'desc' }
        });
        const wallet = await database_1.default.wallet.findUnique({ where: { userId: req.userId } });
        const headers = ['Date', 'Projet', 'Secteur', 'Montant (FCFA)', 'Retour attendu (FCFA)', 'Taux (%)', 'Statut', 'Recu (FCFA)'];
        const rows = investments.map(i => [
            new Date(i.createdAt).toLocaleDateString('fr-FR'),
            i.project?.title || '', i.project?.sector || '',
            i.amount, i.expectedReturn || 0, i.project?.expectedReturn || 0,
            i.project?.status || '', i.returnedAmount || 0
        ]);
        rows.push(['TOTAL', '', '', investments.reduce((s, i) => s + i.amount, 0), investments.reduce((s, i) => s + (i.expectedReturn || 0), 0), '', '', investments.reduce((s, i) => s + (i.returnedAmount || 0), 0)]);
        rows.push(['Solde wallet', wallet?.balance || 0, '', '', '', '', '', '']);
        rows.push(['En sequestre', wallet?.escrowBalance || 0, '', '', '', '', '', '']);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="investissements-${Date.now()}.csv"`);
        res.send('\ufeff' + toCSV(headers, rows));
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Erreur export' });
    }
});
router.get('/entrepreneur', auth_1.authenticate, async (req, res) => {
    try {
        const projects = await database_1.default.project.findMany({
            where: { entrepreneurId: req.userId },
            include: { investments: true, milestones: true },
            orderBy: { createdAt: 'desc' }
        });
        const headers = ['Projet', 'Secteur', 'Statut', 'Objectif (FCFA)', 'Leve (FCFA)', 'Investisseurs', 'Jalons', 'Jalons valides', 'Date'];
        const rows = projects.map(p => [
            p.title, p.sector, p.status, p.goalAmount, p.raisedAmount,
            p.investments.length, p.milestones.length,
            p.milestones.filter(m => ['APPROVED', 'PAID'].includes(m.status)).length,
            new Date(p.createdAt).toLocaleDateString('fr-FR')
        ]);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="projets-${Date.now()}.csv"`);
        res.send('\ufeff' + toCSV(headers, rows));
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Erreur export' });
    }
});
router.get('/mentor', auth_1.authenticate, async (req, res) => {
    try {
        const projects = await database_1.default.project.findMany({
            where: { mentorId: req.userId },
            include: { investments: true },
            orderBy: { createdAt: 'desc' }
        });
        const wallet = await database_1.default.wallet.findUnique({ where: { userId: req.userId } });
        const headers = ['Projet', 'Secteur', 'Statut', 'Leve (FCFA)', 'Investisseurs', 'Commission (FCFA)', 'Date'];
        const rows = projects.map(p => [
            p.title, p.sector, p.status, p.raisedAmount,
            p.investments.length, Math.round(p.raisedAmount * 0.02),
            new Date(p.createdAt).toLocaleDateString('fr-FR')
        ]);
        rows.push(['TOTAL COMMISSIONS', '', '', '', '', projects.reduce((s, p) => s + Math.round(p.raisedAmount * 0.02), 0), '']);
        rows.push(['Solde wallet', '', '', '', '', wallet?.balance || 0, '']);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="commissions-mentor-${Date.now()}.csv"`);
        res.send('\ufeff' + toCSV(headers, rows));
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Erreur export' });
    }
});
router.get('/supplier', auth_1.authenticate, async (req, res) => {
    try {
        const { supplierId } = req.query;
        const payments = await database_1.default.milestonePayment.findMany({
            where: supplierId ? { supplierId: String(supplierId) } : {},
            include: { milestone: { select: { title: true, project: { select: { title: true } } } }, supplier: { select: { companyName: true } } },
            orderBy: { createdAt: 'desc' }
        });
        const headers = ['Date', 'Fournisseur', 'Projet', 'Jalon', 'Montant (FCFA)', 'Statut', 'Date paiement'];
        const rows = payments.map(p => [
            new Date(p.createdAt).toLocaleDateString('fr-FR'),
            p.supplier?.companyName || '', p.milestone?.project?.title || '',
            p.milestone?.title || '', p.amount, p.status,
            p.paidAt ? new Date(p.paidAt).toLocaleDateString('fr-FR') : 'En attente'
        ]);
        rows.push(['TOTAL', '', '', '', payments.reduce((s, p) => s + p.amount, 0), '', '']);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="paiements-fournisseur-${Date.now()}.csv"`);
        res.send('\ufeff' + toCSV(headers, rows));
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Erreur export' });
    }
});
router.get('/admin', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { from, to } = req.query;
        const where = {};
        if (from)
            where.createdAt = { ...where.createdAt, gte: new Date(String(from)) };
        if (to)
            where.createdAt = { ...where.createdAt, lte: new Date(String(to)) };
        const [revenues, projects, users, investments] = await Promise.all([
            database_1.default.platformRevenue.findMany({ where, orderBy: { createdAt: 'desc' } }),
            database_1.default.project.findMany({ select: { status: true, raisedAmount: true, sector: true, createdAt: true } }),
            database_1.default.user.findMany({ select: { role: true, kycStatus: true, createdAt: true } }),
            database_1.default.investment.findMany({ select: { amount: true, createdAt: true } }),
        ]);
        const revHeaders = ['Date', 'Type', 'Montant (FCFA)', 'Description'];
        const revRows = revenues.map(r => [new Date(r.createdAt).toLocaleDateString('fr-FR'), r.type, r.amount, r.description || '']);
        revRows.push(['TOTAL', '', revenues.reduce((s, r) => s + r.amount, 0), '']);
        const statsHeaders = ['Metrique', 'Valeur'];
        const statsRows = [
            ['Total utilisateurs', users.length],
            ['Investisseurs', users.filter(u => u.role === 'INVESTOR').length],
            ['Entrepreneurs', users.filter(u => u.role === 'ENTREPRENEUR').length],
            ['Mentors', users.filter(u => u.role === 'MENTOR').length],
            ['KYC verifies', users.filter(u => u.kycStatus === 'VERIFIED').length],
            ['Projets actifs', projects.filter(p => p.status === 'ACTIVE').length],
            ['Projets finances', projects.filter(p => p.status === 'FUNDED').length],
            ['Projets termines', projects.filter(p => p.status === 'COMPLETED').length],
            ['Total leve (FCFA)', projects.reduce((s, p) => s + p.raisedAmount, 0)],
            ['Volume investissements (FCFA)', investments.reduce((s, i) => s + i.amount, 0)],
            ['Revenus BAOBAB (FCFA)', revenues.reduce((s, r) => s + r.amount, 0)],
        ];
        const csv = '=== REVENUS BAOBAB INVEST ===\n' + toCSV(revHeaders, revRows) + '\n\n=== STATISTIQUES GLOBALES ===\n' + toCSV(statsHeaders, statsRows);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="baobab-admin-${Date.now()}.csv"`);
        res.send('\ufeff' + csv);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Erreur export' });
    }
});
exports.default = router;
//# sourceMappingURL=exports.js.map