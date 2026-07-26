// @ts-nocheck
// Service de parrainage — bonus versé UNIQUEMENT quand :
//   1) le filleul a vérifié son KYC (déjà obligatoire pour investir)
//   2) le filleul a fait son premier investissement
//   3) le parrain a lui-même déjà investi au moins une fois
// Budget partagé entre tous les parrainages — coupure auto si dépassé.
// Appelé après CHAQUE investissement réussi (voir investments.ts).

async function getReferralConfig(tx: any) {
  const configs = await tx.platformConfig.findMany({
    where: { key: { in: ['referral_bonus_amount', 'referral_budget_total', 'referral_budget_spent', 'referral_program_active'] } }
  })
  const map: Record<string, number> = {}
  configs.forEach((c: any) => { map[c.key] = Number(c.value) })
  return {
    bonusAmount: map.referral_bonus_amount ?? 2000,
    budgetTotal: map.referral_budget_total ?? 200000,
    budgetSpent: map.referral_budget_spent ?? 0,
    programActive: (map.referral_program_active ?? 1) === 1,
  }
}

async function hasInvested(userId: string, tx: any): Promise<boolean> {
  const count = await tx.investment.count({ where: { userId } })
  return count > 0
}

async function payReferralBonus(parrainId: string, filleulId: string, tx: any) {
  const cfg = await getReferralConfig(tx)
  if (!cfg.programActive) return false
  if (cfg.budgetSpent + cfg.bonusAmount > cfg.budgetTotal) {
    // Budget épuisé — coupure automatique du programme
    await tx.platformConfig.upsert({
      where: { key: 'referral_program_active' },
      update: { value: 0 },
      create: { key: 'referral_program_active', value: 0, label: 'Programme de parrainage actif', description: '1 = actif, 0 = désactivé' },
    })
    return false
  }
  await tx.wallet.update({ where: { userId: parrainId }, data: { balance: { increment: cfg.bonusAmount } } })
  await tx.user.update({ where: { id: filleulId }, data: { referralBonusPaid: true } })
  await tx.user.update({ where: { id: parrainId }, data: { referralCount: { increment: 1 }, referralEarned: { increment: cfg.bonusAmount } } })
  await tx.platformConfig.upsert({
    where: { key: 'referral_budget_spent' },
    update: { value: { increment: cfg.bonusAmount } },
    create: { key: 'referral_budget_spent', value: cfg.bonusAmount, label: 'Budget parrainage dépensé (FCFA)', description: 'Compteur système' },
  })
  const parrain = await tx.user.findUnique({ where: { id: parrainId }, select: { firstName: true } })
  const filleul = await tx.user.findUnique({ where: { id: filleulId }, select: { firstName: true } })
  await tx.notification.create({
    data: {
      userId: parrainId,
      title: '🎁 Bonus de parrainage reçu !',
      body: `${filleul?.firstName || 'Votre filleul'} a investi — vous recevez ${cfg.bonusAmount.toLocaleString()} FCFA de bonus.`,
      type: 'REFERRAL_BONUS',
      data: JSON.stringify({ amount: cfg.bonusAmount, filleulId })
    }
  })
  return true
}

// À appeler après chaque investissement réussi, avec l'id de l'investisseur.
export async function checkAndPayReferralBonus(userId: string, tx: any) {
  try {
    // Cas A — cet utilisateur EST un filleul, jamais payé, et son parrain a déjà investi
    const user = await tx.user.findUnique({ where: { id: userId }, select: { referredBy: true, referralBonusPaid: true } })
    if (user?.referredBy && !user.referralBonusPaid) {
      const parrainInvested = await hasInvested(user.referredBy, tx)
      if (parrainInvested) {
        await payReferralBonus(user.referredBy, userId, tx)
      }
    }
    // Cas B — cet utilisateur EST parrain pour des filleuls déjà qualifiés
    // (KYC + investi) mais bloqués jusqu'ici car LUI n'avait pas encore investi
    const pendingFilleuls = await tx.user.findMany({
      where: { referredBy: userId, referralBonusPaid: false },
      select: { id: true }
    })
    for (const f of pendingFilleuls) {
      const filleulInvested = await hasInvested(f.id, tx)
      if (filleulInvested) {
        await payReferralBonus(userId, f.id, tx)
      }
    }
  } catch (e) {
    console.error('[REFERRAL] Erreur vérification bonus:', e)
  }
}
