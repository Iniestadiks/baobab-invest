import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../config/database'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt'
import { authenticate, AuthRequest } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/helpers'

const router = Router()

// Login
router.post('/login', async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body
    if (!email || !password) { res.status(400).json({ success: false, message: 'Email et mot de passe requis' }); return }
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) { res.status(401).json({ success: false, message: 'Identifiants invalides' }); return }
    if (!user.isActive || user.isBanned) { res.status(403).json({ success: false, message: 'Compte désactivé ou banni' }); return }
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) { res.status(401).json({ success: false, message: 'Identifiants invalides' }); return }
    const accessToken = generateAccessToken(user.id, user.role)
    const refreshToken = generateRefreshToken(user.id)
    // lastLoginAt non disponible
    successResponse(res, {
      accessToken, refreshToken,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, kycStatus: user.kycStatus, profileImageUrl: user.profileImageUrl, level: user.level }
    }, 'Connexion réussie')
  } catch (e) { console.error(e); errorResponse(res) }
})

// Register
router.post('/register', async (req, res): Promise<void> => {
  try {
    const { email, password, firstName, lastName, phone, role, country, city, region, countryCode, indicatif } = req.body
    if (!email || !password || !firstName || !lastName) { res.status(400).json({ success: false, message: 'Champs obligatoires manquants' }); return }
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) { res.status(409).json({ success: false, message: 'Email déjà utilisé' }); return }
    const hashed = await bcrypt.hash(password, 10)
    const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase()
    const user = await prisma.user.create({
      data: { email, password: hashed, firstName, lastName, phone, role: role || 'INVESTOR', referralCode, country: country || 'SN', city: city || '', region: region || '', countryCode: countryCode || 'SN', indicatif: indicatif || '+221' }
    })
    await prisma.wallet.create({ data: { userId: user.id, balance: 0 } })
    const accessToken = generateAccessToken(user.id, user.role)
    const refreshToken = generateRefreshToken(user.id)
    successResponse(res, {
      accessToken, refreshToken,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, kycStatus: user.kycStatus }
    }, 'Compte créé avec succès')
  } catch (e) { console.error(e); errorResponse(res) }
})

// Me
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { wallet: true }
    })
    if (!user) { res.status(404).json({ success: false, message: 'Utilisateur introuvable' }); return }
    successResponse(res, {
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      role: user.role, kycStatus: user.kycStatus, profileImageUrl: user.profileImageUrl, level: user.level,
      phone: user.phone, city: user.city, country: user.country, region: user.region, countryCode: user.countryCode, indicatif: user.indicatif,
      totalInvested: user.totalInvested, reputationScore: user.reputationScore,
      wallet: user.wallet
    })
  } catch (e) { console.error(e); errorResponse(res) }
})

// Refresh token
router.post('/refresh', async (req, res): Promise<void> => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) { res.status(400).json({ success: false, message: 'Refresh token manquant' }); return }
    const decoded = verifyRefreshToken(refreshToken)
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } })
    if (!user || !user.isActive) { res.status(401).json({ success: false, message: 'Token invalide' }); return }
    const accessToken = generateAccessToken(user.id, user.role)
    const newRefreshToken = generateRefreshToken(user.id)
    successResponse(res, { accessToken, refreshToken: newRefreshToken })
  } catch (e) { res.status(401).json({ success: false, message: 'Token invalide ou expiré' }) }
})

// Update profile
router.patch('/profile', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, phone, city, country, bio, region, countryCode, indicatif } = req.body
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { firstName, lastName, phone, city, country, bio, region, countryCode, indicatif }
    })
    successResponse(res, user, 'Profil mis à jour')
  } catch (e) { errorResponse(res) }
})

// Upload avatar
router.patch('/avatar', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { avatarUrl } = req.body
    const user = await prisma.user.update({ where: { id: req.userId }, data: { profileImageUrl: avatarUrl } })
    successResponse(res, { profileImageUrl: user.profileImageUrl }, 'Avatar mis à jour')
  } catch (e) { errorResponse(res) }
})

// Profil public
router.get('/profile/:userId', async (req, res): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: { id: true, firstName: true, lastName: true, city: true, bio: true, role: true, reputationScore: true, createdAt: true, level: true, profileImageUrl: true }
    })
    if (!user) { res.status(404).json({ success: false, message: 'Utilisateur introuvable' }); return }
    successResponse(res, user)
  } catch (e) { errorResponse(res) }
})

// Profil public d'un utilisateur
router.get('/profile/:userId', async (req, res): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: {
        id: true, firstName: true, lastName: true, role: true,
        city: true, country: true, bio: true, profileImageUrl: true,
        reputationScore: true, level: true, kycStatus: true, createdAt: true
      }
    })
    if (!user) { res.status(404).json({ success: false, message: 'Utilisateur introuvable' }); return }
    const projects = await prisma.project.findMany({
      where: user.role === 'MENTOR'
        ? { mentorId: req.params.userId, status: { in: ['ACTIVE','FUNDED','IN_PROGRESS','COMPLETED'] } }
        : { entrepreneurId: req.params.userId, status: { not: 'PENDING_REVIEW' } },
      select: { id: true, title: true, sector: true, city: true, raisedAmount: true, status: true },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ success: true, data: { ...user, projects } })
  } catch (e) { res.status(500).json({ success: false }) }
})

// Liste des mentors certifiés disponibles
router.get('/mentors', async (req, res): Promise<void> => {
  try {
    const mentors = await prisma.user.findMany({
      where: { role: 'MENTOR', kycStatus: 'VERIFIED', isActive: true, isBanned: false },
      select: {
        id: true, firstName: true, lastName: true,
        city: true, country: true, reputationScore: true,
        level: true, bio: true, profileImageUrl: true
      },
      orderBy: { reputationScore: 'desc' }
    })
    res.json({ success: true, data: mentors })
  } catch (e) { res.status(500).json({ success: false }) }
})

export default router
