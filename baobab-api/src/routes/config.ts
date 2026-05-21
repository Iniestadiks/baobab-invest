import { Router, Response } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/helpers'
const router = Router()

// Route publique — taux visibles par tous
router.get('/public', async (req, res): Promise<void> => {
  try {
    const configs = await prisma.platformConfig.findMany({ orderBy: { key: 'asc' } })
    res.json({ success: true, data: configs })
  } catch (e) { res.status(500).json({ success: false }) }
})

// Lire tous les taux (admin)
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const configs = await prisma.platformConfig.findMany({ orderBy: { key: 'asc' } })
    successResponse(res, configs)
  } catch (e) { errorResponse(res) }
})

// Mettre à jour un taux
router.patch('/:key', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { value } = req.body
    const { key } = req.params
    if (value === undefined || isNaN(Number(value))) {
      res.status(400).json({ success: false, message: 'Valeur invalide' }); return
    }
    // Clés de type pourcentage (0-50%)
    const pctKeys = [
      'commission_baobab_collection', 'commission_mentor', 'commission_guarantee',
      'payin_recovery', 'payin_repayment', 'withdrawal_fee_standard', 'withdrawal_fee_no_invest',
      'return_min'
    ]
    // Clés de type mois (0-12)
    const monthKeys = ['grace_period_agriculture', 'grace_period_other']

    if (pctKeys.includes(key)) {
      if (Number(value) < 0 || Number(value) > 50) {
        res.status(400).json({ success: false, message: 'Taux doit être entre 0 et 50%' }); return
      }
    }
    if (monthKeys.includes(key)) {
      if (Number(value) < 0 || Number(value) > 12) {
        res.status(400).json({ success: false, message: 'Délai doit être entre 0 et 12 mois' }); return
      }
    }
    const config = await prisma.platformConfig.update({
      where: { key },
      data: { value: Number(value), updatedBy: req.userId }
    })
    successResponse(res, config, `"${config.label}" mis à jour → ${value}`)
  } catch (e) { errorResponse(res) }
})

// Réinitialiser aux valeurs par défaut
router.post('/reset', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const defaults: Record<string, number> = {
      commission_baobab_collection: 5,
      payin_recovery: 4,
      commission_mentor: 2,
      commission_guarantee: 2,
      payin_repayment: 4,
      withdrawal_fee_standard: 3,
      withdrawal_fee_no_invest: 7,
      return_min: 22,
      grace_period_agriculture: 2,
      grace_period_other: 1,
    }
    for (const [key, value] of Object.entries(defaults)) {
      await prisma.platformConfig.upsert({
        where: { key },
        update: { value },
        create: { key, value, label: key, description: key }
      })
    }
    successResponse(res, {}, 'Taux réinitialisés aux valeurs par défaut')
  } catch (e) { errorResponse(res) }
})

export default router
