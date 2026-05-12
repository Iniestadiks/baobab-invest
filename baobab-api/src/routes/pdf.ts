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
    const { from, to } = req.query
    const where: any = {}
    if (from) where.createdAt = { ...where.createdAt, gte: new Date(String(from)) }
    if (to) where.createdAt = { ...where.createdAt, lte: new Date(String(to)) }

    const [revenues, investments, users, projects] = await Promise.all([
      prisma.platformRevenue.findMany({ where, orderBy: { createdAt: 'desc' } }),
      prisma.investment.findMany({ select: { amount: true, createdAt: true } }),
      prisma.user.findMany({ select: { role: true, kycStatus: true, createdAt: true } }),
      prisma.project.findMany({ select: { status: true, raisedAmount: true, sector: true } })
    ])

    const period = from && to
      ? `Du ${new Date(String(from)).toLocaleDateString('fr-FR')} au ${new Date(String(to)).toLocaleDateString('fr-FR')}`
      : `Rapport complet — ${new Date().toLocaleDateString('fr-FR')}`

    generateAdminReport(res, { revenues, investments, users, projects, period })
  } catch (e) { console.error(e); res.status(500).json({ success: false, message: 'Erreur génération PDF' }) }
})

export default router
