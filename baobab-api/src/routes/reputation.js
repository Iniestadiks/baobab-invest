import { PrismaClient } from "@prisma/client";
import { awardBadge, getLevel } from "../services/reputationService";
import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
const router = Router();
const prisma = new PrismaClient();
// GET /api/reputation/me — Mon profil réputation
router.get("/me", authenticate, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { reputationPoints: true, reputationScore: true, level: true, role: true, firstName: true }
        });
        if (!user) {
            res.status(404).json({ success: false });
            return;
        }
        const levelInfo = getLevel(user.reputationPoints || 0);
        const events = await prisma.reputationEvent.findMany({
            where: { userId: req.userId },
            orderBy: { createdAt: "desc" },
            take: 20
        });
        const badges = await prisma.userBadge.findMany({
            where: { userId: req.userId },
            orderBy: { awardedAt: "desc" }
        });
        res.json({ success: true, data: { ...user, levelInfo, events, badges, nextLevelPoints: levelInfo.nextLevelPoints, progress: Math.round(((user.reputationPoints || 0) - (levelInfo.level === 1 ? 0 : levelInfo.level === 2 ? 100 : levelInfo.level === 3 ? 300 : levelInfo.level === 4 ? 600 : 1000)) / (levelInfo.nextLevelPoints - (levelInfo.level === 1 ? 0 : levelInfo.level === 2 ? 100 : levelInfo.level === 3 ? 300 : levelInfo.level === 4 ? 600 : 1000)) * 100) } });
    }
    catch (e) {
        res.status(500).json({ success: false });
    }
});
// GET /api/reputation/leaderboard — Classement public
router.get("/leaderboard", async (req, res) => {
    try {
        const role = String(req.query.role || "INVESTOR");
        const baseWhere = { kycStatus: "VERIFIED", role: role };
        if (role === "INVESTOR") {
            const users = await prisma.user.findMany({
                where: baseWhere,
                select: {
                    id: true, firstName: true, lastName: true, city: true, country: true,
                    reputationPoints: true, reputationScore: true, level: true, profileImageUrl: true,
                    userBadges: { select: { badge: true, label: true, icon: true }, take: 3 },
                    investments: { select: { amount: true } }
                },
                orderBy: { reputationPoints: "desc" },
                take: 10
            });
            const result = users.map(u => ({ ...u, totalInvested: u.investments.reduce((s, i) => s + i.amount, 0), investments: undefined }));
            res.json({ success: true, data: result });
            return;
        }
        if (role === "ENTREPRENEUR") {
            const users = await prisma.user.findMany({
                where: baseWhere,
                select: {
                    id: true, firstName: true, lastName: true, city: true, country: true,
                    reputationPoints: true, reputationScore: true, level: true, profileImageUrl: true,
                    userBadges: { select: { badge: true, label: true, icon: true }, take: 3 },
                    projectsOwned: { select: { status: true, raisedAmount: true } }
                },
                orderBy: { reputationPoints: "desc" },
                take: 10
            });
            res.json({ success: true, data: users });
            return;
        }
        if (role === "MENTOR") {
            const users = await prisma.user.findMany({
                where: baseWhere,
                select: {
                    id: true, firstName: true, lastName: true, city: true, country: true,
                    reputationPoints: true, reputationScore: true, level: true, profileImageUrl: true,
                    userBadges: { select: { badge: true, label: true, icon: true }, take: 3 }
                },
                orderBy: { reputationPoints: "desc" },
                take: 10
            });
            res.json({ success: true, data: users });
            return;
        }
        res.json({ success: true, data: [] });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ success: false });
    }
});
// GET /api/reputation/rankings/month — Classement mensuel actuel
router.get("/rankings/month", async (req, res) => {
    try {
        const now = new Date();
        const rankings = await prisma.monthlyRanking.findMany({
            where: { month: now.getMonth() + 1, year: now.getFullYear() },
            include: { user: { select: { firstName: true, lastName: true, profileImageUrl: true, city: true, role: true } } },
            orderBy: [{ role: "asc" }, { rank: "asc" }]
        });
        res.json({ success: true, data: rankings });
    }
    catch (e) {
        res.status(500).json({ success: false });
    }
});
// POST /api/reputation/award-badge — Admin attribue badge manuellement
router.post("/award-badge", authenticate, requireAdmin, async (req, res) => {
    try {
        const { userId, badgeKey } = req.body;
        await awardBadge(userId, badgeKey);
        res.json({ success: true, message: "Badge attribué" });
    }
    catch (e) {
        res.status(500).json({ success: false });
    }
});
// GET /api/reputation/user/:id — Profil réputation public
router.get("/user/:id", async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: {
                firstName: true, lastName: true, city: true, country: true,
                reputationPoints: true, reputationScore: true, level: true,
                profileImageUrl: true, role: true, kycStatus: true,
                bio: true, createdAt: true,
                userBadges: { orderBy: { awardedAt: "desc" } },
                reputationEvents: { orderBy: { createdAt: "desc" }, take: 10 },
                projectsOwned: { where: { status: { in: ["ACTIVE", "FUNDED", "IN_PROGRESS", "COMPLETED"] } }, select: { id: true, title: true, status: true, raisedAmount: true, goalAmount: true, sector: true } },
                investments: { select: { amount: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 5 }
            }
        });
        if (!user) {
            res.status(404).json({ success: false });
            return;
        }
        const levelInfo = getLevel(user.reputationPoints || 0);
        res.json({ success: true, data: { ...user, levelInfo } });
    }
    catch (e) {
        res.status(500).json({ success: false });
    }
});
export default router;
