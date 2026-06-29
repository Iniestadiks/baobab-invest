"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.BADGES = exports.REPUTATION_POINTS = void 0;
exports.getLevel = getLevel;
exports.addReputationPoints = addReputationPoints;
exports.awardBadge = awardBadge;
exports.checkAndAwardBadges = checkAndAwardBadges;
// @ts-nocheck
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
exports.prisma = prisma;
// ===== DÉFINITION DES POINTS =====
exports.REPUTATION_POINTS = {
    // Investisseur
    KYC_VERIFIED: 5,
    PROFILE_COMPLETED: 5,
    FIRST_INVESTMENT: 10,
    INVESTMENT_MADE: 5,
    INVESTMENT_50K: 10,
    INVESTMENT_100K: 15,
    INVESTMENT_500K: 25,
    INVESTMENT_1M: 50,
    INVESTMENT_COMPLETES_PROJECT: 20,
    INVESTMENT_NEW_SECTOR: 15,
    INVESTMENT_SAME_ENTREPRENEUR: 10,
    REFERRAL_INVESTED: 10,
    PROJECT_REVIEW_LEFT: 5,
    PROJECT_REPAID_SUCCESS: 20,
    FIVE_PROJECTS_SUCCESS: 30,
    // Entrepreneur
    ENTREPRENEUR_KYC: 10,
    ENTREPRENEUR_PROFILE: 5,
    BUSINESS_PLAN_ADDED: 10,
    PROJECT_VALIDATED: 20,
    PROJECT_50_PERCENT_7DAYS: 30,
    PROJECT_FULLY_FUNDED: 50,
    PROJECT_FUNDED_48H: 20,
    MONTHLY_REPORT_PUBLISHED: 10,
    PROJECT_MEDIA_ADDED: 15,
    INVESTOR_QUESTION_ANSWERED: 5,
    PROJECT_FULLY_REPAID: 50,
    PROJECT_EARLY_REPAID: 20,
    SECOND_PROJECT_SUCCESS: 100,
    THIRD_PROJECT_PLUS: 150,
    MENTOR_POSITIVE_REVIEW: 30,
    // Pénalités
    PAYMENT_LATE_3DAYS: -10,
    PAYMENT_LATE_7DAYS: -20,
    PAYMENT_LATE_15DAYS: -30,
    PROJECT_FAILED: -50,
    FRAUD_PROVEN: -100,
    NO_MONTHLY_REPORT: -5,
    NO_UPDATE_30DAYS: -15,
    INACTIVE_90DAYS: -5,
    // Mentor
    MENTOR_ACCEPTED: 10,
    MENTOR_PROJECT_FUNDED: 20,
    MENTOR_PROJECT_REPAID: 30,
    MENTOR_PROJECT_FAILED: -20,
    MENTOR_FRAUD: -30,
    MENTOR_NO_RESPONSE: -10,
    MENTOR_5_SUCCESS: 50,
};
// ===== DÉFINITION DES BADGES =====
exports.BADGES = {
    // Investisseur
    FIRST_INVESTMENT: { label: "Premier pas", icon: "🥇", description: "Premier investissement effectué" },
    INVESTOR_ACTIVE: { label: "Investisseur actif", icon: "💰", description: "5 investissements réalisés" },
    INVESTOR_DIAMOND: { label: "Diamant", icon: "💎", description: "1 000 000 FCFA investi au total" },
    INVESTOR_LIGHTNING: { label: "Éclair", icon: "⚡", description: "Investi dans les 6h d un projet" },
    INVESTOR_STREAK: { label: "En série", icon: "🔥", description: "3 investissements en 30 jours" },
    INVESTOR_DIASPORA: { label: "Diaspora", icon: "🌍", description: "Investisseur depuis l étranger" },
    INVESTOR_LOYAL: { label: "Fidèle", icon: "🤝", description: "Réinvesti chez le même entrepreneur" },
    INVESTOR_DIVERSIFIED: { label: "Diversifié", icon: "🌈", description: "Investi dans 5 secteurs différents" },
    INVESTOR_COMPLETES: { label: "Finisseur", icon: "🎯", description: "A complété le financement d un projet" },
    INVESTOR_MONTH: { label: "Investisseur du mois", icon: "👑", description: "Top investisseur du mois" },
    INVESTOR_YEAR: { label: "Investisseur de l an", icon: "🏆", description: "Top investisseur de l année" },
    // Entrepreneur
    PROJECT_FAST_FUNDED: { label: "Décollage rapide", icon: "🚀", description: "Projet financé en moins de 48h" },
    ENTREPRENEUR_SERIOUS: { label: "Sérieux", icon: "⭐", description: "3 rapports mensuels consécutifs" },
    ENTREPRENEUR_PUNCTUAL: { label: "Ponctuel", icon: "📅", description: "6 mensualités sans retard" },
    ENTREPRENEUR_REPAID: { label: "Remboursé", icon: "💯", description: "Projet remboursé à 100%" },
    ENTREPRENEUR_REPEAT: { label: "Récidiviste positif", icon: "🔄", description: "2ème projet financé avec succès" },
    ENTREPRENEUR_MONTH: { label: "Entrepreneur du mois", icon: "👑", description: "Top entrepreneur du mois" },
    ENTREPRENEUR_YEAR: { label: "Entrepreneur de l an", icon: "🏆", description: "Top entrepreneur de l année" },
    ENTREPRENEUR_HEARTBEAT: { label: "Coup de coeur", icon: "🌟", description: "Sélection coup de coeur admin" },
    ENTREPRENEUR_RESILIENT: { label: "Résilient", icon: "💪", description: "A surmonté un retard et remboursé" },
    // Mentor
    MENTOR_ACTIVE: { label: "Mentor actif", icon: "🎓", description: "3 projets parrainés" },
    MENTOR_EXCELLENCE: { label: "Excellence mentor", icon: "🏅", description: "5 projets réussis" },
    MENTOR_TRUSTED: { label: "Mentor de confiance", icon: "⭐", description: "Note moyenne > 4.5/5" },
    MENTOR_MONTH: { label: "Mentor du mois", icon: "👑", description: "Top mentor du mois" },
};
// ===== NIVEAUX =====
function getLevel(points) {
    if (points >= 1000)
        return { level: 5, label: "Grand Baobab", icon: "🏆", nextLevelPoints: 9999 };
    if (points >= 600)
        return { level: 4, label: "Baobab", icon: "🌲", nextLevelPoints: 1000 };
    if (points >= 300)
        return { level: 3, label: "Arbre", icon: "🌳", nextLevelPoints: 600 };
    if (points >= 100)
        return { level: 2, label: "Pousse", icon: "🌿", nextLevelPoints: 300 };
    return { level: 1, label: "Graine", icon: "🌱", nextLevelPoints: 100 };
}
// ===== AJOUTER DES POINTS =====
async function addReputationPoints(userId, type, points, description, projectId) {
    try {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { reputationScore: true, reputationPoints: true, level: true, firstName: true } });
        if (!user)
            return;
        const oldPoints = user.reputationPoints || 0;
        const oldLevel = getLevel(oldPoints);
        const newPoints = Math.max(0, oldPoints + points);
        const newLevel = getLevel(newPoints);
        // Enregistrer l événement
        await prisma.reputationEvent.create({
            data: { userId, type, points, description, projectId }
        });
        // Score sur 100 : proportionnel au niveau et aux points
        const scoreByLevel = { 1: 20, 2: 40, 3: 60, 4: 80, 5: 100 };
        const baseScore = scoreByLevel[newLevel.level] || 20;
        const reputationScore = Math.min(100, baseScore);
        await prisma.user.update({
            where: { id: userId },
            data: {
                reputationPoints: newPoints,
                level: newLevel.level,
                reputationScore
            }
        });
        // Notifier si gain de points
        if (points > 0) {
            await prisma.notification.create({
                data: {
                    userId,
                    title: points >= 20 ? "🎉 Points de réputation gagnés !" : "⭐ Réputation mise à jour",
                    body: description + " (+" + points + " pts)",
                    type: "REPUTATION_GAINED",
                    data: JSON.stringify({ points, total: newPoints })
                }
            });
        }
        // Notifier si passage de niveau
        if (newLevel.level > oldLevel.level) {
            await prisma.notification.create({
                data: {
                    userId,
                    title: "🎉 Nouveau niveau atteint !",
                    body: "Félicitations ! Vous êtes maintenant " + newLevel.icon + " " + newLevel.label + " (Niveau " + newLevel.level + ")",
                    type: "LEVEL_UP",
                    data: JSON.stringify({ level: newLevel.level, label: newLevel.label })
                }
            });
        }
        return { newPoints, newLevel };
    }
    catch (e) {
        console.error("[REPUTATION] Erreur:", e);
    }
}
// ===== ATTRIBUER UN BADGE =====
async function awardBadge(userId, badgeKey, projectId) {
    try {
        const badge = exports.BADGES[badgeKey];
        if (!badge)
            return;
        // Vérifier si déjà attribué
        const existing = await prisma.userBadge.findUnique({ where: { userId_badge: { userId, badge: badgeKey } } });
        if (existing)
            return;
        await prisma.userBadge.create({
            data: { userId, badge: badgeKey, label: badge.label, icon: badge.icon, projectId }
        });
        await prisma.notification.create({
            data: {
                userId,
                title: "🏅 Nouveau badge obtenu !",
                body: "Vous avez débloqué le badge " + badge.icon + " " + badge.label + " — " + badge.description,
                type: "BADGE_EARNED",
                data: JSON.stringify({ badge: badgeKey, label: badge.label, icon: badge.icon })
            }
        });
        console.log("[BADGE] Attribué:", badge.label, "à", userId);
    }
    catch (e) {
        console.error("[BADGE] Erreur:", e);
    }
}
// ===== VÉRIFIER ET ATTRIBUER LES BADGES AUTOMATIQUES =====
async function checkAndAwardBadges(userId, role) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                investments: { include: { project: { select: { sector: true } } } },
                projects: true,
                userBadges: true
            }
        });
        if (!user)
            return;
        const existingBadges = user.userBadges.map(b => b.badge);
        if (role === "INVESTOR") {
            const totalInvested = user.investments.reduce((s, i) => s + i.amount, 0);
            const investCount = user.investments.length;
            const sectors = [...new Set(user.investments.map(i => i.project?.sector).filter(Boolean))];
            if (investCount >= 1 && !existingBadges.includes("FIRST_INVESTMENT"))
                await awardBadge(userId, "FIRST_INVESTMENT");
            if (investCount >= 5 && !existingBadges.includes("INVESTOR_ACTIVE"))
                await awardBadge(userId, "INVESTOR_ACTIVE");
            if (totalInvested >= 1000000 && !existingBadges.includes("INVESTOR_DIAMOND"))
                await awardBadge(userId, "INVESTOR_DIAMOND");
            if (sectors.length >= 5 && !existingBadges.includes("INVESTOR_DIVERSIFIED"))
                await awardBadge(userId, "INVESTOR_DIVERSIFIED");
            if (user.country && user.country !== "SN" && !existingBadges.includes("INVESTOR_DIASPORA"))
                await awardBadge(userId, "INVESTOR_DIASPORA");
        }
        if (role === "ENTREPRENEUR") {
            const successProjects = user.projects.filter(p => p.status === "COMPLETED").length;
            const fundedProjects = user.projects.filter(p => ["FUNDED", "IN_PROGRESS", "COMPLETED"].includes(p.status)).length;
            if (fundedProjects >= 1 && !existingBadges.includes("ENTREPRENEUR_REPAID")) {
                // Vérifier si remboursé
            }
            if (successProjects >= 2 && !existingBadges.includes("ENTREPRENEUR_REPEAT"))
                await awardBadge(userId, "ENTREPRENEUR_REPEAT");
        }
    }
    catch (e) {
        console.error("[BADGES CHECK] Erreur:", e);
    }
}
//# sourceMappingURL=reputationService.js.map