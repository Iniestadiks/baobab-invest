// @ts-nocheck
import { Router, Response } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/helpers'
const router = Router()

// Route publique
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

// Sauver en BROUILLON seulement (pas encore actif)
router.patch('/:key', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { value } = req.body
    const { key } = req.params
    if (value === undefined || isNaN(Number(value))) {
      res.status(400).json({ success: false, message: 'Valeur invalide' }); return
    }
    const pctKeys = [
      'commission_baobab_collection', 'commission_mentor', 'commission_guarantee',
      'payin_recovery', 'payin_repayment', 'withdrawal_fee_standard', 'withdrawal_fee_no_invest',
      'return_min'
    ]
    const monthKeys = ['grace_period_agriculture', 'grace_period_other']
    if (pctKeys.includes(key) && (Number(value) < 0 || Number(value) > 50)) {
      res.status(400).json({ success: false, message: 'Taux doit être entre 0 et 50%' }); return
    }
    if (monthKeys.includes(key) && (Number(value) < 0 || Number(value) > 12)) {
      res.status(400).json({ success: false, message: 'Délai doit être entre 0 et 12 mois' }); return
    }
    // Sauver en brouillon uniquement
    const config = await prisma.platformConfig.update({
      where: { key },
      data: { draftValue: Number(value), updatedBy: req.userId }
    })
    successResponse(res, config, `"${config.label}" sauvegardé en brouillon — pas encore actif`)
  } catch (e) { errorResponse(res) }
})

// Confirmer et appliquer tous les brouillons
router.post('/confirm', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const drafts = await prisma.platformConfig.findMany({
      where: { draftValue: { not: null } }
    })
    if (drafts.length === 0) {
      res.status(400).json({ success: false, message: 'Aucun brouillon en attente' }); return
    }
    // Appliquer tous les brouillons → value
    for (const d of drafts) {
      await prisma.platformConfig.update({
        where: { key: d.key },
        data: { value: d.draftValue!, draftValue: null }
      })
    }
    successResponse(res, { applied: drafts.length }, `${drafts.length} taux appliqués sur tous les futurs projets ✅`)
  } catch (e) { errorResponse(res) }
})

// Annuler les brouillons
router.post('/cancel-draft', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.platformConfig.updateMany({
      where: { draftValue: { not: null } },
      data: { draftValue: null }
    })
    successResponse(res, {}, 'Brouillons annulés — taux actuels conservés')
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
        update: { value, draftValue: null },
        create: { key, value, label: key, description: key }
      })
    }
    successResponse(res, {}, 'Taux réinitialisés aux valeurs par défaut')
  } catch (e) { errorResponse(res) }
})

export default router
