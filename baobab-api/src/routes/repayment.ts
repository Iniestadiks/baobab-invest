import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthRequest, authenticate, requireRole } from '../middleware/auth'
import { getFees } from '../config/fees'

const router = Router()
const prisma = new PrismaClient()

function successResponse(res: Response, data: any, message = 'Succès') {
  res.json({ success: true, message, data })
}
function errorResponse(res: Response, message = 'Erreur serveur') {
  res.status(500).json({ success: false, message })
}

// Créer l'échéancier automatiquement quand un projet passe en FUNDED
// Appelé par la route admin/reimburse
router.post('/create/:projectId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: { investments: { select: { amount: true, expectedReturn: true, userId: true } } }
    })
    if (!project) { res.status(404).json({ success: false, message: 'Projet introuvable' }); return }

    const existing = await prisma.repaymentSchedule.findFirst({ where: { projectId: project.id } })
    if (existing) { res.status(400).json({ success: false, message: 'Échéancier déjà créé' }); return }

    const fees = await getFees()
    const totalGross = project.investments.reduce((s, i) => s + (i.expectedReturn || 0), 0)
    const baobabRate = fees.commission_baobab_return || 5
    const paydunyaRate = fees.paydunya_payout || 3
    const totalNet = Math.round(totalGross * (1 - baobabRate/100 - paydunyaRate/100))
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

    // Créer tous les échéances
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

    // Notifier l'entrepreneur
    await prisma.notification.create({
      data: {
        userId: project.entrepreneurId,
        title: 'Echeancier de remboursement cree',
        body: `Votre projet "${project.title}" est finance. Vous devez rembourser ${monthly.toLocaleString()} FCFA/mois pendant ${months} mois. Total: ${totalNet.toLocaleString()} FCFA net.`,
        type: 'REPAYMENT_SCHEDULE_CREATED',
        data: JSON.stringify({ projectId: project.id, scheduleId: schedule.id })
      }
    })

    successResponse(res, { schedule, monthly, totalNet, months }, 'Échéancier créé')
  } catch (e) { console.error(e); errorResponse(res) }
})

// Entrepreneur — voir son échéancier
router.get('/my/:projectId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schedule = await prisma.repaymentSchedule.findFirst({
      where: { projectId: req.params.projectId },
      include: { payments: { orderBy: { monthNumber: 'asc' } } }
    })
    successResponse(res, schedule)
  } catch (e) { errorResponse(res) }
})

// Entrepreneur — payer une mensualité
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

    if (!schedule) { res.status(404).json({ success: false, message: 'Échéancier introuvable' }); return }
    if (schedule.project.entrepreneurId !== req.userId) {
      res.status(403).json({ success: false, message: 'Non autorisé' }); return
    }

    const nextPayment = schedule.payments[0]
    if (!nextPayment) { res.status(400).json({ success: false, message: 'Aucun paiement en attente' }); return }

    // Vérifier solde wallet entrepreneur
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } })
    if (!wallet || wallet.balance < nextPayment.amount) {
      res.status(400).json({ success: false, message: `Solde insuffisant. Disponible: ${wallet?.balance?.toLocaleString() || 0} FCFA` }); return
    }

    const fees = await getFees()
    const baobabRate = fees.commission_baobab_return || 5
    const paydunyaRate = fees.paydunya_payout || 3
    const totalInvested = schedule.project.investments.reduce((s, i) => s + i.amount, 0)

    await prisma.$transaction(async (tx) => {
      // Débiter wallet entrepreneur
      await tx.wallet.update({
        where: { userId: req.userId! },
        data: { balance: { decrement: nextPayment.amount } }
      })

      // Distribuer proportionnellement aux investisseurs
      for (const inv of schedule.project.investments) {
        const proportion = totalInvested > 0 ? inv.amount / totalInvested : 0
        const investorShare = Math.round(nextPayment.amount * proportion)
        if (investorShare <= 0) continue

        await tx.wallet.update({
          where: { userId: inv.userId },
          data: {
            balance: { increment: investorShare },
            totalEarned: { increment: investorShare }
          }
        })

        await tx.notification.create({
          data: {
            userId: inv.userId,
            title: 'Remboursement recu',
            body: `Vous avez recu ${investorShare.toLocaleString()} FCFA du projet "${schedule.project.title}" (mensualite ${nextPayment.monthNumber}/${schedule.totalMonths}).`,
            type: 'REPAYMENT_RECEIVED',
            data: JSON.stringify({ projectId: schedule.projectId, amount: investorShare })
          }
        })
      }

      // Reverser commission BAOBAB
      const baobabFee = Math.round(nextPayment.amount * baobabRate / 100)
      await tx.platformRevenue.create({
        data: {
          type: 'COMMISSION_RETURN',
          amount: baobabFee,
          projectId: schedule.projectId,
          description: `Commission retour ${baobabRate}% — mensualite ${nextPayment.monthNumber} — ${schedule.project.title}`
        }
      })

      // Marquer paiement comme payé
      await tx.repaymentPayment.update({
        where: { id: nextPayment.id },
        data: { status: 'PAID', paidAt: new Date() }
      })

      // Mettre à jour le schedule
      const newPaid = schedule.paidMonths + 1
      const newRemaining = schedule.remainingAmount - nextPayment.amount
      const nextDue = new Date()
      nextDue.setMonth(nextDue.getMonth() + 1)
      await tx.repaymentSchedule.update({
        where: { id: schedule.id },
        data: {
          paidMonths: newPaid,
          remainingAmount: Math.max(0, newRemaining),
          nextDueDate: newPaid < schedule.totalMonths ? nextDue : null,
          status: newPaid >= schedule.totalMonths ? 'COMPLETED' : 'ACTIVE'
        }
      })

      // Si tout remboursé → projet COMPLETED
      if (newPaid >= schedule.totalMonths) {
        await tx.project.update({
          where: { id: schedule.projectId },
          data: { status: 'COMPLETED' }
        })
        await tx.notification.create({
          data: {
            userId: schedule.project.entrepreneurId,
            title: 'Felicitations ! Projet entierement rembourse',
            body: `Le projet "${schedule.project.title}" est entierement rembourse. Votre score de reputation augmente.`,
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
    }, `Mensualité ${nextPayment.monthNumber}/${schedule.totalMonths} payée`)
  } catch (e) { console.error(e); errorResponse(res) }
})

// Investisseur — voir les remboursements reçus
router.get('/investor/received', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId!, type: 'REPAYMENT_RECEIVED' },
      orderBy: { createdAt: 'desc' }
    })
    successResponse(res, notifications)
  } catch (e) { errorResponse(res) }
})

export default router
