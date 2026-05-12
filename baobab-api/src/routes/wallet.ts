import { Router, Response } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/helpers'

const router = Router()

const OPERATORS = ['Orange Money', 'Wave', 'Free Money', 'Expresso', 'MTN MoMo']

// Demande de dépôt fictif (sera remplacé par webhook PayDunya)
router.post('/deposit', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount, phoneNumber, operator } = req.body

    if (!amount || amount < 1000) {
      res.status(400).json({ success: false, message: 'Montant minimum : 1 000 FCFA' }); return
    }
    if (!phoneNumber || !operator) {
      res.status(400).json({ success: false, message: 'Numéro et opérateur requis' }); return
    }
    if (!OPERATORS.includes(operator)) {
      res.status(400).json({ success: false, message: 'Opérateur non supporté' }); return
    }

    // Créer demande de dépôt en attente
    const deposit = await prisma.walletTransaction.create({
      data: {
        userId: req.userId!,
        type: 'DEPOSIT',
        amount,
        status: 'PENDING',
        phoneNumber,
        operator,
        description: `Dépôt ${operator} — ${phoneNumber}`,
      }
    })

    // Notification admin
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } })
    await prisma.notification.createMany({
      data: admins.map(a => ({
        userId: a.id,
        title: '💰 Nouvelle demande de dépôt',
        body: `Dépôt de ${amount.toLocaleString()} FCFA via ${operator}`,
        type: 'DEPOSIT_REQUEST',
        data: { transactionId: deposit.id }
      }))
    })

    successResponse(res, { transactionId: deposit.id }, 'Demande de dépôt enregistrée. En attente de validation (quelques minutes).')
  } catch (e) { console.error(e); errorResponse(res) }
})

// Demande de retrait
router.post('/withdraw', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount, phoneNumber, operator } = req.body

    if (!amount || amount < 5000) {
      res.status(400).json({ success: false, message: 'Montant minimum de retrait : 5 000 FCFA' }); return
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId } })
    if (!wallet || wallet.balance < amount) {
      res.status(400).json({ success: false, message: `Solde insuffisant. Disponible : ${wallet?.balance?.toLocaleString() || 0} FCFA` }); return
    }

    // Réserver les fonds
    await prisma.wallet.update({
      where: { userId: req.userId! },
      data: { balance: { decrement: amount } }
    })

    const withdrawal = await prisma.walletTransaction.create({
      data: {
        userId: req.userId!,
        type: 'WITHDRAWAL',
        amount,
        status: 'PENDING',
        phoneNumber,
        operator,
        description: `Retrait ${operator} — ${phoneNumber}`,
      }
    })

    // Notification admin
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } })
    await prisma.notification.createMany({
      data: admins.map(a => ({
        userId: a.id,
        title: '💸 Nouvelle demande de retrait',
        body: `Retrait de ${amount.toLocaleString()} FCFA via ${operator}`,
        type: 'WITHDRAWAL_REQUEST',
        data: { transactionId: withdrawal.id }
      }))
    })

    successResponse(res, { transactionId: withdrawal.id }, 'Demande de retrait enregistrée. Traitement sous 24h ouvrées.')
  } catch (e) { console.error(e); errorResponse(res) }
})

// Historique transactions wallet
router.get('/history', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const transactions = await prisma.walletTransaction.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId } })
    successResponse(res, { transactions, wallet })
  } catch (e) { errorResponse(res) }
})

// Admin — liste des demandes en attente
router.get('/admin/pending', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const pending = await prisma.walletTransaction.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { firstName: true, lastName: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' }
    })
    successResponse(res, pending)
  } catch (e) { errorResponse(res) }
})

// Admin — valider un dépôt
router.post('/admin/approve/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tx = await prisma.walletTransaction.findUnique({ where: { id: req.params.id } })
    if (!tx || tx.status !== 'PENDING') {
      res.status(400).json({ success: false, message: 'Transaction introuvable ou déjà traitée' }); return
    }

    await prisma.$transaction(async (p) => {
      // Mettre à jour la transaction
      await p.walletTransaction.update({
        where: { id: tx.id },
        data: { status: 'COMPLETED', processedAt: new Date() }
      })

      if (tx.type === 'DEPOSIT') {
        // Créditer le wallet
        await p.wallet.update({
          where: { userId: tx.userId },
          data: { balance: { increment: tx.amount }, totalDeposited: { increment: tx.amount } }
        })
        // Notifier l'utilisateur
        await p.notification.create({
          data: {
            userId: tx.userId,
            title: '✅ Dépôt confirmé !',
            body: `${tx.amount.toLocaleString()} FCFA ont été ajoutés à votre wallet.`,
            type: 'DEPOSIT_CONFIRMED',
            data: { amount: tx.amount }
          }
        })
      } else if (tx.type === 'WITHDRAWAL') {
        // Le wallet est déjà débité — juste confirmer
        await p.wallet.update({
          where: { userId: tx.userId },
          data: { totalWithdrawn: { increment: tx.amount } }
        })
        await p.notification.create({
          data: {
            userId: tx.userId,
            title: '✅ Retrait confirmé !',
            body: `${tx.amount.toLocaleString()} FCFA ont été envoyés sur votre ${tx.operator} (${tx.phoneNumber}).`,
            type: 'WITHDRAWAL_CONFIRMED',
            data: { amount: tx.amount }
          }
        })
      }
    })

    // TODO PayDunya: si retrait → appeler PayDunya Payout API ici
    // await paydunya.payout({ amount: tx.amount, phone: tx.phoneNumber, operator: tx.operator })

    successResponse(res, {}, 'Transaction validée')
  } catch (e) { console.error(e); errorResponse(res) }
})

// Admin — rejeter une demande
router.post('/admin/reject/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reason } = req.body
    const tx = await prisma.walletTransaction.findUnique({ where: { id: req.params.id } })
    if (!tx || tx.status !== 'PENDING') {
      res.status(400).json({ success: false, message: 'Transaction introuvable ou déjà traitée' }); return
    }

    await prisma.$transaction(async (p) => {
      await p.walletTransaction.update({
        where: { id: tx.id },
        data: { status: 'REJECTED', processedAt: new Date() }
      })
      // Si retrait rejeté → rembourser le wallet
      if (tx.type === 'WITHDRAWAL') {
        await p.wallet.update({
          where: { userId: tx.userId },
          data: { balance: { increment: tx.amount } }
        })
      }
      await p.notification.create({
        data: {
          userId: tx.userId,
          title: `❌ ${tx.type === 'DEPOSIT' ? 'Dépôt' : 'Retrait'} refusé`,
          body: reason || 'Votre demande a été refusée. Contactez le support.',
          type: 'TRANSACTION_REJECTED',
          data: { amount: tx.amount }
        }
      })
    })

    successResponse(res, {}, 'Transaction rejetée')
  } catch (e) { errorResponse(res) }
})

// Webhook PayDunya (placeholder — à brancher quand on a les clés)
router.post('/webhook/paydunya', async (req, res): Promise<void> => {
  try {
    const { status, invoice, custom_data } = req.body
    // TODO: vérifier la signature PayDunya
    // TODO: retrouver la transaction par custom_data.transactionId
    // TODO: créditer le wallet si status === 'completed'
    console.log('PayDunya webhook reçu:', { status, invoice: invoice?.token })
    res.json({ status: 'received' })
  } catch (e) { res.status(500).json({ error: 'Webhook error' }) }
})

export default router
