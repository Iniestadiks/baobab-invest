import { Router, Response } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/helpers'

const router = Router()

// Envoyer un message (lié à un projet ou non)
router.post('/send', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { toUserId, content, projectId } = req.body
    if (!toUserId || !content?.trim()) {
      res.status(400).json({ success: false, message: 'Destinataire et message obligatoires' })
      return
    }
    if (content.trim().length < 5) {
      res.status(400).json({ success: false, message: 'Message trop court (min 5 caractères)' })
      return
    }

    const recipient = await prisma.user.findUnique({ where: { id: toUserId }, select: { id: true, firstName: true, role: true } })
    if (!recipient) { res.status(404).json({ success: false, message: 'Destinataire introuvable' }); return }

    const sender = await prisma.user.findUnique({ where: { id: req.userId }, select: { firstName: true, lastName: true } })

    const message = await prisma.message.create({
      data: {
        fromUserId: req.userId!,
        toUserId,
        content: content.trim(),
        projectId: projectId || null,
      },
      include: {
        fromUser: { select: { id: true, firstName: true, lastName: true, role: true } },
        toUser: { select: { id: true, firstName: true, lastName: true, role: true } },
        project: { select: { id: true, title: true } },
      }
    })

    // Notification au destinataire
    await prisma.notification.create({
      data: {
        userId: toUserId,
        title: `💬 Message de ${sender?.firstName} ${sender?.lastName}`,
        body: content.substring(0, 80) + (content.length > 80 ? '...' : ''),
        type: 'MESSAGE',
        data: { fromUserId: req.userId, projectId: projectId || null }
      }
    })

    successResponse(res, message, 'Message envoyé')
  } catch (e) {
    console.error(e)
    errorResponse(res)
  }
})

// Mes conversations (liste des contacts avec dernier message)
router.get('/conversations', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ fromUserId: req.userId }, { toUserId: req.userId }]
      },
      include: {
        fromUser: { select: { id: true, firstName: true, lastName: true, role: true } },
        toUser: { select: { id: true, firstName: true, lastName: true, role: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' }
    })

    // Grouper par conversation (avec chaque contact)
    const conversations: Record<string, any> = {}
    for (const msg of messages) {
      const otherUser = msg.fromUserId === req.userId ? msg.toUser : msg.fromUser
      const key = otherUser.id
      if (!conversations[key]) {
        const unreadCount = await prisma.message.count({
          where: { fromUserId: otherUser.id, toUserId: req.userId, isRead: false }
        })
        conversations[key] = {
          contact: otherUser,
          lastMessage: msg,
          unreadCount,
          projectId: msg.projectId,
          project: msg.project,
        }
      }
    }

    successResponse(res, Object.values(conversations))
  } catch (e) {
    console.error(e)
    errorResponse(res)
  }
})

// Messages d'une conversation
router.get('/with/:userId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.query

    const where: any = {
      OR: [
        { fromUserId: req.userId, toUserId: req.params.userId },
        { fromUserId: req.params.userId, toUserId: req.userId },
      ]
    }
    if (projectId) where.projectId = String(projectId)

    const messages = await prisma.message.findMany({
      where,
      include: {
        fromUser: { select: { id: true, firstName: true, lastName: true, role: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'asc' }
    })

    // Marquer comme lus
    await prisma.message.updateMany({
      where: { fromUserId: req.params.userId, toUserId: req.userId, isRead: false },
      data: { isRead: true }
    })

    const contact = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: { id: true, firstName: true, lastName: true, role: true, city: true, reputationScore: true }
    })

    successResponse(res, { messages, contact })
  } catch (e) {
    console.error(e)
    errorResponse(res)
  }
})

// Nombre de messages non lus
router.get('/unread-count', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const count = await prisma.message.count({
      where: { toUserId: req.userId, isRead: false }
    })
    successResponse(res, { count })
  } catch {
    errorResponse(res)
  }
})

// Message groupé entrepreneur → tous ses investisseurs
router.post('/broadcast/:projectId', authenticate, requireRole(['ENTREPRENEUR']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params
    const { content: msgContent } = req.body

    if (!msgContent || msgContent.trim().length < 10) {
      res.status(400).json({ success: false, message: 'Message trop court (minimum 10 caractères)' })
      return
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { investments: { select: { userId: true } } }
    })

    if (!project || project.entrepreneurId !== req.userId) {
      res.status(403).json({ success: false, message: 'Non autorisé' })
      return
    }

    // Vérifier limite 7 jours
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentBroadcast = await prisma.message.findFirst({
      where: {
        fromUserId: req.userId,
        projectId,
        type: 'BROADCAST',
        createdAt: { gte: sevenDaysAgo }
      }
    })

    if (recentBroadcast) {
      const nextDate = new Date(recentBroadcast.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000)
      const daysLeft = Math.ceil((nextDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      res.status(429).json({ success: false, message: `Limite atteinte. Prochain envoi possible dans ${daysLeft} jour(s)` })
      return
    }

    // Investisseurs uniques
    const investorIds = [...new Set(project.investments.map(i => i.userId))]

    if (investorIds.length === 0) {
      res.status(400).json({ success: false, message: 'Aucun investisseur pour ce projet' })
      return
    }

    // Créer les messages + notifications
    const messagesData = investorIds.map(userId => ({
      fromUserId: req.userId!,
      toUserId: userId,
      content: `📢 [${project.title}] ${msgContent}`,
      projectId,
      type: 'BROADCAST',
    }))

    await prisma.message.createMany({ data: messagesData })

    // Notifications
    await prisma.notification.createMany({
      data: investorIds.map(userId => ({
        userId,
        title: `📢 Message de ${project.title}`,
        body: msgContent.substring(0, 100) + (msgContent.length > 100 ? '...' : ''),
        type: 'FEED_UPDATE',
        data: { projectId }
      }))
    })

    // Créer aussi un post dans le feed — remet à zéro le compteur 21j
    await prisma.post.create({
      data: {
        projectId,
        authorId: req.userId!,
        content: msgContent,
        type: 'UPDATE',
      }
    })

    // Réduire score réputation si inactivité — annuler la pénalité récente
    await prisma.user.update({
      where: { id: req.userId! },
      data: { reputationScore: { increment: 2 } }
    }).catch(() => {})

    successResponse(res, { sentTo: investorIds.length }, `Message envoyé à ${investorIds.length} investisseur(s)`)
  } catch (e) { console.error(e); errorResponse(res) }
})

export default router

// Upload pièce jointe dans un message
router.post('/upload-attachment', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const multer = require('multer')
    const path = require('path')
    const fs = require('fs')

    const storage = multer.diskStorage({
      destination: (r: any, f: any, cb: any) => {
        const dir = '/home/baobab-invest/baobab-api/uploads/messages'
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        cb(null, dir)
      },
      filename: (r: any, f: any, cb: any) => {
        cb(null, `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${path.extname(f.originalname)}`)
      }
    })

    const upload = multer({
      storage,
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (r: any, f: any, cb: any) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.doc', '.docx']
        const ext = path.extname(f.originalname).toLowerCase()
        if (allowed.includes(ext)) cb(null, true)
        else cb(new Error('Format non supporté'))
      }
    }).single('file')

    upload(req, res, async (err: any) => {
      if (err) { res.status(400).json({ success: false, message: err.message }); return }
      if (!req.file) { res.status(400).json({ success: false, message: 'Aucun fichier' }); return }

      const fileUrl = `/uploads/messages/${req.file.filename}`
      const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(req.file.originalname).toLowerCase())

      successResponse(res, {
        url: fileUrl,
        name: req.file.originalname,
        size: req.file.size,
        isImage,
        type: req.file.mimetype
      }, 'Fichier uploadé')
    })
  } catch (e) {
    console.error(e)
    errorResponse(res)
  }
})
