// @ts-nocheck
import { PrismaClient } from '@prisma/client'
import { getProjectFees } from '../config/fees'
const prisma = new PrismaClient()

// ═══════════════════════════════════════════════════════════════════
// Échec de projet — remboursement en deux temps :
//  1) Argent des paliers JAMAIS débloqués → restitué directement à TOUS
//     les investisseurs (ce n'est pas une perte, c'est de l'argent qui
//     n'a simplement jamais quitté la plateforme).
//  2) Compensation assurance sur la perte RÉELLEMENT décaissée
//     (ce que l'entrepreneur a reçu et ne remboursera jamais) — réservée
//     aux investisseurs assurés, plafonnée à 80%, selon le pot dispo.
//  Les deux volets sont diminués des frais opérateur de paiement réels
//  (taux figé du projet), car ces frais ne sont jamais récupérables.
// ═══════════════════════════════════════════════════════════════════
export async function executeProjectFailure(projectId: string, reason: string | undefined, triggeredBy: 'ADMIN' | 'AUTO_COLLECTION') {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      investments: { include: { user: { select: { id: true, firstName: true } } } },
      entrepreneur: { select: { id: true, firstName: true } },
      repaymentSchedules: { include: { payments: { where: { status: 'PAID' } } } },
    }
  })
  if (!project) return { success: false, message: 'Projet introuvable' }
  if (project.status === 'FAILED') return { success: false, message: 'Projet déjà en échec' }

  const fees = await getProjectFees(project)
  const operatorFeeRate = (fees.payin_repayment || 4) / 100
  const maxCoverageRate = 80

  const totalRaised = project.investments.reduce((s: number, i: any) => s + i.amount, 0) || 1
  const netAmount = project.netAmount || Math.round((project.goalAmount || 0) * 0.90)
  const currentPalier = project.currentPalier || 1
  // Part du netAmount encore jamais versée à l'entrepreneur selon le palier atteint
  const undisbursedPct = currentPalier >= 3 ? 0 : currentPalier === 2 ? 0.35 : 0.60 // P1 seul -> P2+P3 restants (25+35), P1+P2 -> P3 restant (35)
  const undisbursedTotal = Math.round(netAmount * undisbursedPct)

  const insuredInvs = project.investments.filter((i: any) => (i.guaranteeContribution || 0) > 0)
  const totalInsured = insuredInvs.reduce((s: number, i: any) => s + i.amount, 0)
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
  const adminWallet = adminUser ? await prisma.wallet.findUnique({ where: { userId: adminUser.id } }) : null
  const availableGuarantee = adminWallet?.guaranteeBalance || 0

  const totalPaidBySchedules = (project.repaymentSchedules || []).reduce(
    (sum: number, sch: any) => sum + sch.payments.reduce((s: number, p: any) => s + (p.amount || 0), 0), 0
  )

  let totalGuaranteeDistributed = 0
  let totalUndisbursedDistributed = 0

  try {
    await prisma.$transaction(async (tx: any) => {
      // Réservation atomique et conditionnelle — AVANT tout crédit d'argent.
      // Le contrôle "déjà en échec" ci-dessus se basait sur une lecture
      // périmée faite avant la transaction : deux déclenchements concurrents
      // (admin + cron automatique de recouvrement, par exemple) pouvaient
      // tous deux passer cette vérification et indemniser les investisseurs
      // deux fois, en pénalisant l'entrepreneur deux fois également.
      const reserved = await tx.project.updateMany({
        where: { id: project.id, status: { not: 'FAILED' } },
        data: { status: 'FAILED' }
      })
      if (reserved.count === 0) {
        throw new Error('ALREADY_FAILED')
      }

      for (const inv of project.investments) {
        const shareOfTotal = inv.amount / totalRaised
        const alreadyReceived = Math.round(totalPaidBySchedules * shareOfTotal)
      const undisbursedShare = Math.round(undisbursedTotal * shareOfTotal)

      const isInsured = (inv.guaranteeContribution || 0) > 0
      const perteAvantAssurance = Math.max(0, inv.amount - alreadyReceived - undisbursedShare)
      const plafond80 = Math.round(inv.amount * maxCoverageRate / 100)
      const proportionAssurance = totalInsured > 0 ? inv.amount / totalInsured : 0
      const fondsProrata = Math.round(availableGuarantee * proportionAssurance)
      const guaranteeShare = isInsured ? Math.min(perteAvantAssurance, plafond80, fondsProrata) : 0

      const brut = undisbursedShare + Math.max(0, guaranteeShare)
      const fraisOperateur = Math.round(brut * operatorFeeRate)
      const net = Math.max(0, brut - fraisOperateur)

      if (net > 0) {
        await tx.wallet.update({
          where: { userId: inv.userId },
          data: { balance: { increment: net }, gainBalance: { increment: net }, totalEarned: { increment: net } }
        })
      }
      totalGuaranteeDistributed += Math.max(0, guaranteeShare)
      totalUndisbursedDistributed += undisbursedShare

      const parts: string[] = []
      if (undisbursedShare > 0) parts.push(`${undisbursedShare.toLocaleString()} FCFA de fonds jamais débloqués restitués`)
      if (guaranteeShare > 0) parts.push(`${guaranteeShare.toLocaleString()} FCFA de compensation assurance`)
      if (fraisOperateur > 0) parts.push(`${fraisOperateur.toLocaleString()} FCFA de frais opérateur déduits`)
      const detailMsg = parts.length > 0 ? parts.join(', ') + `. Net reçu : ${net.toLocaleString()} FCFA.` : `Aucune compensation disponible (non assuré et fonds déjà entièrement décaissés).`

      await tx.notification.create({
        data: {
          userId: inv.userId,
          title: net > 0 ? '💸 Remboursement échec de projet' : '❌ Projet en échec — aucune compensation',
          body: `Le projet "${project.title}" a échoué. ${detailMsg} Motif : ${reason || (triggeredBy === 'AUTO_COLLECTION' ? 'Recouvrement non résolu sous 30 jours' : 'Non précisé')}`,
          type: 'PROJECT_FAILED',
          data: JSON.stringify({ projectId: project.id, undisbursedShare, guaranteeShare, fraisOperateur, net })
        }
      })
    }

    if (adminUser && totalGuaranteeDistributed > 0) {
      await tx.wallet.update({ where: { userId: adminUser.id }, data: { guaranteeBalance: { decrement: totalGuaranteeDistributed } } })
    }

    await tx.user.update({ where: { id: project.entrepreneurId }, data: { reputationScore: { decrement: 50 } } })
    await tx.notification.create({
      data: {
        userId: project.entrepreneurId,
        title: 'Projet déclaré en échec',
        body: `Votre projet "${project.title}" a été déclaré en échec. Motif : ${reason || (triggeredBy === 'AUTO_COLLECTION' ? 'Recouvrement non résolu sous 30 jours' : 'Non précisé')}. -50 points de réputation.`,
        type: 'PROJECT_FAILED',
        data: JSON.stringify({ projectId: project.id })
      }
    })
    })
  } catch (e: any) {
    if (e?.message === 'ALREADY_FAILED') {
      return { success: false, message: 'Projet déjà en échec (traité par un déclenchement concurrent)' }
    }
    throw e
  }

  return {
    success: true,
    message: 'Projet déclaré FAILED',
    undisbursedTotal: totalUndisbursedDistributed,
    guaranteeFund: totalGuaranteeDistributed,
    investorsCount: project.investments.length
  }
}