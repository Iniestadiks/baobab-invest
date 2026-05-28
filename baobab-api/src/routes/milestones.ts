import { Router, Response } from 'express'
import { z } from 'zod'
import prisma from '../config/database'
import { FEES, calcInvestorReturn } from '../config/fees'
import { authenticate, requireAdmin, requireRole, AuthRequest } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/helpers'

const router = Router()

// Créer des jalons pour un projet (entrepreneur)
router.post('/project/:projectId', authenticate, requireRole(['ENTREPRENEUR']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { milestones } = req.body
    const projectId = req.params.projectId

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { milestones: true }
    })
    if (!project || project.entrepreneurId !== req.userId) {
      res.status(403).json({ success: false, message: 'Non autorisé' })
      return
    }

    // Budget réellement disponible = montant levé - jalons déjà créés (hors rejetés)
    const dejaDepense = project.milestones
      .filter(m => !['REJECTED'].includes(m.status))
      .reduce((sum, m) => sum + m.amount, 0)
    const budgetDisponible = project.raisedAmount - dejaDepense

    if (budgetDisponible <= 0) {
      res.status(400).json({ success: false, message: 'Budget épuisé — tous les fonds levés ont déjà été alloués aux jalons' })
      return
    }

    const schema = z.array(z.object({
      title: z.string().min(3),
      description: z.string().min(10),
      amount: z.number().min(1000),
      dueDate: z.string().optional(),
    }))

    const data = schema.parse(milestones)

    // Vérifier que le total des nouveaux jalons ne dépasse pas le budget disponible
    const total = data.reduce((sum, m) => sum + m.amount, 0)
    if (total > budgetDisponible) {
      res.status(400).json({ success: false, message: `Total jalons (${total.toLocaleString()} FCFA) dépasse le budget disponible (${budgetDisponible.toLocaleString()} FCFA)` })
      return
    }

    const created = await prisma.milestone.createMany({
      data: data.map(m => ({
        projectId,
        title: m.title,
        description: m.description,
        amount: m.amount,
        dueDate: m.dueDate ? new Date(m.dueDate) : null,
      }))
    })

    successResponse(res, { count: created.count }, `${created.count} jalon(s) créé(s)`, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, message: error.errors[0].message })
      return
    }
    errorResponse(res)
  }
})

// Lister les jalons d'un projet
// Budget disponible pour jalons
router.get('/project/:projectId/budget', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: {
        milestones: true,
        investments: { include: { user: { select: { id: true, firstName: true, lastName: true, profileImageUrl: true, city: true, level: true, totalInvested: true } } } }
      }
    })
    if (!project) { res.status(404).json({ success: false, message: 'Projet introuvable' }); return }

    const dejaAlloue = project.milestones
      .filter(m => !['REJECTED'].includes(m.status))
      .reduce((sum, m) => sum + m.amount, 0)
    const dejaApprouve = project.milestones
      .filter(m => ['APPROVED', 'PAID'].includes(m.status))
      .reduce((sum, m) => sum + m.amount, 0)
    const budgetDisponible = project.raisedAmount - dejaAlloue

    // Investisseurs uniques
    const investorsMap = new Map()
    project.investments.forEach(inv => {
      if (!investorsMap.has(inv.userId)) {
        investorsMap.set(inv.userId, {
          ...inv.user,
          totalInvestedInProject: inv.amount,
          investedAt: inv.createdAt,
        })
      } else {
        investorsMap.get(inv.userId).totalInvestedInProject += inv.amount
      }
    })

    successResponse(res, {
      raisedAmount: project.raisedAmount,
      dejaAlloue,
      dejaApprouve,
      budgetDisponible,
      milestones: project.milestones,
      investors: Array.from(investorsMap.values()),
    })
  } catch (e) { console.error(e); errorResponse(res) }
})

router.get('/project/:projectId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const milestones = await prisma.milestone.findMany({
      where: { projectId: req.params.projectId },
      include: {
        payments: {
          include: { supplier: { select: { companyName: true, mobileMoneyProvider: true } } }
        }
      },
      orderBy: { createdAt: 'asc' }
    })
    successResponse(res, milestones)
  } catch {
    errorResponse(res)
  }
})

// Entrepreneur soumet une demande de déblocage
router.post('/:id/request', authenticate, requireRole(['ENTREPRENEUR']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { invoiceUrl, supplierId, description } = req.body
    const milestone = await prisma.milestone.findUnique({
      where: { id: req.params.id },
      include: { project: true }
    })

    if (!milestone) {
      res.status(404).json({ success: false, message: 'Jalon introuvable' })
      return
    }
    if (milestone.project.entrepreneurId !== req.userId) {
      res.status(403).json({ success: false, message: 'Non autorisé' })
      return
    }
    if (milestone.status !== 'PENDING') {
      res.status(400).json({ success: false, message: 'Ce jalon a déjà été soumis ou traité' })
      return
    }

    // Vérifier que le fournisseur existe et est vérifié
    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } })
      if (!supplier || !supplier.isVerified) {
        res.status(400).json({ success: false, message: 'Fournisseur non vérifié — utilise un fournisseur pré-enregistré' })
        return
      }
    }

    const updated = await prisma.milestone.update({
      where: { id: req.params.id },
      data: {
        status: 'SUBMITTED',
        invoiceUrl: invoiceUrl || null,
        description: description || milestone.description,
      }
    })

    // Notifier l'admin
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } })
    await prisma.notification.createMany({
      data: admins.map(a => ({
        userId: a.id,
        title: '📋 Demande de déblocage',
        body: `${milestone.project.title} — Jalon "${milestone.title}" : ${milestone.amount.toLocaleString()} FCFA`,
        type: 'MILESTONE_REQUEST',
        data: { milestoneId: milestone.id, projectId: milestone.projectId }
      }))
    })

    successResponse(res, updated, 'Demande de déblocage soumise — en attente de validation (48h)')
  } catch {
    errorResponse(res)
  }
})

// Admin approuve et déclenche le paiement fournisseur
router.post('/:id/approve', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { supplierId, adminNote } = req.body
    const milestone = await prisma.milestone.findUnique({
      where: { id: req.params.id },
      include: { project: { include: { entrepreneur: true } } }
    })

    if (!milestone || milestone.status !== 'SUBMITTED') {
      res.status(400).json({ success: false, message: 'Jalon non trouvé ou non soumis' })
      return
    }

    // Vérifier le fournisseur
    const supplier = supplierId ? await prisma.supplier.findUnique({ where: { id: supplierId } }) : null
    if (supplierId && (!supplier || !supplier.isVerified)) {
      res.status(400).json({ success: false, message: 'Fournisseur non vérifié' })
      return
    }

    // Transaction atomique avec calcul PayDunya Payout
    const { getFees } = await import('../config/fees')
    const fees = await getFees()
    const payoutRate = fees.withdrawal_fee_standard || 3
    const paydunyaPayout = Math.round(milestone.amount * payoutRate / 100)
    const netSupplier = milestone.amount - paydunyaPayout

    await prisma.$transaction(async (tx) => {
      await tx.milestone.update({
        where: { id: req.params.id },
        data: { status: 'APPROVED', adminNote: adminNote || 'Approuve', paidAt: new Date() }
      })
      if (supplierId) {
        await tx.milestonePayment.create({
          data: { milestoneId: milestone.id, supplierId, amount: netSupplier, status: 'COMPLETED', paidAt: new Date() }
        })
      }
      // BAOBAB absorbe PayDunya Payout : debiter wallet admin
      const adminU = await tx.user.findFirst({ where: { role: 'ADMIN' } })
      if (adminU && paydunyaPayout > 0) {
        await tx.wallet.update({
          where: { userId: adminU.id },
          data: { balance: { decrement: paydunyaPayout }, commissionBalance: { decrement: paydunyaPayout } }
        })
        await tx.platformRevenue.create({
          data: { type: 'PAYDUNYA_FEE', amount: -paydunyaPayout, projectId: milestone.projectId,
            description: 'PayDunya Payout ' + payoutRate + '% jalon ' + milestone.title }
        })
      }
      await tx.notification.create({
        data: {
          userId: milestone.project.entrepreneurId,
          title: 'Jalon approuve !',
          body: 'Le jalon ' + milestone.title + ' a ete approuve.' + (supplierId ? ' Paiement ' + netSupplier.toLocaleString() + ' FCFA envoye au fournisseur.' : ''),
          type: 'MILESTONE_APPROVED',
        }
      })
    })

    // Notifier les investisseurs
    const investments = await prisma.investment.findMany({
      where: { projectId: milestone.projectId },
      select: { userId: true }
    })
    const uniqueInvestors = [...new Set(investments.map(i => i.userId))]
    await prisma.notification.createMany({
      data: uniqueInvestors.map(userId => ({
        userId,
        title: '🚀 Avancement projet',
        body: `${milestone.project.title} : le jalon "${milestone.title}" est validé et payé !`,
        type: 'MILESTONE_UPDATE',
      }))
    })

    successResponse(res, null, 'Jalon approuvé — paiement fournisseur déclenché')
  } catch (e) {
    console.error(e)
    errorResponse(res)
  }
})

// Admin rejette la demande
router.post('/:id/reject', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { adminNote } = req.body
    const milestone = await prisma.milestone.findUnique({
      where: { id: req.params.id },
      include: { project: true }
    })
    if (!milestone) { res.status(404).json({ success: false, message: 'Jalon introuvable' }); return }

    await prisma.milestone.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED', adminNote }
    })

    await prisma.notification.create({
      data: {
        userId: milestone.project.entrepreneurId,
        title: '❌ Jalon rejeté',
        body: `Le jalon "${milestone.title}" a été rejeté : ${adminNote}`,
        type: 'MILESTONE_REJECTED',
      }
    })

    successResponse(res, null, 'Jalon rejeté')
  } catch {
    errorResponse(res)
  }
})

// Système de remboursement investisseurs (fin de projet)
router.post('/project/:projectId/reimburse', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projectId = req.params.projectId
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { investments: { include: { user: { include: { wallet: true } } } } }
    })

    if (!project) { res.status(404).json({ success: false, message: 'Projet introuvable' }); return }

    let totalReimbursed = 0
    const results = []

    for (const inv of project.investments) {
      if (!inv.user.wallet) continue
      const totalReturn = inv.amount + inv.expectedReturn
      const commission = inv.expectedReturn * 0.04

      await prisma.$transaction([
        // Créditer le wallet de l'investisseur
        prisma.wallet.update({
          where: { userId: inv.userId },
          data: {
            balance: { increment: totalReturn - commission },
            escrowBalance: { decrement: inv.amount },
            totalEarned: { increment: inv.expectedReturn - commission },
          }
        }),
        // Mettre à jour l'investissement
        prisma.investment.update({
          where: { id: inv.id },
          data: { status: 'COMPLETED', returnedAmount: totalReturn - commission }
        }),
        // Transaction
        prisma.transaction.create({
          data: {
            userId: inv.userId,
            type: 'RETURN',
            amount: totalReturn - commission,
            status: 'COMPLETED',
            description: `Remboursement projet "${project.title}"`,
          }
        }),
        // Notification
        prisma.notification.create({
          data: {
            userId: inv.userId,
            title: '💰 Remboursement reçu !',
            body: `Tu as reçu ${(totalReturn - commission).toLocaleString()} FCFA du projet "${project.title}"`,
            type: 'REIMBURSEMENT',
          }
        }),
      ])

      totalReimbursed += totalReturn - commission
      results.push({ investor: `${inv.user.firstName} ${inv.user.lastName}`, amount: totalReturn - commission })
    }

    // Clôturer le projet
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'COMPLETED' }
    })

    successResponse(res, { totalReimbursed, investors: results }, `✅ ${project.investments.length} investisseurs remboursés — ${totalReimbursed.toLocaleString()} FCFA distribués`)
  } catch (e) {
    console.error(e)
    errorResponse(res)
  }
})

export default router
