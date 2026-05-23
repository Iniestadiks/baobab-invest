import { Router, Response } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { getFees } from '../config/fees'
import { addReputationPoints, awardBadge, checkAndAwardBadges, REPUTATION_POINTS } from '../services/reputationService'
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
    const guaranteeContrib = investments.reduce((s, i) => s + (i.guaranteeContribution || i.amount * 0.02), 0)
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId } })
    let totalReturned = 0
    const totalInvestedAllProjects = await prisma.investment.groupBy({
      by: ['projectId'], where: { project: { repaymentSchedules: { some: {} } } }, _sum: { amount: true }
    })
    const projectTotals: Record<string, number> = {}
    totalInvestedAllProjects.forEach(p => { projectTotals[p.projectId] = p._sum.amount || 1 })
    for (const inv of investments) {
      const schedule = await prisma.repaymentSchedule.findFirst({
        where: { projectId: inv.projectId },
        include: { payments: { where: { status: "PAID" } } }
      })
      if (!schedule || schedule.payments.length === 0) continue
      const totalProj = projectTotals[inv.projectId] || 1
      const proportion = inv.amount / totalProj
      const received = schedule.payments.reduce((s, p) => s + Math.round(p.amount * proportion), 0)
      totalReturned += received
    }
    res.json({
      success: true,
      data: {
        investments,
        totalInvested,
        totalExpected: totalExpectedBrut,
        totalReturned,
        projectsFunded: investments.filter(i => i.project?.status === "COMPLETED").length,
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
    if (!amount || amount < 5000) {
      res.status(400).json({ success: false, message: 'Montant minimum : 5 000 FCFA' }); return
    }
    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user || user.kycStatus !== 'VERIFIED') {
      res.status(403).json({ success: false, message: "KYC requis avant d'investir" }); return
    }
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) { res.status(404).json({ success: false, message: 'Projet introuvable' }); return }
    if (!['ACTIVE', 'FUNDED'].includes(project.status)) {
      res.status(400).json({ success: false, message: "Ce projet n'accepte plus d'investissements" }); return
    }
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId } })
    if (!wallet || wallet.balance < amount) {
      res.status(400).json({ success: false, message: `Solde insuffisant. Disponible : ${wallet?.balance?.toLocaleString() || 0} FCFA` }); return
    }

    // CALCUL DES COMMISSIONS — NOUVELLE STRATÉGIE FINANCIÈRE
    const fees = await getFees()
    const withInsurance = req.body.withInsurance !== false  // true par défaut
    const platformFee         = Math.round(amount * fees.commission_baobab_collection / 100)
    const payinFee            = Math.round(amount * fees.payin_recovery / 100)
    const mentorFee           = project.mentorId ? Math.round(amount * fees.commission_mentor / 100) : 0
    const guaranteeFee        = withInsurance ? Math.round(amount * fees.commission_guarantee / 100) : 0
    const reinvestedGuarantee = withInsurance ? 0 : Math.round(amount * fees.commission_guarantee / 100)
    const sharePercent        = amount / project.goalAmount
    const minRate             = fees.return_min
    const returnRate          = Math.max(project.expectedReturn || 0, minRate)
    const expectedReturn      = Math.round(amount * (1 + returnRate / 100))

    await prisma.$transaction(async (tx) => {
      // 1. Débiter wallet investisseur
      await tx.wallet.update({
        where: { userId: req.userId! },
          escrowBalance: { increment: amount },
          depositBalance: { decrement: amount },
      })
      // 2. Créer l'investissement
      await tx.investment.create({
        data: { userId: req.userId!, projectId, amount, status: 'PENDING', expectedReturn, guaranteeContribution: guaranteeFee, sharePercent }
      })
      // 3. Mettre à jour le projet
      const newRaised = project.raisedAmount + amount
      const newStatus = newRaised >= project.goalAmount ? 'FUNDED' : project.status
      await tx.project.update({
        where: { id: projectId },
        data: { raisedAmount: { increment: amount }, investorCount: { increment: 1 }, status: newStatus }
      })
      // 4. Créditer wallet admin : BAOBAB 5% + Payin 4%
      const adminUser = await tx.user.findFirst({ where: { role: 'ADMIN' } })
      if (adminUser) {
        await tx.wallet.update({
          where: { userId: adminUser.id },
          data: {
            balance: { increment: platformFee + payinFee },
            commissionBalance: { increment: platformFee + payinFee },
            guaranteeBalance: { increment: guaranteeFee },
          }
        })
      }
      await tx.platformRevenue.create({ data: { type: 'COMMISSION_COLLECTION', amount: platformFee, projectId, description: `Commission collecte 5% — ${project.title}` } })
      await tx.platformRevenue.create({ data: { type: 'PAYIN_RECOVERY', amount: payinFee, projectId, description: `Récupération Payin 4% — ${project.title}` } })
      if (guaranteeFee > 0) {
        await tx.platformRevenue.create({ data: { type: 'GUARANTEE_FEE', amount: guaranteeFee, projectId, description: `Assurance 2% — ${project.title}` } })
      }
      // 5. Créditer mentor 2%
      if (project.mentorId && mentorFee > 0) {
        await tx.wallet.update({ where: { userId: project.mentorId }, data: { balance: { increment: mentorFee } } })
        await tx.platformRevenue.create({ data: { type: 'MENTOR_COMMISSION', amount: mentorFee, projectId, description: `Commission mentor 2% — ${project.title}` } })
      }
      // 6. Notification entrepreneur
      await tx.notification.create({
        data: { userId: project.entrepreneurId, title: '💰 Nouvel investissement !', body: `${user.firstName} a investi ${amount.toLocaleString()} FCFA dans "${project.title}"`, type: 'INVESTMENT', data: { projectId, amount } }
      })
    })

    // Points de réputation investisseur
    const invCount = await prisma.investment.count({ where: { userId: req.userId! } })
    if (invCount === 1) await addReputationPoints(req.userId!, 'FIRST_INVESTMENT', REPUTATION_POINTS.FIRST_INVESTMENT, 'Premier investissement effectué', projectId)
    else await addReputationPoints(req.userId!, 'INVESTMENT_MADE', REPUTATION_POINTS.INVESTMENT_MADE, 'Nouvel investissement effectué', projectId)
    if (amount >= 1000000) await addReputationPoints(req.userId!, 'INVESTMENT_1M', REPUTATION_POINTS.INVESTMENT_1M, 'Investissement > 1 000 000 FCFA', projectId)
    else if (amount >= 500000) await addReputationPoints(req.userId!, 'INVESTMENT_500K', REPUTATION_POINTS.INVESTMENT_500K, 'Investissement > 500 000 FCFA', projectId)
    else if (amount >= 100000) await addReputationPoints(req.userId!, 'INVESTMENT_100K', REPUTATION_POINTS.INVESTMENT_100K, 'Investissement > 100 000 FCFA', projectId)
    else if (amount >= 50000) await addReputationPoints(req.userId!, 'INVESTMENT_50K', REPUTATION_POINTS.INVESTMENT_50K, 'Investissement > 50 000 FCFA', projectId)
    await checkAndAwardBadges(req.userId!, 'INVESTOR')

    successResponse(res, {
      expectedReturn, returnRate,
      withInsurance,
      fees: { platform: platformFee, payin: payinFee, mentor: mentorFee, guarantee: guaranteeFee },
      sharePercent: (sharePercent * 100).toFixed(4) + '%'
    }, `Investissement de ${amount.toLocaleString()} FCFA effectué !`)
  } catch (e) { console.error(e); errorResponse(res) }
})

// Admin — remboursement global projet
router.post('/reimburse-project/:projectId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: { investments: { include: { user: { select: { id: true, firstName: true } } } }, entrepreneur: { select: { id: true, firstName: true, lastName: true } }, mentor: { select: { id: true, firstName: true } } }
    })
    if (!project) { res.status(404).json({ success: false, message: 'Projet introuvable' }); return }
    if (!['FUNDED', 'IN_PROGRESS'].includes(project.status)) { res.status(400).json({ success: false, message: 'Projet non eligible' }); return }
    await prisma.project.update({ where: { id: project.id }, data: { status: 'IN_PROGRESS' } })
    const fees = await getFees()
    const netAmount = (project as any).netAmount || project.goalAmount
    const returnRate = Math.max(project.expectedReturn || 0, fees.return_min)
    const totalGross = Math.round(netAmount * (1 + returnRate / 100))
    const months = project.durationMonths || 12
    const monthly = Math.ceil(totalGross / months)
    const uniqueInvestors = [...new Set(project.investments.map((i: any) => i.userId))]
    await prisma.notification.create({
      data: { userId: project.entrepreneurId, title: 'Echéancier activé', body: `Remboursez ${monthly.toLocaleString()} FCFA/mois pendant ${months} mois. Total: ${totalGross.toLocaleString()} FCFA.`, type: 'REPAYMENT_SCHEDULE_CREATED', data: JSON.stringify({ projectId: project.id, monthly, months, total: totalGross }) }
    })
    for (const userId of uniqueInvestors) {
      const inv = project.investments.filter((i: any) => i.userId === userId)
      const invShare = inv.reduce((s: number, i: any) => s + (i.amount / project.goalAmount), 0)
      const invNet = Math.round(totalGross * invShare)
      await prisma.notification.create({
        data: { userId: userId as string, title: 'Remboursement en cours', body: `Le projet "${project.title}" entre en remboursement. Vous recevrez ~${Math.ceil(invNet/months).toLocaleString()} FCFA/mois.`, type: 'REPAYMENT_STARTED', data: JSON.stringify({ projectId: project.id }) }
      })
    }
    // Créer échéancier si pas encore fait
    const existing = await prisma.repaymentSchedule.findFirst({ where: { projectId: project.id } })
    if (!existing) {
      const gracePeriod = (project as any).gracePeriodMonths || 0
      const nextDue = new Date(); nextDue.setMonth(nextDue.getMonth() + 1 + gracePeriod)
      const schedule = await prisma.repaymentSchedule.create({
        data: { projectId: project.id, totalAmount: totalGross, monthlyAmount: monthly, totalMonths: months, remainingAmount: totalGross, nextDueDate: nextDue, status: 'ACTIVE' }
      })
      const paymentsData = Array.from({ length: months }, (_, i) => {
        const due = new Date(); due.setMonth(due.getMonth() + i + 1 + gracePeriod)
        return { scheduleId: schedule.id, projectId: project.id, amount: i === months-1 ? totalGross - monthly*(months-1) : monthly, monthNumber: i+1, dueDate: due, status: 'PENDING' }
      })
      await prisma.repaymentPayment.createMany({ data: paymentsData })
    }
    successResponse(res, {}, 'Projet en remboursement — échéancier créé')
  } catch (e) { console.error(e); errorResponse(res) }
})

// Plans d'épargne
router.get('/savings-plans', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId } })
    successResponse(res, { scheduledAmount: wallet?.scheduledAmount || 0, scheduledDay: wallet?.scheduledDay || null, isActive: (wallet?.scheduledAmount || 0) > 0 })
  } catch (e) { errorResponse(res) }
})

router.post('/savings-plan', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount, day } = req.body
    if (!amount || amount < 1000) { res.status(400).json({ success: false, message: 'Montant minimum 1000 FCFA' }); return }
    if (!day || day < 1 || day > 28) { res.status(400).json({ success: false, message: 'Jour invalide (1-28)' }); return }
    const wallet = await prisma.wallet.update({ where: { userId: req.userId! }, data: { scheduledAmount: amount, scheduledDay: day } })
    successResponse(res, { scheduledAmount: wallet.scheduledAmount, scheduledDay: wallet.scheduledDay }, 'Plan épargne activé')
  } catch (e) { errorResponse(res) }
})

router.post('/savings-config', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount, day } = req.body
    if (!amount || amount < 1000) { res.status(400).json({ success: false, message: 'Montant minimum 1 000 FCFA' }); return }
    if (!day || day < 1 || day > 28) { res.status(400).json({ success: false, message: 'Jour invalide (1-28)' }); return }
    await prisma.wallet.update({ where: { userId: req.userId! }, data: { scheduledAmount: amount, scheduledDay: day } })
    await prisma.notification.create({
      data: { userId: req.userId!, title: 'Épargne programmée configurée', body: `Votre épargne de ${amount.toLocaleString()} FCFA sera déposée automatiquement le ${day} de chaque mois.`, type: 'SAVINGS_CONFIGURED', data: JSON.stringify({ amount, day }) }
    })
    successResponse(res, { amount, day }, 'Épargne programmée configurée')
  } catch (e) { errorResponse(res) }
})

// Export CSV
router.get('/exports/admin', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const investments = await prisma.investment.findMany({
      include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } }, project: { select: { title: true, sector: true, status: true } } },
      orderBy: { createdAt: 'desc' }
    })
    const rows = ['Date,Investisseur,Email,Telephone,Projet,Secteur,Montant,Retour attendu,Statut']
    investments.forEach(i => {
      rows.push([new Date(i.createdAt).toLocaleDateString('fr-FR'), (i.user.firstName + ' ' + i.user.lastName).replace(',', ' '), i.user.email, i.user.phone || '', (i.project?.title || '').replace(',', ' '), i.project?.sector || '', i.amount, i.expectedReturn || 0, i.status].join(','))
    })
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="investissements-baobab.csv"')
    res.send('\uFEFF' + rows.join('\n'))
  } catch (e) { errorResponse(res) }
})

export default router
