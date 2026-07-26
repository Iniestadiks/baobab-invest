// @ts-nocheck
import { Router, Response } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/helpers'
import { COURSE_CATALOG, getCoursesForRole, getCourse } from '../config/academyCourses'
import { addReputationPoints } from '../services/reputationService'
const router = Router()

// Liste des cours disponibles pour le rôle de l'utilisateur, avec statut de complétion
router.get('/courses', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } })
    const courses = getCoursesForRole(user?.role || 'ALL')
    const completions = await prisma.courseCompletion.findMany({
      where: { userId: req.userId },
      select: { courseId: true, completedAt: true }
    })
    const completedMap: Record<string, string> = {}
    completions.forEach(c => { completedMap[c.courseId] = c.completedAt })
    const enriched = courses.map(c => ({
      ...c,
      completed: !!completedMap[c.id],
      completedAt: completedMap[c.id] || null,
    }))
    successResponse(res, {
      courses: enriched,
      totalCertified: enriched.filter(c => c.certified).length,
      completedCertified: enriched.filter(c => c.certified && c.completed).length,
    })
  } catch (e) { console.error(e); errorResponse(res) }
})

// Détail d'un cours (contenu de la leçon)
router.get('/courses/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const course = getCourse(req.params.id)
    if (!course) { res.status(404).json({ success: false, message: 'Cours introuvable' }); return }
    const completion = await prisma.courseCompletion.findUnique({
      where: { userId_courseId: { userId: req.userId!, courseId: course.id } }
    })
    successResponse(res, { ...course, completed: !!completion })
  } catch (e) { errorResponse(res) }
})

// Marquer un cours comme terminé — attribue les points réels
router.post('/complete/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const course = getCourse(req.params.id)
    if (!course) { res.status(404).json({ success: false, message: 'Cours introuvable' }); return }
    const existing = await prisma.courseCompletion.findUnique({
      where: { userId_courseId: { userId: req.userId!, courseId: course.id } }
    })
    if (existing) {
      successResponse(res, { alreadyCompleted: true }, 'Cours déjà marqué comme terminé')
      return
    }
    await prisma.courseCompletion.create({
      data: { userId: req.userId!, courseId: course.id, pointsEarned: course.certified ? course.points : 0 }
    })
    // Points de réputation réels (gamification) — pour tous les rôles
    if (course.points > 0) {
      await addReputationPoints(req.userId!, 'COURSE_COMPLETED', course.points, `Cours terminé : ${course.title}`, undefined)
    }
    await prisma.notification.create({
      data: {
        userId: req.userId!,
        title: course.certified ? '🏆 Cours certifiant terminé !' : '📚 Cours terminé !',
        body: `"${course.title}" — +${course.points} pts${course.certified ? ' (compte pour votre score de bankabilité si vous soumettez un projet)' : ''}`,
        type: 'COURSE_COMPLETED',
        data: JSON.stringify({ courseId: course.id, points: course.points })
      }
    })
    successResponse(res, { pointsEarned: course.points, certified: course.certified }, `Cours terminé — +${course.points} pts !`)
  } catch (e) { console.error(e); errorResponse(res) }
})

export default router
