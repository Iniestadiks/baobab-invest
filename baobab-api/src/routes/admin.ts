import { Router, Response } from 'express'
import prisma from '../config/database'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/helpers'

const router = Router()

// Liste tous les utilisateurs
router.get('/users', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, role, search } = req.query
    const where: any = {}
    if (status && status !== 'ALL') where.kycStatus = status
    if (role && role !== 'ALL') where.role = role
    if (search) where.OR = [
      { firstName: { contains: String(search), mode: 'insensitive' } },
      { lastName: { contains: String(search), mode: 'insensitive' } },
      { email: { contains: String(search), mode: 'insensitive' } },
    ]
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        phone: true, role: true, city: true, country: true,
        kycStatus: true, kycDocumentUrl: true, kycSelfieUrl: true,
        kycRccmUrl: true, kycSubmittedAt: true, kycVerifiedAt: true,
        kycRejectedReason: true, kycDocumentExpiry: true, kycDocumentType: true,
        kycAttempts: true, kycNotes: true,
        isActive: true, isBanned: true, banReason: true,
        reputationScore: true, level: true, referralCode: true, referralCount: true,
        wallet: { select: { balance: true, escrowBalance: true, totalInvested: true } },
        city: true, country: true, level: true, totalInvested: true,
        createdAt: true,
      }
    })
    successResponse(res, users)
  } catch {
    errorResponse(res)
  }
})

// Valider KYC
router.post('/users/:id/verify-kyc', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { kycStatus: 'VERIFIED', kycVerifiedAt: new Date() }
    })
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: '✅ KYC Validé !',
        body: 'Ton identité a été vérifiée. Tu peux maintenant investir et retirer des fonds.',
        type: 'KYC_VERIFIED',
      }
    })
    successResponse(res, user, 'KYC validé')
  } catch {
    errorResponse(res)
  }
})

// Rejeter KYC
router.post('/users/:id/reject-kyc', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reason } = req.body
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { kycStatus: 'REJECTED', kycRejectedReason: reason }
    })
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: '❌ KYC Rejeté',
        body: `Raison : ${reason}. Merci de soumettre à nouveau tes documents.`,
        type: 'KYC_REJECTED',
      }
    })
    successResponse(res, user, 'KYC rejeté')
  } catch {
    errorResponse(res)
  }
})

// Bannir un utilisateur
router.post('/users/:id/ban', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reason } = req.body
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isBanned: true, isActive: false, banReason: reason, bannedAt: new Date() }
    })
    successResponse(res, user, 'Utilisateur banni')
  } catch {
    errorResponse(res)
  }
})

// Réhabiliter un utilisateur
router.post('/users/:id/unban', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isBanned: false, isActive: true, banReason: null, rehabilitationAt: new Date() }
    })
    successResponse(res, user, 'Utilisateur réhabilité')
  } catch {
    errorResponse(res)
  }
})

// Stats globales
router.get('/stats', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [
      totalUsers, totalProjects, activeProjects,
      pendingProjects, totalInvestments, pendingKyc,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.project.count({ where: { status: 'PENDING' } }),
      prisma.project.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.investment.count(),
      prisma.user.count({ where: { kycStatus: 'PENDING' } }),
    ])
    successResponse(res, {
      totalUsers, totalProjects, activeProjects,
      pendingProjects, totalInvestments, pendingKyc,
    })
  } catch {
    errorResponse(res)
  }
})

// Changer le rôle d'un utilisateur
router.patch('/users/:userId/role', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.body
    const validRoles = ['INVESTOR','ENTREPRENEUR','MENTOR','ADMIN']
    if (!validRoles.includes(role)) {
      res.status(400).json({ success: false, message: 'Rôle invalide' }); return
    }
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: { role }
    })
    successResponse(res, user, `Rôle modifié en ${role}`)
  } catch (e) { errorResponse(res) }
})

// Finances détaillées admin — par projet
router.get('/finances/details', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projects = await prisma.project.findMany({
      include: {
        investments: { select: { amount: true, expectedReturn: true, status: true, createdAt: true, user: { select: { firstName: true, lastName: true } } } },
        milestones: { include: { payments: { include: { supplier: { select: { companyName: true } } } } } },
        entrepreneur: { select: { firstName: true, lastName: true } },
        mentor: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' }
    })

    const fees = await prisma.platformConfig.findMany()
    const feeMap: any = {}
    fees.forEach((f: any) => { feeMap[f.key] = f.value })

    const projectsDetails = projects.map(p => {
      const totalInvested = p.investments.reduce((s, i) => s + i.amount, 0)
      const totalExpectedReturn = p.investments.reduce((s, i) => s + (i.expectedReturn || 0), 0)
      const baobabOnCollection = Math.round(totalInvested * (feeMap.commission_baobab_collection || 5) / 100)
      const mentorFee = p.mentorId ? Math.round(totalInvested * (feeMap.commission_mentor || 2) / 100) : 0
      const guaranteeFee = Math.round(totalInvested * (feeMap.commission_guarantee || 2) / 100)
      const paydunyaPayin = Math.round(totalInvested * (feeMap.paydunya_payin || 3) / 100)
      const cagnotteNette = totalInvested - baobabOnCollection - mentorFee - guaranteeFee
      // Au remboursement (projections)
      const baobabOnReturn = Math.round(totalExpectedReturn * (feeMap.commission_baobab_return || 5) / 100)
      const paydunyaPayout = Math.round(totalExpectedReturn * (feeMap.paydunya_payout || 2) / 100)
      const netInvestors = totalExpectedReturn - baobabOnReturn - paydunyaPayout
      // Fournisseurs payés
      const totalFournisseurs = p.milestones.reduce((s, m) =>
        s + m.payments.filter((pay: any) => pay.status === 'COMPLETED').reduce((ss: number, pay: any) => ss + pay.amount, 0), 0)
      const fournisseursPending = p.milestones.reduce((s, m) =>
        s + m.payments.filter((pay: any) => pay.status === 'PENDING').reduce((ss: number, pay: any) => ss + pay.amount, 0), 0)
      // Revenu net BAOBAB sur ce projet
      const revenueNetBAOBABProjet = baobabOnCollection - paydunyaPayin + (p.status === 'COMPLETED' ? baobabOnReturn - paydunyaPayout : 0)

      return {
        id: p.id,
        title: p.title,
        sector: p.sector,
        status: p.status,
        entrepreneur: `${p.entrepreneur?.firstName} ${p.entrepreneur?.lastName}`,
        mentor: p.mentor ? `${p.mentor?.firstName} ${p.mentor?.lastName}` : null,
        goalAmount: p.goalAmount,
        totalInvested,
        cagnotteNette,
        investorCount: p.investments.length,
        expectedReturn: p.expectedReturn,
        totalExpectedReturn,
        netInvestors,
        baobabOnCollection,
        mentorFee,
        guaranteeFee,
        paydunyaPayin,
        baobabOnReturn,
        paydunyaPayout,
        revenueNetBAOBABProjet,
        totalFournisseurs,
        fournisseursPending,
        milestones: p.milestones.map(m => ({
          title: m.title,
          amount: m.amount,
          status: m.status,
          payments: m.payments.map((pay: any) => ({
            supplier: pay.supplier?.companyName,
            amount: pay.amount,
            status: pay.status,
          }))
        })),
        investors: p.investments.map(i => ({
          name: `${i.user?.firstName} ${i.user?.lastName}`,
          amount: i.amount,
          expectedReturn: i.expectedReturn,
          netReturn: Math.round((i.expectedReturn || 0) * (1 - (feeMap.commission_baobab_return||5)/100 - (feeMap.paydunya_payout||2)/100)),
          date: i.createdAt,
          status: i.status
        }))
      }
    })

    successResponse(res, { projects: projectsDetails })
  } catch (e) { console.error(e); errorResponse(res) }
})

export default router

// Stats globales graphiques admin
router.get('/stats/charts', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [users, projects, investments] = await Promise.all([
      prisma.user.findMany({ select: { role: true, createdAt: true, kycStatus: true } }),
      prisma.project.findMany({ select: { sector: true, status: true, raisedAmount: true, goalAmount: true, createdAt: true } }),
      prisma.investment.findMany({ select: { amount: true, expectedReturn: true, createdAt: true, status: true } })
    ])

    // Inscriptions par mois
    const usersByMonth: Record<string, number> = {}
    users.forEach(u => {
      const key = new Date(u.createdAt).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
      usersByMonth[key] = (usersByMonth[key] || 0) + 1
    })
    const usersTimeline = Object.entries(usersByMonth).map(([date, count]) => ({ date, count }))

    // Investissements par mois
    const investByMonth: Record<string, number> = {}
    investments.forEach(inv => {
      const key = new Date(inv.createdAt).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
      investByMonth[key] = (investByMonth[key] || 0) + inv.amount
    })
    const investTimeline = Object.entries(investByMonth).map(([date, montant]) => ({ date, montant }))

    // Répartition par rôle
    const roleData = [
      { name: 'Investisseurs', value: users.filter(u => u.role === 'INVESTOR').length },
      { name: 'Entrepreneurs', value: users.filter(u => u.role === 'ENTREPRENEUR').length },
      { name: 'Mentors', value: users.filter(u => u.role === 'MENTOR').length },
    ]

    // Projets par secteur
    const sectorData: Record<string, number> = {}
    projects.forEach(p => {
      sectorData[p.sector] = (sectorData[p.sector] || 0) + 1
    })
    const sectorChart = Object.entries(sectorData).map(([name, value]) => ({ name, value }))

     // KPIs globaux enrichis
     const fees = await prisma.platformConfig.findMany()
     const feeMap: any = {}
     fees.forEach((f: any) => { feeMap[f.key] = parseFloat(f.value) })
     const totalRaisedBrut = investments.reduce((s, i) => s + i.amount, 0)
     const fraisTaux = (feeMap.commission_baobab_collection||5) + (feeMap.commission_mentor||2) + (feeMap.commission_guarantee||2)
     const totalCagnotteNette = Math.round(totalRaisedBrut * (1 - fraisTaux/100))
     const totalExpectedReturn = investments.reduce((s, i) => s + (i.expectedReturn||0), 0)
     const totalNetInvestors = Math.round(totalExpectedReturn * (1 - (feeMap.commission_baobab_return||5)/100 - (feeMap.paydunya_payout||2)/100))
     const revs = await prisma.platformRevenue.findMany()
     const revByType: any = {}
     revs.forEach((r: any) => { revByType[r.type] = (revByType[r.type]||0) + r.amount })
     const revenuNetBAOBAB = (revByType['COMMISSION_COLLECTION']||0) - Math.abs(revByType['PAYDUNYA_FEE']||0)
     const activeProjects = projects.filter(p => p.status === 'ACTIVE').length
     const fundedProjects = projects.filter(p => p.status === 'FUNDED').length
     const completedProjects = projects.filter(p => p.status === 'COMPLETED').length
     const kycVerified = users.filter(u => u.kycStatus === 'VERIFIED').length
     const kycPending = users.filter(u => u.kycStatus === 'PENDING').length
     const totalInvestors = users.filter(u => u.role === 'INVESTOR').length
     const totalEntrepreneurs = users.filter(u => u.role === 'ENTREPRENEUR').length
     const totalMentors = users.filter(u => u.role === 'MENTOR').length
     const avgInvestment = investments.length > 0 ? Math.round(totalRaisedBrut / investments.length) : 0
     // Investissements par mois avec brut et net
     const investByMonthBrut: Record<string, number> = {}
     const investByMonthNet: Record<string, number> = {}
     investments.forEach(inv => {
       const key = new Date(inv.createdAt).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
       investByMonthBrut[key] = (investByMonthBrut[key]||0) + inv.amount
       investByMonthNet[key] = (investByMonthNet[key]||0) + Math.round(inv.amount * (1 - fraisTaux/100))
     })
     const investTimelineEnriched = Object.keys(investByMonthBrut).map(date => ({
       date, montant: investByMonthBrut[date], net: investByMonthNet[date]
     }))
     successResponse(res, {
       usersTimeline, investTimeline: investTimelineEnriched, roleData, sectorChart,
       kpis: {
         totalUsers: users.length, totalRaised: totalRaisedBrut,
         totalCagnotteNette, totalExpectedReturn, totalNetInvestors,
         revenuNetBAOBAB, activeProjects, fundedProjects, completedProjects,
         kycVerified, kycPending, kycRate: Math.round((kycVerified / users.length) * 100),
         totalInvestments: investments.length, feeMap, totalInvestors, totalEntrepreneurs, totalMentors, avgInvestment
       }
     })
  } catch (e) {
    console.error(e)
    errorResponse(res)
  }
})

// Vérifier les projets sans post depuis 21 jours
router.post('/check-inactive-projects', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const twentyOneDaysAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)

    const activeProjects = await prisma.project.findMany({
      where: { status: { in: ['ACTIVE', 'IN_PROGRESS'] } },
      include: {
        posts: { orderBy: { createdAt: 'desc' }, take: 1 },
        entrepreneur: { select: { firstName: true, lastName: true } },
        investments: { select: { userId: true } }
      }
    })

    let alertCount = 0
    for (const project of activeProjects) {
      const lastPost = project.posts[0]
      const isInactive = !lastPost || new Date(lastPost.createdAt) < twentyOneDaysAgo

      if (isInactive) {
        // Notifier l'entrepreneur
        await prisma.notification.create({
          data: {
            userId: project.entrepreneurId,
            title: '⚠️ Rapport mensuel requis !',
            body: `Ton projet "${project.title}" n'a pas eu de mise à jour depuis plus de 21 jours. Publie un rapport maintenant pour rassurer tes investisseurs et maintenir ton score de réputation.`,
            type: 'INACTIVITY_ALERT',
            data: { projectId: project.id }
          }
        })

        // Réduire le score de réputation
        await prisma.user.update({
          where: { id: project.entrepreneurId },
          data: { reputationScore: { decrement: 5 } }
        })

        // Notifier les investisseurs
        const uniqueInvestors = [...new Set(project.investments.map(i => i.userId))]
        if (uniqueInvestors.length > 0) {
          await prisma.notification.createMany({
            data: uniqueInvestors.map(userId => ({
              userId,
              title: '📭 Pas de nouvelles du projet',
              body: `Aucune mise à jour de "${project.title}" depuis 21 jours. L'équipe BAOBAB INVEST surveille la situation.`,
              type: 'PROJECT_INACTIVITY',
              data: { projectId: project.id }
            }))
          })
        }

        alertCount++
      }
    }

    successResponse(res, { alertCount, projectsChecked: activeProjects.length }, `${alertCount} alerte(s) envoyée(s)`)
  } catch (e) {
    console.error(e)
    errorResponse(res)
  }
})

// Rembourser les investisseurs d'un projet terminé
router.post('/projects/:projectId/reimburse', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: { investments: { include: { user: { include: { wallet: true } } } } }
    })

    if (!project) { res.status(404).json({ success: false, message: 'Projet introuvable' }); return }
    if (project.status === 'COMPLETED') { res.status(400).json({ success: false, message: 'Projet déjà remboursé' }); return }

    let totalReimbursed = 0
    const results = []

    for (const inv of project.investments) {
      if (!inv.user.wallet) continue
      const commission = inv.expectedReturn * 0.04
      const mentorCommission = inv.expectedReturn * 0.01
      const netReturn = inv.expectedReturn - commission - mentorCommission
      const totalReceived = inv.amount + netReturn

      await prisma.$transaction([
        prisma.wallet.update({
          where: { userId: inv.userId },
          data: {
            balance: { increment: totalReceived },
            escrowBalance: { decrement: inv.amount },
            totalEarned: { increment: netReturn },
          }
        }),
        prisma.investment.update({
          where: { id: inv.id },
          data: { status: 'COMPLETED', returnedAmount: totalReceived }
        }),
        prisma.transaction.create({
          data: {
            userId: inv.userId,
            type: 'RETURN',
            amount: totalReceived,
            status: 'COMPLETED',
            description: `Remboursement projet "${project.title}" — Capital + retour net`,
          }
        }),
        prisma.notification.create({
          data: {
            userId: inv.userId,
            title: '🎉 Remboursement reçu !',
            body: `Tu as reçu ${totalReceived.toLocaleString()} FCFA du projet "${project.title}" (capital + retour net après commissions).`,
            type: 'REIMBURSEMENT',
            data: { projectId: project.id }
          }
        }),
      ])

      totalReimbursed += totalReceived
      results.push({ investor: `${inv.user.firstName} ${inv.user.lastName}`, received: totalReceived })
    }

    // Si mentor, lui verser sa commission
    if (project.mentorId) {
      const totalMentorCommission = project.investments.reduce((s, i) => s + (i.expectedReturn * 0.01), 0)
      const mentorWallet = await prisma.wallet.findUnique({ where: { userId: project.mentorId } })
      if (mentorWallet) {
        await prisma.wallet.update({
          where: { userId: project.mentorId },
          data: { balance: { increment: totalMentorCommission } }
        })
        await prisma.notification.create({
          data: {
            userId: project.mentorId,
            title: '💰 Commission mentor reçue !',
            body: `Tu as reçu ${totalMentorCommission.toLocaleString()} FCFA de commission (1%) pour ton parrainage de "${project.title}".`,
            type: 'MENTOR_COMMISSION',
          }
        })
      }
    }

    await prisma.project.update({ where: { id: req.params.projectId }, data: { status: 'COMPLETED' } })

    successResponse(res, { totalReimbursed, investorsReimbursed: results.length, details: results },
      `✅ ${results.length} investisseur(s) remboursé(s) — ${totalReimbursed.toLocaleString()} FCFA distribués`)
  } catch (e) {
    console.error(e)
    errorResponse(res)
  }
})

// Revenus de la plateforme BAOBAB INVEST
router.get('/platform-revenues', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const revenues = await prisma.platformRevenue.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const byType: Record<string, number> = {}
    revenues.forEach(r => { byType[r.type] = (byType[r.type] || 0) + r.amount })
    const byMonth: Record<string, number> = {}
    revenues.forEach(r => {
      const key = new Date(r.createdAt).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
      byMonth[key] = (byMonth[key] || 0) + r.amount
    })
    const revenuBrutBAOBAB = (byType['COMMISSION_COLLECTION'] || 0) + (byType['COMMISSION_RETURN'] || 0)
    const coutPaydunya = Math.abs(byType['PAYDUNYA_FEE'] || 0)
    const revenueNetBAOBAB = revenuBrutBAOBAB - coutPaydunya
    const totalMentorCommission = byType['MENTOR_COMMISSION'] || 0
    const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0)
    successResponse(res, {
      revenues,
      totalRevenue,
      revenuBrutBAOBAB,
      coutPaydunya,
      revenueNetBAOBAB,
      totalMentorCommission,
      byType,
      byMonth: Object.entries(byMonth).map(([date, amount]) => ({ date, amount })),
      projectionAnnuelle: revenueNetBAOBAB * 12,
    })
  } catch (e) {
    console.error(e)
    errorResponse(res)
  }
})

// Jalons soumis en attente de validation admin
router.get('/milestones/pending', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const milestones = await prisma.milestone.findMany({
      where: { status: 'SUBMITTED' },
      include: {
        project: {
          select: {
            id: true, title: true, raisedAmount: true,
            entrepreneur: { select: { id: true, firstName: true, lastName: true, email: true } }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })
    successResponse(res, milestones)
  } catch (e) {
    console.error(e)
    errorResponse(res)
  }
})

// Approuver un jalon
router.patch('/milestones/:id/approve', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { adminNote } = req.body
    const milestone = await prisma.milestone.findUnique({
      where: { id: req.params.id },
      include: { project: { select: { title: true, entrepreneurId: true } } }
    })
    if (!milestone) { res.status(404).json({ success: false, message: 'Jalon introuvable' }); return }

    const updated = await prisma.milestone.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED', adminNote: adminNote || 'Approuvé', paidAt: new Date() }
    })

    // Notifier l'entrepreneur
    await prisma.notification.create({
      data: {
        userId: milestone.project.entrepreneurId,
        title: '✅ Jalon approuvé !',
        body: `Le jalon "${milestone.title}" (${milestone.amount.toLocaleString()} FCFA) a été validé. Les fonds vont être débloqués.`,
        type: 'MILESTONE_APPROVED',
        data: { projectId: milestone.projectId }
      }
    })

    successResponse(res, updated, 'Jalon approuvé')
  } catch (e) {
    console.error(e)
    errorResponse(res)
  }
})

// Rejeter un jalon
router.patch('/milestones/:id/reject', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { adminNote } = req.body
    if (!adminNote) { res.status(400).json({ success: false, message: 'Raison de rejet obligatoire' }); return }

    const milestone = await prisma.milestone.findUnique({
      where: { id: req.params.id },
      include: { project: { select: { title: true, entrepreneurId: true } } }
    })
    if (!milestone) { res.status(404).json({ success: false, message: 'Jalon introuvable' }); return }

    const updated = await prisma.milestone.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED', adminNote }
    })

    await prisma.notification.create({
      data: {
        userId: milestone.project.entrepreneurId,
        title: '❌ Jalon refusé',
        body: `Le jalon "${milestone.title}" a été refusé. Raison : ${adminNote}`,
        type: 'MILESTONE_REJECTED',
        data: { projectId: milestone.projectId }
      }
    })

    successResponse(res, updated, 'Jalon rejeté')
  } catch (e) {
    console.error(e)
    errorResponse(res)
  }
})

// Admin — détail complet d'un utilisateur
router.get('/users/:id/wallet', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.params.id } })
    successResponse(res, wallet)
  } catch (e) { errorResponse(res) }
})

router.get('/users/:id/investments', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const investments = await prisma.investment.findMany({
      where: { userId: req.params.id },
      include: { project: { select: { title: true, sector: true, status: true } } },
      orderBy: { createdAt: 'desc' }
    })
    successResponse(res, investments)
  } catch (e) { errorResponse(res) }
})

router.get('/users/:id/projects', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projects = await prisma.project.findMany({
      where: { entrepreneurId: req.params.id },
      orderBy: { createdAt: 'desc' }
    })
    successResponse(res, projects)
  } catch (e) { errorResponse(res) }
})

router.get('/users/:id/transactions', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const txs = await prisma.walletTransaction.findMany({
      where: { userId: req.params.id },
      orderBy: { createdAt: 'desc' }
    })
    successResponse(res, txs)
  } catch (e) { errorResponse(res) }
})

router.get('/users/:id/notifications', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifs = await prisma.notification.findMany({
      where: { userId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
    successResponse(res, notifs)
  } catch (e) { errorResponse(res) }
})
