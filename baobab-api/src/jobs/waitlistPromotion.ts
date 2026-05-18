import { PrismaClient } from '@prisma/client'
import { MAX_ACTIVE_PER_SUBSECTOR } from '../config/taxonomy'

const prisma = new PrismaClient()

export async function checkAndPromoteWaitlist() {
  console.log('[CRON] Verification liste d attente...')
  try {
    const waitlisted = await prisma.project.findMany({
      where: { status: 'WAITLISTED' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, sector: true, subSector: true, city: true, title: true, entrepreneurId: true }
    })
    if (waitlisted.length === 0) { console.log('[CRON] Aucun projet en attente'); return }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    let promotedCount = 0

    for (const project of waitlisted) {
      const activeProjects = await prisma.project.findMany({
        where: {
          sector: project.sector, subSector: project.subSector,
          city: { contains: project.city, mode: 'insensitive' },
          status: { in: ['ACTIVE', 'FUNDED', 'IN_PROGRESS'] }
        },
        select: { id: true, raisedAmount: true, goalAmount: true, createdAt: true, status: true }
      })

      const validActive = activeProjects.filter(p => {
        const isStale = p.status === 'ACTIVE' && p.createdAt < thirtyDaysAgo && p.raisedAmount < p.goalAmount * 0.2
        return !isStale
      })

      if (validActive.length < MAX_ACTIVE_PER_SUBSECTOR) {
        await prisma.project.update({ where: { id: project.id }, data: { status: 'PENDING_REVIEW' } })
        promotedCount++

        await prisma.notification.create({
          data: {
            userId: project.entrepreneurId,
            title: 'Votre projet est promu !',
            body: 'Un slot s est libere ! Votre projet ' + project.title + ' est maintenant en attente de validation.',
            type: 'PROJECT_PROMOTED',
            data: JSON.stringify({ projectId: project.id })
          }
        })

        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } })
        if (admins.length > 0) {
          await prisma.notification.createMany({
            data: admins.map(a => ({
              userId: a.id,
              title: 'Projet promu de la liste d attente',
              body: project.title + ' — ' + project.sector + '/' + (project.subSector || '') + ' — ' + project.city,
              type: 'PROJECT_PROMOTED',
              data: JSON.stringify({ projectId: project.id })
            }))
          })
        }
        console.log('[CRON] Promu:', project.title)
      }
    }
    console.log('[CRON] Total promus:', promotedCount)
  } catch (e) {
    console.error('[CRON] Erreur:', e)
  } finally {
    await prisma.$disconnect()
  }
}
