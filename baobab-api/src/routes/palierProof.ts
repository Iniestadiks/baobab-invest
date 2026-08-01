// @ts-nocheck
import { Router, Response } from 'express'
import multer from 'multer'
import path from 'path'
import prisma from '../config/database'
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth'
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
  limits: { fileSize: 60 * 1024 * 1024 },
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

// Entrepreneur — upload (ou renvoi après rejet) vidéo + documents pour un palier
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
    const existing = await prisma.palierProof.findUnique({ where: { projectId_palier: { projectId, palier: palierNum } } })
    if (!existing) { res.status(400).json({ success: false, message: "Vous n'avez pas encore atteint le seuil de mensualités pour ce palier" }); return }
    // Comme le KYC : blocage seulement si déjà en cours d'examen ou déjà approuvé.
    // Après un rejet, on peut renvoyer une nouvelle vidéo.
    if (existing.status === 'IN_REVIEW') { res.status(400).json({ success: false, message: 'Une vidéo est déjà en cours d\'examen pour ce palier' }); return }
    if (existing.status === 'APPROVED') { res.status(400).json({ success: false, message: 'Ce palier est déjà débloqué' }); return }

    const files = req.files as any
    if (!files?.video) { res.status(400).json({ success: false, message: 'Vidéo obligatoire (max 1min45)' }); return }
    const date = Date.now()
    const videoUrl = await uploadToCloudinary(files.video[0].buffer, `korapact/paliers/${projectId}`, `palier${palierNum}-video-${date}`, 'video')
    const documents: { url: string; name: string }[] = []
    if (files.documents) {
      for (const [i, doc] of files.documents.entries()) {
        const url = await uploadToCloudinary(doc.buffer, `korapact/paliers/${projectId}`, `palier${palierNum}-doc${i}-${date}`)
        documents.push({ url, name: doc.originalname })
      }
    }
    // Renvoi après rejet : on efface les anciens votes pour repartir sur un examen propre
    if (existing.status === 'REJECTED') {
      await prisma.palierProofVote.deleteMany({ where: { proofId: existing.id } })
    }
    const reviewDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000)
    await prisma.palierProof.update({
      where: { id: existing.id },
      data: { videoUrl, documents: JSON.stringify(documents), status: 'IN_REVIEW', reviewDeadline }
    })
    // Notifier tous les investisseurs du projet — ils doivent valider
    const investorIds = [...new Set((await prisma.investment.findMany({ where: { projectId }, select: { userId: true } })).map(i => i.userId))]
    if (investorIds.length > 0) {
      await prisma.notification.createMany({
        data: investorIds.map(userId => ({
          userId,
          title: `🎬 Vidéo Palier ${palierNum} à valider`,
          body: `L'entrepreneur a posté une vidéo sur l'avancement du projet. Merci de la visionner et de voter (👍/👎) sous 48h.`,
          type: 'PALIER_PROOF_VOTE_NEEDED',
          data: JSON.stringify({ projectId, palier: palierNum })
        }))
      })
    }
    successResponse(res, { videoUrl, documents }, `Vidéo envoyée — en attente de validation par les investisseurs (48h)`)
  } catch (e) { console.error(e); errorResponse(res) }
})

// Investisseur du projet — voter sur une preuve en cours d'examen
router.post('/:projectId/:palier/vote', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, palier } = req.params
    const palierNum = parseInt(palier)
    const { vote, reason } = req.body as { vote: 'APPROVE' | 'REJECT'; reason?: string }
    if (!['APPROVE', 'REJECT'].includes(vote)) { res.status(400).json({ success: false, message: 'Vote invalide' }); return }
    if (vote === 'REJECT' && (!reason || reason.trim().length < 10)) { res.status(400).json({ success: false, message: 'Motif requis pour un rejet (10 caractères min)' }); return }
    const hasInvested = await prisma.investment.count({ where: { projectId, userId: req.userId } }) > 0
    if (!hasInvested) { res.status(403).json({ success: false, message: 'Réservé aux investisseurs de ce projet' }); return }
    const proof = await prisma.palierProof.findUnique({ where: { projectId_palier: { projectId, palier: palierNum } } })
    if (!proof || proof.status !== 'IN_REVIEW') { res.status(400).json({ success: false, message: "Aucune vidéo en cours d'examen pour ce palier" }); return }

    await prisma.palierProofVote.upsert({
      where: { proofId_investorId: { proofId: proof.id, investorId: req.userId! } },
      update: { vote, reason: reason || null },
      create: { proofId: proof.id, investorId: req.userId!, vote, reason: reason || null }
    })

    // Vérifier quorum + majorité après ce vote
    const totalInvestors = (await prisma.investment.groupBy({ by: ['userId'], where: { projectId } })).length
    const votes = await prisma.palierProofVote.findMany({ where: { proofId: proof.id } })
    const approveCount = votes.filter(v => v.vote === 'APPROVE').length
    const rejectCount = votes.filter(v => v.vote === 'REJECT').length
    const quorumReached = votes.length > totalInvestors - votes.length // + de répondants que de non-répondants

    if (quorumReached && approveCount > rejectCount) {
      await prisma.palierProof.update({ where: { id: proof.id }, data: { status: 'APPROVED' } })
      const schedule = await prisma.repaymentSchedule.findFirst({ where: { projectId } })
      if (schedule) await prisma.$transaction(async (tx: any) => { await checkAndUnlockPalier(schedule.id, tx) })
      successResponse(res, { outcome: 'APPROVED' }, '✅ Vote enregistré — quorum atteint, palier débloqué !')
      return
    }
    successResponse(res, { outcome: 'PENDING', approveCount, rejectCount, totalInvestors, votesCount: votes.length }, 'Vote enregistré')
  } catch (e) { console.error(e); errorResponse(res) }
})

// Admin — décision finale (approuve ou rejette directement, court-circuite le vote)
router.post('/:projectId/:palier/admin-decide', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, palier } = req.params
    const palierNum = parseInt(palier)
    const { decision, reason } = req.body as { decision: 'APPROVE' | 'REJECT'; reason?: string }
    const proof = await prisma.palierProof.findUnique({ where: { projectId_palier: { projectId, palier: palierNum } } })
    if (!proof || proof.status !== 'IN_REVIEW') { res.status(400).json({ success: false, message: "Aucune vidéo en cours d'examen pour ce palier" }); return }
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (decision === 'APPROVE') {
      await prisma.palierProof.update({ where: { id: proof.id }, data: { status: 'APPROVED' } })
      const schedule = await prisma.repaymentSchedule.findFirst({ where: { projectId } })
      if (schedule) await prisma.$transaction(async (tx: any) => { await checkAndUnlockPalier(schedule.id, tx) })
      successResponse(res, {}, '✅ Palier approuvé par admin — débloqué')
    } else {
      await prisma.palierProof.update({ where: { id: proof.id }, data: { status: 'REJECTED' } })
      await prisma.notification.create({
        data: {
          userId: project!.entrepreneurId,
          title: `❌ Vidéo Palier ${palierNum} rejetée`,
          body: `Votre vidéo a été rejetée par l'admin${reason ? ' : ' + reason : ''}. Postez une nouvelle vidéo pour débloquer ce palier.`,
          type: 'PALIER_PROOF_REJECTED',
          data: JSON.stringify({ projectId, palier: palierNum })
        }
      })
      successResponse(res, {}, 'Palier rejeté — entrepreneur notifié pour renvoi')
    }
  } catch (e) { console.error(e); errorResponse(res) }
})

// Voir les preuves d'un projet — entrepreneur, investisseurs du projet, ou admin
// Admin — liste de toutes les vidéos en attente d'examen (tous projets)
router.get('/admin/pending', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const proofs = await prisma.palierProof.findMany({
      where: { status: 'IN_REVIEW' },
      include: {
        project: { select: { title: true, sector: true, entrepreneur: { select: { firstName: true, lastName: true } } } },
        votes: true,
      },
      orderBy: { createdAt: 'asc' }
    })
    const enriched = await Promise.all(proofs.map(async (p: any) => {
      const totalInvestors = (await prisma.investment.groupBy({ by: ['userId'], where: { projectId: p.projectId } })).length
      return {
        ...p,
        documents: p.documents ? JSON.parse(p.documents) : [],
        approveCount: p.votes.filter((v: any) => v.vote === 'APPROVE').length,
        rejectCount: p.votes.filter((v: any) => v.vote === 'REJECT').length,
        totalInvestors,
      }
    }))
    successResponse(res, enriched)
  } catch (e) { console.error(e); errorResponse(res) }
})

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
    const proofs = await prisma.palierProof.findMany({ where: { projectId }, orderBy: { palier: 'asc' }, include: { votes: true } })
    const totalInvestors = (await prisma.investment.groupBy({ by: ['userId'], where: { projectId } })).length
    const enriched = proofs.map((p: any) => ({
      ...p,
      documents: p.documents ? JSON.parse(p.documents) : [],
      approveCount: p.votes.filter((v: any) => v.vote === 'APPROVE').length,
      rejectCount: p.votes.filter((v: any) => v.vote === 'REJECT').length,
      totalInvestors,
      myVote: p.votes.find((v: any) => v.investorId === req.userId)?.vote || null,
      votes: isAdmin || isOwner ? p.votes : undefined, // détail des votes/motifs réservé admin+entrepreneur
    }))
    successResponse(res, enriched)
  } catch (e) { console.error(e); errorResponse(res) }
})

export default router
