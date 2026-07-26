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
    const role = String(req.query.role || "INVESTOR")
    const period = String(req.query.period || "all")
    if (!["INVESTOR", "ENTREPRENEUR", "MENTOR"].includes(role)) {
      res.json({ success: true, data: [] }); return
    }
    const baseWhere: any = { kycStatus: "VERIFIED", role: role }

    const includeExtra = (r: string) => {
      if (r === "INVESTOR") return { investments: { select: { amount: true } } }
      if (r === "ENTREPRENEUR") return { projectsOwned: { select: { status: true, raisedAmount: true } } }
      return {}
    }
    const mapResult = (u: any) => ({
      ...u,
      totalInvested: u.investments ? u.investments.reduce((s: number, i: any) => s + i.amount, 0) : undefined,
      investments: undefined,
    })

    // ── "Tout temps" — classement sur les points cumulés à vie ──
    if (period === "all") {
      const users = await prisma.user.findMany({
        where: baseWhere,
        select: {
          id: true, firstName: true, lastName: true, city: true, country: true,
          reputationPoints: true, reputationScore: true, level: true, profileImageUrl: true,
          userBadges: { select: { badge: true, label: true, icon: true }, take: 3 },
          ...includeExtra(role),
        },
        orderBy: { reputationPoints: "desc" },
        take: 10,
      })
      res.json({ success: true, data: users.map(mapResult) }); return
    }

    // ── "Ce mois" / "Cette année" — points RÉELLEMENT gagnés dans la période,
    // calculés à partir des événements de réputation (ReputationEvent), pas
    // du total à vie. Le niveau affiché reste le niveau global de l'utilisateur.
    const now = new Date()
    const periodStart = period === "month"
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(now.getFullYear(), 0, 1) // "year"

    const roleUsers = await prisma.user.findMany({ where: baseWhere, select: { id: true } })
    const userIds = roleUsers.map(u => u.id)
    if (userIds.length === 0) { res.json({ success: true, data: [] }); return }

    const grouped = await prisma.reputationEvent.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, createdAt: { gte: periodStart }, points: { gt: 0 } },
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
      take: 10,
    })
    const topUserIds = grouped.map(g => g.userId)
    if (topUserIds.length === 0) { res.json({ success: true, data: [] }); return }

    const pointsMap: Record<string, number> = {}
    grouped.forEach(g => { pointsMap[g.userId] = g._sum.points || 0 })

    const users = await prisma.user.findMany({
      where: { id: { in: topUserIds } },
      select: {
        id: true, firstName: true, lastName: true, city: true, country: true,
        reputationScore: true, level: true, profileImageUrl: true,
        userBadges: { select: { badge: true, label: true, icon: true }, take: 3 },
        ...includeExtra(role),
      },
    })
    const result = topUserIds
      .map(id => users.find(u => u.id === id))
      .filter((u): u is NonNullable<typeof u> => !!u)
      .map(u => mapResult({ ...u, reputationPoints: pointsMap[u.id] || 0 }))

    res.json({ success: true, data: result })
  } catch(e) { console.error(e); res.status(500).json({ success: false }) }
})
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
        profileImageUrl: true, role: true, kycStatus: true,
        bio: true, createdAt: true,
        userBadges: { orderBy: { awardedAt: "desc" } },
        reputationEvents: { orderBy: { createdAt: "desc" }, take: 10 },
        projectsOwned: { where: { status: { in: ["ACTIVE","FUNDED","IN_PROGRESS","COMPLETED"] } }, select: { id: true, title: true, status: true, raisedAmount: true, goalAmount: true, sector: true } },
        investments: { select: { amount: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 5 }
      }
    })
    if (!user) { res.status(404).json({ success: false }); return }
    const levelInfo = getLevel(user.reputationPoints || 0)
    res.json({ success: true, data: { ...user, levelInfo } })
  } catch(e) { res.status(500).json({ success: false }) }
})

export default router
