// @ts-nocheck
import { Router, Response } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth'
import { getFees, getProjectFees } from '../config/fees'
import { triggerFundedActions } from '../services/paliers'
import { addReputationPoints, awardBadge, checkAndAwardBadges, REPUTATION_POINTS } from '../services/reputationService'
import { checkAndPayReferralBonus } from '../services/referralService'
import { successResponse, errorResponse } from '../utils/helpers'
const router = Router()

// Stats investisseur
router.get('/my', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const investments = await prisma.investment.findMany({
      where: { userId: req.userId },
      include: { project: { select: {
        title: true, sector: true, status: true, expectedReturn: true, id: true,
        goalAmount: true, raisedAmount: true, netAmount: true, durationMonths: true,
        feePayinRepaymentRate: true,
        entrepreneurId: true,
        entrepreneur: { select: { id: true, firstName: true, lastName: true, profileImageUrl: true } },
        mentor: { select: { id: true, firstName: true, lastName: true } }
      } } },
      orderBy: { createdAt: 'desc' }
    })
    const totalInvested = investments.reduce((s, i) => s + i.amount, 0)
    const totalExpectedBrut = investments.reduce((s, i) => s + (i.expectedReturn || 0), 0)
    // Taux de secours réel (config actuelle) au lieu d'un 2% codé en dur —
    // ne sert que pour les très rares investissements sans guaranteeContribution stocké.
    const guaranteeCfg = await prisma.platformConfig.findUnique({ where: { key: 'commission_guarantee' } })
    const guaranteeFallbackRate = guaranteeCfg ? parseFloat(String(guaranteeCfg.value)) / 100 : 0.02
    const guaranteeContrib = investments.reduce((s, i) => s + (i.guaranteeContribution || i.amount * guaranteeFallbackRate), 0)
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
    const invMinCfg = await prisma.platformConfig.findUnique({ where: { key: 'investment_min' } })
    const investMin = invMinCfg ? Number(invMinCfg.value) : 5000
    if (!amount || amount < investMin) {
      res.status(400).json({ success: false, message: `Montant minimum : ${investMin.toLocaleString()} FCFA` }); return
    }
    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user || user.kycStatus !== 'VERIFIED') {
      res.status(403).json({ success: false, message: "KYC requis avant d'investir" }); return
    }
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) { res.status(404).json({ success: false, message: 'Projet introuvable' }); return }
    if (project.status !== 'ACTIVE') {
      res.status(400).json({ success: false, message: "Ce projet n'accepte plus d'investissements" }); return
    }
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId } })
    // CALCUL DES COMMISSIONS — taux FIGÉS à la création du projet (jamais recalculés)
    const fees = await getProjectFees(project)
    const withInsurance = req.body.withInsurance === true  // false par défaut — choix explicite
    const platformFee  = Math.round(amount * fees.commission_baobab_collection / 100)
    const payinFee     = Math.round(amount * fees.payin_recovery / 100)
    const mentorFee    = project.mentorId ? Math.round(amount * fees.commission_mentor / 100) : 0
    const guaranteeFee = withInsurance ? Math.round(amount * fees.commission_guarantee / 100) : 0
    // Vérification solde : investissement + assurance si prise
    const totalRequired = amount + guaranteeFee
    if (!wallet || wallet.balance < totalRequired) {
      const manque = totalRequired - (wallet?.balance || 0)
      res.status(400).json({
        success: false,
        message: withInsurance
          ? `Solde insuffisant pour couvrir l'investissement et l'assurance. Il vous manque ${manque.toLocaleString()} FCFA — rechargez votre wallet.`
          : `Solde insuffisant. Disponible : ${wallet?.balance?.toLocaleString() || 0} FCFA`
      }); return
    }
    const sharePercent        = amount / project.goalAmount
    const minRate             = fees.return_min
    const returnRate          = Math.max(project.expectedReturn || 0, minRate)
    // Calcul correct du retour investisseur :
    // sharePercent = amount / goalAmount
    // netAmount = besoin net entrepreneur = goalAmount * (1 - frais%)
    // totalRemb = netAmount * (1 + returnRate/100)
    // payinRepay = totalRemb * payin_repayment%
    // investorReturn = (totalRemb - payinRepay) * sharePercent
    // + bonus si sans assurance
    // Modèle financier correct :
    // netAmount = ce que l'entrepreneur reçoit = goalAmount * (1 - frais_fixes)
    // frais_fixes = BAOBAB(6%) + payin(4%) + mentor(2% si actif)
    // Assurance = addon individuel, ne réduit pas la part projet
    const payinRepayPct = fees.payin_repayment || 4
    const fraisFixesPct = (fees.commission_baobab_collection + fees.payin_recovery + (project.mentorId ? fees.commission_mentor : 0)) / 100
    const netAmount = Math.round(project.goalAmount * (1 - fraisFixesPct))
    // Retour total remboursé par l'entrepreneur sur netAmount
    const totalRemb = Math.round(netAmount * (1 + returnRate / 100))
    // Payin prélevé sur les remboursements (4%)
    const payinRepay = Math.round(totalRemb * payinRepayPct / 100)
    const netDistributed = totalRemb - payinRepay
    // expectedReturn IDENTIQUE avec ou sans assurance
    // L'assurance est un coût séparé — elle ne change pas le retour brut
    // Sans assurance = gain net supérieur car coût total moindre
    const expectedReturn = Math.round(netDistributed * sharePercent)

    await prisma.$transaction(async (tx) => {
      // 0. Réservation atomique et conditionnelle de la place dans la cagnotte —
      // AVANT tout débit. Si deux investissements concurrents arrivent en même
      // temps, seul celui qui passe encore sous goalAmount au moment de l'écriture
      // réussit ; l'autre voit updateMany affecter 0 ligne et la transaction entière
      // est annulée (rollback automatique Prisma sur exception).
      const newRaised = project.raisedAmount + amount
      const newStatus = newRaised >= project.goalAmount ? 'FUNDED' : project.status
      const reserved = await tx.project.updateMany({
        where: { id: projectId, status: 'ACTIVE', raisedAmount: { lte: project.goalAmount - amount } },
        data: { raisedAmount: { increment: amount }, investorCount: { increment: 1 }, status: newStatus }
      })
      if (reserved.count === 0) {
        throw new Error('OVERFUND: objectif déjà atteint ou montant restant insuffisant pour cet investissement')
      }
      // 1. Débiter wallet investisseur
      // amount → escrow (investissement)
      // guaranteeFee → guaranteeBalance admin (assurance, si prise)
      await tx.wallet.update({
        where: { userId: req.userId! },
        data: {
          balance:        { decrement: totalRequired },  // amount + guaranteeFee
          escrowBalance:  { increment: amount },          // seul amount en escrow
          depositBalance: { decrement: totalRequired },
          totalInvested:  { increment: amount },
        }
      })
      // Enregistrer transaction investissement
      await tx.walletTransaction.create({
        data: {
          userId: req.userId!,
          type: 'INVESTMENT',
          amount,
          status: 'COMPLETED',
          description: `Investissement — ${project.title}`,
          processedAt: new Date()
        }
      })
      // Enregistrer transaction assurance séparément
      if (withInsurance && guaranteeFee > 0) {
        await tx.walletTransaction.create({
          data: {
            userId: req.userId!,
            type: 'INSURANCE',
            amount: guaranteeFee,
            status: 'COMPLETED',
            description: `Assurance capital 2% — ${project.title}`,
            processedAt: new Date()
          }
        })
      }
      // 2. Créer l'investissement
      await tx.investment.create({
        data: { userId: req.userId!, projectId, amount, status: 'PENDING', expectedReturn, guaranteeContribution: guaranteeFee, sharePercent }
      })
      // 4. Créditer wallet admin : BAOBAB commission% + Payin%
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
      await tx.platformRevenue.create({ data: { type: 'COMMISSION_COLLECTION', amount: platformFee, projectId, description: `Commission collecte ${fees.commission_baobab_collection}% — ${project.title}` } })
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
      // 7. Si projet FUNDED → déclencher paliers + échéancier automatique
      if (newStatus === 'FUNDED' && project.currentPalier === 0) {
        await triggerFundedActions(projectId, tx)
      }
      // 8. Vérifier si ce nouvel investissement déclenche un bonus de
      // parrainage (KYC + investissement des deux côtés — voir service)
      await checkAndPayReferralBonus(req.userId!, tx)
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
  } catch (e: any) {
    if (e?.message?.startsWith('OVERFUND')) {
      res.status(409).json({ success: false, message: "Ce montant dépasse ce qu'il reste à lever sur ce projet — quelqu'un vient probablement d'investir en même temps que vous. Réessayez avec un montant plus faible." })
      return
    }
    console.error(e); errorResponse(res)
  }
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
router.get('/exports/admin', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
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