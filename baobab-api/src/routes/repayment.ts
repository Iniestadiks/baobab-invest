// @ts-nocheck
import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthRequest, authenticate, requireRole } from '../middleware/auth'
import { sendNotificationEmail } from '../services/emailService'
import { getFees, getProjectFees } from '../config/fees'
import { executeProjectFailure } from '../services/projectFailure'
import { requestClosureVideo } from '../services/paliers'
import { executeProjectFailure } from '../services/projectFailure'
import { checkAndUnlockPalier } from '../services/paliers'
import { updateBuilderGamification } from '../services/builderGamification'

const router = Router()
const prisma = new PrismaClient()

function successResponse(res: Response, data: any, message = 'OK') {
  res.json({ success: true, message, data })
}
function errorResponse(res: Response, message = 'Erreur serveur') {
  res.status(500).json({ success: false, message })
}

// Admin — voir tous les echéanciers (AVANT /my/:projectId pour eviter conflit)
router.get('/admin/all', authenticate, requireRole(['ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schedules = await prisma.repaymentSchedule.findMany({
      include: {
        project: {
          select: {
            title: true,
            entrepreneur: { select: { firstName: true, lastName: true } }
          }
        },
        payments: { orderBy: { monthNumber: 'asc' } }
      },
      orderBy: { createdAt: 'desc' }
    })
    successResponse(res, schedules)
  } catch (e) { errorResponse(res) }
})

// Investisseur — voir les remboursements recus (AVANT /my/:projectId)
router.get('/investor/received', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Trouver tous les investissements de cet investisseur
    const investments = await prisma.investment.findMany({
      where: { userId: req.userId! },
      select: { id: true, amount: true, projectId: true, project: { select: { title: true } } }
    })

    const results = []

    for (const inv of investments) {
      // Trouver l'echéancier du projet
      const schedule = await prisma.repaymentSchedule.findFirst({
        where: { projectId: inv.projectId },
        include: { payments: { where: { status: 'PAID' }, orderBy: { monthNumber: 'asc' } } }
      })
      if (!schedule || schedule.payments.length === 0) continue

      // Utiliser sharePercent pour la proportion exacte
      const investmentFull = await prisma.investment.findFirst({
        where: { userId: req.userId!, projectId: inv.projectId },
        select: { sharePercent: true }
      })
      const proportion = investmentFull?.sharePercent || (inv.amount / (schedule.project?.goalAmount || inv.amount))
      const feesData = await getFees()
      const payinRepayPct = feesData.payin_repayment || 4

      for (const payment of schedule.payments) {
        const payinFee = Math.round(payment.amount * payinRepayPct / 100)
        const netPayment = payment.amount - payinFee
        const investorShare = Math.round(netPayment * proportion)
        results.push({
          id: payment.id,
          projectId: inv.projectId,
          projectTitle: inv.project?.title,
          monthNumber: payment.monthNumber,
          totalMonths: schedule.totalMonths,
          amount: investorShare,
          grossAmount: payment.amount,
          paidAt: payment.paidAt,
          createdAt: payment.paidAt
        })
      }
    }
    results.sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime())
    successResponse(res, results)
  } catch (e) { console.error(e); errorResponse(res) }
})

// Creer l'echeancier pour un projet
router.post('/create/:projectId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: { investments: { select: { amount: true, expectedReturn: true, userId: true } } }
    })
    if (!project) { res.status(404).json({ success: false, message: 'Projet introuvable' }); return }

    const existing = await prisma.repaymentSchedule.findFirst({ where: { projectId: project.id } })
    if (existing) { res.status(400).json({ success: false, message: 'Echeancier deja cree' }); return }

    const fees = await getProjectFees(project)
    
    // NOUVELLE STRATÉGIE : remboursement = 22% sur besoin net du projet
    // Pas de commission BAOBAB au retour (0%)
    // BAOBAB prélève 4% Payin sur chaque mensualité pour compenser ses avances
    const netAmount = project.netAmount || project.goalAmount
    const returnRate = Math.max(project.expectedReturn || 0, fees.return_min)
    const totalGross = Math.round(netAmount * (1 + returnRate / 100))
    
    // Payin 4% prélevé sur chaque mensualité → distribué aux investisseurs nets
    const payinRate = fees.payin_repayment  // 4%
    
    const months = project.durationMonths || 12
    
    // Délai de grâce selon secteur
    const gracePeriod = project.gracePeriodMonths || 0
    const monthly = Math.ceil(totalGross / months)
    const netMonthly = Math.round(monthly * (1 - payinRate / 100))  // après Payin 4%
    
    const nextDue = new Date()
    nextDue.setMonth(nextDue.getMonth() + 1 + gracePeriod)  // délai grâce

    const schedule = await prisma.repaymentSchedule.create({
      data: {
        projectId: project.id,
        totalAmount: totalGross,
        monthlyAmount: monthly,
        totalMonths: months,
        remainingAmount: totalGross,
        nextDueDate: nextDue,
        status: 'ACTIVE'
      }
    })

    const payments = Array.from({ length: months }, (_, i) => {
      const due = new Date()
      due.setMonth(due.getMonth() + i + 1 + gracePeriod)
      return {
        scheduleId: schedule.id,
        projectId: project.id,
        amount: i === months - 1 ? totalGross - monthly * (months - 1) : monthly,
        monthNumber: i + 1,
        dueDate: due,
        status: 'PENDING'
      }
    })
    await prisma.repaymentPayment.createMany({ data: payments })

    await prisma.notification.create({
      data: {
        userId: project.entrepreneurId,
        title: 'Echeancier de remboursement cree',
        body: 'Remboursez ' + monthly.toLocaleString() + ' FCFA/mois pendant ' + months + ' mois' + (gracePeriod > 0 ? ' (debut mois ' + (gracePeriod+1) + ')' : '') + '. Total: ' + totalGross.toLocaleString() + ' FCFA.',
        type: 'REPAYMENT_SCHEDULE_CREATED',
        data: JSON.stringify({ projectId: project.id, scheduleId: schedule.id })
      }
    })

    successResponse(res, { schedule, monthly, totalGross, months, gracePeriod }, 'Echeancier cree')
  } catch (e) { console.error(e); errorResponse(res) }
})

// Entrepreneur — voir son echeancier
router.get('/my/:projectId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      select: { entrepreneurId: true, investments: { select: { userId: true } } }
    })
    if (!project) { res.status(404).json({ success: false, message: 'Projet introuvable' }); return }
    const isOwnerOrInvestor = project.entrepreneurId === req.userId
      || project.investments.some(i => i.userId === req.userId)
      || req.userRole === 'ADMIN'
    if (!isOwnerOrInvestor) {
      res.status(403).json({ success: false, message: 'Accès refusé' }); return
    }
    const schedule = await prisma.repaymentSchedule.findFirst({
      where: { projectId: req.params.projectId },
      include: { payments: { orderBy: { monthNumber: 'asc' } } }
    })
    successResponse(res, schedule)
  } catch (e) { errorResponse(res) }
})

// Entrepreneur — payer une mensualite
router.post('/pay/:scheduleId', authenticate, requireRole(['ENTREPRENEUR']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schedule = await prisma.repaymentSchedule.findUnique({
      where: { id: req.params.scheduleId },
      include: {
        project: {
          include: {
            investments: { include: { user: { select: { id: true, firstName: true } } } }
          }
        },
        payments: { where: { status: 'PENDING' }, orderBy: { monthNumber: 'asc' }, take: 1 }
      }
    })

    if (!schedule) { res.status(404).json({ success: false, message: 'Echeancier introuvable' }); return }
    if (schedule.project.entrepreneurId !== req.userId) {
      res.status(403).json({ success: false, message: 'Non autorise' }); return
    }

    const nextPayment = schedule.payments[0]
    if (!nextPayment) { res.status(400).json({ success: false, message: 'Aucun paiement en attente' }); return }

    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } })
    if (!wallet || wallet.balance < nextPayment.amount) {
      res.status(400).json({ success: false, message: 'Solde insuffisant. Disponible: ' + (wallet?.balance?.toLocaleString() || 0) + ' FCFA' }); return
    }

    const fees = await getProjectFees(schedule.project)
    const payinRate = fees.payin_repayment || 4   // Payin mensualités 4%
    const baobabRate = 0                           // 0% commission retour BAOBAB (modèle validé)
    const payinFee = Math.round(nextPayment.amount * payinRate / 100)
    const netToDistribute = nextPayment.amount - payinFee
    // Distribution proportionnelle via sharePercent
    const goalAmount = schedule.project.goalAmount

    await prisma.$transaction(async (tx) => {
      // Réservation atomique et conditionnelle — AVANT tout mouvement d'argent.
      // Avant ce correctif, la mensualité était lue PENDING puis marquée PAID
      // sans revérifier son statut au moment de l'écriture : un double-clic ou
      // deux requêtes concurrentes payaient deux fois la même mensualité.
      const paymentReserved = await tx.repaymentPayment.updateMany({
        where: { id: nextPayment.id, status: 'PENDING' },
        data: { status: 'PAID', paidAt: new Date() }
      })
      if (paymentReserved.count === 0) {
        throw new Error('ALREADY_PAID: cette mensualité a déjà été réglée')
      }
      const walletReserved = await tx.wallet.updateMany({
        where: { userId: req.userId!, balance: { gte: nextPayment.amount } },
        data: { balance: { decrement: nextPayment.amount } }
      })
      if (walletReserved.count === 0) {
        throw new Error('INSUFFICIENT: solde insuffisant au moment du paiement')
      }
      // Payin 4% → admin
      const adminRep2 = await tx.user.findFirst({ where: { role: "ADMIN" } })
      if (adminRep2 && payinFee > 0) {
        await tx.wallet.update({ where: { userId: adminRep2.id }, data: { commissionBalance: { increment: payinFee } } })
        await tx.platformRevenue.create({ data: { type: "PAYIN_REPAYMENT", amount: payinFee, projectId: schedule.projectId, description: "Payin 4% mensualite M" + nextPayment.monthNumber } })
      }

      // Grouper par userId pour eviter doublons (Fonds Solidaire a 3 investissements)
      const investorMap: Record<string, { totalShare: number; invIds: string[] }> = {}
      for (const inv of schedule.project.investments) {
        const proportion = inv.sharePercent || (goalAmount > 0 ? inv.amount / goalAmount : 0)
        const investorShare = Math.round(netToDistribute * proportion)
        if (investorShare <= 0) continue
        if (!investorMap[inv.userId]) investorMap[inv.userId] = { totalShare: 0, invIds: [] }
        investorMap[inv.userId].totalShare += investorShare
        investorMap[inv.userId].invIds.push(inv.id)
        // returnedAmount par investissement individuel
        await tx.investment.update({
          where: { id: inv.id },
          data: { returnedAmount: { increment: investorShare } }
        })
      }
      // Reliquat d'arrondi (netToDistribute - somme des parts arrondies
      // indépendamment) — attribué explicitement au plus gros investisseur
      // plutôt que de disparaître ou d'être fabriqué silencieusement.
      const totalDistributed = Object.values(investorMap).reduce((s, d) => s + d.totalShare, 0)
      const residual = netToDistribute - totalDistributed
      if (residual !== 0 && Object.keys(investorMap).length > 0) {
        const biggestUserId = Object.entries(investorMap).sort((a, b) => b[1].totalShare - a[1].totalShare)[0][0]
        investorMap[biggestUserId].totalShare += residual
      }
      // Crediter chaque investisseur une seule fois
      for (const [userId, data] of Object.entries(investorMap)) {
        await tx.wallet.update({
          where: { userId },
          data: { balance: { increment: data.totalShare }, gainBalance: { increment: data.totalShare }, totalEarned: { increment: data.totalShare } }
        })
        await tx.notification.create({
          data: {
            userId,
            title: 'Remboursement recu',
            body: 'Vous avez recu ' + data.totalShare.toLocaleString() + ' FCFA du projet "' + schedule.project.title + '" (mois ' + nextPayment.monthNumber + '/' + schedule.totalMonths + ').',
            type: 'REPAYMENT_RECEIVED',
            data: JSON.stringify({ projectId: schedule.projectId, amount: data.totalShare })
          }
        })
        const investorUser = await tx.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } })
        if (investorUser) {
          sendNotificationEmail(investorUser.email, investorUser.firstName, '💰 Remboursement reçu', `vous avez reçu ${data.totalShare.toLocaleString()} FCFA du projet "${schedule.project.title}" (mois ${nextPayment.monthNumber}/${schedule.totalMonths}).`).catch(() => {})
        }
      }

      const baobabFee = Math.round(nextPayment.amount * baobabRate / 100)
      // Crediter wallet admin de la commission retour BAOBAB — seulement si
      // positif (baobabRate est actuellement figé à 0% ; créer une écriture
      // à montant nul à chaque mensualité polluait le journal des revenus
      // pour rien).
      if (baobabFee > 0) {
        const adminRep = await tx.user.findFirst({ where: { role: 'ADMIN' } })
        if (adminRep) {
          await tx.wallet.update({
            where: { userId: adminRep.id },
            data: { balance: { increment: baobabFee }, commissionBalance: { increment: baobabFee } }
          })
        }
        await tx.platformRevenue.create({
          data: {
            type: 'COMMISSION_RETURN',
            amount: baobabFee,
            projectId: schedule.projectId,
            description: 'Commission retour ' + baobabRate + '% — mois ' + nextPayment.monthNumber
          }
        })
      }

      await tx.repaymentPayment.update({
        where: { id: nextPayment.id },
        data: { status: 'PAID', paidAt: new Date() }
      })

      const newPaid = schedule.paidMonths + 1
      const newRemaining = Math.max(0, schedule.remainingAmount - nextPayment.amount)
      const nextDue = new Date()
      nextDue.setMonth(nextDue.getMonth() + 1)

      await tx.repaymentSchedule.update({
        where: { id: schedule.id },
        data: {
          paidMonths: newPaid,
          remainingAmount: newRemaining,
          nextDueDate: newPaid < schedule.totalMonths ? nextDue : null,
          status: newPaid >= schedule.totalMonths ? 'COMPLETED' : 'ACTIVE'
        }
      })

      if (newPaid >= schedule.totalMonths) {
        // Libérer escrowBalance des investisseurs
        for (const inv of schedule.project.investments) {
          await tx.wallet.update({
            where: { userId: inv.userId },
            data: { escrowBalance: { decrement: inv.amount } }
          })
        }
        await tx.project.update({ where: { id: schedule.projectId }, data: { status: 'COMPLETED' } })
        await requestClosureVideo(schedule.projectId, tx)
        await tx.notification.create({
          data: {
            userId: schedule.project.entrepreneurId,
            title: 'Projet entierement rembourse',
            body: 'Le projet "' + schedule.project.title + '" est entierement rembourse. Votre score de reputation augmente.',
            type: 'PROJECT_COMPLETED',
            data: JSON.stringify({ projectId: schedule.projectId })
          }
        })
      }
    })

    // Vérifier déblocage palier suivant (transaction séparée)
    try {
      await prisma.$transaction(async (txPalier) => {
        await checkAndUnlockPalier(schedule.id, txPalier)
      })
    } catch (palierErr) { console.error('Palier check error:', palierErr) }
    // +5 pts gamification aux batisseurs si remboursement recu
    try {
      const builders = await prisma.builderProfile.findMany({ select: { userId: true } })
      for (const b of builders) {
        await updateBuilderGamification(b.userId, { type: 'REMBOURSEMENT_OK' })
      }
    } catch (ge) { console.error('[GAMIFICATION] repayment bonus:', ge) }

    successResponse(res, {
      paidMonth: nextPayment.monthNumber,
      amount: nextPayment.amount,
      remainingMonths: schedule.totalMonths - schedule.paidMonths - 1
    }, 'Mensualite ' + nextPayment.monthNumber + '/' + schedule.totalMonths + ' payee')
  } catch (e: any) {
    if (e?.message?.startsWith('ALREADY_PAID')) {
      res.status(409).json({ success: false, message: 'Cette mensualité a déjà été réglée — probablement un double-clic.' }); return
    }
    if (e?.message?.startsWith('INSUFFICIENT')) {
      res.status(400).json({ success: false, message: 'Solde insuffisant au moment du paiement.' }); return
    }
    console.error(e); errorResponse(res)
  }
})

// Admin — reporter une échéance
router.patch('/admin/reschedule/:scheduleId', authenticate, requireRole(['ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { newDueDate, note, monthNumber } = req.body
    if (!newDueDate) { res.status(400).json({ success: false, message: 'newDueDate requis' }); return }

    const schedule = await prisma.repaymentSchedule.findUnique({
      where: { id: req.params.scheduleId },
      include: { project: { include: { investments: { select: { userId: true } }, entrepreneur: { select: { id: true } } } } }
    })
    if (!schedule) { res.status(404).json({ success: false, message: 'Échéancier introuvable' }); return }
    // Limite de 2 rallongements — au-delà, bascule automatique en recouvrement
    // plutôt que de continuer à repousser indéfiniment.
    if ((schedule.rescheduleCount || 0) >= 2) {
      await prisma.repaymentSchedule.update({
        where: { id: schedule.id },
        data: { status: 'IN_COLLECTION', collectionStartedAt: new Date() }
      })
      const investorIdsCol = [...new Set(schedule.project.investments.map(i => i.userId))]
      await prisma.notification.create({
        data: {
          userId: schedule.project.entrepreneurId,
          title: '🚨 Passage en recouvrement',
          body: `Vous avez déjà utilisé vos 2 rallongements pour "${schedule.project.title}". Sans résolution sous 30 jours, le projet sera déclaré en échec.`,
          type: 'SCHEDULE_COLLECTION',
          data: JSON.stringify({ scheduleId: schedule.id })
        }
      })
      if (investorIdsCol.length > 0) {
        await prisma.notification.createMany({
          data: investorIdsCol.map((userId: any) => ({
            userId,
            title: '⚠️ Projet en recouvrement',
            body: `Le projet "${schedule.project.title}" est passé en recouvrement après épuisement des rallongements disponibles.`,
            type: 'SCHEDULE_COLLECTION',
            data: JSON.stringify({ projectId: schedule.projectId })
          }))
        })
      }
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } })
      await prisma.notification.createMany({
        data: admins.map(a => ({
          userId: a.id,
          title: '🚨 Projet en recouvrement — 2 rallongements épuisés',
          body: `"${schedule.project.title}" bascule en recouvrement. Délai de 30 jours avant échec automatique.`,
          type: 'SCHEDULE_COLLECTION',
          data: JSON.stringify({ scheduleId: schedule.id, projectId: schedule.projectId })
        }))
      })
      res.status(400).json({ success: false, message: 'Limite de 2 rallongements déjà atteinte — le projet passe automatiquement en recouvrement.', code: 'COLLECTION_TRIGGERED' })
      return
    }


    // Trouver tous les mois PENDING et les décaler proportionnellement
    const pendingPayments = await prisma.repaymentPayment.findMany({
      where: { scheduleId: schedule.id, status: 'PENDING' },
      orderBy: { monthNumber: 'asc' }
    })
    if (pendingPayments.length === 0) {
      res.status(400).json({ success: false, message: 'Aucune mensualite en attente' }); return
    }
    const nextPending = pendingPayments[0]
    const diffMs = new Date(newDueDate).getTime() - new Date(nextPending.dueDate).getTime()
    for (const payment of pendingPayments) {
      const updatedDate = new Date(new Date(payment.dueDate).getTime() + diffMs)
      await prisma.repaymentPayment.update({
        where: { id: payment.id },
        data: { dueDate: updatedDate }
      })
    }
    await prisma.repaymentSchedule.update({
      where: { id: schedule.id },
      data: { nextDueDate: new Date(newDueDate), adminNote: note || schedule.adminNote, rescheduleCount: { increment: 1 } }
    })

    // Notifier entrepreneur
    await prisma.notification.create({
      data: {
        userId: schedule.project.entrepreneurId,
        title: '📅 Échéance reportée',
        body: `Votre prochaine mensualité a été reportée au ${new Date(newDueDate).toLocaleDateString('fr-FR')}. ${note || ''}`,
        type: 'SCHEDULE_UPDATED',
        data: JSON.stringify({ scheduleId: schedule.id, newDueDate })
      }
    })

    // Notifier investisseurs
    const investorIds = [...new Set(schedule.project.investments.map(i => i.userId))]
    if (investorIds.length > 0) {
      await prisma.notification.createMany({
        data: investorIds.map((userId: any) => ({
          userId,
          title: '📅 Échéance modifiée',
          body: `Une mensualité du projet "${schedule.project.title}" a été reportée au ${new Date(newDueDate).toLocaleDateString('fr-FR')}.`,
          type: 'SCHEDULE_UPDATED',
          data: JSON.stringify({ projectId: schedule.projectId })
        }))
      })
    }

    successResponse(res, { scheduleId: schedule.id, newDueDate }, 'Échéance reportée avec succès')
  } catch (e) { console.error(e); errorResponse(res) }
})

export default router

// Entrepreneur — rembourser plusieurs mensualités d'avance ou tout rembourser
router.post('/pay-advance/:scheduleId', authenticate, requireRole(['ENTREPRENEUR']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { months } = req.body // months = 0 signifie TOUT rembourser
    const schedule = await prisma.repaymentSchedule.findUnique({
      where: { id: req.params.scheduleId },
      include: {
        project: {
          include: {
            investments: { include: { user: { select: { id: true, firstName: true } } } }
          }
        },
        payments: { where: { status: 'PENDING' }, orderBy: { monthNumber: 'asc' } }
      }
    })

    if (!schedule) { res.status(404).json({ success: false, message: 'Echeancier introuvable' }); return }
    if (schedule.project.entrepreneurId !== req.userId) { res.status(403).json({ success: false, message: 'Non autorise' }); return }
    if (schedule.payments.length === 0) { res.status(400).json({ success: false, message: 'Aucun paiement en attente' }); return }

    // Determiner les paiements à effectuer
    const paymentsToProcess = months === 0 ? schedule.payments : schedule.payments.slice(0, months)
    const totalAmount = paymentsToProcess.reduce((s, p) => s + p.amount, 0)

    // Verifier solde
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } })
    if (!wallet || wallet.balance < totalAmount) {
      res.status(400).json({ success: false, message: 'Solde insuffisant. Disponible: ' + (wallet?.balance||0).toLocaleString() + ' FCFA — Requis: ' + totalAmount.toLocaleString() + ' FCFA' }); return
    }

    const fees = await getProjectFees(schedule.project)
    const baobabRate = fees.payin_repayment || 4  // Payin mensualités — 0% commission retour
    const totalInvested = schedule.project.investments.reduce((s, i) => s + i.amount, 0)
    const isEarlyFull = months === 0 || paymentsToProcess.length === schedule.payments.length
    // Payin prélevé sur le montant brut, investisseurs reçoivent le NET —
    // même modèle équilibré que la mensualité normale (/pay). Avant ce correctif,
    // les investisseurs recevaient 100% du brut ET l'admin recevait le payin en
    // plus, créant de l'argent à chaque remboursement anticipé.
    const baobabFee = Math.round(totalAmount * baobabRate / 100)
    const netToDistribute = totalAmount - baobabFee

    await prisma.$transaction(async (tx) => {
      // Réservation atomique et conditionnelle — AVANT tout mouvement d'argent.
      // Un double-clic sur "tout rembourser" pouvait, avant ce correctif, payer
      // deux fois le même lot de mensualités (update par id, sans revérifier le
      // statut PENDING au moment de l'écriture).
      const paymentIds = paymentsToProcess.map(p => p.id)
      const paymentsReserved = await tx.repaymentPayment.updateMany({
        where: { id: { in: paymentIds }, status: 'PENDING' },
        data: { status: 'PAID', paidAt: new Date() }
      })
      if (paymentsReserved.count !== paymentIds.length) {
        throw new Error('ALREADY_PAID: une ou plusieurs de ces mensualités ont déjà été réglées')
      }
      const walletReserved = await tx.wallet.updateMany({
        where: { userId: req.userId!, balance: { gte: totalAmount } },
        data: { balance: { decrement: totalAmount } }
      })
      if (walletReserved.count === 0) {
        throw new Error('INSUFFICIENT: solde insuffisant au moment du paiement')
      }

      // Distribuer à chaque investisseur proportionnellement — sur le NET, pas le brut
      for (const inv of schedule.project.investments) {
        const proportion = totalInvested > 0 ? inv.amount / totalInvested : 0
        const investorShare = Math.round(netToDistribute * proportion)
        if (investorShare <= 0) continue
        await tx.wallet.update({
          where: { userId: inv.userId },
          data: {
            balance: { increment: investorShare },
            gainBalance: { increment: investorShare },
            totalEarned: { increment: investorShare }
          }
        })
        // Mettre à jour returnedAmount de CETTE ligne d'investissement précise —
        // updateMany par userId+projectId ciblait TOUTES les lignes de cet
        // investisseur à chaque itération, gonflant returnedAmount par la
        // somme de toutes ses parts sur chaque ligne au lieu de sa propre part.
        await tx.investment.update({
          where: { id: inv.id },
          data: { returnedAmount: { increment: investorShare } }
        })
        await tx.notification.create({
          data: {
            userId: inv.userId,
            title: isEarlyFull ? 'Remboursement anticipe complet' : 'Remboursement anticipe partiel',
            body: 'Vous avez recu ' + investorShare.toLocaleString() + ' FCFA (' + paymentsToProcess.length + ' mois) du projet "' + schedule.project.title + '".',
            type: 'REPAYMENT_RECEIVED',
            data: JSON.stringify({ projectId: schedule.projectId, amount: investorShare })
          }
        })
      }

      // Commission BAOBAB — prélevée du brut, pas ajoutée en plus
      const adminAdv = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
      if (adminAdv) {
        await prisma.wallet.update({
          where: { userId: adminAdv.id },
          data: { balance: { increment: baobabFee }, commissionBalance: { increment: baobabFee } }
        })
      }
      await tx.platformRevenue.create({
        data: { type: 'COMMISSION_RETURN', amount: baobabFee, projectId: schedule.projectId, description: 'Commission remboursement anticipe — ' + paymentsToProcess.length + ' mois' }
      })

      // Mettre à jour l'échéancier
      const newPaid = schedule.paidMonths + paymentsToProcess.length
      const newRemaining = Math.max(0, schedule.remainingAmount - totalAmount)
      const isCompleted = newPaid >= schedule.totalMonths

      await tx.repaymentSchedule.update({
        where: { id: schedule.id },
        data: {
          paidMonths: newPaid,
          remainingAmount: newRemaining,
          nextDueDate: isCompleted ? null : new Date(new Date().setMonth(new Date().getMonth() + 1)),
          status: isCompleted ? 'COMPLETED' : 'ACTIVE'
        }
      })

      // Score réputation +20 si remboursement anticipé complet
      if (isEarlyFull) {
        await tx.user.update({
          where: { id: req.userId! },
          data: { reputationScore: { increment: 20 } }
        })
        await tx.project.update({ where: { id: schedule.projectId }, data: { status: 'COMPLETED' } })
        await requestClosureVideo(schedule.projectId, tx)
        await tx.notification.create({
          data: {
            userId: req.userId!,
            title: 'Felicitations ! Remboursement complet',
            body: 'Vous avez rembourse entierement le projet "' + schedule.project.title + '" en avance. +20 points de reputation !',
            type: 'PROJECT_COMPLETED',
            data: JSON.stringify({ projectId: schedule.projectId })
          }
        })
      }
    })

    successResponse(res, { monthsPaid: paymentsToProcess.length, totalPaid: totalAmount }, (isEarlyFull ? 'Remboursement complet effectue' : paymentsToProcess.length + ' mensualites payees en avance'))
  } catch (e: any) {
    if (e?.message?.startsWith('ALREADY_PAID')) {
      res.status(409).json({ success: false, message: 'Une ou plusieurs de ces mensualités ont déjà été réglées — probablement un double-clic.' }); return
    }
    if (e?.message?.startsWith('INSUFFICIENT')) {
      res.status(400).json({ success: false, message: 'Solde insuffisant au moment du paiement.' }); return
    }
    console.error(e); errorResponse(res)
  }
})
// Admin — déclarer un projet FAILED et distribuer le remboursement
// (fonds paliers jamais débloqués + compensation assurance, frais opérateur déduits)
router.post('/project-failed/:projectId', authenticate, requireRole(['ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reason } = req.body
    const result = await executeProjectFailure(req.params.projectId, reason, 'ADMIN')
    if (!result.success) { res.status(400).json(result); return }
    successResponse(res, result, 'Projet déclaré FAILED — ' + (result.undisbursedTotal + result.guaranteeFund).toLocaleString() + ' FCFA distribués au total')
  } catch (e) { console.error(e); errorResponse(res) }
})