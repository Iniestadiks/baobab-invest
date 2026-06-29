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
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const config_1 = require("./config");
const auth_1 = __importDefault(require("./routes/auth"));
const projects_1 = __importDefault(require("./routes/projects"));
const investments_1 = __importDefault(require("./routes/investments"));
const milestones_1 = __importDefault(require("./routes/milestones"));
const suppliers_1 = __importDefault(require("./routes/suppliers"));
const feed_1 = __importDefault(require("./routes/feed"));
const admin_1 = __importDefault(require("./routes/admin"));
const fund_1 = __importDefault(require("./routes/fund"));
const upload_1 = __importDefault(require("./routes/upload"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const repayment_1 = __importDefault(require("./routes/repayment"));
const messages_1 = __importDefault(require("./routes/messages"));
const kyc_1 = __importDefault(require("./routes/kyc"));
const exports_1 = __importDefault(require("./routes/exports"));
const wallet_1 = __importDefault(require("./routes/wallet"));
const config_2 = __importDefault(require("./routes/config"));
const referral_1 = __importDefault(require("./routes/referral"));
const pdf_1 = __importDefault(require("./routes/pdf"));
const geo_1 = __importDefault(require("./routes/geo"));
const reputation_1 = __importDefault(require("./routes/reputation"));
const waitlistPromotion_1 = require("./jobs/waitlistPromotion");
const monthlyRankings_1 = require("./jobs/monthlyRankings");
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: '*', credentials: true }));
app.use(express_1.default.json({ limit: '10mb' }));
// Timeout étendu pour les uploads vidéo (5 minutes)
app.use('/api/upload', (req, res, next) => {
    req.setTimeout(300000); // 5 minutes
    res.setTimeout(300000);
    next();
});
app.use('/uploads', require('express').static('/home/baobab-invest/baobab-api/uploads'));
app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.use('/api/auth', auth_1.default);
app.use('/api/projects', projects_1.default);
app.use('/api/investments', investments_1.default);
app.use('/api/milestones', milestones_1.default);
app.use('/api/suppliers', suppliers_1.default);
app.use('/api/feed', feed_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/fund', fund_1.default);
app.use('/api/upload', upload_1.default);
app.use('/api/notifications', notifications_1.default);
app.use('/api/repayment', repayment_1.default);
app.use('/api/messages', messages_1.default);
app.use('/api/kyc', kyc_1.default);
app.use('/api/exports', exports_1.default);
app.use('/api/wallet', wallet_1.default);
app.use('/api/config', config_2.default);
app.use('/api/referral', referral_1.default);
app.use('/api/pdf', pdf_1.default);
app.use('/api/geo', geo_1.default);
app.use('/api/reputation', reputation_1.default);
// Cron toutes les heures — promotion liste d'attente
setInterval(waitlistPromotion_1.checkAndPromoteWaitlist, 60 * 60 * 1000);
// Cron quotidien — vérification retards paiement (tous les jours à 9h)
const checkRepaymentDelays = async () => {
    try {
        const prisma = new client_1.PrismaClient();
        const now = new Date();
        const late3days = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const late7days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const late15days = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
        const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const schedules = await prisma.repaymentSchedule.findMany({
            where: { status: 'ACTIVE' },
            include: {
                project: { include: { investments: { select: { userId: true } }, entrepreneur: { select: { id: true, firstName: true } } } },
                payments: { where: { status: 'PENDING' }, orderBy: { monthNumber: 'asc' }, take: 1 }
            }
        });
        let alerts = 0;
        for (const sched of schedules) {
            const nextPayment = sched.payments[0];
            if (!nextPayment?.dueDate)
                continue;
            const dueDate = new Date(nextPayment.dueDate);
            const entrepreneurId = sched.project.entrepreneurId;
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const recentAlert = await prisma.notification.findFirst({
                where: { userId: entrepreneurId, type: { in: ['PAYMENT_REMINDER', 'PAYMENT_LATE', 'PAYMENT_CRITICAL'] }, createdAt: { gte: oneDayAgo } }
            });
            if (recentAlert)
                continue;
            let title = '';
            let body = '';
            let scoreDecrement = 0;
            let notifyInvestors = false;
            let notifyAdmin = false;
            if (dueDate <= in3days && dueDate > now) {
                title = '⏰ Rappel mensualité dans 3 jours';
                body = `Votre mensualité de ${nextPayment.amount.toLocaleString()} FCFA est due le ${dueDate.toLocaleDateString('fr-FR')}. Rechargez votre wallet.`;
            }
            else if (dueDate <= now && dueDate > late3days) {
                title = '⚠️ Mensualité en retard';
                body = `Votre mensualité de ${nextPayment.amount.toLocaleString()} FCFA était due le ${dueDate.toLocaleDateString('fr-FR')}. Payez maintenant.`;
                scoreDecrement = 5;
            }
            else if (dueDate <= late3days && dueDate > late7days) {
                title = '🔴 Retard 3 jours — pénalité';
                body = `3 jours de retard sur ${nextPayment.amount.toLocaleString()} FCFA. -10 points réputation.`;
                scoreDecrement = 10;
                notifyInvestors = true;
            }
            else if (dueDate <= late7days && dueDate > late15days) {
                title = '🚨 Retard critique — 7 jours';
                body = `7 jours de retard. BAOBAB INVEST intervient. Score -30 points.`;
                scoreDecrement = 30;
                notifyInvestors = true;
                notifyAdmin = true;
            }
            else if (dueDate <= late15days) {
                title = '💀 Défaut de paiement — 15 jours';
                body = `15 jours de retard. Le projet peut être marqué en défaut.`;
                scoreDecrement = 50;
                notifyInvestors = true;
                notifyAdmin = true;
            }
            else
                continue;
            await prisma.notification.create({ data: { userId: entrepreneurId, title, body, type: 'PAYMENT_REMINDER', data: JSON.stringify({ scheduleId: sched.id }) } });
            if (scoreDecrement > 0)
                await prisma.user.update({ where: { id: entrepreneurId }, data: { reputationScore: { decrement: scoreDecrement } } });
            if (notifyInvestors) {
                const ids = [...new Set(sched.project.investments.map(i => i.userId))];
                await prisma.notification.createMany({ data: ids.map(userId => ({ userId: userId, title: '📭 Retard remboursement', body: `L'entrepreneur de "${sched.project.title}" est en retard.`, type: 'PAYMENT_LATE', data: JSON.stringify({ projectId: sched.projectId }) })) });
            }
            if (notifyAdmin) {
                const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
                await prisma.notification.createMany({ data: admins.map(a => ({ userId: a.id, title: '🚨 Retard critique', body: `Projet "${sched.project.title}" — ${Math.round((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))} jours de retard.`, type: 'PAYMENT_CRITICAL', data: JSON.stringify({ projectId: sched.projectId }) })) });
            }
            alerts++;
        }
        if (alerts > 0)
            console.log('[CRON] Retards paiement —', alerts, 'alertes envoyées');
        await prisma.$disconnect();
    }
    catch (e) {
        console.error('[CRON] Erreur check retards:', e);
    }
};
// Lancer quotidiennement à 9h
const scheduleDelayCheck = () => {
    const now = new Date();
    const next9h = new Date(now);
    next9h.setHours(9, 0, 0, 0);
    if (next9h <= now)
        next9h.setDate(next9h.getDate() + 1);
    const delay = next9h.getTime() - now.getTime();
    setTimeout(() => { checkRepaymentDelays(); setInterval(checkRepaymentDelays, 24 * 60 * 60 * 1000); }, delay);
    console.log('[CRON] Vérification retards paiement prévue à', next9h.toLocaleTimeString());
};
scheduleDelayCheck();
// Cron mensuel — classements (1er du mois à 8h)
const scheduleMonthlyRankings = () => {
    const now = new Date();
    // Toujours programmer pour le 1er du PROCHAIN mois
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 8, 0, 0);
    const delay = next.getTime() - now.getTime();
    setTimeout(() => {
        (0, monthlyRankings_1.computeMonthlyRankings)();
        // Reprogrammer chaque mois
        setInterval(monthlyRankings_1.computeMonthlyRankings, 30 * 24 * 60 * 60 * 1000);
    }, delay);
    console.log('[CRON] Classement mensuel prévu le', next.toLocaleDateString());
};
// // scheduleMonthlyRankings() // desactive // desactive
// CRON mensuel — gamification bâtisseurs (1er du mois à 8h30)
const scheduleBuilderGamification = () => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 8, 30, 0);
    const delay = next.getTime() - now.getTime();
    setTimeout(async () => {
        const { decrementInactiveBuilders } = await Promise.resolve().then(() => __importStar(require('./services/builderGamification')));
        await decrementInactiveBuilders();
        setInterval(async () => {
            const { decrementInactiveBuilders: d } = await Promise.resolve().then(() => __importStar(require('./services/builderGamification')));
            await d();
        }, 30 * 24 * 60 * 60 * 1000);
    }, delay);
    console.log('[CRON] Gamification bâtisseurs prévue le', next.toLocaleDateString());
};
// // scheduleBuilderGamification() // desactive // desactive
(0, waitlistPromotion_1.checkAndPromoteWaitlist)(); // Lancer au démarrage
app.listen(config_1.config.port, () => {
    console.log(`🌳 BAOBAB INVEST API démarrée sur le port ${config_1.config.port}`);
    console.log(`📡 Environnement : ${config_1.config.env}`);
    console.log(`🗄️  Routes : auth | projects | investments | milestones | suppliers | feed | admin | fund | upload | notifications`);
});
//# sourceMappingURL=index.js.map