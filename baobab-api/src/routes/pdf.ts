import { Router, Response } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth'
import {
  generateInvestmentCertificate,
  generateInvestorStatement,
  generateProjectReport,
  generateAdminReport,
  generateMentorReport,
  generateBuilderReport
} from '../services/pdf'

const router = Router()

// Certificat d'investissement — par investisseur
router.get('/certificate/:investmentId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const investment = await prisma.investment.findUnique({
      where: { id: req.params.investmentId },
      include: {
        user: true,
        project: { include: { entrepreneur: { select: { firstName: true, lastName: true } } } }
      }
    })
    if (!investment) { res.status(404).json({ success: false, message: 'Investissement introuvable' }); return }
    if (investment.userId !== req.userId) { res.status(403).json({ success: false, message: 'Non autorisé' }); return }
    generateInvestmentCertificate(res, {
      investor: investment.user,
      investment,
      project: investment.project
    })
  } catch (e) { console.error(e); res.status(500).json({ success: false, message: 'Erreur génération PDF' }) }
})

// Relevé de compte investisseur
router.get('/statement/investor', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query
    const where: any = { userId: req.userId }
    if (from) where.createdAt = { ...where.createdAt, gte: new Date(String(from)) }
    if (to) where.createdAt = { ...where.createdAt, lte: new Date(String(to)) }

    const [user, investments, wallet] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.userId } }),
      prisma.investment.findMany({ where, include: { project: { select: { title: true, sector: true, expectedReturn: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.wallet.findUnique({ where: { userId: req.userId } })
    ])

    const period = from && to
      ? `Du ${new Date(String(from)).toLocaleDateString('fr-FR')} au ${new Date(String(to)).toLocaleDateString('fr-FR')}`
      : `Relevé complet — ${new Date().toLocaleDateString('fr-FR')}`

    generateInvestorStatement(res, { investor: user, investments, wallet, period })
  } catch (e) { console.error(e); res.status(500).json({ success: false, message: 'Erreur génération PDF' }) }
})

// Rapport projet entrepreneur
router.get('/report/project/:projectId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: {
        entrepreneur: true,
        milestones: { include: { supplier: { select: { companyName: true } } } },
        investments: { include: { user: { select: { firstName: true, lastName: true, city: true } } } }
      }
    })
    if (!project) { res.status(404).json({ success: false, message: 'Projet introuvable' }); return }
    if (project.entrepreneurId !== req.userId) { res.status(403).json({ success: false, message: 'Non autorisé' }); return }

    const feesConfig = await prisma.platformConfig.findMany()
    const feeMap: any = {}
    feesConfig.forEach((f: any) => { feeMap[f.key] = parseFloat(f.value) })
    generateProjectReport(res, {
      entrepreneur: project.entrepreneur,
      project,
      milestones: project.milestones,
      investments: project.investments,
      fees: feeMap
    })
  } catch (e) { console.error(e); res.status(500).json({ success: false, message: 'Erreur génération PDF' }) }
})

// Rapport mentor
router.get('/report/mentor', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [mentor, projects, wallet] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.userId } }),
      prisma.project.findMany({ where: { mentorId: req.userId }, include: { investments: true } }),
      prisma.wallet.findUnique({ where: { userId: req.userId } })
    ])

    const period = `Rapport mentor — ${new Date().toLocaleDateString('fr-FR')}`
    generateMentorReport(res, { mentor, projects, wallet, period })
  } catch (e) { console.error(e); res.status(500).json({ success: false, message: 'Erreur génération PDF' }) }
})

// Rapport admin
router.get('/report/admin', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [revenues, feesConfig, users] = await Promise.all([
      prisma.platformRevenue.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.platformConfig.findMany(),
      prisma.user.findMany({ select: { role: true, kycStatus: true } })
    ])
    const projects = await prisma.project.findMany({
      include: {
        investments: { select: { amount: true, expectedReturn: true, status: true, createdAt: true, user: { select: { firstName: true, lastName: true } } } },
        entrepreneur: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' }
    })
    const feeMap: any = {}
    feesConfig.forEach((f: any) => { feeMap[f.key] = parseFloat(f.value) })
    const totalRaised = projects.reduce((s: number, p: any) => s + (p.raisedAmount || 0), 0)
    const fraisTaux = (feeMap.commission_baobab_collection||5) + (feeMap.commission_mentor||2) + (feeMap.commission_guarantee||2)
    const totalCagnotteNette = Math.round(totalRaised * (1 - fraisTaux/100))
    const totalGrossReturn = projects.reduce((s: number, p: any) => s + p.investments.reduce((ss: number, i: any) => ss + (i.expectedReturn||0), 0), 0)
    const totalNetInvestors = Math.round(totalGrossReturn * (1 - (feeMap.payin_repayment||4)/100))
    const revByType: any = {}
    revenues.forEach((r: any) => { revByType[r.type] = (revByType[r.type]||0) + r.amount })
    const revenuNetBAOBAB = (revByType['COMMISSION_COLLECTION']||0) - Math.abs(revByType['PAYDUNYA_FEE']||0)
    const stats = {
      totalUsers: users.length,
      totalRaised, totalCagnotteNette, totalNetInvestors, revenuNetBAOBAB,
      activeProjects: projects.filter((p: any) => p.status === 'ACTIVE').length,
      fundedProjects: projects.filter((p: any) => p.status === 'FUNDED').length,
      completedProjects: projects.filter((p: any) => p.status === 'COMPLETED').length,
      kycVerified: users.filter((u: any) => u.kycStatus === 'VERIFIED').length,
      kycRate: Math.round((users.filter((u: any) => u.kycStatus === 'VERIFIED').length / (users.length||1)) * 100)
    }
    generateAdminReport(res, { stats, projects, revenues, fees: feeMap })
  } catch (e) { console.error(e); res.status(500).json({ success: false, message: 'Erreur generation PDF' }) }
})
// Relevé investisseur avec période (mensuel/trimestriel/annuel)
router.get('/statement/investor', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { period } = req.query
    const now = new Date()
    let from: Date | null = null
    let periodLabel = 'Rapport complet'

    if (period === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      periodLabel = 'Rapport mensuel — ' + now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    } else if (period === 'quarter') {
      from = new Date(now.getTime() - 90*24*60*60*1000)
      periodLabel = 'Rapport trimestriel — ' + from.toLocaleDateString('fr-FR') + ' au ' + now.toLocaleDateString('fr-FR')
    } else if (period === 'year') {
      from = new Date(now.getFullYear(), 0, 1)
      periodLabel = 'Rapport annuel ' + now.getFullYear()
    }

    const [user, wallet, feesConfig] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.userId! } }),
      prisma.wallet.findUnique({ where: { userId: req.userId! } }),
      prisma.platformConfig.findMany()
    ])

    const where: any = { userId: req.userId! }
    if (from) where.createdAt = { gte: from }

    const investments = await prisma.investment.findMany({
      where,
      include: { project: { select: { title: true, sector: true, status: true, expectedReturn: true } } },
      orderBy: { createdAt: 'desc' }
    })

    const feeMap: any = {}
    feesConfig.forEach((f: any) => { feeMap[f.key] = parseFloat(f.value) })

    generateInvestorStatement(res, { investor: user, investments, wallet, period: periodLabel, fees: feeMap })
  } catch (e) { console.error(e); errorResponse(res) }
})

// Rapport entrepreneur avec période
router.get('/report/entrepreneur', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [user, feesConfig] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.userId! } }),
      prisma.platformConfig.findMany()
    ])
    const feeMap: any = {}
    feesConfig.forEach((f: any) => { feeMap[f.key] = parseFloat(f.value) })

    const projects = await prisma.project.findMany({
      where: { entrepreneurId: req.userId! },
      include: {
        investments: { include: { user: { select: { firstName: true, lastName: true } } } },
        milestones: true,
        repaymentSchedules: { include: { payments: { orderBy: { monthNumber: 'asc' } } } }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Générer un rapport pour chaque projet ou le premier
    if (projects.length === 0) { res.status(404).json({ success: false, message: 'Aucun projet' }); return }
    const project = projects[0]
    generateProjectReport(res, { project, entrepreneur: user, investments: project.investments, milestones: project.milestones, fees: feeMap })
  } catch (e) { console.error(e); errorResponse(res) }
})

// Rapport mentor avec période
router.get('/report/mentor', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [user, wallet, feesConfig] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.userId! } }),
      prisma.wallet.findUnique({ where: { userId: req.userId! } }),
      prisma.platformConfig.findMany()
    ])
    const feeMap: any = {}
    feesConfig.forEach((f: any) => { feeMap[f.key] = parseFloat(f.value) })

    const projects = await prisma.project.findMany({
      where: { mentorId: req.userId! },
      orderBy: { createdAt: 'desc' }
    })

    generateMentorReport(res, { mentor: user, projects, wallet, fees: feeMap })
  } catch (e) { console.error(e); errorResponse(res) }
})

// Admin — rapport d'un utilisateur spécifique
router.get('/admin/user/:userId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type } = req.query // investor, entrepreneur, mentor
    const [user, wallet, feesConfig] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.params.userId } }),
      prisma.wallet.findUnique({ where: { userId: req.params.userId } }),
      prisma.platformConfig.findMany()
    ])
    if (!user) { res.status(404).json({ success: false, message: 'Utilisateur introuvable' }); return }

    const feeMap: any = {}
    feesConfig.forEach((f: any) => { feeMap[f.key] = parseFloat(f.value) })

    if (type === 'investor' || user.role === 'INVESTOR') {
      const investments = await prisma.investment.findMany({
        where: { userId: req.params.userId },
        include: { project: { select: { title: true, sector: true, status: true, expectedReturn: true } } },
        orderBy: { createdAt: 'desc' }
      })
      generateInvestorStatement(res, { investor: user, investments, wallet, period: 'Rapport complet — ' + user.firstName + ' ' + user.lastName, fees: feeMap })
    } else if (type === 'entrepreneur' || user.role === 'ENTREPRENEUR') {
      const projects = await prisma.project.findMany({
        where: { entrepreneurId: req.params.userId },
        include: { investments: { include: { user: { select: { firstName: true, lastName: true } } } }, milestones: true },
        orderBy: { createdAt: 'desc' }
      })
      if (projects.length === 0) { res.status(404).json({ success: false, message: 'Aucun projet' }); return }
      generateProjectReport(res, { project: projects[0], entrepreneur: user, investments: projects[0].investments, milestones: projects[0].milestones, fees: feeMap })
    } else if (type === 'mentor' || user.role === 'MENTOR') {
      const projects = await prisma.project.findMany({ where: { mentorId: req.params.userId } })
      generateMentorReport(res, { mentor: user, projects, wallet, fees: feeMap })
    } else {
      res.status(400).json({ success: false, message: 'Type de rapport invalide' })
    }
  } catch (e) { console.error(e); errorResponse(res) }
})

// Rapport bâtisseur PDF
router.get('/builder/report', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [user, contribs, wallet] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.userId },
        include: { builderProfile: true }
      }),
      prisma.fundContribution.findMany({
        where: { userId: req.userId!, status: 'COMPLETED' },
        include: { project: { select: { title: true, sector: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.wallet.findUnique({ where: { userId: req.userId } })
    ])
    const badges = await prisma.fundBadge.findMany({ where: { userId: req.userId! } })
    const totalDonated = contribs.reduce((s, c) => s + (c.amount || 0), 0)
    const impactData = {
      level: totalDonated >= 10000000 ? 'GRAND_MECENE' :
             totalDonated >= 2000000  ? 'OR' :
             totalDonated >= 500000   ? 'ARGENT' : 'BATISSEUR'
    }
    generateBuilderReport(res, { builder: user, contributions: contribs, wallet, badges, impactData })
  } catch (e) { console.error(e); res.status(500).json({ success: false, message: 'Erreur génération PDF' }) }
})

export default router
