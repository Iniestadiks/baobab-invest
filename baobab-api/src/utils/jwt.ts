// @ts-nocheck
import jwt from 'jsonwebtoken'
import { config } from '../config'

export const generateAccessToken = (userId: string, role: string): string => {
  return jwt.sign({ userId, role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as string,
  })
}

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ userId }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as string,
  })
}

export const verifyRefreshToken = (token: string): { userId: string } => {
  return jwt.verify(token, config.jwt.refreshSecret) as { userId: string }
}
