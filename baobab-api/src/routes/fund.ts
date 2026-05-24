import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const FUND_ID = '00000000-0000-0000-0000-000000000001'
const BAOBAB_FEE_RATE = 0.10   // 10% BAOBAB
const OPERATOR_FEE_RATE = 0.04  // 4% opérateur

const successResponse = (res: Response, data: any, message = 'OK') =>
  res.json({ success: true, data, message })
const errorResponse = (res: Response, message = 'Erreur serveur', code = 500) =>
  res.status(code).json({ success: false, message })

// Attribuer badges selon montant cumulé
async function awardFundBadges(userId: string) {
  const total = await prisma.fundContribution.aggregate({
    where: { userId, status: 'COMPLETED' },
    _sum: { amount: true }
  })
  const amount = total._sum.amount || 0
  const badges = []
  if (amount >= 500)    badges.push('SEMEUR')
  if (amount >= 5000)   badges.push('JARDINIER')
  if (amount >= 25000)  badges.push('BAOBAB')
  if (amount >= 100000) badges.push('GRAND_BATISSEUR')
  for (const badge of badges) {
    await prisma.fundBadge.upsert({
      where: { userId_badge: { userId, badge } },
      update: {},
      create: { userId, badge }
    })
  }
}

// ─── STATS PUBLIQUES ────────────────────────────────────────────────────────
router.get('/stats', async (req: any, res: Response): Promise<void> => {
  try {
    const [fund, contributions, allocations, campaigns, topContributors, monthly] = await Promise.all([
      prisma.solidaryFund.findUnique({ where: { id: FUND_ID } }),
      prisma.fundContribution.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true, netAmount: true, baobabFee: true },
        _count: true
      }),
      prisma.fundAllocation.aggregate({ _sum: { amount: true }, _count: true }),
      prisma.fundCampaign.findMany({
        where: { active: true, endDate: { gte: new Date() } },
        include: { project: { select: { title: true, sector: true } } },
        orderBy: { endDate: 'asc' }
      }),
      // Top contributeurs publics
      prisma.fundContribution.groupBy({
        by: ['userId'],
        where: { status: 'COMPLETED', anonymous: false, userId: { not: null } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 10
      }),
      // Stats mensuelles 12 derniers mois
      prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', "createdAt") as month,
          SUM(amount) as total,
          COUNT(*) as count
        FROM fund_contribution
        WHERE status = 'COMPLETED'
          AND "createdAt" >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY month ASC
      `
    ])

    // Enrichir top contributeurs
    const enrichedTop = await Promise.all(
      topContributors.map(async (c) => {
        if (!c.userId) return null
        const user = await prisma.user.findUnique({
          where: { id: c.userId },
          select: { firstName: true, lastName: true, reputationScore: true }
        })
        const badges = await prisma.fundBadge.findMany({ where: { userId: c.userId } })
        return { ...user, total: c._sum.amount, badges: badges.map(b => b.badge) }
      })
    )

    // Projets financés par le fonds
    const fundedProjects = await prisma.fundAllocation.findMany({
      include: {
        project: { select: { id: true, title: true, sector: true, status: true, raisedAmount: true, goalAmount: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    successResponse(res, {
      fund: {
        totalReceived: contributions._sum.amount || 0,
        totalNet: contributions._sum.netAmount || 0,
        totalBaobabFee: contributions._sum.baobabFee || 0,
        totalAllocated: allocations._sum.amount || 0,
        available: (contributions._sum.netAmount || 0) - (allocations._sum.amount || 0),
        totalContributors: contributions._count,
        totalProjects: allocations._count,
      },
      campaigns,
      topContributors: enrichedTop.filter(Boolean),
      fundedProjects,
      monthly
    })
  } catch (e) { console.error(e); errorResponse(res) }
})

// ─── HISTORIQUE CONTRIBUTIONS PUBLIQUES ─────────────────────────────────────
router.get('/contributions', async (req: any, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', projectId, campaignId, startDate, endDate } = req.query
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string)
    const where: any = { status: 'COMPLETED' }
    if (projectId) where.projectId = projectId
    if (campaignId) where.campaignId = campaignId
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate as string)
      if (endDate) where.createdAt.lte = new Date(endDate as string)
    }
    const [total, contributions] = await Promise.all([
      prisma.fundContribution.count({ where }),
      prisma.fundContribution.findMany({
        where, skip, take: parseInt(limit as string),
        include: {
          user: { select: { firstName: true, lastName: true } },
          project: { select: { title: true, sector: true } },
        },
        orderBy: { createdAt: 'desc' }
      })
    ])
    const enriched = contributions.map(c => ({
      ...c,
      displayName: c.anonymous ? 'Anonyme' : c.user ? `${c.user.firstName} ${c.user.lastName}` : c.guestName || 'Visiteur'
    }))
    successResponse(res, { contributions: enriched, total, page: parseInt(page as string), pages: Math.ceil(total / parseInt(limit as string)) })
  } catch (e) { errorResponse(res) }
})

// ─── CONTRIBUER (avec ou sans compte) ───────────────────────────────────────
router.post('/contribute', async (req: any, res: Response): Promise<void> => {
  try {
    const { amount, anonymous = false, message, projectId, campaignId, paymentMethod = 'WAVE', operator, guestName, guestEmail, guestPhone } = req.body
    if (!amount || amount < 500) { errorResponse(res, 'Montant minimum : 500 FCFA', 400); return }

    const baobabFee  = Math.round(amount * BAOBAB_FEE_RATE)
    const operatorFee = Math.round(amount * OPERATOR_FEE_RATE)
    const netAmount  = amount - baobabFee

    // Récupérer userId si connecté
    let userId: string | null = null
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken')
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET!) as any
        userId = decoded.userId
      } catch {}
    }

    const contribution = await prisma.fundContribution.create({
      data: {
        amount, netAmount, baobabFee, operatorFee,
        anonymous, message, userId,
        guestName, guestEmail, guestPhone,
        projectId: projectId || null,
        campaignId: campaignId || null,
        paymentMethod, operator,
        status: 'PENDING'
      }
    })

    // En mode test : confirmer immédiatement (en prod = webhook PayDunya)
    // TODO: initier paiement PayDunya ici

    successResponse(res, {
      contributionId: contribution.id,
      amount, netAmount, baobabFee,
      message: 'Contribution enregistrée. Paiement en attente.'
    }, 'Contribution créée')
  } catch (e) { console.error(e); errorResponse(res) }
})

// ─── CONFIRMER CONTRIBUTION (webhook PayDunya) ───────────────────────────────
router.post('/confirm/:id', async (req: any, res: Response): Promise<void> => {
  try {
    const contribution = await prisma.fundContribution.findUnique({ where: { id: req.params.id } })
    if (!contribution || contribution.status === 'COMPLETED') { res.json({ success: true }); return }

    await prisma.fundContribution.update({
      where: { id: req.params.id },
      data: { status: 'COMPLETED', updatedAt: new Date() }
    })

    // Mettre à jour fonds solidaire
    await prisma.solidaryFund.upsert({
      where: { id: FUND_ID },
      create: { id: FUND_ID, totalReceived: contribution.amount, totalContributors: 1 },
      update: { totalReceived: { increment: contribution.amount }, totalContributors: { increment: 1 } }
    })

    // Créditer BAOBAB
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    if (admin) {
      await prisma.wallet.update({
        where: { userId: admin.id },
        data: { commissionBalance: { increment: contribution.baobabFee } }
      })
    }

    // Si campagne → mettre à jour raised
    if (contribution.campaignId) {
      await prisma.fundCampaign.update({
        where: { id: contribution.campaignId },
        data: { raised: { increment: contribution.netAmount } }
      })
    }

    // Attribution badges si user connecté
    if (contribution.userId) await awardFundBadges(contribution.userId)

    // Notification si user connecté
    if (contribution.userId) {
      await prisma.notification.create({
        data: {
          userId: contribution.userId,
          title: '🌱 Merci pour votre contribution !',
          body: `Votre don de ${contribution.amount.toLocaleString()} FCFA au Fonds Solidaire BAOBAB a été confirmé.`,
          type: 'FUND_CONTRIBUTION',
          data: JSON.stringify({ contributionId: contribution.id, amount: contribution.amount })
        }
      })
    }

    successResponse(res, { confirmed: true }, 'Contribution confirmée')
  } catch (e) { console.error(e); errorResponse(res) }
})

// ─── ADMIN — CONFIRMER MANUELLEMENT ─────────────────────────────────────────
router.post('/admin/confirm/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const contribution = await prisma.fundContribution.findUnique({ where: { id: req.params.id } })
    if (!contribution) { errorResponse(res, 'Contribution introuvable', 404); return }
    // Réutiliser la route confirm
    req.params = { id: req.params.id }
    // Appeler directement la logique
    await prisma.fundContribution.update({ where: { id: req.params.id }, data: { status: 'COMPLETED' } })
    await prisma.solidaryFund.upsert({
      where: { id: FUND_ID },
      create: { id: FUND_ID, totalReceived: contribution.amount, totalContributors: 1 },
      update: { totalReceived: { increment: contribution.amount }, totalContributors: { increment: 1 } }
    })
    if (contribution.userId) await awardFundBadges(contribution.userId)
    successResponse(res, {}, 'Contribution confirmée manuellement')
  } catch (e) { errorResponse(res) }
})

// ─── ADMIN — ALLOUER FONDS À UN PROJET ──────────────────────────────────────
router.post('/admin/allocate', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, amount, note } = req.body
    if (!projectId || !amount) { errorResponse(res, 'Projet et montant requis', 400); return }

    // Vérifier fonds disponible
    const contributions = await prisma.fundContribution.aggregate({
      where: { status: 'COMPLETED' }, _sum: { netAmount: true }
    })
    const allocations = await prisma.fundAllocation.aggregate({ _sum: { amount: true } })
    const available = (contributions._sum.netAmount || 0) - (allocations._sum.amount || 0)

    if (amount > available) { errorResponse(res, `Fonds insuffisant. Disponible: ${Math.round(available).toLocaleString()} FCFA`, 400); return }

    const allocation = await prisma.fundAllocation.create({
      data: { projectId, amount, adminId: req.userId!, note }
    })

    // Créditer wallet entrepreneur
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { entrepreneur: true }
    })
    if (project) {
      await prisma.wallet.update({
        where: { userId: project.entrepreneurId },
        data: { balance: { increment: amount } }
      })
      await prisma.notification.create({
        data: {
          userId: project.entrepreneurId,
          title: '🎉 Fonds Solidaire — Financement reçu !',
          body: `Votre projet "${project.title}" vient de recevoir ${amount.toLocaleString()} FCFA du Fonds Solidaire BAOBAB INVEST.`,
          type: 'FUND_ALLOCATION',
          data: JSON.stringify({ projectId, amount })
        }
      })
    }

    await prisma.solidaryFund.update({
      where: { id: FUND_ID },
      data: { totalAllocated: { increment: amount }, totalProjects: { increment: 1 } }
    })

    successResponse(res, allocation, 'Fonds alloués avec succès')
  } catch (e) { console.error(e); errorResponse(res) }
})

// ─── ADMIN — LISTE CONTRIBUTIONS (avec filtres) ──────────────────────────────
router.get('/admin/contributions', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, startDate, endDate, page = '1', limit = '50' } = req.query
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string)
    const where: any = {}
    if (status) where.status = status
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate as string)
      if (endDate) where.createdAt.lte = new Date(endDate as string)
    }
    const [total, contributions, stats] = await Promise.all([
      prisma.fundContribution.count({ where }),
      prisma.fundContribution.findMany({
        where, skip, take: parseInt(limit as string),
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          project: { select: { title: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.fundContribution.aggregate({
        where, _sum: { amount: true, netAmount: true, baobabFee: true }
      })
    ])
    successResponse(res, { contributions, total, stats: stats._sum, pages: Math.ceil(total / parseInt(limit as string)) })
  } catch (e) { errorResponse(res) }
})

// ─── ADMIN — STATS DÉTAILLÉES ────────────────────────────────────────────────
router.get('/admin/stats', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query
    const where: any = { status: 'COMPLETED' }
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate as string)
      if (endDate) where.createdAt.lte = new Date(endDate as string)
    }

    const [global, byMethod, byMonth, allocations, campaigns, badges] = await Promise.all([
      prisma.fundContribution.aggregate({
        where, _sum: { amount: true, netAmount: true, baobabFee: true, operatorFee: true }, _count: true
      }),
      prisma.fundContribution.groupBy({
        by: ['paymentMethod'], where, _sum: { amount: true }, _count: true
      }),
      prisma.$queryRaw`
        SELECT 
          TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') as month,
          SUM(amount)::float as total,
          SUM("netAmount")::float as net,
          SUM("baobabFee")::float as fees,
          COUNT(*)::int as count
        FROM fund_contribution
        WHERE status = 'COMPLETED'
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY month DESC
        LIMIT 24
      `,
      prisma.fundAllocation.findMany({
        include: { project: { select: { title: true, sector: true, status: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.fundCampaign.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.fundBadge.groupBy({ by: ['badge'], _count: true, orderBy: { _count: { badge: 'desc' } } })
    ])

    successResponse(res, {
      global: {
        totalReceived: global._sum.amount || 0,
        totalNet: global._sum.netAmount || 0,
        totalBaobabFee: global._sum.baobabFee || 0,
        totalOperatorFee: global._sum.operatorFee || 0,
        totalContributions: global._count,
        totalAllocated: allocations.reduce((s, a) => s + a.amount, 0),
        available: (global._sum.netAmount || 0) - allocations.reduce((s, a) => s + a.amount, 0),
      },
      byMethod,
      byMonth,
      allocations,
      campaigns,
      badges
    })
  } catch (e) { console.error(e); errorResponse(res) }
})

// ─── ADMIN — CRÉER CAMPAGNE ──────────────────────────────────────────────────
router.post('/admin/campaigns', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, goalAmount, startDate, endDate, projectId, imageUrl } = req.body
    if (!title || !goalAmount || !startDate || !endDate) { errorResponse(res, 'Champs manquants', 400); return }
    const campaign = await prisma.fundCampaign.create({
      data: { title, description, goalAmount, startDate: new Date(startDate), endDate: new Date(endDate), projectId: projectId || null, imageUrl }
    })
    successResponse(res, campaign, 'Campagne créée')
  } catch (e) { errorResponse(res) }
})

// ─── ADMIN — GÉRER CAMPAGNES ─────────────────────────────────────────────────
router.patch('/admin/campaigns/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { active, title, description, goalAmount, endDate } = req.body
    const campaign = await prisma.fundCampaign.update({
      where: { id: req.params.id },
      data: { active, title, description, goalAmount, endDate: endDate ? new Date(endDate) : undefined }
    })
    successResponse(res, campaign, 'Campagne mise à jour')
  } catch (e) { errorResponse(res) }
})

// ─── EXPORT PDF/CSV (admin) ───────────────────────────────────────────────────
router.get('/admin/export', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { format = 'csv', startDate, endDate } = req.query
    const where: any = { status: 'COMPLETED' }
    if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate as string) }
    if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate as string) }

    const contributions = await prisma.fundContribution.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        project: { select: { title: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (format === 'csv') {
      const headers = 'Date,Contributeur,Email,Montant,Net BAOBAB,Frais,Projet,Méthode,Statut\n'
      const rows = contributions.map(c => {
        const name = c.anonymous ? 'Anonyme' : c.user ? `${c.user.firstName} ${c.user.lastName}` : c.guestName || 'Visiteur'
        const email = c.anonymous ? '' : c.user?.email || c.guestEmail || ''
        return `${new Date(c.createdAt).toLocaleDateString('fr-FR')},${name},${email},${c.amount},${c.netAmount},${c.baobabFee},${c.project?.title || 'Fonds général'},${c.paymentMethod},${c.status}`
      }).join('\n')
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="fonds-solidaire-${new Date().toISOString().split('T')[0]}.csv"`)
      res.send('\uFEFF' + headers + rows)
    } else {
      successResponse(res, contributions)
    }
  } catch (e) { errorResponse(res) }
})

// ─── MES CONTRIBUTIONS (utilisateur connecté) ────────────────────────────────
router.get('/my-contributions', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [contributions, badges, total] = await Promise.all([
      prisma.fundContribution.findMany({
        where: { userId: req.userId!, status: 'COMPLETED' },
        include: { project: { select: { title: true, sector: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.fundBadge.findMany({ where: { userId: req.userId! } }),
      prisma.fundContribution.aggregate({
        where: { userId: req.userId!, status: 'COMPLETED' },
        _sum: { amount: true }
      })
    ])
    successResponse(res, { contributions, badges, totalDonated: total._sum.amount || 0 })
  } catch (e) { errorResponse(res) }
})

export default router
