import { Router, Response } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth'
import {
  generateInvestmentCertificate,
  generateInvestorStatement,
  generateProjectReport,
  generateAdminReport,
  generateMentorReport
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

    generateProjectReport(res, {
      entrepreneur: project.entrepreneur,
      project,
      milestones: project.milestones,
      investors: project.investments.map(i => i.user)
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
    const totalNetInvestors = Math.round(totalGrossReturn * (1 - (feeMap.commission_baobab_return||5)/100 - (feeMap.paydunya_payout||3)/100))
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
export default router
