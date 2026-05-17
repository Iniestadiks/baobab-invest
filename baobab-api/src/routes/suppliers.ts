import { Router, Request, Response } from 'express'
import { z } from 'zod'
import prisma from '../config/database'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/helpers'

const router = Router()

const supplierSchema = z.object({
  companyName: z.string().min(2),
  contactName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  sector: z.string(),
  city: z.string(),
  country: z.string().default('SN'),
  rccmNumber: z.string().optional(),
  nineaNumber: z.string().optional(),
  mobileMoneyNumber: z.string().min(8),
  mobileMoneyProvider: z.enum(['WAVE', 'ORANGE', 'MTN', 'MOOV', 'FREE']),
  description: z.string().optional(),
})

// Enregistrer un fournisseur (public)
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = supplierSchema.parse(req.body)
    const existing = await prisma.supplier.findFirst({
      where: { OR: [{ email: data.email }, { phone: data.phone }] }
    })
    if (existing) {
      res.status(400).json({ success: false, message: 'Email ou téléphone déjà enregistré' })
      return
    }
    const supplier = await prisma.supplier.create({ data })
    successResponse(res, supplier, 'Demande d\'enregistrement soumise — en attente de vérification KYB', 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, message: error.errors[0].message })
      return
    }
    errorResponse(res)
  }
})

// Liste TOUS les fournisseurs (admin seulement)
router.get('/admin/all', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: [{ isVerified: 'asc' }, { createdAt: 'desc' }],
    })
    successResponse(res, suppliers)
  } catch {
    errorResponse(res)
  }
})

// Liste des fournisseurs vérifiés (public)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sector, country, search } = req.query
    const suppliers = await prisma.supplier.findMany({
      where: {
        isVerified: true,
        status: 'VERIFIED',
        ...(sector ? { sector: String(sector) } : {}),
        ...(country ? { country: String(country) } : {}),
        ...(search ? {
          OR: [
            { companyName: { contains: String(search), mode: 'insensitive' } },
            { description: { contains: String(search), mode: 'insensitive' } },
          ]
        } : {}),
      },
      orderBy: [{ isPremium: 'desc' }, { rating: 'desc' }],
      select: {
        id: true, companyName: true, contactName: true,
        sector: true, city: true, country: true,
        mobileMoneyProvider: true, description: true,
        logoUrl: true, isPremium: true, rating: true,
      }
    })
    successResponse(res, suppliers)
  } catch {
    errorResponse(res)
  }
})

// Détail fournisseur
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id },
      include: {
        milestonePayments: {
          select: { amount: true, status: true, paidAt: true },
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    })
    if (!supplier || !supplier.isVerified) {
      res.status(404).json({ success: false, message: 'Fournisseur introuvable' })
      return
    }
    successResponse(res, supplier)
  } catch {
    errorResponse(res)
  }
})

// Admin — vérifier un fournisseur (KYB)
router.patch('/:id/verify', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supplier = await prisma.supplier.update({
      where: { id: req.params.id },
      data: { status: 'VERIFIED', isVerified: true, verifiedAt: new Date() }
    })
    successResponse(res, supplier, 'Fournisseur vérifié avec succès')
  } catch {
    errorResponse(res)
  }
})

// Admin — suspendre un fournisseur
router.patch('/:id/suspend', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supplier = await prisma.supplier.update({
      where: { id: req.params.id },
      data: { status: 'SUSPENDED', isVerified: false }
    })
    successResponse(res, supplier, 'Fournisseur suspendu')
  } catch {
    errorResponse(res)
  }
})

export default router

// Fournisseur par email (pour son espace dédié)
router.get('/by-email/:email', async (req: Request, res: Response): Promise<void> => {
  try {
    const supplier = await prisma.supplier.findFirst({
      where: { email: decodeURIComponent(req.params.email) }
    })
    if (!supplier) {
      res.status(404).json({ success: false, message: 'Fournisseur introuvable' })
      return
    }
    const payments = await prisma.milestonePayment.findMany({
      where: { supplierId: supplier.id },
      include: {
        milestone: {
          select: {
            title: true,
            project: { select: { title: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    successResponse(res, { supplier, payments })
  } catch (e) {
    console.error(e)
    errorResponse(res)
  }
})

// Auth fournisseur — login
router.post('/auth/login', async (req: any, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body
    if (!email || !password) { res.status(400).json({ success: false, message: 'Email et mot de passe requis' }); return }
    const supplier = await prisma.supplier.findUnique({ where: { email } })
    if (!supplier) { res.status(404).json({ success: false, message: 'Compte fournisseur introuvable' }); return }
    if (!supplier.password) { res.status(400).json({ success: false, message: 'Mot de passe non configuré — contactez BAOBAB INVEST' }); return }
    const bcrypt = await import('bcryptjs')
    const valid = await bcrypt.default.compare(password, supplier.password)
    if (!valid) { res.status(401).json({ success: false, message: 'Mot de passe incorrect' }); return }
    await prisma.supplier.update({ where: { id: supplier.id }, data: { lastLoginAt: new Date() } })
    const jwt = await import('jsonwebtoken')
    const token = jwt.default.sign({ supplierId: supplier.id, email: supplier.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' })
    res.json({ success: true, data: { token, supplier: { id: supplier.id, companyName: supplier.companyName, email: supplier.email, isVerified: supplier.isVerified, mobileMoneyProvider: supplier.mobileMoneyProvider, mobileMoneyNumber: supplier.mobileMoneyNumber } } })
  } catch (e) { console.error(e); errorResponse(res) }
})

// Admin — définir mot de passe fournisseur
router.post('/:id/set-password', authenticate, requireAdmin, async (req: any, res: Response): Promise<void> => {
  try {
    const { password } = req.body
    if (!password || password.length < 6) { res.status(400).json({ success: false, message: 'Mot de passe minimum 6 caractères' }); return }
    const bcrypt = await import('bcryptjs')
    const hashed = await bcrypt.default.hash(password, 10)
    await prisma.supplier.update({ where: { id: req.params.id }, data: { password: hashed } })
    res.json({ success: true, message: 'Mot de passe défini avec succès' })
  } catch (e) { console.error(e); errorResponse(res) }
})

// Fournisseur connecté — ses paiements
router.get('/my-payments', async (req: any, res: Response): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) { res.status(401).json({ success: false, message: 'Non autorisé' }); return }
    const jwt = await import('jsonwebtoken')
    const decoded: any = jwt.default.verify(token, process.env.JWT_SECRET || 'secret')
    const payments = await prisma.milestonePayment.findMany({
      where: { supplierId: decoded.supplierId },
      include: { milestone: { include: { project: { select: { title: true } } } } },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ success: true, data: payments })
  } catch (e) { res.status(401).json({ success: false, message: 'Token invalide' }) }
})
