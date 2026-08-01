// @ts-nocheck
import { Router, Response } from 'express'
import multer from 'multer'
import path from 'path'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/helpers'
import { v2 as cloudinary } from 'cloudinary'
import { Readable } from 'stream'
import { checkAndUnlockPalier } from '../services/paliers'
const router = Router()

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024 }, // 60 Mo — large pour 1min45 de vidéo
  fileFilter: (req, file, cb) => {
    const allowedVideo = ['.mp4', '.mov', '.webm']
    const allowedDoc = ['.pdf', '.jpg', '.jpeg', '.png']
    const ext = path.extname(file.originalname).toLowerCase()
    if (file.fieldname === 'video' && !allowedVideo.includes(ext)) { cb(new Error('Format vidéo non supporté (mp4/mov/webm)')); return }
    if (file.fieldname === 'documents' && !allowedDoc.includes(ext)) { cb(new Error('Format document non supporté (pdf/jpg/png)')); return }
    cb(null, true)
  }
})

async function uploadToCloudinary(buffer: Buffer, folder: string, publicId: string, resourceType: 'video' | 'auto' = 'auto'): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: resourceType },
      (error, result) => { if (error) reject(error); else resolve(result!.secure_url) }
    )
    Readable.from(buffer).pipe(stream)
  })
}

// Entrepreneur — upload vidéo + documents pour débloquer un palier
router.post('/:projectId/:palier', authenticate, upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'documents', maxCount: 5 },
]), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, palier } = req.params
    const palierNum = parseInt(palier)
    if (![2, 3].includes(palierNum)) { res.status(400).json({ success: false, message: 'Palier invalide (2 ou 3 uniquement)' }); return }
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) { res.status(404).json({ success: false, message: 'Projet introuvable' }); return }
    if (project.entrepreneurId !== req.userId) { res.status(403).json({ success: false, message: 'Non autorisé' }); return }
    // Le palier précédent doit être atteint (seuil de mensualités OK) avant de pouvoir uploader
    const existing = await prisma.palierProof.findUnique({ where: { projectId_palier: { projectId, palier: palierNum } } })
    if (!existing) { res.status(400).json({ success: false, message: "Vous n'avez pas encore atteint le seuil de mensualités pour ce palier" }); return }
    if (existing.videoUrl) { res.status(400).json({ success: false, message: 'Preuve déjà envoyée pour ce palier' }); return }

    const files = req.files as any
    if (!files?.video) { res.status(400).json({ success: false, message: 'Vidéo obligatoire (max 1min45)' }); return }
    const date = new Date().toISOString().split('T')[0]
    const videoUrl = await uploadToCloudinary(files.video[0].buffer, `korapact/paliers/${projectId}`, `palier${palierNum}-video-${date}`, 'video')
    const documents: { url: string; name: string }[] = []
    if (files.documents) {
      for (const [i, doc] of files.documents.entries()) {
        const url = await uploadToCloudinary(doc.buffer, `korapact/paliers/${projectId}`, `palier${palierNum}-doc${i}-${date}`)
        documents.push({ url, name: doc.originalname })
      }
    }
    await prisma.palierProof.update({
      where: { id: existing.id },
      data: { videoUrl, documents: JSON.stringify(documents) }
    })
    // Le seuil de mensualités était déjà atteint — l'upload débloque immédiatement le palier
    const schedule = await prisma.repaymentSchedule.findFirst({ where: { projectId } })
    if (schedule) {
      await prisma.$transaction(async (tx: any) => { await checkAndUnlockPalier(schedule.id, tx) })
    }
    successResponse(res, { videoUrl, documents }, `Preuve envoyée — Palier ${palierNum} débloqué !`)
  } catch (e) { console.error(e); errorResponse(res) }
})

// Voir les preuves d'un projet — entrepreneur, investisseurs du projet, ou admin
router.get('/:projectId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) { res.status(404).json({ success: false, message: 'Projet introuvable' }); return }
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } })
    const isOwner = project.entrepreneurId === req.userId
    const isAdmin = user?.role === 'ADMIN'
    const hasInvested = await prisma.investment.count({ where: { projectId, userId: req.userId } }) > 0
    if (!isOwner && !isAdmin && !hasInvested) { res.status(403).json({ success: false, message: 'Réservé aux investisseurs de ce projet' }); return }
    const proofs = await prisma.palierProof.findMany({ where: { projectId }, orderBy: { palier: 'asc' } })
    const enriched = proofs.map((p: any) => ({ ...p, documents: p.documents ? JSON.parse(p.documents) : [] }))
    successResponse(res, enriched)
  } catch (e) { console.error(e); errorResponse(res) }
})

// Investisseur du projet — signaler une preuve insuffisante/suspecte
router.post('/:projectId/:palier/flag', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, palier } = req.params
    const { reason } = req.body
    if (!reason || reason.trim().length < 10) { res.status(400).json({ success: false, message: 'Motif requis (10 caractères min)' }); return }
    const hasInvested = await prisma.investment.count({ where: { projectId, userId: req.userId } }) > 0
    if (!hasInvested) { res.status(403).json({ success: false, message: 'Réservé aux investisseurs de ce projet' }); return }
    const proof = await prisma.palierProof.findUnique({ where: { projectId_palier: { projectId, palier: parseInt(palier) } } })
    if (!proof) { res.status(404).json({ success: false, message: 'Preuve introuvable' }); return }
    await prisma.palierProof.update({
      where: { id: proof.id },
      data: { flagged: true, flagReason: reason, flaggedBy: req.userId }
    })
    // Notifier les admins
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
    await prisma.notification.createMany({
      data: admins.map((a: any) => ({
        userId: a.id,
        title: '🚩 Preuve de palier signalée',
        body: `Un investisseur a signalé la preuve du Palier ${palier} sur un projet — motif : ${reason}`,
        type: 'PALIER_PROOF_FLAGGED',
        data: JSON.stringify({ projectId, palier })
      }))
    })
    successResponse(res, {}, 'Signalement envoyé — un admin va vérifier')
  } catch (e) { console.error(e); errorResponse(res) }
})

export default router
