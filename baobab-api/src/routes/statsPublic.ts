import { Router, Request, Response } from 'express'
import prisma from '../config/database'
import { successResponse } from '../utils/helpers'

const router = Router()

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [userCount, projectStats, fund, configRates] = await Promise.all([
      prisma.user.count({ where: { role: { not: 'ADMIN' }, isActive: true } }),
      prisma.project.aggregate({
        where: { status: { in: ['ACTIVE', 'FUNDED', 'IN_PROGRESS', 'COMPLETED'] } },
        _sum: { raisedAmount: true },
        _count: true,
      }),
      prisma.solidaryFund.findFirst(),
      prisma.platformConfig.findMany({
        where: { key: { in: ['commission_baobab_collection','commission_mentor','commission_guarantee','payin_repayment','return_min','withdrawal_fee_standard'] } },
      }),
    ])

    const activeProjects = await prisma.project.count({ where: { status: 'ACTIVE' } })
    const feeMap: Record<string, number> = {}
    configRates.forEach(c => { feeMap[c.key] = c.value })

    successResponse(res, {
      kpis: {
        totalUsers: userCount,
        totalRaised: projectStats._sum.raisedAmount || 0,
        activeProjects,
        totalProjects: projectStats._count,
      },
      fund: {
        totalReceived: fund?.totalReceived || 0,
        totalContributors: fund?.totalContributors || 0,
        totalProjects: fund?.totalProjects || 0,
      },
      config: configRates.map(c => ({ key: c.key, value: c.value })),
    })
  } catch (e) {
    console.error('[STATS PUBLIC]', e)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
})

export default router
