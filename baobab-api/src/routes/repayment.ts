import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthRequest, authenticate, requireRole } from '../middleware/auth'
import { getFees } from '../config/fees'

const router = Router()
const prisma = new PrismaClient()

function successResponse(res: Response, data: any, message = 'OK') {
  res.json({ success: true, message, data })
}
function errorResponse(res: Response, message = 'Erreur serveur') {
  res.status(500).json({ success: false, message })
}

// Admin — voir tous les echéanciers (AVANT /my/:projectId pour eviter conflit)
router.get('/admin/all', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
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

      // Calculer la part proportionnelle de cet investisseur
      const totalInvested = await prisma.investment.aggregate({
        where: { projectId: inv.projectId },
        _sum: { amount: true }
      })
      const totalInvestedAmount = totalInvested._sum.amount || 1
      const proportion = inv.amount / totalInvestedAmount

      for (const payment of schedule.payments) {
        const investorShare = Math.round(payment.amount * proportion)
        results.push({
          id: payment.id,
          projectId: inv.projectId,
          projectTitle: inv.project?.title,
          monthNumber: payment.monthNumber,
          totalMonths: schedule.totalMonths,
          amount: investorShare,
          paidAt: payment.paidAt,
          createdAt: payment.paidAt
        })
      }
    }

    // Trier par date décroissante
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

    const fees = await getFees()
    const totalGross = project.investments.reduce((s, i) => s + (i.expectedReturn || 0), 0)
    const baobabRate = fees.commission_baobab_return || 5
    const paydunyaRate = fees.paydunya_payout || 3
    const totalNet = Math.round(totalGross * (1 - baobabRate / 100 - paydunyaRate / 100))
    const months = project.durationMonths || 12
    const monthly = Math.ceil(totalNet / months)
    const nextDue = new Date()
    nextDue.setMonth(nextDue.getMonth() + 1)

    const schedule = await prisma.repaymentSchedule.create({
      data: {
        projectId: project.id,
        totalAmount: totalNet,
        monthlyAmount: monthly,
        totalMonths: months,
        remainingAmount: totalNet,
        nextDueDate: nextDue,
        status: 'ACTIVE'
      }
    })

    const payments = Array.from({ length: months }, (_, i) => {
      const due = new Date()
      due.setMonth(due.getMonth() + i + 1)
      return {
        scheduleId: schedule.id,
        projectId: project.id,
        amount: i === months - 1 ? totalNet - monthly * (months - 1) : monthly,
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
        body: 'Remboursez ' + monthly.toLocaleString() + ' FCFA/mois pendant ' + months + ' mois. Total: ' + totalNet.toLocaleString() + ' FCFA.',
        type: 'REPAYMENT_SCHEDULE_CREATED',
        data: JSON.stringify({ projectId: project.id, scheduleId: schedule.id })
      }
    })

    successResponse(res, { schedule, monthly, totalNet, months }, 'Echeancier cree')
  } catch (e) { console.error(e); errorResponse(res) }
})

// Entrepreneur — voir son echeancier
router.get('/my/:projectId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
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

    const fees = await getFees()
    const baobabRate = fees.commission_baobab_return || 5
    const paydunyaRate = fees.paydunya_payout || 3
    const totalInvested = schedule.project.investments.reduce((s, i) => s + i.amount, 0)

    await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { userId: req.userId! },
        data: { balance: { decrement: nextPayment.amount } }
      })

      for (const inv of schedule.project.investments) {
        const proportion = totalInvested > 0 ? inv.amount / totalInvested : 0
        const investorShare = Math.round(nextPayment.amount * proportion)
        if (investorShare <= 0) continue

        await tx.wallet.update({
          where: { userId: inv.userId },
          data: { balance: { increment: investorShare }, totalEarned: { increment: investorShare } }
        })

        await tx.notification.create({
          data: {
            userId: inv.userId,
            title: 'Remboursement recu',
            body: 'Vous avez recu ' + investorShare.toLocaleString() + ' FCFA du projet "' + schedule.project.title + '" (mois ' + nextPayment.monthNumber + '/' + schedule.totalMonths + ').',
            type: 'REPAYMENT_RECEIVED',
            data: JSON.stringify({ projectId: schedule.projectId, amount: investorShare })
          }
        })
      }

      const baobabFee = Math.round(nextPayment.amount * baobabRate / 100)
      // Crediter wallet admin de la commission retour BAOBAB
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
        await tx.project.update({ where: { id: schedule.projectId }, data: { status: 'COMPLETED' } })
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

    successResponse(res, {
      paidMonth: nextPayment.monthNumber,
      amount: nextPayment.amount,
      remainingMonths: schedule.totalMonths - schedule.paidMonths - 1
    }, 'Mensualite ' + nextPayment.monthNumber + '/' + schedule.totalMonths + ' payee')
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

    const fees = await getFees()
    const baobabRate = fees.commission_baobab_return || 5
    const totalInvested = schedule.project.investments.reduce((s, i) => s + i.amount, 0)
    const isEarlyFull = months === 0 || paymentsToProcess.length === schedule.payments.length

    await prisma.$transaction(async (tx) => {
      // Débiter wallet entrepreneur
      await tx.wallet.update({ where: { userId: req.userId! }, data: { balance: { decrement: totalAmount } } })

      // Distribuer à chaque investisseur proportionnellement
      for (const inv of schedule.project.investments) {
        const proportion = totalInvested > 0 ? inv.amount / totalInvested : 0
        const investorShare = Math.round(totalAmount * proportion)
        if (investorShare <= 0) continue
        await tx.wallet.update({
          where: { userId: inv.userId },
          data: { balance: { increment: investorShare }, totalEarned: { increment: investorShare } }
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

      // Commission BAOBAB
      const baobabFee = Math.round(totalAmount * baobabRate / 100)
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

      // Marquer paiements comme payés
      for (const pay of paymentsToProcess) {
        await tx.repaymentPayment.update({ where: { id: pay.id }, data: { status: 'PAID', paidAt: new Date() } })
      }

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
  } catch (e) { console.error(e); errorResponse(res) }
})

// Admin — vérifier les retards de paiement et envoyer alertes
router.post('/check-delays', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date()
    const in7days = new Date(now.getTime() + 7*24*60*60*1000)
    const in3days = new Date(now.getTime() + 3*24*60*60*1000)
    const late7days = new Date(now.getTime() - 7*24*60*60*1000)
    const late3days = new Date(now.getTime() - 3*24*60*60*1000)

    const schedules = await prisma.repaymentSchedule.findMany({
      where: { status: 'ACTIVE' },
      include: {
        project: {
          include: {
            investments: { select: { userId: true, amount: true } },
            entrepreneur: { select: { id: true, firstName: true } }
          }
        },
        payments: { where: { status: 'PENDING' }, orderBy: { monthNumber: 'asc' }, take: 1 }
      }
    })

    let alerts = 0
    const oneDayAgo = new Date(now.getTime() - 24*60*60*1000)

    for (const sched of schedules) {
      const nextPayment = sched.payments[0]
      if (!nextPayment?.dueDate) continue
      const dueDate = new Date(nextPayment.dueDate)
      const entrepreneurId = sched.project.entrepreneurId

      // Vérifier si une alerte récente existe déjà (éviter doublons)
      const recentAlert = await prisma.notification.findFirst({
        where: { userId: entrepreneurId, createdAt: { gte: oneDayAgo }, body: { contains: sched.project.title } }
      })
      if (recentAlert) continue

      let title = ''
      let body = ''
      let scoreDecrement = 0
      let notifyAdmin = false
      let notifyInvestors = false

      if (dueDate <= now && dueDate >= late3days) {
        // Jour J — rappel urgent
        title = 'Paiement mensualite en retard'
        body = 'Votre mensualite de ' + nextPayment.amount.toLocaleString() + ' FCFA pour "' + sched.project.title + '" etait due le ' + dueDate.toLocaleDateString('fr-FR') + '. Payez maintenant pour eviter des penalites.'
      } else if (dueDate < late3days && dueDate >= late7days) {
        // J+3 — pénalité score
        title = 'Retard paiement — penalite appliquee'
        body = 'Votre paiement de ' + nextPayment.amount.toLocaleString() + ' FCFA est en retard de 3 jours. -10 points de reputation.'
        scoreDecrement = 10
        notifyInvestors = true
      } else if (dueDate < late7days) {
        // J+7 — alerte admin
        title = 'Retard critique — 7 jours'
        body = 'Votre paiement de ' + nextPayment.amount.toLocaleString() + ' FCFA est en retard de plus de 7 jours. L equipe BAOBAB INVEST intervient.'
        scoreDecrement = 30
        notifyAdmin = true
        notifyInvestors = true
      } else if (dueDate <= in3days) {
        // J-3 — rappel
        title = 'Rappel paiement dans 3 jours'
        body = 'Votre mensualite de ' + nextPayment.amount.toLocaleString() + ' FCFA est due le ' + dueDate.toLocaleDateString('fr-FR') + '. Pensez a recharger votre wallet.'
      } else if (dueDate <= in7days) {
        // J-7 — avertissement
        title = 'Mensualite due dans 7 jours'
        body = 'Votre prochaine mensualite de ' + nextPayment.amount.toLocaleString() + ' FCFA est due le ' + dueDate.toLocaleDateString('fr-FR') + '.'
      } else continue

      // Notifier entrepreneur
      await prisma.notification.create({
        data: { userId: entrepreneurId, title, body, type: 'PAYMENT_REMINDER', data: JSON.stringify({ scheduleId: sched.id, projectId: sched.projectId }) }
      })

      // Pénalité score
      if (scoreDecrement > 0) {
        await prisma.user.update({ where: { id: entrepreneurId }, data: { reputationScore: { decrement: scoreDecrement } } })
      }

      // Notifier investisseurs
      if (notifyInvestors) {
        const investorIds = [...new Set(sched.project.investments.map(i => i.userId))]
        await prisma.notification.createMany({
          data: investorIds.map(userId => ({
            userId: userId as string,
            title: 'Retard remboursement projet',
            body: 'L entrepreneur du projet "' + sched.project.title + '" est en retard de paiement. BAOBAB INVEST surveille la situation.',
            type: 'PAYMENT_LATE',
            data: JSON.stringify({ projectId: sched.projectId })
          }))
        })
      }

      // Notifier admin
      if (notifyAdmin) {
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } })
        await prisma.notification.createMany({
          data: admins.map(a => ({
            userId: a.id,
            title: 'Retard critique — intervention requise',
            body: 'Le projet "' + sched.project.title + '" est en retard de paiement depuis plus de 7 jours. Envisager le fonds de garantie.',
            type: 'PAYMENT_CRITICAL',
            data: JSON.stringify({ projectId: sched.projectId, scheduleId: sched.id })
          }))
        })
      }

      alerts++
    }

    successResponse(res, { alerts, checked: schedules.length }, alerts + ' alerte(s) envoyee(s)')
  } catch (e) { console.error(e); errorResponse(res) }
})

// Admin — déclarer un projet FAILED et distribuer le fonds de garantie
router.post('/project-failed/:projectId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reason } = req.body
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: {
        investments: { include: { user: { select: { id: true, firstName: true } } } },
        entrepreneur: { select: { id: true, firstName: true } }
      }
    })
    if (!project) { res.status(404).json({ success: false, message: 'Projet introuvable' }); return }

    const fees = await getFees()
    const guaranteeRate = fees.commission_guarantee || 2
    const totalInvested = project.investments.reduce((s, i) => s + i.amount, 0)
    const guaranteeFund = Math.round(totalInvested * guaranteeRate / 100)

    await prisma.$transaction(async (tx) => {
      // Passer le projet en FAILED
      await tx.project.update({ where: { id: project.id }, data: { status: 'FAILED' } })

      // Distribuer le fonds de garantie proportionnellement
      for (const inv of project.investments) {
        const proportion = totalInvested > 0 ? inv.amount / totalInvested : 0
        const guaranteeShare = Math.round(guaranteeFund * proportion)
        if (guaranteeShare <= 0) continue

        await tx.wallet.update({
          where: { userId: inv.userId },
          data: { balance: { increment: guaranteeShare } }
        })

        await tx.notification.create({
          data: {
            userId: inv.userId,
            title: 'Projet echoue — remboursement garantie',
            body: 'Le projet "' + project.title + '" a echoue. Vous recevez ' + guaranteeShare.toLocaleString() + ' FCFA du fonds de garantie (2% de votre investissement). Nous sommes desoles pour ce resultat.',
            type: 'PROJECT_FAILED',
            data: JSON.stringify({ projectId: project.id, guaranteeShare })
          }
        })
      }

      // Débiter le fonds de garantie du wallet admin
      const adminUser = await tx.user.findFirst({ where: { role: 'ADMIN' } })
      if (adminUser) {
        await tx.wallet.update({
          where: { userId: adminUser.id },
          data: { guaranteeBalance: { decrement: guaranteeFund } }
        })
      }

      // Pénaliser l'entrepreneur -50 pts
      await tx.user.update({
        where: { id: project.entrepreneurId },
        data: { reputationScore: { decrement: 50 } }
      })

      // Notifier l'entrepreneur
      await tx.notification.create({
        data: {
          userId: project.entrepreneurId,
          title: 'Projet declare en echec',
          body: 'Votre projet "' + project.title + '" a ete declare en echec. Motif: ' + (reason || 'Non precise') + '. -50 points de reputation.',
          type: 'PROJECT_FAILED',
          data: JSON.stringify({ projectId: project.id })
        }
      })
    })

    successResponse(res, { guaranteeFund, investorsCount: project.investments.length }, 'Projet declare FAILED — ' + guaranteeFund.toLocaleString() + ' FCFA distribues depuis le fonds de garantie')
  } catch (e) { console.error(e); errorResponse(res) }
})
