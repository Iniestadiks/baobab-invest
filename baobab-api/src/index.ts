import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { config } from './config'
import authRoutes from './routes/auth'
import projectRoutes from './routes/projects'
import investmentRoutes from './routes/investments'
import milestoneRoutes from './routes/milestones'
import supplierRoutes from './routes/suppliers'
import feedRoutes from './routes/feed'
import adminRoutes from './routes/admin'
import fundRoutes from './routes/fund'
import uploadRoutes from './routes/upload'
import notificationRoutes from './routes/notifications'
import repaymentRouter from './routes/repayment'
import messageRoutes from './routes/messages'
import kycRoutes from './routes/kyc'
import exportRoutes from './routes/exports'
import walletRoutes from './routes/wallet'
import configRoutes from './routes/config'
import referralRoutes from './routes/referral'
import pdfRoutes from './routes/pdf'
import geoRoutes from './routes/geo'
import reputationRoutes from './routes/reputation'
import { checkAndPromoteWaitlist } from './jobs/waitlistPromotion'
import { computeMonthlyRankings } from './jobs/monthlyRankings'

const app = express()

app.use(helmet())
app.use(cors({ origin: '*', credentials: true }))
app.use(express.json({ limit: '10mb' }))
// Timeout étendu pour les uploads vidéo (5 minutes)
app.use('/api/upload', (req: any, res: any, next: any) => {
  req.setTimeout(300000)  // 5 minutes
  res.setTimeout(300000)
  next()
})
app.use('/uploads', require('express').static('/home/baobab-invest/baobab-api/uploads'))

app.get('/health', (_, res) => res.json({ status: 'ok' }))

app.use('/api/auth', authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/investments', investmentRoutes)
app.use('/api/milestones', milestoneRoutes)
app.use('/api/suppliers', supplierRoutes)
app.use('/api/feed', feedRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/fund', fundRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/repayment', repaymentRouter)
app.use('/api/messages', messageRoutes)
app.use('/api/kyc', kycRoutes)
app.use('/api/exports', exportRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/config', configRoutes)
app.use('/api/referral', referralRoutes)
app.use('/api/pdf', pdfRoutes)
app.use('/api/geo', geoRoutes)
app.use('/api/reputation', reputationRoutes)

// Cron toutes les heures — promotion liste d'attente
setInterval(checkAndPromoteWaitlist, 60 * 60 * 1000)

// Cron quotidien — vérification retards paiement (tous les jours à 9h)
const checkRepaymentDelays = async () => {
  try {
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    const now = new Date()
    const late3days = new Date(now.getTime() - 3*24*60*60*1000)
    const late7days = new Date(now.getTime() - 7*24*60*60*1000)
    const late15days = new Date(now.getTime() - 15*24*60*60*1000)
    const in3days = new Date(now.getTime() + 3*24*60*60*1000)
    const schedules = await prisma.repaymentSchedule.findMany({
      where: { status: 'ACTIVE' },
      include: {
        project: { include: { investments: { select: { userId: true } }, entrepreneur: { select: { id: true, firstName: true } } } },
        payments: { where: { status: 'PENDING' }, orderBy: { monthNumber: 'asc' }, take: 1 }
      }
    })
    let alerts = 0
    for (const sched of schedules) {
      const nextPayment = sched.payments[0]
      if (!nextPayment?.dueDate) continue
      const dueDate = new Date(nextPayment.dueDate)
      const entrepreneurId = sched.project.entrepreneurId
      const oneDayAgo = new Date(now.getTime() - 24*60*60*1000)
      const recentAlert = await prisma.notification.findFirst({
        where: { userId: entrepreneurId, type: { in: ['PAYMENT_REMINDER','PAYMENT_LATE','PAYMENT_CRITICAL'] }, createdAt: { gte: oneDayAgo } }
      })
      if (recentAlert) continue
      let title = ''; let body = ''; let scoreDecrement = 0; let notifyInvestors = false; let notifyAdmin = false
      if (dueDate <= in3days && dueDate > now) {
        title = '⏰ Rappel mensualité dans 3 jours'
        body = `Votre mensualité de ${nextPayment.amount.toLocaleString()} FCFA est due le ${dueDate.toLocaleDateString('fr-FR')}. Rechargez votre wallet.`
      } else if (dueDate <= now && dueDate > late3days) {
        title = '⚠️ Mensualité en retard'
        body = `Votre mensualité de ${nextPayment.amount.toLocaleString()} FCFA était due le ${dueDate.toLocaleDateString('fr-FR')}. Payez maintenant.`
        scoreDecrement = 5
      } else if (dueDate <= late3days && dueDate > late7days) {
        title = '🔴 Retard 3 jours — pénalité'
        body = `3 jours de retard sur ${nextPayment.amount.toLocaleString()} FCFA. -10 points réputation.`
        scoreDecrement = 10; notifyInvestors = true
      } else if (dueDate <= late7days && dueDate > late15days) {
        title = '🚨 Retard critique — 7 jours'
        body = `7 jours de retard. BAOBAB INVEST intervient. Score -30 points.`
        scoreDecrement = 30; notifyInvestors = true; notifyAdmin = true
      } else if (dueDate <= late15days) {
        title = '💀 Défaut de paiement — 15 jours'
        body = `15 jours de retard. Le projet peut être marqué en défaut.`
        scoreDecrement = 50; notifyInvestors = true; notifyAdmin = true
      } else continue
      await prisma.notification.create({ data: { userId: entrepreneurId, title, body, type: 'PAYMENT_REMINDER', data: JSON.stringify({ scheduleId: sched.id }) } })
      if (scoreDecrement > 0) await prisma.user.update({ where: { id: entrepreneurId }, data: { reputationScore: { decrement: scoreDecrement } } })
      if (notifyInvestors) {
        const ids = [...new Set(sched.project.investments.map(i => i.userId))]
        await prisma.notification.createMany({ data: ids.map(userId => ({ userId: userId as string, title: '📭 Retard remboursement', body: `L'entrepreneur de "${sched.project.title}" est en retard.`, type: 'PAYMENT_LATE', data: JSON.stringify({ projectId: sched.projectId }) })) })
      }
      if (notifyAdmin) {
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } })
        await prisma.notification.createMany({ data: admins.map(a => ({ userId: a.id, title: '🚨 Retard critique', body: `Projet "${sched.project.title}" — ${Math.round((now.getTime()-dueDate.getTime())/(1000*60*60*24))} jours de retard.`, type: 'PAYMENT_CRITICAL', data: JSON.stringify({ projectId: sched.projectId }) })) })
      }
      alerts++
    }
    if (alerts > 0) console.log('[CRON] Retards paiement —', alerts, 'alertes envoyées')
    await prisma.$disconnect()
  } catch (e) { console.error('[CRON] Erreur check retards:', e) }
}
// Lancer quotidiennement à 9h
const scheduleDelayCheck = () => {
  const now = new Date()
  const next9h = new Date(now)
  next9h.setHours(9, 0, 0, 0)
  if (next9h <= now) next9h.setDate(next9h.getDate() + 1)
  const delay = next9h.getTime() - now.getTime()
  setTimeout(() => { checkRepaymentDelays(); setInterval(checkRepaymentDelays, 24*60*60*1000) }, delay)
  console.log('[CRON] Vérification retards paiement prévue à', next9h.toLocaleTimeString())
}
scheduleDelayCheck()

// Cron mensuel — classements (1er du mois à 8h)
const scheduleMonthlyRankings = () => {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 8, 0, 0)
  const delay = next.getTime() - now.getTime()
  setTimeout(() => { computeMonthlyRankings(); setInterval(computeMonthlyRankings, 30 * 24 * 60 * 60 * 1000) }, delay)
  console.log('[CRON] Classement mensuel prévu le', next.toLocaleDateString())
}
scheduleMonthlyRankings()
checkAndPromoteWaitlist() // Lancer au démarrage

app.listen(config.port, () => {
  console.log(`🌳 BAOBAB INVEST API démarrée sur le port ${config.port}`)
  console.log(`📡 Environnement : ${config.env}`)
  console.log(`🗄️  Routes : auth | projects | investments | milestones | suppliers | feed | admin | fund | upload | notifications`)
})
