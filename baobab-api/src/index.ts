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
  console.log(`🗄️  Routes : auth | projects | investments | milestones | suppliers | feed | admin | fund | notifications`)
})
