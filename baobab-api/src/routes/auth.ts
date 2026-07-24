import { Router, Response, Request } from 'express'
import bcrypt from 'bcryptjs'
import nodemailer from 'nodemailer'
import rateLimit from 'express-rate-limit'
import prisma from '../config/database'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt'
import { authenticate, AuthRequest } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/helpers'
import { config } from '../config'

const router = Router()

// ═══════════════════════════════════════════════════════
// EMAIL SERVICE
// ═══════════════════════════════════════════════════════

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})

async function sendVerificationEmail(email: string, firstName: string, code: string): Promise<void> {
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
            <p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0;">© 2026 KORAPACT</p>
          </div>
        </div>
      `,
    })
  } catch (e) {
    console.error('[EMAIL] Erreur envoi code vérification:', (e as Error).message)
  }
}

// ═══════════════════════════════════════════════════════
// RATE LIMITERS
// ═══════════════════════════════════════════════════════

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, message: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5,
  message: { success: false, message: 'Trop de comptes créés depuis cette IP. Réessayez dans 1 heure.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  return req.socket?.remoteAddress || 'unknown'
}

/** Vérifie si un utilisateur est actuellement bloqué (temporaire ou définitif). */
function isCurrentlyBanned(user: { isBanned: boolean; rehabilitationAt: Date | null }): boolean {
  if (!user.isBanned) return false
  // Blocage temporaire expiré → on laisse passer (le déblocage auto se fait au login)
  if (user.rehabilitationAt && new Date() > user.rehabilitationAt) return false
  return true
}

/** Déblocage automatique si la date de réhabilitation est passée. */
async function autoUnbanIfExpired(userId: string, rehabilitationAt: Date | null): Promise<void> {
  if (rehabilitationAt && new Date() > rehabilitationAt) {
    await prisma.user.update({
      where: { id: userId },
      data: { isBanned: false, isActive: true, banReason: null, bannedAt: null, rehabilitationAt: null },
    })
  }
}

// ═══════════════════════════════════════════════════════
// CONNEXION UTILISATEUR (interdit aux admins)
// ═══════════════════════════════════════════════════════

router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email?: string; password?: string }

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email et mot de passe requis' })
      return
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })

    // Réponse générique : ne révèle pas si le compte existe
    if (!user) {
      res.status(401).json({ success: false, message: 'Identifiants invalides' })
      return
    }

    // Bloquer silencieusement les administrateurs — ne pas révéler leur existence
    if (user.role === 'ADMIN') {
      res.status(401).json({ success: false, message: 'Identifiants invalides' })
      return
    }

    // Déblocage automatique si blocage temporaire expiré
    await autoUnbanIfExpired(user.id, user.rehabilitationAt)

    // Relire l'état mis à jour
    const freshUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, kycStatus: true, profileImageUrl: true, level: true, isEmailVerified: true, isActive: true, isBanned: true, rehabilitationAt: true, password: true },
    })

    if (!freshUser) {
      res.status(401).json({ success: false, message: 'Identifiants invalides' })
      return
    }

    if (!freshUser.isActive) {
      res.status(403).json({ success: false, message: 'Ce compte a été désactivé. Contactez le support.' })
      return
    }

    if (isCurrentlyBanned(freshUser)) {
      const until = freshUser.rehabilitationAt
        ? `jusqu'au ${new Date(freshUser.rehabilitationAt).toLocaleDateString('fr-FR')}`
        : 'définitivement'
      res.status(403).json({ success: false, message: `Compte bloqué ${until}.` })
      return
    }

    const valid = await bcrypt.compare(password, freshUser.password)
    if (!valid) {
      res.status(401).json({ success: false, message: 'Identifiants invalides' })
      return
    }

    const accessToken = generateAccessToken(freshUser.id, freshUser.role)
    const refreshToken = generateRefreshToken(freshUser.id)

    successResponse(res, {
      accessToken,
      refreshToken,
      user: {
        id: freshUser.id,
        email: freshUser.email,
        firstName: freshUser.firstName,
        lastName: freshUser.lastName,
        role: freshUser.role,
        kycStatus: freshUser.kycStatus,
        profileImageUrl: freshUser.profileImageUrl,
        level: freshUser.level,
        isEmailVerified: freshUser.isEmailVerified,
      },
    }, 'Connexion réussie')
  } catch (e) {
    console.error('[AUTH] Erreur login:', e)
    errorResponse(res)
  }
})

// ═══════════════════════════════════════════════════════
// CONNEXION ADMINISTRATEUR (route séparée et sécurisée)
// ═══════════════════════════════════════════════════════

router.post('/admin/login', adminLoginLimiter, async (req: Request, res: Response): Promise<void> => {
  const ip = getClientIp(req)
  const ua = req.headers['user-agent'] || 'unknown'

  try {
    const { email, password } = req.body as { email?: string; password?: string }

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email et mot de passe requis' })
      return
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })

    // Toujours répondre de manière générique
    if (!user || user.role !== 'ADMIN') {
      await logAdminAction(null, 'LOGIN_FAILED', null, `Tentative avec email inconnu ou non-admin: ${email}`, ip, ua)
      res.status(401).json({ success: false, message: 'Accès refusé' })
      return
    }

    if (!user.isActive || isCurrentlyBanned(user)) {
      await logAdminAction(user.id, 'LOGIN_FAILED', null, 'Compte désactivé ou bloqué', ip, ua)
      res.status(401).json({ success: false, message: 'Accès refusé' })
      return
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      await logAdminAction(user.id, 'LOGIN_FAILED', null, 'Mot de passe incorrect', ip, ua)
      res.status(401).json({ success: false, message: 'Accès refusé' })
      return
    }

    const accessToken = generateAccessToken(user.id, user.role)
    const refreshToken = generateRefreshToken(user.id)

    await logAdminAction(user.id, 'LOGIN_SUCCESS', null, 'Connexion administrateur réussie', ip, ua)

    successResponse(res, {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    }, 'Connexion administrateur réussie')
  } catch (e) {
    console.error('[AUTH] Erreur admin login:', e)
    await logAdminAction(null, 'LOGIN_ERROR', null, `Erreur serveur lors de la connexion`, ip, ua).catch(() => {})
    errorResponse(res)
  }
})

// ═══════════════════════════════════════════════════════
// INSCRIPTION
// ═══════════════════════════════════════════════════════

router.post('/register', registerLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, phone, role, country, city, region, countryCode, indicatif, companyName, sector } = req.body as Record<string, string>

    if (!email || !password || !firstName || !lastName || !phone) {
      res.status(400).json({ success: false, message: 'Champs obligatoires manquants (prénom, nom, email, téléphone, mot de passe)' })
      return
    }

    if (password.length < 8) {
      res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 8 caractères' })
      return
    }

    const normalizedEmail = email.toLowerCase().trim()

    const [existingEmail, existingPhone] = await Promise.all([
      prisma.user.findUnique({ where: { email: normalizedEmail } }),
      prisma.user.findUnique({ where: { phone: phone.trim() } }),
    ])

    if (existingEmail) {
      res.status(409).json({ success: false, message: 'Un compte existe déjà avec cet email — connectez-vous' })
      return
    }

    if (existingPhone) {
      res.status(409).json({ success: false, message: 'Un compte existe déjà avec ce numéro de téléphone — connectez-vous' })
      return
    }

    const assignedRole = role && ['INVESTOR', 'ENTREPRENEUR', 'MENTOR', 'BUILDER'].includes(role) ? role : 'INVESTOR'

    const hashed = await bcrypt.hash(password, 10)
    const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase()

    const verifyCode = Math.floor(100000 + Math.random() * 900000).toString()
    const verifyExpiry = new Date(Date.now() + 10 * 60 * 1000)

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashed,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        role: assignedRole as 'INVESTOR' | 'ENTREPRENEUR' | 'MENTOR' | 'BUILDER',
        referralCode,
        country: country || 'SN',
        city: city || '',
        region: region || '',
        countryCode: countryCode || 'SN',
        indicatif: indicatif || '+221',
        emailVerifyCode: verifyCode,
        emailVerifyExpiry: verifyExpiry,
        isEmailVerified: false,
      },
    })

    await prisma.wallet.create({ data: { userId: user.id, balance: 0 } })

    if (assignedRole === 'BUILDER') {
      await prisma.builderProfile.create({
        data: { userId: user.id, companyName: companyName || null, sector: sector || null },
      })
      // Les bâtisseurs n'ont pas besoin de vérification email — accès immédiat
      await prisma.user.update({
        where: { id: user.id },
        data: { kycStatus: 'VERIFIED', isEmailVerified: true },
      })
    } else {
      await sendVerificationEmail(normalizedEmail, user.firstName, verifyCode)
    }

    const accessToken = generateAccessToken(user.id, user.role)
    const refreshToken = generateRefreshToken(user.id)

    successResponse(res, {
      accessToken,
      refreshToken,
      requiresVerification: assignedRole !== 'BUILDER',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        kycStatus: user.kycStatus,
        isEmailVerified: user.isEmailVerified,
      },
    }, assignedRole === 'BUILDER' ? 'Compte créé avec succès' : 'Compte créé — vérifiez votre email')
  } catch (e) {
    console.error('[AUTH] Erreur register:', e)
    errorResponse(res)
  }
})

// ═══════════════════════════════════════════════════════
// VÉRIFICATION EMAIL (OTP)
// ═══════════════════════════════════════════════════════

router.post('/verify-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, code } = req.body as { email?: string; code?: string }

    if (!email || !code) {
      res.status(400).json({ success: false, message: 'Email et code requis' })
      return
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })

    if (!user) {
      res.status(404).json({ success: false, message: 'Utilisateur introuvable' })
      return
    }

    if (user.isEmailVerified) {
      res.json({ success: true, message: 'Email déjà vérifié' })
      return
    }

    if (!user.emailVerifyCode || !user.emailVerifyExpiry) {
      res.status(400).json({ success: false, message: 'Aucun code en attente — demandez-en un nouveau' })
      return
    }

    if (new Date() > user.emailVerifyExpiry) {
      res.status(400).json({ success: false, message: 'Code expiré — demandez-en un nouveau' })
      return
    }

    if (user.emailVerifyCode !== code.trim()) {
      res.status(400).json({ success: false, message: 'Code incorrect' })
      return
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true, emailVerifyCode: null, emailVerifyExpiry: null },
    })

    successResponse(res, { verified: true }, 'Email vérifié avec succès ✅')
  } catch (e) {
    console.error('[AUTH] Erreur verify-email:', e)
    errorResponse(res)
  }
})

// ═══════════════════════════════════════════════════════
// RENVOI DU CODE DE VÉRIFICATION
// ═══════════════════════════════════════════════════════

router.post('/resend-verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email?: string }

    if (!email) {
      res.status(400).json({ success: false, message: 'Email requis' })
      return
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })

    if (!user) {
      // Ne pas révéler l'inexistence — réponse neutre
      res.json({ success: true, message: 'Si ce compte existe, un nouveau code a été envoyé' })
      return
    }

    if (user.isEmailVerified) {
      res.status(400).json({ success: false, message: 'Cet email est déjà vérifié' })
      return
    }

    const verifyCode = Math.floor(100000 + Math.random() * 900000).toString()
    const verifyExpiry = new Date(Date.now() + 10 * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyCode: verifyCode, emailVerifyExpiry: verifyExpiry },
    })

    await sendVerificationEmail(user.email, user.firstName, verifyCode)

    successResponse(res, {}, 'Nouveau code envoyé')
  } catch (e) {
    console.error('[AUTH] Erreur resend-verify:', e)
    errorResponse(res)
  }
})

// ═══════════════════════════════════════════════════════
// GOOGLE OAUTH — Initiation
// ═══════════════════════════════════════════════════════

router.get('/google', (req: Request, res: Response): void => {
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

// ═══════════════════════════════════════════════════════
// GOOGLE OAUTH — Callback
// ═══════════════════════════════════════════════════════

router.get('/google/callback', async (req: Request, res: Response): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || config.app.frontendUrl
  try {
    const { code } = req.query

    if (!code || typeof code !== 'string') {
      res.redirect(`${frontendUrl}/auth/login?error=google_failed`)
      return
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: `${process.env.API_URL}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenRes.json() as { access_token?: string }

    if (!tokenData.access_token) {
      res.redirect(`${frontendUrl}/auth/login?error=google_failed`)
      return
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    const profile = await profileRes.json() as { email?: string; given_name?: string; family_name?: string; name?: string; id?: string; picture?: string }

    if (!profile.email) {
      res.redirect(`${frontendUrl}/auth/login?error=google_failed`)
      return
    }

    const normalizedEmail = profile.email.toLowerCase().trim()
    let user = await prisma.user.findUnique({ where: { email: normalizedEmail } })

    // Bloquer les admins — ne pas leur permettre de passer par OAuth public
    if (user && user.role === 'ADMIN') {
      res.redirect(`${frontendUrl}/auth/login?error=google_failed`)
      return
    }

    // Déblocage auto si nécessaire
    if (user) {
      await autoUnbanIfExpired(user.id, user.rehabilitationAt)
      user = await prisma.user.findUnique({ where: { id: user.id } })
    }

    if (user && (!user!.isActive || isCurrentlyBanned(user!))) {
      res.redirect(`${frontendUrl}/auth/login?error=account_blocked`)
      return
    }

    if (!user) {
      const referralCode = Math.random().toString(36).substring(2, 10).toUpperCase()
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          firstName: profile.given_name || profile.name?.split(' ')[0] || 'Utilisateur',
          lastName: profile.family_name || profile.name?.split(' ').slice(1).join(' ') || '',
          password: await bcrypt.hash(Math.random().toString(36) + Date.now(), 10),
          role: 'INVESTOR',
          referralCode,
          isEmailVerified: true,
          googleId: profile.id,
          profileImageUrl: profile.picture || null,
          country: 'SN',
          city: '',
          countryCode: 'SN',
          indicatif: '+221',
          phone: `google_${Date.now()}`, // placeholder unique — à compléter via profil
        },
      })
      await prisma.wallet.create({ data: { userId: user.id, balance: 0 } })
    } else if (!user.googleId) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: profile.id,
          isEmailVerified: true,
          profileImageUrl: user.profileImageUrl || profile.picture || null,
        },
      })
    }

    const accessToken = generateAccessToken(user.id, user.role)
    const refreshToken = generateRefreshToken(user.id)

    res.redirect(`${frontendUrl}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`)
  } catch (e) {
    console.error('[AUTH] Erreur Google OAuth callback:', e)
    res.redirect(`${process.env.FRONTEND_URL || config.app.frontendUrl}/auth/login?error=google_failed`)
  }
})

// ═══════════════════════════════════════════════════════
// REFRESH TOKEN
// ═══════════════════════════════════════════════════════

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string }

    if (!refreshToken) {
      res.status(400).json({ success: false, message: 'Refresh token manquant' })
      return
    }

    let decoded: { userId: string }
    try {
      decoded = verifyRefreshToken(refreshToken)
    } catch {
      res.status(401).json({ success: false, message: 'Token invalide ou expiré' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, isActive: true, isBanned: true, rehabilitationAt: true },
    })

    if (!user) {
      res.status(401).json({ success: false, message: 'Token invalide' })
      return
    }

    // Déblocage auto
    await autoUnbanIfExpired(user.id, user.rehabilitationAt)
    const freshUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, isActive: true, isBanned: true, rehabilitationAt: true },
    })

    if (!freshUser || !freshUser.isActive || isCurrentlyBanned(freshUser)) {
      res.status(401).json({ success: false, message: 'Compte non autorisé' })
      return
    }

    const newAccessToken = generateAccessToken(freshUser.id, freshUser.role)
    const newRefreshToken = generateRefreshToken(freshUser.id)

    successResponse(res, { accessToken: newAccessToken, refreshToken: newRefreshToken })
  } catch (e) {
    console.error('[AUTH] Erreur refresh:', e)
    res.status(401).json({ success: false, message: 'Token invalide ou expiré' })
  }
})

// ═══════════════════════════════════════════════════════
// PROFIL COURANT
// ═══════════════════════════════════════════════════════

router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { wallet: true },
    })

    if (!user) {
      res.status(404).json({ success: false, message: 'Utilisateur introuvable' })
      return
    }

    successResponse(res, {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      kycStatus: user.kycStatus,
      profileImageUrl: user.profileImageUrl,
      level: user.level,
      phone: user.phone,
      city: user.city,
      country: user.country,
      region: user.region,
      countryCode: user.countryCode,
      indicatif: user.indicatif,
      isEmailVerified: user.isEmailVerified,
      totalInvested: user.totalInvested,
      reputationScore: user.reputationScore,
      wallet: user.wallet,
    })
  } catch (e) {
    console.error('[AUTH] Erreur /me:', e)
    errorResponse(res)
  }
})

// ═══════════════════════════════════════════════════════
// MISE À JOUR DU PROFIL
// ═══════════════════════════════════════════════════════

router.patch('/profile', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, phone, city, country, bio, region, countryCode, indicatif } = req.body as Record<string, string | undefined>

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { firstName, lastName, phone, city, country, bio, region, countryCode, indicatif },
    })

    successResponse(res, user, 'Profil mis à jour')
  } catch (e) {
    console.error('[AUTH] Erreur update profile:', e)
    errorResponse(res)
  }
})

// ═══════════════════════════════════════════════════════
// AVATAR
// ═══════════════════════════════════════════════════════

router.patch('/avatar', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { avatarUrl } = req.body as { avatarUrl?: string }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { profileImageUrl: avatarUrl },
    })

    successResponse(res, { profileImageUrl: user.profileImageUrl }, 'Avatar mis à jour')
  } catch (e) {
    console.error('[AUTH] Erreur avatar:', e)
    errorResponse(res)
  }
})

// ═══════════════════════════════════════════════════════
// PROFIL PUBLIC D'UN UTILISATEUR
// ═══════════════════════════════════════════════════════

router.get('/profile/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: String(req.params.userId) },
      select: {
        id: true, firstName: true, lastName: true, role: true,
        city: true, country: true, bio: true, profileImageUrl: true,
        reputationScore: true, reputationPoints: true, level: true,
        kycStatus: true, createdAt: true,
      },
    })

    if (!user) {
      res.status(404).json({ success: false, message: 'Utilisateur introuvable' })
      return
    }

    const projects = await prisma.project.findMany({
      where: user.role === 'MENTOR'
        ? { mentorId: String(req.params.userId), status: { in: ['ACTIVE', 'FUNDED', 'IN_PROGRESS', 'COMPLETED'] } }
        : { entrepreneurId: String(req.params.userId), status: { not: 'PENDING_REVIEW' } },
      select: { id: true, title: true, sector: true, city: true, raisedAmount: true, status: true },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, data: { ...user, projects } })
  } catch (e) {
    console.error('[AUTH] Erreur profil public:', e)
    res.status(500).json({ success: false })
  }
})

// ═══════════════════════════════════════════════════════
// LISTE DES MENTORS CERTIFIÉS
// ═══════════════════════════════════════════════════════

router.get('/mentors', async (req: Request, res: Response): Promise<void> => {
  try {
    const mentors = await prisma.user.findMany({
      where: { role: 'MENTOR', kycStatus: 'VERIFIED', isActive: true, isBanned: false },
      select: {
        id: true, firstName: true, lastName: true,
        city: true, country: true, reputationScore: true,
        level: true, bio: true, profileImageUrl: true,
      },
      orderBy: { reputationScore: 'desc' },
    })

    res.json({ success: true, data: mentors })
  } catch (e) {
    console.error('[AUTH] Erreur mentors:', e)
    res.status(500).json({ success: false })
  }
})

// ═══════════════════════════════════════════════════════
// PROFIL BÂTISSEUR
// ═══════════════════════════════════════════════════════

router.patch('/builder/profile', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { companyName, sector, description, website, country, isPublic } = req.body as Record<string, string | boolean | undefined>

    const profile = await prisma.builderProfile.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId!, companyName: companyName as string, sector: sector as string, description: description as string, website: website as string, country: country as string, isPublic: Boolean(isPublic) },
      update: { companyName: companyName as string, sector: sector as string, description: description as string, website: website as string, country: country as string, isPublic: Boolean(isPublic), updatedAt: new Date() },
    })

    successResponse(res, profile, 'Profil Bâtisseur mis à jour')
  } catch (e) {
    console.error('[AUTH] Erreur builder profile:', e)
    errorResponse(res)
  }
})

// ═══════════════════════════════════════════════════════
// HELPER INTERNE — Journalisation admin
// ═══════════════════════════════════════════════════════

async function logAdminAction(
  adminId: string | null,
  action: string,
  targetUserId: string | null,
  reason: string,
  ip: string,
  ua: string,
): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId,
        action,
        targetUserId,
        reason,
        ipAddress: ip,
        userAgent: ua.substring(0, 500),
      },
    })
  } catch {
    // Ne pas crasher si la journalisation échoue
    console.warn('[AUDIT] Journalisation échouée pour action:', action)
  }
}


// ═══════════════════════════════════════════════════════
// MOT DE PASSE OUBLIÉ
// ═══════════════════════════════════════════════════════

router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email?: string }
    if (!email) { res.status(400).json({ success: false, message: 'Email requis' }); return }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })

    if (!user || user.role === 'ADMIN') {
      res.json({ success: true, message: 'Si ce compte existe, un email a été envoyé.' })
      return
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString()
    const resetExpiry = new Date(Date.now() + 15 * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyCode: resetCode, emailVerifyExpiry: resetExpiry },
    })

    await transporter.sendMail({
      from: `"KORAPACT" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Réinitialisation de votre mot de passe KORAPACT',
      html: `
        <div style="max-width:520px;margin:40px auto;background:#0C1024;border:1px solid rgba(255,255,255,0.07);border-radius:24px;overflow:hidden;font-family:'Segoe UI',sans-serif;">
          <div style="background:linear-gradient(135deg,#2563EB,#06B6D4);padding:40px;text-align:center;">
            <div style="width:52px;height:52px;background:rgba(255,255,255,0.15);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:#fff;margin-bottom:16px;">K</div>
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:900;">KORAPACT</h1>
          </div>
          <div style="padding:40px;">
            <h2 style="color:#fff;font-size:20px;font-weight:800;margin:0 0 12px;">Bonjour ${user.firstName}</h2>
            <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.7;margin:0 0 32px;">Votre code de réinitialisation :</p>
            <div style="background:rgba(37,99,235,0.1);border:2px solid rgba(37,99,235,0.4);border-radius:20px;padding:32px;text-align:center;margin-bottom:32px;">
              <div style="font-size:48px;font-weight:900;letter-spacing:20px;color:#fff;font-family:monospace;">${resetCode}</div>
              <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:16px 0 0;">Expire dans <strong style="color:#06B6D4;">15 minutes</strong></p>
            </div>
            <p style="color:rgba(255,255,255,0.3);font-size:13px;">Si vous n avez pas demande cette reinitialisation, ignorez cet email.</p>
          </div>
          <div style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0;">2026 KORAPACT</p>
          </div>
        </div>
      `,
    })

    res.json({ success: true, message: 'Si ce compte existe, un email a ete envoye.' })
  } catch (e) {
    console.error('[AUTH] Erreur forgot-password:', e)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
})

// ═══════════════════════════════════════════════════════
// RÉINITIALISATION DU MOT DE PASSE
// ═══════════════════════════════════════════════════════

router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, code, newPassword } = req.body as { email?: string; code?: string; newPassword?: string }

    if (!email || !code || !newPassword) {
      res.status(400).json({ success: false, message: 'Email, code et nouveau mot de passe requis' }); return
    }
    if (newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 8 caracteres' }); return
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (!user || !user.emailVerifyCode || !user.emailVerifyExpiry) {
      res.status(400).json({ success: false, message: 'Code invalide ou expire' }); return
    }
    if (new Date() > user.emailVerifyExpiry) {
      res.status(400).json({ success: false, message: 'Code expire — recommencez' }); return
    }
    if (user.emailVerifyCode !== code.trim()) {
      res.status(400).json({ success: false, message: 'Code incorrect' }); return
    }

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, emailVerifyCode: null, emailVerifyExpiry: null },
    })

    successResponse(res, {}, 'Mot de passe reinitialise avec succes')
  } catch (e) {
    console.error('[AUTH] Erreur reset-password:', e)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
})

export { logAdminAction }
export default router