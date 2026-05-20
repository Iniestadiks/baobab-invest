import { Router, Request, Response } from 'express'
import { z } from 'zod'
import prisma from '../config/database'
import { authenticate, requireRole, requireAdmin, AuthRequest } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/helpers'
import { getFees } from '../config/fees'

const router = Router()

const projectSchema = z.object({
  title: z.string().min(5, 'Titre trop court'),
  description: z.string().min(50, 'Description trop courte (min 50 caractères)'),
  sector: z.enum(['AGRICULTURE','COMMERCE','TECH','ARTISANAT','EDUCATION','SANTE','SERVICES','ENERGIE','TRANSPORT','AUTRE']),
  subSector: z.string().optional(),
  city: z.string(),
  country: z.string().default('SN'),
  goalAmount: z.number().min(100000, 'Montant minimum 100 000 FCFA'),
  minimumInvestment: z.number().min(5000).default(5000),
  expectedReturn: z.number().min(15, 'Taux de retour minimum : 15%').max(100),
  durationMonths: z.number().min(1).max(60),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  mentorId: z.string().optional(),
  pitchVideoUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  campaignEndsAt: z.string().optional(),
})

// Calculer le score de bankabilité
function calculateBankabilityScore(data: any): number {
  let score = 0
  if (data.description.length > 200) score += 15
  if (data.pitchVideoUrl) score += 20
  if (data.coverImageUrl) score += 10
  if (data.mentorId) score += 25
  if (data.goalAmount <= 2000000) score += 10
  if (data.expectedReturn <= 30) score += 10
  if (data.durationMonths >= 6) score += 10
  return Math.min(score, 100)
}

// Catalogue public — avec filtres
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sector, country, city, riskLevel, minAmount, maxAmount,
            status, sortBy, page = '1', limit = '12' } = req.query

    const skip = (Number(page) - 1) * Number(limit)

    const where: any = {
      status: status ? String(status) : { in: ['ACTIVE', 'FUNDED', 'IN_PROGRESS', 'COMPLETED'] },
      ...(sector ? { sector: String(sector) } : {}),
      ...(country ? { country: String(country) } : {}),
      ...(city ? { city: { contains: String(city), mode: 'insensitive' } } : {}),
      ...(riskLevel ? { riskLevel: String(riskLevel) } : {}),
      ...(minAmount ? { goalAmount: { gte: Number(minAmount) } } : {}),
      ...(maxAmount ? { goalAmount: { lte: Number(maxAmount) } } : {}),
    }

    const orderBy: any =
      sortBy === 'popular' ? { investorCount: 'desc' }
      : sortBy === 'ending' ? { campaignEndsAt: 'asc' }
      : sortBy === 'newest' ? { createdAt: 'desc' }
      : { createdAt: 'desc' }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where, orderBy, skip, take: Number(limit),
        select: {
          id: true, title: true, description: true, sector: true, subSector: true,
          city: true, country: true, goalAmount: true, raisedAmount: true,
          minimumInvestment: true, expectedReturn: true, durationMonths: true,
          status: true, riskLevel: true, coverImageUrl: true, pitchVideoUrl: true,
          investorCount: true, campaignEndsAt: true, bankabilityScore: true,
          createdAt: true,
          entrepreneur: { select: { firstName: true, lastName: true, city: true, reputationScore: true } },
          mentor: { select: { firstName: true, lastName: true, reputationScore: true } },
          _count: { select: { investments: true, posts: true } }
        }
      }),
      prisma.project.count({ where })
    ])

    // Calculer le pourcentage de financement
    const enriched = projects.map(p => ({
      ...p,
      fundingPercent: Math.round((p.raisedAmount / p.goalAmount) * 100),
      daysLeft: p.campaignEndsAt
        ? Math.max(0, Math.ceil((new Date(p.campaignEndsAt).getTime() - Date.now()) / 86400000))
        : null,
    }))

    successResponse(res, {
      projects: enriched,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) }
    })
  } catch (e) {
    console.error(e)
    errorResponse(res)
  }
})

// Détail d'un projet
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        entrepreneur: { select: { id: true, firstName: true, lastName: true, profileImageUrl: true, city: true, reputationScore: true, createdAt: true } },
        mentor: { select: { id: true, firstName: true, lastName: true, profileImageUrl: true, reputationScore: true } },
        milestones: { orderBy: { createdAt: 'asc' } },
        _count: { select: { investments: true, posts: true } }
      }
    })
    if (!project) {
      res.status(404).json({ success: false, message: 'Projet introuvable' })
      return
    }
    await prisma.project.update({ where: { id: req.params.id }, data: { viewCount: { increment: 1 } } })
    successResponse(res, {
      ...project,
      fundingPercent: Math.round((project.raisedAmount / project.goalAmount) * 100),
      daysLeft: project.campaignEndsAt
        ? Math.max(0, Math.ceil((new Date(project.campaignEndsAt).getTime() - Date.now()) / 86400000))
        : null,
    })
  } catch {
    errorResponse(res)
  }
})

// Simulation de rendement
router.post('/:id/simulate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount } = req.body
    const project = await prisma.project.findUnique({ where: { id: req.params.id } })
    if (!project) { res.status(404).json({ success: false, message: 'Projet introuvable' }); return }
    if (amount < project.minimumInvestment) {
      res.status(400).json({ success: false, message: `Minimum ${project.minimumInvestment} FCFA` })
      return
    }
    const sharePercent = amount / project.goalAmount
    const hasMentor = !!project.mentorId
    const returnRate = project.expectedReturn || (hasMentor ? 15 : 17)
    // expectedReturn = capital + intérêts (ex: 100 000 FCFA à 17% = 117 000 FCFA)
    const expectedReturn = Math.round(amount * (1 + returnRate / 100))
    // Commissions à la clôture
    const platformFee   = Math.round(amount * 0.05)  // BAOBAB 5%
    const mentorFee     = hasMentor ? Math.round(amount * 0.02) : 0  // Mentor 2%
    const guaranteeFee  = Math.round(amount * 0.02)  // Garantie 2%
    const paydunyaPayin = Math.round(amount * 0.03)  // PayDunya Payin 3% (absorbé BAOBAB)
    // Commissions sur retours
    const baobabOnReturn   = Math.round(expectedReturn * 0.05)  // BAOBAB 5% sur retours
    const paydunyaPayout   = Math.round(expectedReturn * 0.02)  // PayDunya Payout 2% (absorbé BAOBAB)
    const netReceived      = expectedReturn - baobabOnReturn - paydunyaPayout
    const bonusSansMentor  = hasMentor ? 0 : Math.round(amount * 0.02)  // +2% investisseur si pas de mentor

    successResponse(res, {
      invested: amount,
      sharePercent: (sharePercent * 100).toFixed(4),
      returnRate: returnRate + '%',
      hasMentor,
      // À l'investissement
      platformFee,
      mentorFee,
      guaranteeFee,
      paydunyaPayin,
      // Au remboursement
      expectedReturn,
      baobabOnReturn,
      paydunyaPayout,
      bonusSansMentor,
      netReceived,
      // Résumé
      totalCostForBAOBAB: platformFee + paydunyaPayin + baobabOnReturn + paydunyaPayout,
      monthlyReturn: project.durationMonths ? Math.round((netReceived - amount) / project.durationMonths) : 0,
    })
  } catch {
    errorResponse(res)
  }
})

// Soumettre un projet (entrepreneur)
router.post('/', authenticate, requireRole(['ENTREPRENEUR']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entrepreneur = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!entrepreneur || entrepreneur.kycStatus !== 'VERIFIED') {
      res.status(403).json({ success: false, message: "Votre KYC doit etre verifie par un administrateur avant de soumettre un projet." })
      return
    }

    // Calculer goalAmount automatiquement
    const feesCalc = await getFees()
    const hasMentorCalc = !!req.body.mentorId
    const hasInsuranceCalc = req.body.withInsurance !== false
    const diviseurCalc = 1 - (feesCalc.commission_baobab_collection/100)
      - (hasMentorCalc ? feesCalc.commission_mentor/100 : 0)
      - (hasInsuranceCalc ? feesCalc.commission_guarantee/100 : 0)
    const netAmountCalc = req.body.goalAmount
    const computedGoalCalc = Math.ceil(netAmountCalc / diviseurCalc)
    const graceCalc = ['AGRICULTURE','ELEVAGE'].includes(req.body.sector)
      ? feesCalc.grace_period_agriculture
      : feesCalc.grace_period_other

    // Vérifier slots sous-secteur
    if (req.body.subSector && req.body.city) {
      const { MAX_ACTIVE_PER_SUBSECTOR } = await import('../config/taxonomy')
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const activeProjects = await prisma.project.findMany({
        where: {
          sector: req.body.sector,
          subSector: req.body.subSector,
          city: { contains: req.body.city, mode: 'insensitive' },
          status: { in: ['ACTIVE', 'FUNDED', 'IN_PROGRESS'] }
        },
        select: { id: true, title: true, raisedAmount: true, goalAmount: true, createdAt: true, status: true }
      })
      const validActive = activeProjects.filter(p => {
        const isStale = p.status === 'ACTIVE' && p.createdAt < thirtyDaysAgo && p.raisedAmount < p.goalAmount * 0.2
        return !isStale
      })
      if (validActive.length >= MAX_ACTIVE_PER_SUBSECTOR) {
        const waitlistCount = await prisma.project.count({
          where: { sector: req.body.sector, subSector: req.body.subSector, city: { contains: req.body.city, mode: 'insensitive' }, status: 'WAITLISTED' }
        })
        const data = projectSchema.parse(req.body)
        const score = calculateBankabilityScore({ ...data, description: data.description })
        const waitlistedProject = await prisma.project.create({
          data: { ...data, goalAmount: computedGoalCalc, netAmount: netAmountCalc, gracePeriodMonths: graceCalc, entrepreneurId: req.userId!, campaignEndsAt: data.campaignEndsAt ? new Date(data.campaignEndsAt) : null, bankabilityScore: score, status: 'WAITLISTED' }
        })
        await prisma.notification.create({
          data: { userId: req.userId!, title: 'Projet en liste d attente', body: `Votre projet "${waitlistedProject.title}" est en position ${waitlistCount + 1} dans la liste d attente.`, type: 'PROJECT_WAITLISTED', data: JSON.stringify({ projectId: waitlistedProject.id, position: waitlistCount + 1 }) }
        })
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } })
        await prisma.notification.createMany({
          data: admins.map(a => ({ userId: a.id, title: 'Nouveau projet en liste d attente', body: `"${waitlistedProject.title}" — position ${waitlistCount + 1}`, type: 'PROJECT_WAITLISTED', data: JSON.stringify({ projectId: waitlistedProject.id }) }))
        })
        res.status(202).json({
          success: true,
          message: `Slots complets. Votre projet est en position ${waitlistCount + 1} dans la liste d attente.`,
          data: { project: waitlistedProject, position: waitlistCount + 1 }
        })
        return
      }
    }

    const data = projectSchema.parse(req.body)
    const score = calculateBankabilityScore({ ...data, description: data.description })
    const project = await prisma.project.create({
      data: {
        ...data,
        goalAmount: computedGoalCalc,
        netAmount: netAmountCalc,
        gracePeriodMonths: graceCalc,
        entrepreneurId: req.userId!,
        campaignEndsAt: data.campaignEndsAt ? new Date(data.campaignEndsAt) : null,
        bankabilityScore: score,
        status: 'PENDING_REVIEW',
      }
    })

    // Notifier les admins
    const adminsNotif = await prisma.user.findMany({ where: { role: 'ADMIN' } })
    await prisma.notification.createMany({
      data: adminsNotif.map(a => ({ userId: a.id, title: '🆕 Nouveau projet à valider', body: `"${project.title}" — ${data.sector} — ${data.city} — GoalAmount: ${computedGoalCalc.toLocaleString()} FCFA`, type: 'NEW_PROJECT', data: JSON.stringify({ projectId: project.id }) }))
    })

    console.log(`Nouveau projet soumis : ${project.title} — Score bankabilité : ${score} — GoalAmount: ${computedGoalCalc}`)
    successResponse(res, { ...project, bankabilityScore: score, goalAmount: computedGoalCalc, netAmount: netAmountCalc, gracePeriodMonths: graceCalc }, 'Projet soumis — en attente de validation', 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, message: error.errors[0].message })
      return
    }
    console.error(error)
    errorResponse(res)
  }
})

// Mes projets (entrepreneur)
router.get('/my/projects', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projects = await prisma.project.findMany({
      where: { entrepreneurId: req.userId },
      include: {
        milestones: true,
        _count: { select: { investments: true, posts: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    successResponse(res, projects)
  } catch {
    errorResponse(res)
  }
})

// Admin — valider un projet
router.patch('/:id/approve', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { adminNote } = req.body
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE', adminNote }
    })
    await prisma.notification.create({
      data: {
        userId: project.entrepreneurId,
        title: '✅ Projet approuvé !',
        body: `Félicitations ! Votre projet "${project.title}" est maintenant en ligne. Les investisseurs peuvent y investir.`,
        type: 'PROJECT_APPROVED',
        data: JSON.stringify({ projectId: project.id })
      }
    })
    successResponse(res, project, 'Projet approuvé et publié')
  } catch (e) { console.error(e); errorResponse(res) }
})
// Admin — rejeter un projet
router.patch('/:id/reject', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { adminNote } = req.body
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED', adminNote }
    })
    await prisma.notification.create({
      data: {
        userId: project.entrepreneurId,
        title: '❌ Projet non validé',
        body: `Votre projet "${project.title}" n'a pas été validé. Motif : ${adminNote || 'Non précisé'}. Corrigez et soumettez à nouveau.`,
        type: 'PROJECT_REJECTED',
        data: JSON.stringify({ projectId: project.id })
      }
    })
    successResponse(res, project, 'Projet rejeté')
  } catch (e) { console.error(e); errorResponse(res) }
})
// Entrepreneur — demander clôture anticipée
router.post('/:id/request-early-close', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { note } = req.body
    const project = await prisma.project.findUnique({ where: { id: req.params.id } })
    if (!project || project.entrepreneurId !== req.userId) {
      res.status(403).json({ success: false, message: 'Non autorisé' }); return
    }
    if (!['ACTIVE'].includes(project.status)) {
      res.status(400).json({ success: false, message: 'Projet non éligible à la clôture anticipée' }); return
    }
    await prisma.project.update({
      where: { id: req.params.id },
      data: { earlyCloseRequested: true, earlyCloseNote: note || '' }
    })
    // Notifier les admins
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } })
    await prisma.notification.createMany({
      data: admins.map(a => ({
        userId: a.id,
        title: 'Demande de cloture anticipee',
        body: `L entrepreneur demande la cloture anticipee du projet "${project.title}" avec ${project.raisedAmount?.toLocaleString()} FCFA recoltes. Motif: ${note || 'Non precise'}`,
        type: 'EARLY_CLOSE_REQUEST',
        data: JSON.stringify({ projectId: project.id })
      }))
    })
    successResponse(res, {}, "Demande de cloture anticipee envoyee")
  } catch (e) { console.error(e); errorResponse(res) }
})

// Entrepreneur — demander prolongation
router.post('/:id/request-extension', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { days, note } = req.body
    if (!days || days < 7 || days > 90) {
      res.status(400).json({ success: false, message: 'Prolongation entre 7 et 90 jours' }); return
    }
    const project = await prisma.project.findUnique({ where: { id: req.params.id } })
    if (!project || project.entrepreneurId !== req.userId) {
      res.status(403).json({ success: false, message: 'Non autorisé' }); return
    }
    if (!['ACTIVE'].includes(project.status)) {
      res.status(400).json({ success: false, message: 'Projet non éligible à la prolongation' }); return
    }
    await prisma.project.update({
      where: { id: req.params.id },
      data: { extensionRequested: true, extensionDays: days, extensionNote: note || '' }
    })
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } })
    await prisma.notification.createMany({
      data: admins.map(a => ({
        userId: a.id,
        title: 'Demande de prolongation campagne',
        body: `L entrepreneur demande une prolongation de ${days} jours pour "${project.title}". Motif: ${note || 'Non precise'}`,
        type: 'EXTENSION_REQUEST',
        data: JSON.stringify({ projectId: project.id })
      }))
    })
    successResponse(res, {}, `Demande de prolongation de ${days} jours envoyée`)
  } catch (e) { console.error(e); errorResponse(res) }
})

// Admin — valider clôture anticipée
router.post('/:id/approve-early-close', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: { investments: { include: { user: { select: { id: true, firstName: true } } } } }
    })
    if (!project) { res.status(404).json({ success: false, message: 'Projet introuvable' }); return }

    const fees = await prisma.platformConfig.findMany()
    const feeMap: any = {}
    fees.forEach((f: any) => { feeMap[f.key] = parseFloat(f.value) })

    // Clôturer le projet avec le montant récolté
    await prisma.project.update({
      where: { id: req.params.id },
      data: { status: 'FUNDED', earlyCloseRequested: false, goalAmount: project.raisedAmount || 0 }
    })

    // Notifier l'entrepreneur
    await prisma.notification.create({
      data: {
        userId: project.entrepreneurId,
        title: 'Cloture anticipee approuvee',
        body: `Votre demande de cloture anticipee pour "${project.title}" a ete approuvee. Le projet est finance avec ${project.raisedAmount?.toLocaleString()} FCFA.`,
        type: 'EARLY_CLOSE_APPROVED',
        data: JSON.stringify({ projectId: project.id })
      }
    })

    // Notifier les investisseurs
    const uniqueInvestors = [...new Set(project.investments.map((i: any) => i.userId))]
    await prisma.notification.createMany({
      data: uniqueInvestors.map((userId: any) => ({
        userId,
        title: 'Projet finance par cloture anticipee',
        body: `Le projet "${project.title}" a ete clos par l entrepreneur avec ${project.raisedAmount?.toLocaleString()} FCFA recoltes. Les remboursements seront calcules sur cette base.`,
        type: 'EARLY_CLOSE_INVESTOR',
        data: JSON.stringify({ projectId: project.id })
      }))
    })

    successResponse(res, {}, 'Clôture anticipée approuvée — projet financé')
  } catch (e) { console.error(e); errorResponse(res) }
})

// Admin — valider prolongation
router.post('/:id/approve-extension', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } })
    if (!project) { res.status(404).json({ success: false, message: 'Projet introuvable' }); return }
    const newEndDate = new Date((project.campaignEndsAt || new Date()).getTime() + (project.extensionDays || 30) * 24 * 60 * 60 * 1000)
    await prisma.project.update({
      where: { id: req.params.id },
      data: { campaignEndsAt: newEndDate, extensionRequested: false, extensionDays: null }
    })
    await prisma.notification.create({
      data: {
        userId: project.entrepreneurId,
        title: 'Prolongation approuvee',
        body: `Votre campagne "${project.title}" est prolongee jusqu au ${newEndDate.toLocaleDateString('fr-FR')}.`,
        type: 'EXTENSION_APPROVED',
        data: JSON.stringify({ projectId: project.id, newEndDate })
      }
    })
    successResponse(res, { newEndDate }, 'Prolongation approuvée')
  } catch (e) { console.error(e); errorResponse(res) }
})

export default router

// Debug route — à supprimer en production
router.get('/debug/pending', async (req, res) => {
  const projects = await prisma.project.findMany({ where: { status: 'PENDING_REVIEW' }, orderBy: { createdAt: 'asc' } })
  res.json({ count: projects.length, ids: projects.map(p => ({ id: p.id, title: p.title })) })
})

// Investisseurs d'un projet (visible par l'entrepreneur propriétaire)
router.get('/:id/investors', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } })
    if (!project) { res.status(404).json({ success: false, message: 'Projet introuvable' }); return }

    // Seul l'entrepreneur du projet ou l'admin peut voir les investisseurs
    if (project.entrepreneurId !== req.userId && req.userRole !== 'ADMIN') {
      res.status(403).json({ success: false, message: 'Accès refusé' })
      return
    }

    const investments = await prisma.investment.findMany({
      where: { projectId: req.params.id },
      include: {
        user: {
          select: {
            id: true, firstName: true, lastName: true,
            city: true, country: true, level: true,
            profileImageUrl: true, createdAt: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const stats = {
      totalInvestors: investments.length,
      totalRaised: investments.reduce((s, i) => s + i.amount, 0),
      averageInvestment: investments.length > 0
        ? Math.round(investments.reduce((s, i) => s + i.amount, 0) / investments.length)
        : 0,
      fundingPercent: Math.round((project.raisedAmount / project.goalAmount) * 100),
    }

    successResponse(res, { investments, stats })
  } catch (e) {
    console.error(e)
    errorResponse(res)
  }
})

// Stats graphiques pour l'entrepreneur
router.get('/stats/entrepreneur', authenticate, requireRole(['ENTREPRENEUR']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projects = await prisma.project.findMany({
      where: { entrepreneurId: req.userId },
      include: {
        investments: { orderBy: { createdAt: 'asc' } },
        milestones: true,
      }
    })

    // Collecte dans le temps pour chaque projet
    const collecteData: any[] = []
    projects.forEach(p => {
      let cumul = 0
      p.investments.forEach(inv => {
        cumul += inv.amount
        collecteData.push({
          date: new Date(inv.createdAt).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
          montant: cumul,
          projet: p.title.substring(0, 20),
          objectif: p.goalAmount,
          pourcentage: Math.round((cumul / p.goalAmount) * 100)
        })
      })
    })

    // Répartition jalons
    const milestoneStats = {
      PENDING: 0, SUBMITTED: 0, APPROVED: 0, REJECTED: 0, PAID: 0
    }
    projects.forEach(p => {
      p.milestones.forEach(m => {
        milestoneStats[m.status as keyof typeof milestoneStats]++
      })
    })

    // Investisseurs par projet
    const investorData = projects.map(p => ({
      name: p.title.substring(0, 20),
      investisseurs: p.investorCount,
      collecte: p.raisedAmount,
      objectif: p.goalAmount,
      pourcentage: Math.round((p.raisedAmount / p.goalAmount) * 100)
    }))

    successResponse(res, { collecteData, milestoneStats, investorData, totalProjects: projects.length })
  } catch (e) {
    console.error(e)
    errorResponse(res)
  }
})

// Mentor — accepter de parrainer un projet
router.post('/:id/mentor/accept', authenticate, requireRole(['MENTOR']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } })
    if (!project) { res.status(404).json({ success: false, message: 'Projet introuvable' }); return }
    if (project.mentorId !== req.userId) {
      res.status(403).json({ success: false, message: 'Ce projet ne t\'a pas désigné comme mentor' }); return
    }

    // Vérifier limite 5 projets simultanés
    const activeAsMentor = await prisma.project.count({
      where: { mentorId: req.userId, status: { in: ['ACTIVE', 'PENDING_REVIEW', 'FUNDED', 'IN_PROGRESS'] } }
    })
    if (activeAsMentor >= 5) {
      res.status(400).json({ success: false, message: 'Tu parraines déjà 5 projets simultanés — maximum atteint selon les règles BAOBAB INVEST' })
      return
    }

    // Notifier l'entrepreneur
    await prisma.notification.create({
      data: {
        userId: project.entrepreneurId,
        title: '🎓 Mentor confirmé !',
        body: `Ton mentor a accepté de parrainer ton projet "${project.title}". Ton score de bankabilité augmente de +25 pts !`,
        type: 'MENTOR_ACCEPTED',
        data: { projectId: project.id }
      }
    })

    successResponse(res, null, 'Parrainage accepté — tu es maintenant le garant de ce projet')
  } catch (e) {
    console.error(e)
    errorResponse(res)
  }
})

// Mentor — refuser de parrainer
router.post('/:id/mentor/decline', authenticate, requireRole(['MENTOR']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } })
    if (!project || project.mentorId !== req.userId) {
      res.status(403).json({ success: false, message: 'Non autorisé' }); return
    }

    const { reason } = req.body

    // Retirer le mentor du projet
    await prisma.project.update({
      where: { id: req.params.id },
      data: { mentorId: null }
    })

    // Notifier l'entrepreneur
    await prisma.notification.create({
      data: {
        userId: project.entrepreneurId,
        title: '❌ Mentor a décliné',
        body: `Ton mentor a décliné le parrainage de "${project.title}"${reason ? ` : ${reason}` : ''}. Tu peux choisir un autre mentor.`,
        type: 'MENTOR_DECLINED',
        data: { projectId: project.id }
      }
    })

    successResponse(res, null, 'Parrainage refusé')
  } catch {
    errorResponse(res)
  }
})

// Mes projets en tant que mentor
router.get('/mentor/my-projects', authenticate, requireRole(['MENTOR']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projects = await prisma.project.findMany({
      where: { mentorId: req.userId },
      include: {
        entrepreneur: { select: { firstName: true, lastName: true, city: true, reputationScore: true } },
        investments: { select: { amount: true, expectedReturn: true } },
        milestones: { select: { status: true, amount: true } },
        _count: { select: { investments: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calculer la commission mentor (1% des retours)
    const enriched = projects.map(p => {
      const totalReturns = p.investments.reduce((s, i) => s + i.expectedReturn, 0)
      const mentorCommission = totalReturns * 0.01
      return { ...p, mentorCommission, totalReturns }
    })

    successResponse(res, enriched)
  } catch {
    errorResponse(res)
  }
})

// Admin — changer statut projet (promotion waitlist, annulation)
router.patch('/:id/status', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body
    const allowed = ['PENDING_REVIEW', 'ACTIVE', 'CANCELLED', 'WAITLISTED']
    if (!allowed.includes(status)) {
      res.status(400).json({ success: false, message: 'Statut invalide' }); return
    }
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: { status },
      select: { id: true, title: true, entrepreneurId: true, status: true }
    })
    // Notifier l'entrepreneur
    const messages: Record<string, string> = {
      'PENDING_REVIEW': 'Votre projet a ete promu et est en attente de validation.',
      'CANCELLED': 'Votre projet a ete retire de la liste d attente.',
    }
    if (messages[status]) {
      await prisma.notification.create({
        data: { userId: project.entrepreneurId, title: 'Mise a jour de votre projet', body: messages[status], type: 'PROJECT_STATUS_UPDATED', data: JSON.stringify({ projectId: project.id }) }
      })
    }
    successResponse(res, project, 'Statut mis a jour')
  } catch (e) { errorResponse(res) }
})
