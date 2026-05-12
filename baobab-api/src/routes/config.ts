import { Router, Response } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/helpers'

const router = Router()

// Route publique — taux visibles par tous (sans auth)
router.get('/public', async (req, res): Promise<void> => {
  try {
    const configs = await prisma.platformConfig.findMany({ orderBy: { key: 'asc' } })
    res.json({ success: true, data: configs })
  } catch (e) { res.status(500).json({ success: false }) }
})

// Lire tous les taux (admin seulement)
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

    // Validations selon le type
    if (key.includes('commission') || key.includes('paydunya') || key.includes('return_min')) {
      if (Number(value) < 0 || Number(value) > 50) {
        res.status(400).json({ success: false, message: 'Taux doit être entre 0 et 50%' }); return
      }
    }

    const config = await prisma.platformConfig.update({
      where: { key },
      data: { value: Number(value), updatedBy: req.userId }
    })

    successResponse(res, config, `Taux "${config.label}" mis à jour → ${value}`)
  } catch (e) { errorResponse(res) }
})

// Réinitialiser aux valeurs par défaut
router.post('/reset', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const defaults: Record<string, number> = {
      commission_baobab_collection: 5,
      commission_mentor: 2,
      commission_guarantee: 2,
      commission_baobab_return: 5,
      paydunya_payin: 3,
      paydunya_payout: 2,
      return_min_with_mentor: 15,
      return_min_no_mentor: 17,
      investment_min: 5000,
      withdrawal_min: 5000,
    }
    for (const [key, value] of Object.entries(defaults)) {
      await prisma.platformConfig.update({ where: { key }, data: { value } })
    }
    successResponse(res, {}, 'Taux réinitialisés aux valeurs par défaut')
  } catch (e) { errorResponse(res) }
})

export default router
