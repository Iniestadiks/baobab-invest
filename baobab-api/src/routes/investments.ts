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

// Admin — remboursement global projet (tous investisseurs)
router.post('/reimburse-project/:projectId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: {
        investments: { include: { user: { select: { id: true, firstName: true } } } },
        entrepreneur: { select: { id: true, firstName: true, lastName: true } },
        mentor: { select: { id: true, firstName: true } }
      }
    })
    if (!project) { res.status(404).json({ success: false, message: 'Projet introuvable' }); return }
    if (project.status !== 'FUNDED') { res.status(400).json({ success: false, message: 'Projet non eligible' }); return }

    const fees = await getFees()
    const baobabRate = fees.commission_baobab_return || 5
    const paydunyaRate = fees.paydunya_payout || 3

    await prisma.$transaction(async (tx) => {
      let totalNetDistributed = 0

      for (const inv of project.investments) {
        const grossReturn = inv.expectedReturn || 0
        const baobabOnReturn = Math.round(grossReturn * baobabRate / 100)
        const paydunyaOnReturn = Math.round(grossReturn * paydunyaRate / 100)
        const netReturn = grossReturn - baobabOnReturn - paydunyaOnReturn

        // Créditer investisseur
        await tx.wallet.update({
          where: { userId: inv.userId },
          data: { balance: { increment: netReturn }, totalEarned: { increment: netReturn - inv.amount }, escrowBalance: { decrement: inv.amount } }
        })

        // Commission BAOBAB sur retours
        await tx.platformRevenue.create({
          data: { type: 'COMMISSION_RETURN', amount: baobabOnReturn, projectId: project.id, description: `Commission retour 5% — ${project.title}` }
        })
        await tx.platformRevenue.create({
          data: { type: 'PAYDUNYA_FEE', amount: -paydunyaOnReturn, projectId: project.id, description: `PayDunya Payout absorbe — ${project.title}` }
        })

        // Notifier investisseur
        await tx.notification.create({
          data: {
            userId: inv.userId,
            title: 'Remboursement recu',
            body: `Vous avez recu ${netReturn.toLocaleString()} FCFA pour votre investissement dans "${project.title}". Gain net: +${(netReturn - inv.amount).toLocaleString()} FCFA.`,
            type: 'REPAYMENT_RECEIVED',
            data: JSON.stringify({ projectId: project.id, amount: netReturn, gain: netReturn - inv.amount })
          }
        })

        totalNetDistributed += netReturn
      }

      // Mettre à jour poche admin
      const adminUser = await tx.user.findFirst({ where: { role: 'ADMIN' } })
      if (adminUser) {
        const totalReturn = project.investments.reduce((s, i) => s + (i.expectedReturn || 0), 0)
        const baobabOnAllReturns = Math.round(totalReturn * baobabRate / 100)
        const paydunyaOnAllReturns = Math.round(totalReturn * paydunyaRate / 100)
        await tx.wallet.update({
          where: { userId: adminUser.id },
          data: {
            commissionBalance: { increment: baobabOnAllReturns - paydunyaOnAllReturns },
            escrowInvestors: { decrement: totalNetDistributed },
            guaranteeBalance: { decrement: Math.round(project.raisedAmount * (fees.commission_guarantee || 2) / 100) }
          }
        })
      }

      // Projet terminé
      await tx.project.update({ where: { id: project.id }, data: { status: 'COMPLETED' } })

      // Notifier entrepreneur
      await tx.notification.create({
        data: {
          userId: project.entrepreneurId,
          title: 'Projet complete — remboursement effectue',
          body: `Le projet "${project.title}" est termine. ${totalNetDistributed.toLocaleString()} FCFA ont ete distribues aux investisseurs. Votre score de reputation augmente.`,
          type: 'PROJECT_COMPLETED',
          data: JSON.stringify({ projectId: project.id })
        }
      })

      // Notifier mentor si applicable
      if (project.mentorId) {
        await tx.notification.create({
          data: {
            userId: project.mentorId,
            title: 'Projet mentor complete',
            body: `Le projet "${project.title}" que vous avez mentoré est entierement rembourse.`,
            type: 'PROJECT_COMPLETED',
            data: JSON.stringify({ projectId: project.id })
          }
        })
      }
    })

    // Créer échéancier si pas encore fait
    try {
      const existing = await prisma.repaymentSchedule.findFirst({ where: { projectId: project.id } })
      if (!existing) {
        const fees2 = await getFees()
        const totalGross = project.investments.reduce((s, i) => s + (i.expectedReturn || 0), 0)
        const totalNet = Math.round(totalGross * (1 - (fees2.commission_baobab_return||5)/100 - (fees2.paydunya_payout||3)/100))
        const months = project.durationMonths || 12
        const monthly = Math.ceil(totalNet / months)
        const nextDue = new Date(); nextDue.setMonth(nextDue.getMonth() + 1)
        const schedule = await prisma.repaymentSchedule.create({
          data: { projectId: project.id, totalAmount: totalNet, monthlyAmount: monthly, totalMonths: months, remainingAmount: totalNet, nextDueDate: nextDue }
        })
        const paymentsData = Array.from({ length: months }, (_, i) => {
          const due = new Date(); due.setMonth(due.getMonth() + i + 1)
          return { scheduleId: schedule.id, projectId: project.id, amount: i === months-1 ? totalNet - monthly*(months-1) : monthly, monthNumber: i+1, dueDate: due }
        })
        await prisma.repaymentPayment.createMany({ data: paymentsData })
        await prisma.notification.create({
          data: { userId: project.entrepreneurId, title: 'Echeancier de remboursement cree', body: `Remboursez ${monthly.toLocaleString()} FCFA/mois pendant ${months} mois via votre wallet BAOBAB INVEST.`, type: 'REPAYMENT_SCHEDULE_CREATED', data: JSON.stringify({ projectId: project.id }) }
        })
      }
    } catch(err) { console.error('Erreur echeancier:', err) }

    successResponse(res, { totalDistributed: 0 }, 'Remboursements effectues et echeancier cree')
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
