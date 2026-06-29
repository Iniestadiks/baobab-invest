// @ts-nocheck
import { Router, Response } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/helpers'

const router = Router()

// Feed d'un projet (privé — investisseurs seulement)
router.get('/project/:projectId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projectId = req.params.projectId
    const investment = await prisma.investment.findFirst({
      where: { projectId, userId: req.userId }
    })
    const project = await prisma.project.findUnique({ where: { id: projectId } })

    const isEntrepreneur = project?.entrepreneurId === req.userId
    const isMentor = project?.mentorId === req.userId

    if (!investment && !isEntrepreneur && !isMentor) {
      res.status(403).json({ success: false, message: 'Accès réservé aux investisseurs de ce projet' })
      return
    }

    const posts = await prisma.post.findMany({
      where: { projectId },
      include: {
        author: { select: { firstName: true, lastName: true, profileImageUrl: true, role: true } },
        reactions: { where: { userId: req.userId }, select: { type: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    successResponse(res, posts)
  } catch {
    errorResponse(res)
  }
})

// Publier un post (entrepreneur)
router.post('/project/:projectId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { content, mediaUrls } = req.body
    const projectId = req.params.projectId

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project || project.entrepreneurId !== req.userId) {
      res.status(403).json({ success: false, message: 'Non autorisé' })
      return
    }
    if (!content || content.length < 20) {
      res.status(400).json({ success: false, message: 'Le post doit faire au moins 20 caractères' })
      return
    }

    const post = await prisma.post.create({
      data: { authorId: req.userId!, projectId, content, mediaUrls: mediaUrls || [] },
      include: { author: { select: { firstName: true, lastName: true } } }
    })

    // Notifier tous les investisseurs
    const investors = await prisma.investment.findMany({
      where: { projectId },
      select: { userId: true }
    })
    const uniqueInvestors = [...new Set(investors.map(i => i.userId))]
    await prisma.notification.createMany({
      data: uniqueInvestors.map(userId => ({
        userId,
        title: '📸 Nouvelle mise à jour',
        body: `${project.title} : ${content.substring(0, 60)}...`,
        type: 'FEED_UPDATE',
        data: { projectId, postId: post.id }
      }))
    })

    successResponse(res, post, 'Post publié', 201)
  } catch {
    errorResponse(res)
  }
})

// Réagir à un post
router.post('/post/:postId/react', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type } = req.body
    if (!['TRUST', 'WORRY', 'BRAVO'].includes(type)) {
      res.status(400).json({ success: false, message: 'Réaction invalide' })
      return
    }
    const postId = req.params.postId
    const existing = await prisma.postReaction.findUnique({
      where: { postId_userId: { postId, userId: req.userId! } }
    })

    if (existing) {
      if (existing.type === type) {
        await prisma.postReaction.delete({ where: { postId_userId: { postId, userId: req.userId! } } })
        const field = type === 'TRUST' ? 'trustCount' : type === 'WORRY' ? 'worryCount' : 'bravoCount'
        await prisma.post.update({ where: { id: postId }, data: { [field]: { decrement: 1 } } })
        successResponse(res, null, 'Réaction retirée')
        return
      }
      const oldField = existing.type === 'TRUST' ? 'trustCount' : existing.type === 'WORRY' ? 'worryCount' : 'bravoCount'
      const newField = type === 'TRUST' ? 'trustCount' : type === 'WORRY' ? 'worryCount' : 'bravoCount'
      await prisma.postReaction.update({ where: { postId_userId: { postId, userId: req.userId! } }, data: { type } })
      await prisma.post.update({ where: { id: postId }, data: { [oldField]: { decrement: 1 }, [newField]: { increment: 1 } } })
    } else {
      await prisma.postReaction.create({ data: { postId, userId: req.userId!, type } })
      const field = type === 'TRUST' ? 'trustCount' : type === 'WORRY' ? 'worryCount' : 'bravoCount'
      await prisma.post.update({ where: { id: postId }, data: { [field]: { increment: 1 } } })
    }

    successResponse(res, null, 'Réaction enregistrée')
  } catch {
    errorResponse(res)
  }
})

export default router
