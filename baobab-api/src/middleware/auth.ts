import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import prisma from '../config/database'

export interface AuthRequest extends Request {
  userId?: string
  userRole?: string
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Token manquant' })
      return
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, config.jwt.secret) as {
      userId: string
      role: string
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, isActive: true, isBanned: true },
    })

    if (!user || !user.isActive || user.isBanned) {
      res.status(401).json({ success: false, message: 'Compte non autorisé' })
      return
    }

    req.userId = decoded.userId
    req.userRole = decoded.role
    next()
  } catch {
    res.status(401).json({ success: false, message: 'Token invalide ou expiré' })
  }
}

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.userRole !== 'ADMIN') {
    res.status(403).json({ success: false, message: 'Accès refusé' })
    return
  }
  next()
}

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ success: false, message: 'Accès refusé' })
      return
    }
    next()
  }
}
