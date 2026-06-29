// @ts-nocheck
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export const BADGE_THRESHOLDS = [
  { badge: 'SEMEUR',          points: 0    },
  { badge: 'JARDINIER',       points: 50   },
  { badge: 'BAOBAB',          points: 200  },
  { badge: 'GRAND_BATISSEUR', points: 500  },
  { badge: 'GRAND_MECENE',    points: 1500 },
]

export function calcPoints(action: {
  type: 'DON_FONDS' | 'INVEST_DIRECT' | 'FONDS_UTILISE' | 'REMBOURSEMENT_OK',
  amount?: number
}): number {
  switch (action.type) {
    case 'DON_FONDS':        return Math.floor((action.amount || 0) / 1000) * 1
    case 'INVEST_DIRECT':    return Math.floor((action.amount || 0) / 1000) * 2
    case 'FONDS_UTILISE':    return 3
    case 'REMBOURSEMENT_OK': return 5
    default: return 0
  }
}

export function getBadgeFromPoints(points: number): string {
  let badge = 'SEMEUR'
  for (const t of BADGE_THRESHOLDS) {
    if (points >= t.points) badge = t.badge
  }
  return badge
}

export async function updateBuilderGamification(userId: string, action: {
  type: 'DON_FONDS' | 'INVEST_DIRECT' | 'FONDS_UTILISE' | 'REMBOURSEMENT_OK',
  amount?: number
}) {
  try {
    const profile = await prisma.builderProfile.findUnique({ where: { userId } })
    if (!profile) return

    const earned = calcPoints(action)
    const newPoints = (profile.reputationPoints || 0) + earned

    const now = new Date()
    let newStreak = profile.donationStreak || 0
    if (action.type === 'DON_FONDS' || action.type === 'INVEST_DIRECT') {
      if (profile.lastDonationAt) {
        const monthsDiff = (now.getTime() - profile.lastDonationAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
        newStreak = monthsDiff <= 1.5 ? newStreak + 1 : 1
      } else {
        newStreak = 1
      }
    }

    const specialBadges = [...(profile.specialBadges || [])]
    if (newStreak >= 3 && !specialBadges.includes('FIDELE')) specialBadges.push('FIDELE')

    const totalContributors = await prisma.fundContribution.count({ where: { status: 'COMPLETED' } })
    if (totalContributors <= 1 && !specialBadges.includes('FONDATEUR')) specialBadges.push('FONDATEUR')

    // Badge Ambassadeur — si 3+ Bâtisseurs parrainés actifs
    const referredBuilders = await prisma.user.count({
      where: { referredBy: userId, role: 'BUILDER' }
    })
    if (referredBuilders >= 3 && !specialBadges.includes('AMBASSADEUR')) {
      specialBadges.push('AMBASSADEUR')
      // +20 pts bonus ambassadeur
      const bonusPts = 20
      const finalPoints = newPoints + bonusPts
      await prisma.builderProfile.update({
        where: { userId },
        data: { reputationPoints: finalPoints, donationStreak: newStreak, lastDonationAt: (action.type === 'DON_FONDS' || action.type === 'INVEST_DIRECT') ? now : undefined, specialBadges }
      })
      for (const t of BADGE_THRESHOLDS) {
        if (finalPoints >= t.points) {
          await prisma.fundBadge.upsert({
            where: { userId_badge: { userId, badge: t.badge } },
            create: { userId, badge: t.badge },
            update: {}
          })
        }
      }
      return { newPoints: finalPoints, earned: earned + bonusPts, newStreak }
    }

    await prisma.builderProfile.update({
      where: { userId },
      data: {
        reputationPoints: newPoints,
        donationStreak: newStreak,
        lastDonationAt: (action.type === 'DON_FONDS' || action.type === 'INVEST_DIRECT') ? now : undefined,
        specialBadges,
        totalDonated: action.type === 'DON_FONDS' ? { increment: action.amount || 0 } : undefined,
        totalInvested: action.type === 'INVEST_DIRECT' ? { increment: action.amount || 0 } : undefined,
      }
    })

    for (const t of BADGE_THRESHOLDS) {
      if (newPoints >= t.points) {
        await prisma.fundBadge.upsert({
          where: { userId_badge: { userId, badge: t.badge } },
          create: { userId, badge: t.badge },
          update: {}
        })
      }
    }

    return { newPoints, earned, newStreak }
  } catch (e) { console.error('[GAMIFICATION] Erreur:', e) }
}

export async function updateTopDonor() {
  try {
    const top = await prisma.builderProfile.findFirst({ orderBy: { totalDonated: 'desc' } })
    if (!top) return
    await prisma.builderProfile.updateMany({ data: { isTopDonor: false } })
    const badges = [...(top.specialBadges || [])]
    if (!badges.includes('ROI_FONDS')) badges.push('ROI_FONDS')
    await prisma.builderProfile.update({
      where: { id: top.id },
      data: { isTopDonor: true, specialBadges: badges }
    })
  } catch (e) { console.error('[GAMIFICATION] updateTopDonor:', e) }
}

export async function decrementInactiveBuilders() {
  try {
    const profiles = await prisma.builderProfile.findMany()
    const now = new Date()
    for (const p of profiles) {
      if (!p.lastDonationAt) continue
      const monthsInactive = (now.getTime() - p.lastDonationAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
      let decrement = 0
      if (monthsInactive > 6) decrement = 10
      else if (monthsInactive > 3) decrement = 5
      if (decrement > 0) {
        // Plancher = jamais descendre en dessous du badge précédent
        const currentBadge = getBadgeFromPoints(p.reputationPoints || 0)
        const currentThreshold = BADGE_THRESHOLDS.find(t => t.badge === currentBadge)?.points || 0
        const prevThreshold = [...BADGE_THRESHOLDS].reverse().find(t => t.points < currentThreshold)?.points || 0
        const newPoints = Math.max(prevThreshold, (p.reputationPoints || 0) - decrement)
        await prisma.builderProfile.update({
          where: { id: p.id },
          data: { reputationPoints: newPoints, donationStreak: Math.max(0, (p.donationStreak || 0) - 1) }
        })
        console.log('[GAMIFICATION] ' + p.userId + ' -' + decrement + ' pts inactif → ' + newPoints + ' pts (plancher: ' + prevThreshold + ')')
      }
    }
    console.log('[GAMIFICATION] Decrementation terminee')
  } catch (e) { console.error('[GAMIFICATION] decrementInactive:', e) }
}
