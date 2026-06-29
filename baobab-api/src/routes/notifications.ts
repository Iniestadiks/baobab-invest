// @ts-nocheck
import { Router, Response } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/helpers'

const router = Router()

router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const unreadCount = await prisma.notification.count({ where: { userId: req.userId, isRead: false } })
    successResponse(res, { notifications, unreadCount })
  } catch {
    errorResponse(res)
  }
})

router.patch('/read-all', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.userId, isRead: false }, data: { isRead: true } })
    successResponse(res, null, 'Notifications marquées comme lues')
  } catch {
    errorResponse(res)
  }
})

// POST /:id/read — marquer une notif comme lue (alternative PATCH)
router.post('/:id/read', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.userId }
    , data: { isRead: true } })
    successResponse(res, {}, 'Lu')
  } catch (e) { errorResponse(res) }
})

// POST /:id/delete — supprimer une notification
router.post('/:id/delete', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.deleteMany({
      where: { id: req.params.id, userId: req.userId }
    })
    successResponse(res, {}, 'Supprimée')
  } catch (e) { errorResponse(res) }
})

// DELETE /:id — supprimer une notification (REST)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.deleteMany({
      where: { id: req.params.id, userId: req.userId }
    })
    successResponse(res, {}, 'Supprimée')
  } catch (e) { errorResponse(res) }
})

// POST /read-all — marquer toutes comme lues
router.post('/read-all', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.userId, isRead: false },
      data: { isRead: true }
    })
    successResponse(res, {}, 'Toutes lues')
  } catch (e) { errorResponse(res) }
})

export default router

// Marquer une notification spécifique comme lue
router.patch('/:id/read', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.update({
      where: { id: req.params.id, userId: req.userId },
      data: { isRead: true }
    })
    successResponse(res, null, 'Lu')
  } catch {
    errorResponse(res)
  }
})
