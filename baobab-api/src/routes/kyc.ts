import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import prisma from '../config/database'
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/helpers'

const router = Router()

const storage = multer.diskStorage({
  destination: (req: any, file, cb) => {
    const userId = req.userId || 'unknown'
    const typeMap: any = { document: 'identity', selfie: 'selfie', rccm: 'rccm' }
    const folder = `/home/baobab-invest/baobab-api/uploads/kyc/${userId}/${typeMap[file.fieldname] || 'other'}`
    fs.mkdirSync(folder, { recursive: true })
    cb(null, folder)
  },
  filename: (req: any, file, cb) => {
    const userId = req.userId || 'unknown'
    const date = new Date().toISOString().split('T')[0]
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${userId}-${file.fieldname}-${date}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf', '.webp']
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true)
    else cb(new Error('Format non supporte'))
  }
})

router.post('/upload', authenticate, upload.fields([
  { name: 'document', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
  { name: 'rccm', maxCount: 1 }
]), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const files = req.files as any
    const existing = await prisma.user.findUnique({ where: { id: req.userId } })
    if (existing?.kycStatus === 'PENDING') {
      res.status(400).json({ success: false, message: 'Une demande est deja en cours. Attendez la reponse de l\'administrateur.' })
      return
    }
    if (existing?.kycStatus === 'VERIFIED') {
      res.status(400).json({ success: false, message: 'Votre KYC est deja verifie.' })
      return
    }
    if (!files?.document || !files?.selfie) {
      res.status(400).json({ success: false, message: 'Document + selfie obligatoires' })
      return
    }
    const userId = req.userId!
    const docUrl = `/uploads/kyc/${userId}/identity/${files.document[0].filename}`
    const selfieUrl = `/uploads/kyc/${userId}/selfie/${files.selfie[0].filename}`
    const rccmUrl = files.rccm ? `/uploads/kyc/${userId}/rccm/${files.rccm[0].filename}` : undefined
    const expiry = req.body.documentExpiry ? new Date(req.body.documentExpiry) : undefined
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        kycDocumentUrl: docUrl,
        kycSelfieUrl: selfieUrl,
        kycRccmUrl: rccmUrl,
        kycStatus: 'PENDING',
        kycSubmittedAt: new Date(),
        kycDocumentExpiry: expiry,
        kycDocumentType: req.body.documentType || 'CNI',
        kycAttempts: { increment: 1 },
        rccmNumber: req.body.rccmNumber || undefined,
        nineaNumber: req.body.nineaNumber || undefined,
      }
    })
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } })
    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          title: 'Nouveau KYC a valider',
          body: `${user.firstName} ${user.lastName} (${user.role}) a soumis ses documents KYC. Tentative #${user.kycAttempts}.`,
          type: 'KYC_PENDING',
          data: { userId: user.id }
        }
      })
    }
    successResponse(res, { docUrl, selfieUrl, rccmUrl }, 'Documents soumis. Verification sous 24h.')
  } catch (e: any) {
    console.error(e)
    errorResponse(res, e.message || 'Erreur upload')
  }
})

router.get('/status', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        kycStatus: true, kycDocumentUrl: true, kycSelfieUrl: true,
        kycRccmUrl: true, kycVerifiedAt: true, kycSubmittedAt: true,
        kycRejectedReason: true, kycDocumentExpiry: true,
        kycDocumentType: true, kycAttempts: true
      }
    })
    successResponse(res, user)
  } catch (e) { errorResponse(res) }
})

router.get('/admin/all', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, role } = req.query
    const where: any = {}
    if (status && status !== 'ALL') where.kycStatus = status
    if (role && role !== 'ALL') where.role = role
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, firstName: true, lastName: true, email: true, role: true,
        city: true, country: true, phone: true,
        kycStatus: true, kycDocumentUrl: true, kycSelfieUrl: true,
        kycRccmUrl: true, kycSubmittedAt: true, kycVerifiedAt: true,
        kycRejectedReason: true, kycDocumentExpiry: true, kycDocumentType: true,
        kycAttempts: true, kycNotes: true, createdAt: true,
        reputationScore: true, level: true, referralCode: true,
        referralCount: true
      },
      orderBy: { createdAt: 'desc' }
    })
    const enriched = users.map(u => ({
      ...u,
      daysUntilExpiry: u.kycDocumentExpiry
        ? Math.ceil((new Date(u.kycDocumentExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null
    }))
    successResponse(res, enriched)
  } catch (e) { errorResponse(res) }
})

router.patch('/admin/verify/:userId', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action, reason, notes } = req.body
    if (!['VERIFIED', 'REJECTED'].includes(action)) {
      res.status(400).json({ success: false, message: 'Action invalide' }); return
    }
    if (action === 'REJECTED' && !reason) {
      res.status(400).json({ success: false, message: 'Motif de rejet obligatoire' }); return
    }
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: {
        kycStatus: action,
        kycVerifiedAt: action === 'VERIFIED' ? new Date() : null,
        kycRejectedReason: action === 'REJECTED' ? reason : null,
        kycVerifiedBy: req.userId,
        kycNotes: notes || null,
      }
    })
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: action === 'VERIFIED' ? 'KYC Verifie !' : 'KYC Rejete',
        body: action === 'VERIFIED'
          ? 'Votre identite a ete verifiee. Vous pouvez maintenant investir et soumettre des projets.'
          : `Votre KYC a ete rejete. Motif : ${reason}. Vous pouvez soumettre de nouveaux documents.`,
        type: action === 'VERIFIED' ? 'KYC_VERIFIED' : 'KYC_REJECTED',
        data: { reason }
      }
    })
    successResponse(res, user, `KYC ${action === 'VERIFIED' ? 'valide' : 'rejete'}`)
  } catch (e) { errorResponse(res) }
})

router.get('/admin/dossier/:userId', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.userId } })
    if (!user) { res.status(404).json({ success: false }); return }
    const dir = `/home/baobab-invest/baobab-api/uploads/kyc/${req.params.userId}`
    if (!fs.existsSync(dir)) {
      successResponse(res, { user: { id: user.id, name: `${user.firstName} ${user.lastName}`, role: user.role }, files: [] })
      return
    }
    const files: any[] = []
    const scanDir = (d: string, rel: string) => {
      fs.readdirSync(d).forEach(f => {
        const full = path.join(d, f)
        const relPath = path.join(rel, f)
        if (fs.statSync(full).isDirectory()) scanDir(full, relPath)
        else files.push({
          name: f,
          folder: rel,
          url: `/uploads/kyc/${req.params.userId}/${relPath}`,
          size: fs.statSync(full).size,
          modified: fs.statSync(full).mtime
        })
      })
    }
    scanDir(dir, '')
    successResponse(res, {
      user: { id: user.id, name: `${user.firstName} ${user.lastName}`, role: user.role },
      files
    })
  } catch (e) { errorResponse(res) }
})

router.post('/check-expiry', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date()
    const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const expired = await prisma.user.findMany({
      where: { kycStatus: 'VERIFIED', kycDocumentExpiry: { lt: now } }
    })
    for (const u of expired) {
      await prisma.user.update({ where: { id: u.id }, data: { kycStatus: 'PENDING' } })
      await prisma.notification.create({
        data: {
          userId: u.id,
          title: 'Document KYC expire',
          body: 'Votre document d identite a expire. Soumettez un nouveau document.',
          type: 'KYC_PENDING'
        }
      })
    }
    const expiringSoon = await prisma.user.findMany({
      where: { kycStatus: 'VERIFIED', kycDocumentExpiry: { gte: now, lte: in30days } }
    })
    for (const u of expiringSoon) {
      await prisma.notification.create({
        data: {
          userId: u.id,
          title: 'Document KYC expire bientot',
          body: 'Votre document expire dans moins de 30 jours. Renouvelez-le.',
          type: 'KYC_PENDING'
        }
      })
    }
    successResponse(res, { expired: expired.length, expiringSoon: expiringSoon.length })
  } catch (e) { errorResponse(res) }
})

export default router
