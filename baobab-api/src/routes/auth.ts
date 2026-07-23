// @ts-nocheck
import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import nodemailer from 'nodemailer'
import prisma from '../config/database'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt'
import { authenticate, AuthRequest } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/helpers'

const router = Router()

// ═══ EMAIL SERVICE ═══
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})

async function sendVerificationEmail(email: string, firstName: string, code: string) {
  try {
    await transporter.sendMail({
      from: `"KORAPACT" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Votre code de vérification KORAPACT',
      html: `
        <div style="max-width:520px;margin:40px auto;background:#0C1024;border:1px solid rgba(255,255,255,0.07);border-radius:24px;overflow:hidden;font-family:'Segoe UI',sans-serif;">
          <div style="background:linear-gradient(135deg,#2563EB,#06B6D4);padding:40px;text-align:center;">
            <div style="width:52px;height:52px;background:rgba(255,255,255,0.15);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:#fff;margin-bottom:16px;">K</div>
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:900;">KORAPACT</h1>
          </div>
          <div style="padding:40px;">
            <h2 style="color:#fff;font-size:20px;font-weight:800;margin:0 0 12px;">Bonjour ${firstName} 👋</h2>
            <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.7;margin:0 0 32px;">Votre code de vérification pour activer votre compte :</p>
            <div style="background:rgba(37,99,235,0.1);border:2px solid rgba(37,99,235,0.4);border-radius:20px;padding:32px;text-align:center;margin-bottom:32px;">
              <div style="font-size:48px;font-weight:900;letter-spacing:20px;color:#fff;font-family:monospace;">${code}</div>
              <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:16px 0 0;">Expire dans <strong style="color:#06B6D4;">10 minutes</strong></p>
            </div>
            <p style="color:rgba(255,255,255,0.3);font-size:13px;">Si vous n'avez pas créé de compte, ignorez cet email.</p>
          </div>
          <div style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0;">© 2026 KORAPACT · Plateforme d'investissement communautaire</p>
          </div>
        </div>
      `,
    })
  } catch (e) { console.error('[EMAIL] Erreur envoi:', e) }
}

// ═══ LOGIN ═══
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
    successResponse(res, {
      accessToken, refreshToken,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, kycStatus: user.kycStatus, profileImageUrl: user.profileImageUrl, level: user.level, isEmailVerified: user.isEmailVerified }
    }, 'Connexion réussie')
  } catch (e) { console.error(e); errorResponse(res) }
})

// ═══ REGISTER ═══
router.post('/register', async (req, res): Promise<void> => {
  try {
    const { email, password, firstName, lastName, phone, role, country, city, region, countryCode, indicatif, companyName, sector } = req.body
    if (!email || !password || !firstName || !lastName) { res.status(400).json({ success: false, message: 'Champs obligatoires manquants' }); return }
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) { res.status(409).json({ success: false, message: 'Email déjà utilisé' }); return }
    const hashed = await bcrypt.hash(password, 10)
    const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase()

    // Générer OTP 6 chiffres
    const verifyCode = Math.floor(100000 + Math.random() * 900000).toString()
    const verifyExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 min

    const user = await prisma.user.create({
      data: {
        email, password: hashed, firstName, lastName, phone,
        role: role || 'INVESTOR', referralCode,
        country: country || 'SN', city: city || '',
        region: region || '', countryCode: countryCode || 'SN',
        indicatif: indicatif || '+221',
        emailVerifyCode: verifyCode,
        emailVerifyExpiry: verifyExpiry,
        isEmailVerified: false,
      }
    })

    await prisma.wallet.create({ data: { userId: user.id, balance: 0 } })

    if (role === 'BUILDER') {
      await prisma.builderProfile.create({
        data: { userId: user.id, companyName: companyName || null, sector: sector || null }
      })
      await prisma.user.update({
        where: { id: user.id },
        data: { kycStatus: 'VERIFIED', isEmailVerified: true }
      })
    }

    // Envoyer email de vérification
    if (role !== 'BUILDER') {
      await sendVerificationEmail(email, firstName, verifyCode)
    }

    const accessToken = generateAccessToken(user.id, user.role)
    const refreshToken = generateRefreshToken(user.id)
    successResponse(res, {
      accessToken, refreshToken,
      requiresVerification: role !== 'BUILDER',
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, kycStatus: user.kycStatus, isEmailVerified: user.isEmailVerified }
    }, 'Compte créé — vérifiez votre email')
  } catch (e) { console.error(e); errorResponse(res) }
})

// ═══ VERIFY EMAIL ═══
router.post('/verify-email', async (req, res): Promise<void> => {
  try {
    const { email, code } = req.body
    if (!email || !code) { res.status(400).json({ success: false, message: 'Email et code requis' }); return }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) { res.status(404).json({ success: false, message: 'Utilisateur introuvable' }); return }
    if (user.isEmailVerified) { res.json({ success: true, message: 'Email déjà vérifié' }); return }

    if (!user.emailVerifyCode || !user.emailVerifyExpiry) {
      res.status(400).json({ success: false, message: 'Aucun code en attente' }); return
    }
    if (new Date() > user.emailVerifyExpiry) {
      res.status(400).json({ success: false, message: 'Code expiré — demandez-en un nouveau' }); return
    }
    if (user.emailVerifyCode !== code) {
      res.status(400).json({ success: false, message: 'Code incorrect' }); return
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true, emailVerifyCode: null, emailVerifyExpiry: null }
    })

    successResponse(res, { verified: true }, 'Email vérifié avec succès ✅')
  } catch (e) { console.error(e); errorResponse(res) }
})

// ═══ RESEND VERIFY CODE ═══
router.post('/resend-verify', async (req, res): Promise<void> => {
  try {
    const { email } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || user.isEmailVerified) { res.status(400).json({ success: false, message: 'Impossible' }); return }

    const verifyCode = Math.floor(100000 + Math.random() * 900000).toString()
    const verifyExpiry = new Date(Date.now() + 10 * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyCode: verifyCode, emailVerifyExpiry: verifyExpiry }
    })

    await sendVerificationEmail(email, user.firstName, verifyCode)
    successResponse(res, {}, 'Nouveau code envoyé')
  } catch (e) { errorResponse(res) }
})

// ═══ GOOGLE OAUTH — Init ═══
router.get('/google', (req, res): void => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: `${process.env.API_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  })
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

// ═══ GOOGLE OAUTH — Callback ═══
router.get('/google/callback', async (req, res): Promise<void> => {
  try {
    const { code } = req.query
    if (!code) { res.redirect(`${process.env.FRONTEND_URL}/auth/login?error=google_failed`); return }

    // Échanger code contre token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: `${process.env.API_URL}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) { res.redirect(`${process.env.FRONTEND_URL}/auth/login?error=google_failed`); return }

    // Récupérer infos Google
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const profile = await profileRes.json()
    if (!profile.email) { res.redirect(`${process.env.FRONTEND_URL}/auth/login?error=google_failed`); return }

    // Créer ou trouver l'utilisateur
    let user = await prisma.user.findUnique({ where: { email: profile.email } })

    if (!user) {
      const referralCode = Math.random().toString(36).substring(2, 10).toUpperCase()
      user = await prisma.user.create({
        data: {
          email: profile.email,
          firstName: profile.given_name || profile.name?.split(' ')[0] || 'Utilisateur',
          lastName: profile.family_name || profile.name?.split(' ').slice(1).join(' ') || '',
          password: await bcrypt.hash(Math.random().toString(36), 10),
          role: 'INVESTOR',
          referralCode,
          isEmailVerified: true,
          googleId: profile.id,
          profileImageUrl: profile.picture || null,
          country: 'SN', city: '', countryCode: 'SN', indicatif: '+221',
        }
      })
      await prisma.wallet.create({ data: { userId: user.id, balance: 0 } })
    } else if (!user.googleId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.id, isEmailVerified: true, profileImageUrl: user.profileImageUrl || profile.picture }
      })
    }

    const accessToken = generateAccessToken(user.id, user.role)
    const refreshToken = generateRefreshToken(user.id)

    // Rediriger vers le frontend avec les tokens
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}&userId=${user.id}`)
  } catch (e) {
    console.error('[GOOGLE AUTH]', e)
    res.redirect(`${process.env.FRONTEND_URL}/auth/login?error=google_failed`)
  }
})

// ═══ ME ═══
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, include: { wallet: true } })
    if (!user) { res.status(404).json({ success: false, message: 'Utilisateur introuvable' }); return }
    successResponse(res, {
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      role: user.role, kycStatus: user.kycStatus, profileImageUrl: user.profileImageUrl, level: user.level,
      phone: user.phone, city: user.city, country: user.country, region: user.region,
      countryCode: user.countryCode, indicatif: user.indicatif, isEmailVerified: user.isEmailVerified,
      totalInvested: user.totalInvested, reputationScore: user.reputationScore, wallet: user.wallet
    })
  } catch (e) { console.error(e); errorResponse(res) }
})

// ═══ REFRESH TOKEN ═══
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

// ═══ UPDATE PROFILE ═══
router.patch('/profile', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, phone, city, country, bio, region, countryCode, indicatif } = req.body
    const user = await prisma.user.update({ where: { id: req.userId }, data: { firstName, lastName, phone, city, country, bio, region, countryCode, indicatif } })
    successResponse(res, user, 'Profil mis à jour')
  } catch (e) { errorResponse(res) }
})

// ═══ AVATAR ═══
router.patch('/avatar', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { avatarUrl } = req.body
    const user = await prisma.user.update({ where: { id: req.userId }, data: { profileImageUrl: avatarUrl } })
    successResponse(res, { profileImageUrl: user.profileImageUrl }, 'Avatar mis à jour')
  } catch (e) { errorResponse(res) }
})

// ═══ PROFIL PUBLIC ═══
router.get('/profile/:userId', async (req, res): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: { id: true, firstName: true, lastName: true, role: true, city: true, country: true, bio: true, profileImageUrl: true, reputationScore: true, reputationPoints: true, level: true, kycStatus: true, createdAt: true }
    })
    if (!user) { res.status(404).json({ success: false, message: 'Utilisateur introuvable' }); return }
    const projects = await prisma.project.findMany({
      where: user.role === 'MENTOR' ? { mentorId: req.params.userId, status: { in: ['ACTIVE','FUNDED','IN_PROGRESS','COMPLETED'] } } : { entrepreneurId: req.params.userId, status: { not: 'PENDING_REVIEW' } },
      select: { id: true, title: true, sector: true, city: true, raisedAmount: true, status: true },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ success: true, data: { ...user, projects } })
  } catch (e) { res.status(500).json({ success: false }) }
})

// ═══ MENTORS ═══
router.get('/mentors', async (req, res): Promise<void> => {
  try {
    const mentors = await prisma.user.findMany({
      where: { role: 'MENTOR', kycStatus: 'VERIFIED', isActive: true, isBanned: false },
      select: { id: true, firstName: true, lastName: true, city: true, country: true, reputationScore: true, level: true, bio: true, profileImageUrl: true },
      orderBy: { reputationScore: 'desc' }
    })
    res.json({ success: true, data: mentors })
  } catch (e) { res.status(500).json({ success: false }) }
})

// ═══ BUILDER PROFILE ═══
router.patch('/builder/profile', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { companyName, sector, description, website, country, isPublic } = req.body
    const profile = await prisma.builderProfile.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId!, companyName, sector, description, website, country, isPublic },
      update: { companyName, sector, description, website, country, isPublic, updatedAt: new Date() }
    })
    successResponse(res, profile, 'Profil Bâtisseur mis à jour')
  } catch (e) { console.error(e); errorResponse(res) }
})

export default router