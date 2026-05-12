import { Router, Response } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { getFees } from '../config/fees'
import { successResponse, errorResponse } from '../utils/helpers'

const router = Router()

// Stats investisseur
router.get('/my', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const investments = await prisma.investment.findMany({
      where: { userId: req.userId },
      include: { project: { select: { title: true, sector: true, status: true, expectedReturn: true, id: true } } },
      orderBy: { createdAt: 'desc' }
    })
    const totalInvested = investments.reduce((s, i) => s + i.amount, 0)
    const totalExpectedBrut = investments.reduce((s, i) => s + (i.expectedReturn || 0), 0)
    const fees = await getFees()
    const totalExpected = Math.round(totalExpectedBrut * (1 - (fees.commission_baobab_return||5)/100 - (fees.paydunya_payout||2)/100))
    const totalExpectedBrutRaw = totalExpectedBrut
    const totalReturned = investments.reduce((s, i) => s + (i.returnedAmount || 0), 0)
    const guaranteeContrib = investments.reduce((s, i) => s + (i.guaranteeContribution || i.amount * 0.02), 0)
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId } })
    res.json({
      success: true,
      data: {
        investments,
        totalInvested,
        totalExpected,
        totalReturned: wallet?.totalEarned || totalReturned,
        projectsFunded: investments.filter(i => i.project?.status === 'COMPLETED').length,
        guaranteeContrib,
        escrowBalance: wallet?.escrowBalance || 0,
      }
    })
  } catch (e) { console.error(e); errorResponse(res) }
})

// Investir dans un projet
router.post('/:projectId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount } = req.body
    const { projectId } = req.params

    // Validation montant
    if (!amount || amount < 5000) {
      res.status(400).json({ success: false, message: 'Montant minimum : 5 000 FCFA' }); return
    }

    // Vérification KYC
    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user || user.kycStatus !== 'VERIFIED') {
      res.status(403).json({ success: false, message: 'KYC requis avant d\'investir' }); return
    }

    // Vérification projet
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) { res.status(404).json({ success: false, message: 'Projet introuvable' }); return }
    if (!['ACTIVE', 'FUNDED'].includes(project.status)) {
      res.status(400).json({ success: false, message: 'Ce projet n\'accepte plus d\'investissements' }); return
    }

    // Vérification solde wallet
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId } })
    if (!wallet || wallet.balance < amount) {
      res.status(400).json({ success: false, message: `Solde insuffisant. Disponible : ${wallet?.balance?.toLocaleString() || 0} FCFA` }); return
    }

    // ============================================
    // CALCUL DES COMMISSIONS (taux dynamiques depuis PlatformConfig)
    // ============================================
    const fees = await getFees()
    const platformFee   = Math.round(amount * fees.commission_baobab_collection / 100)
    const mentorFee     = project.mentorId ? Math.round(amount * fees.commission_mentor / 100) : 0
    const guaranteeFee  = Math.round(amount * fees.commission_guarantee / 100)
    const paydunyaPayin = Math.round(amount * fees.paydunya_payin / 100)

    // Taux de retour minimum selon config
    const minRate    = project.mentorId ? fees.return_min_with_mentor : fees.return_min_no_mentor
    const returnRate = Math.max(project.expectedReturn || 0, minRate)
    const expectedReturn = Math.round(amount * (1 + returnRate / 100))

    // Transaction atomique
    await prisma.$transaction(async (tx) => {

      // 1. Débiter wallet investisseur → escrow
      await tx.wallet.update({
        where: { userId: req.userId! },
        data: {
          balance: { decrement: amount },
          escrowBalance: { increment: amount },
          totalInvested: { increment: amount },
        }
      })

      // 2. Créer l'investissement
      await tx.investment.create({
        data: {
          userId: req.userId!,
          projectId,
          amount,
          status: 'PENDING',
          expectedReturn,
          guaranteeContribution: guaranteeFee,
        }
      })

      // 3. Mettre à jour le projet
      const newRaised = project.raisedAmount + amount
      const newStatus = newRaised >= project.goalAmount ? 'FUNDED' : project.status
      await tx.project.update({
        where: { id: projectId },
        data: {
          raisedAmount: { increment: amount },
          investorCount: { increment: 1 },
          status: newStatus,
        }
      })

      // 4. Enregistrer commission BAOBAB 5%
      await tx.platformRevenue.create({
        data: {
          type: 'COMMISSION_COLLECTION',
          amount: platformFee,
          projectId,
          description: `Commission clôture 5% — ${project.title}`,
        }
      })

      // 4b. Enregistrer coût PayDunya Payin (absorbé par BAOBAB)
      await tx.platformRevenue.create({
        data: {
          type: 'PAYDUNYA_FEE',
          amount: -paydunyaPayin, // négatif = coût pour BAOBAB
          projectId,
          description: `PayDunya Payin 3% absorbé — ${project.title}`,
        }
      })

      // 5. Créditer mentor 2% si applicable
      if (project.mentorId && mentorFee > 0) {
        await tx.wallet.update({
          where: { userId: project.mentorId },
          data: { balance: { increment: mentorFee } }
        })
        await tx.platformRevenue.create({
          data: {
            type: 'MENTOR_COMMISSION',
            amount: mentorFee,
            projectId,
            description: `Commission mentor 2% — ${project.title}`,
          }
        })
      }

      // 6. Notification entrepreneur
      await tx.notification.create({
        data: {
          userId: project.entrepreneurId,
          title: '💰 Nouvel investissement !',
          body: `${user.firstName} a investi ${amount.toLocaleString()} FCFA dans "${project.title}"`,
          type: 'INVESTMENT',
          data: { projectId, amount }
        }
      })
    })

    successResponse(res, {
      expectedReturn,
      returnRate,
      fees: { platform: platformFee, mentor: mentorFee, guarantee: guaranteeFee }
    }, `Investissement de ${amount.toLocaleString()} FCFA effectué !`)

  } catch (e) { console.error(e); errorResponse(res) }
})

// Remboursement investisseur (déclenché par admin)
router.post('/:investmentId/reimburse', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const investment = await prisma.investment.findUnique({
      where: { id: req.params.investmentId },
      include: { project: true }
    })
    if (!investment) { res.status(404).json({ success: false, message: 'Investissement introuvable' }); return }

    const returnAmount = investment.expectedReturn || investment.amount
    // Commission BAOBAB sur retours 5%
    const baobabOnReturn = Math.round(returnAmount * 0.05)
    // PayDunya Payout 2% absorbé par BAOBAB
    const paydunyaPayout = Math.round(returnAmount * 0.02)
    const netReturn = returnAmount - baobabOnReturn - paydunyaPayout

    await prisma.$transaction(async (tx) => {
      // Créditer investisseur
      await tx.wallet.update({
        where: { userId: investment.userId },
        data: {
          balance: { increment: netReturn },
          escrowBalance: { decrement: investment.amount },
          totalEarned: { increment: netReturn - investment.amount }
        }
      })

      // Mettre à jour investissement
      await tx.investment.update({
        where: { id: investment.id },
        data: { status: 'COMPLETED', returnedAmount: netReturn }
      })

      // Commission BAOBAB sur retours
      await tx.platformRevenue.create({
        data: {
          type: 'COMMISSION_RETURN',
          amount: baobabOnReturn,
          projectId: investment.projectId,
          description: `Commission retours 5% — ${investment.project.title}`,
        }
      })

      // Coût PayDunya Payout absorbé
      await tx.platformRevenue.create({
        data: {
          type: 'PAYDUNYA_FEE',
          amount: -paydunyaPayout,
          projectId: investment.projectId,
          description: `PayDunya Payout 2% absorbé — ${investment.project.title}`,
        }
      })

      // Notification investisseur
      await tx.notification.create({
        data: {
          userId: investment.userId,
          title: '🎉 Remboursement reçu !',
          body: `Vous avez reçu ${netReturn.toLocaleString()} FCFA pour votre investissement dans "${investment.project.title}"`,
          type: 'REIMBURSEMENT',
          data: { projectId: investment.projectId, amount: netReturn }
        }
      })
    })

    successResponse(res, { netReturn, baobabOnReturn, paydunyaPayout }, 'Remboursement effectué')
  } catch (e) { console.error(e); errorResponse(res) }
})

// Plans d'épargne programmée
router.get('/savings-plans', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId } })
    successResponse(res, {
      scheduledAmount: wallet?.scheduledAmount || 0,
      scheduledDay: wallet?.scheduledDay || null,
      isActive: (wallet?.scheduledAmount || 0) > 0,
    })
  } catch (e) { errorResponse(res) }
})

router.post('/savings-plan', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount, day } = req.body
    if (!amount || amount < 1000) { res.status(400).json({ success: false, message: 'Montant minimum 1000 FCFA' }); return }
    if (!day || day < 1 || day > 28) { res.status(400).json({ success: false, message: 'Jour invalide (1-28)' }); return }
    const wallet = await prisma.wallet.update({
      where: { userId: req.userId! },
      data: { scheduledAmount: amount, scheduledDay: day }
    })
    successResponse(res, { scheduledAmount: wallet.scheduledAmount, scheduledDay: wallet.scheduledDay }, 'Plan epargne active')
  } catch (e) { errorResponse(res) }
})

router.patch('/savings-plan/:id/toggle', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId } })
    const newAmount = wallet?.scheduledAmount ? 0 : (wallet?.scheduledAmount || 0)
    await prisma.wallet.update({
      where: { userId: req.userId! },
      data: { scheduledAmount: newAmount }
    })
    successResponse(res, {}, newAmount > 0 ? 'Plan activé' : 'Plan suspendu')
  } catch (e) { errorResponse(res) }
})

export default router
