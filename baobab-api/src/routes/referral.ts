import { Router, Response } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/helpers'

const router = Router()
// Mon code de parrainage + stats
router.get('/my', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { referralCode: true, referralCount: true, referralEarned: true, firstName: true }
    })
    if (!user) { res.status(404).json({ success: false }); return }
    // Générer code si absent
    if (!user.referralCode) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase()
      await prisma.user.update({ where: { id: req.userId! }, data: { referralCode: code } })
      user.referralCode = code
    }
    // Filleuls — avec statut du bonus (payé ou en attente de conditions)
    const referrals = await prisma.user.findMany({
      where: { referredBy: req.userId },
      select: { firstName: true, createdAt: true, totalInvested: true, referralBonusPaid: true }
    })
    // Montant du bonus — réglable dans l'admin, pas codé en dur
    const bonusConfig = await prisma.platformConfig.findUnique({ where: { key: 'referral_bonus_amount' } })
    const bonusPerReferral = bonusConfig?.value ?? 2000
    const activeConfig = await prisma.platformConfig.findUnique({ where: { key: 'referral_program_active' } })
    const programActive = (activeConfig?.value ?? 1) === 1
    successResponse(res, {
      referralCode: user.referralCode,
      referralCount: user.referralCount || referrals.filter(r => r.referralBonusPaid).length,
      referralEarned: user.referralEarned || 0,
      bonusPerReferral,
      programActive,
      referrals,
      shareLink: `${process.env.FRONTEND_URL || 'http://46.202.132.161:3000'}/auth/register?ref=${user.referralCode}`,
    })
  } catch (e) { errorResponse(res) }
})
// Appliquer un code de parrainage (appelé au register)
router.post('/apply', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body
    if (!code) { res.status(400).json({ success: false, message: 'Code requis' }); return }
    const parrain = await prisma.user.findFirst({ where: { referralCode: code.toUpperCase() } })
    if (!parrain) { res.status(404).json({ success: false, message: 'Code invalide' }); return }
    if (parrain.id === req.userId) { res.status(400).json({ success: false, message: 'Vous ne pouvez pas vous parrainer vous-même' }); return }
    const me = await prisma.user.findUnique({ where: { id: req.userId } })
    if (me?.referredBy) { res.status(400).json({ success: false, message: 'Vous avez déjà un parrain' }); return }
    // Enregistrer UNIQUEMENT le lien parrain/filleul — AUCUN bonus versé ici.
    // Le bonus n'est payé que plus tard, quand : le filleul a vérifié son KYC
    // ET fait son 1er investissement, ET le parrain a lui-même déjà investi.
    // Voir services/referralService.ts (déclenché depuis investments.ts).
    await prisma.user.update({
      where: { id: req.userId! },
      data: { referredBy: parrain.id }
    })
    await prisma.notification.create({
      data: {
        userId: parrain.id,
        title: '🌱 Nouveau filleul inscrit !',
        body: `${me?.firstName || 'Un filleul'} a rejoint KORAPACT avec votre code. Le bonus sera crédité dès que vous aurez tous les deux investi.`,
        type: 'REFERRAL_PENDING',
        data: { filleulId: req.userId }
      }
    })
    successResponse(res, {}, 'Code appliqué ! Le bonus de parrainage sera versé dès que le filleul et le parrain auront investi.')
  } catch (e) { console.error(e); errorResponse(res) }
})
export default router
