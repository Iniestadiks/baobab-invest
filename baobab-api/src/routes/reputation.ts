import { PrismaClient } from "@prisma/client"
import { addReputationPoints, awardBadge, checkAndAwardBadges, REPUTATION_POINTS, getLevel } from "../services/reputationService"
import { Router, Response } from "express"
import { AuthRequest } from "../middleware/auth"
import { authenticate, requireAdmin } from "../middleware/auth"

const router = Router()
const prisma = new PrismaClient()

// GET /api/reputation/me — Mon profil réputation
router.get("/me", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { reputationPoints: true, reputationScore: true, level: true, role: true, firstName: true }
    })
    if (!user) { res.status(404).json({ success: false }); return }

    const levelInfo = getLevel(user.reputationPoints || 0)
    const events = await prisma.reputationEvent.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
      take: 20
    })
    const badges = await prisma.userBadge.findMany({
      where: { userId: req.userId! },
      orderBy: { awardedAt: "desc" }
    })

    res.json({ success: true, data: { ...user, levelInfo, events, badges, nextLevelPoints: levelInfo.nextLevelPoints, progress: Math.round(((user.reputationPoints || 0) - (levelInfo.level === 1 ? 0 : levelInfo.level === 2 ? 100 : levelInfo.level === 3 ? 300 : levelInfo.level === 4 ? 600 : 1000)) / (levelInfo.nextLevelPoints - (levelInfo.level === 1 ? 0 : levelInfo.level === 2 ? 100 : levelInfo.level === 3 ? 300 : levelInfo.level === 4 ? 600 : 1000)) * 100) } })
  } catch(e) { res.status(500).json({ success: false }) }
})

// GET /api/reputation/leaderboard — Classement public
router.get("/leaderboard", async (req: any, res: Response): Promise<void> => {
  try {
    const { role = "INVESTOR", period = "all" } = req.query
    const now = new Date()
    const where: any = { role: String(role) }
    if (period === "month") {
      where.createdAt = { gte: new Date(now.getFullYear(), now.getMonth(), 1) }
    } else if (period === "year") {
      where.createdAt = { gte: new Date(now.getFullYear(), 0, 1) }
    }

    let users: any[] = []
    if (role === "INVESTOR") {
      users = await prisma.user.findMany({
        where: { role: "INVESTOR" },
        select: {
          id: true, firstName: true, lastName: true, city: true, country: true,
          reputationPoints: true, reputationScore: true, level: true,
          profileImageUrl: true,
          userBadges: { select: { badge: true, label: true, icon: true }, take: 3 },
          investments: { select: { amount: true } }
        },
        orderBy: { reputationPoints: "desc" },
        take: 10
      })
      users = users.map(u => ({ ...u, totalInvested: u.investments.reduce((s: number, i: any) => s + i.amount, 0), investments: undefined }))
    } else if (role === "ENTREPRENEUR") {
      users = await prisma.user.findMany({
        where: { role: "ENTREPRENEUR" },
        select: {
          id: true, firstName: true, lastName: true, city: true, country: true,
          reputationPoints: true, reputationScore: true, level: true,
          profileImageUrl: true,
          userBadges: { select: { badge: true, label: true, icon: true }, take: 3 },
          projects: { select: { status: true, raisedAmount: true }, where: { status: { in: ["COMPLETED", "FUNDED", "IN_PROGRESS"] } } }
        },
        orderBy: { reputationPoints: "desc" },
        take: 10
      })
    }

    res.json({ success: true, data: users })
  } catch(e) { res.status(500).json({ success: false }) }
})

// GET /api/reputation/rankings/month — Classement mensuel actuel
router.get("/rankings/month", async (req: any, res: Response): Promise<void> => {
  try {
    const now = new Date()
    const rankings = await prisma.monthlyRanking.findMany({
      where: { month: now.getMonth() + 1, year: now.getFullYear() },
      include: { user: { select: { firstName: true, lastName: true, profileImageUrl: true, city: true, role: true } } },
      orderBy: [{ role: "asc" }, { rank: "asc" }]
    })
    res.json({ success: true, data: rankings })
  } catch(e) { res.status(500).json({ success: false }) }
})

// POST /api/reputation/award-badge — Admin attribue badge manuellement
router.post("/award-badge", authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, badgeKey } = req.body
    await awardBadge(userId, badgeKey)
    res.json({ success: true, message: "Badge attribué" })
  } catch(e) { res.status(500).json({ success: false }) }
})

// GET /api/reputation/user/:id — Profil réputation public
router.get("/user/:id", async (req: any, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        firstName: true, lastName: true, city: true, country: true,
        reputationPoints: true, reputationScore: true, level: true,
        profileImageUrl: true, role: true,
        userBadges: { orderBy: { awardedAt: "desc" } }
      }
    })
    if (!user) { res.status(404).json({ success: false }); return }
    const levelInfo = getLevel(user.reputationPoints || 0)
    res.json({ success: true, data: { ...user, levelInfo } })
  } catch(e) { res.status(500).json({ success: false }) }
})

export default router
