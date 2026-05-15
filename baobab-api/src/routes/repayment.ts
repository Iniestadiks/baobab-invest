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
    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId!, type: 'REPAYMENT_RECEIVED' },
      orderBy: { createdAt: 'desc' }
    })
    successResponse(res, notifications)
  } catch (e) { errorResponse(res) }
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
