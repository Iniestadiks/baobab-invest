// @ts-nocheck
import { PrismaClient } from '@prisma/client'
import { getProjectFees } from '../config/fees'
const prisma = new PrismaClient()

// Seuils de déblocage PROPORTIONNELS à la durée totale du projet —
// identiques à la formule utilisée côté frontend (entrepreneur/page.tsx)
// pour que l'annonce affichée corresponde exactement à ce qui se passe.
// Ex: projet de 12 mois → Palier 2 après 4 mensualités, Palier 3 après 8.
// Ex: projet de 6 mois  → Palier 2 après 2 mensualités (minimum), Palier 3 après 4 (minimum).
function getPalierThresholds(totalMonths: number) {
  const moisP2 = Math.max(2, Math.round(totalMonths / 3))
  const moisP3 = Math.max(4, Math.round(totalMonths * 2 / 3))
  return { moisP2, moisP3 }
}

export async function triggerFundedActions(projectId: string, tx: any) {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    include: { investments: true }
  })
  if (!project) return

  // Taux FIGÉS à la création du projet — jamais recalculés en direct
  const fees = await getProjectFees(project)
  const netAmount = project.netAmount || Math.round((project.goalAmount || 0) * 0.90)
  const returnRate = Math.max(project.expectedReturn || 0, fees.return_min)
  const payinRepayPct = fees.payin_repayment || 4
  const gracePeriod = project.gracePeriodMonths || 0
  const durationMonths = project.durationMonths || 12

  // Calculs remboursement
  const totalGross = Math.round(netAmount * (1 + returnRate / 100))
  const monthlyGross = Math.ceil(totalGross / durationMonths)

  // ── PALIER 1 : 40% netAmount → wallet entrepreneur immédiatement ──
  const p1Amount = Math.round(netAmount * 0.40)
  await tx.wallet.update({
    where: { userId: project.entrepreneurId },
    data: {
      balance: { increment: p1Amount },
      depositBalance: { increment: p1Amount }
    }
  })
  await tx.project.update({
    where: { id: projectId },
    data: { disbursedP1: p1Amount, currentPalier: 1 }
  })
  await tx.platformRevenue.create({
    data: {
      type: 'DISBURSEMENT_P1',
      amount: p1Amount,
      projectId,
      description: `Palier 1 (40%) versé à l'entrepreneur — ${p1Amount.toLocaleString()} FCFA`
    }
  })

  // ── CRÉER ÉCHÉANCIER AUTOMATIQUE ──
  const existing = await tx.repaymentSchedule.findFirst({ where: { projectId } })
  if (!existing) {
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() + gracePeriod)
    const schedule = await tx.repaymentSchedule.create({
      data: {
        projectId,
        totalAmount: totalGross,
        remainingAmount: totalGross,
        monthlyAmount: monthlyGross,
        totalMonths: durationMonths,
        paidMonths: 0,
        status: 'ACTIVE',
        nextDueDate: startDate,
      }
    })
    for (let month = 1; month <= durationMonths; month++) {
      const dueDate = new Date()
      dueDate.setMonth(dueDate.getMonth() + gracePeriod + month - 1)
      await tx.repaymentPayment.create({
        data: {
          scheduleId: schedule.id,
          projectId,
          monthNumber: month,
          amount: month === durationMonths
            ? totalGross - monthlyGross * (durationMonths - 1)
            : monthlyGross,
          dueDate,
          status: 'PENDING',
        }
      })
    }
  }

  // ── NOTIFICATIONS ──
  const { moisP2 } = getPalierThresholds(durationMonths)
  await tx.notification.create({
    data: {
      userId: project.entrepreneurId,
      title: '🎉 Projet financé ! Palier 1 débloqué',
      body: `Félicitations ! ${p1Amount.toLocaleString()} FCFA (40%) ont été crédités sur votre wallet. Remboursez ${moisP2} mensualités pour débloquer le Palier 2 (25%).`,
      type: 'PALIER_UNLOCKED',
      data: JSON.stringify({ projectId, palier: 1, amount: p1Amount })
    }
  })
  const investorIds = [...new Set(project.investments.map((i: any) => i.userId))]
  if (investorIds.length > 0) {
    await tx.notification.createMany({
      data: investorIds.map((userId: any) => ({
        userId,
        title: '🎯 Projet financé !',
        body: `Le projet a atteint son objectif. L'entrepreneur a reçu 40% de la cagnotte. Remboursement prévu dans ${gracePeriod} mois.`,
        type: 'PROJECT_FUNDED',
        data: JSON.stringify({ projectId })
      }))
    })
  }
  return { p1Amount, schedule: !existing }
}

export async function checkAndUnlockPalier(scheduleId: string, tx: any) {
  const schedule = await tx.repaymentSchedule.findUnique({
    where: { id: scheduleId },
    include: { project: true }
  })
  if (!schedule) return
  const project = schedule.project
  const netAmount = project.netAmount || Math.round((project.goalAmount || 0) * 0.90)
  let currentPalier = project.currentPalier || 1
  const totalMonths = schedule.totalMonths || project.durationMonths || 12
  const { moisP2, moisP3 } = getPalierThresholds(totalMonths)
  const isFullyRepaid = schedule.status === 'COMPLETED' || schedule.paidMonths >= totalMonths

  // Vérifie si une preuve (vidéo + documents) a été soumise pour ce palier —
  // sinon crée le "ticket en attente" et notifie l'entrepreneur, sans verser
  // l'argent. Le versement se fait quand l'entrepreneur uploade sa preuve
  // (voir routes/palierProof.ts), pas ici directement.
  async function checkProofAndMaybeUnlock(palierNum: number, amount: number, label: string): Promise<boolean> {
    let proof = await tx.palierProof.findUnique({ where: { projectId_palier: { projectId: project.id, palier: palierNum } } })
    if (!proof) {
      await tx.palierProof.create({ data: { projectId: project.id, palier: palierNum } })
      await tx.notification.create({
        data: {
          userId: project.entrepreneurId,
          title: `🎬 Palier ${palierNum} atteint — vidéo requise`,
          body: `Vous avez atteint le seuil de mensualités pour le Palier ${palierNum} (${label}). Postez une courte vidéo (1min45 max) sur l'avancement de votre projet pour débloquer les ${amount.toLocaleString()} FCFA.`,
          type: 'PALIER_PROOF_REQUIRED',
          data: JSON.stringify({ projectId: project.id, palier: palierNum, amount })
        }
      })
      return false // pas encore débloqué — en attente de la vidéo
    }
    if (!proof.videoUrl) return false // déjà notifié, en attente de l'upload
    return true // preuve déjà envoyée — on peut débloquer
  }

  // ── PALIER 2 : 25% après moisP2 mensualités payées (ou remboursement total) ──
  if (currentPalier === 1 && (schedule.paidMonths >= moisP2 || isFullyRepaid)) {
    const p2Amount = Math.round(netAmount * 0.25)
    const canUnlock = await checkProofAndMaybeUnlock(2, p2Amount, '25%')
    if (!canUnlock) return
    await tx.wallet.update({
      where: { userId: project.entrepreneurId },
      data: { balance: { increment: p2Amount }, depositBalance: { increment: p2Amount } }
    })
    await tx.project.update({
      where: { id: project.id },
      data: { disbursedP2: p2Amount, currentPalier: 2 }
    })
    await tx.platformRevenue.create({
      data: {
        type: 'DISBURSEMENT_P2',
        amount: p2Amount,
        projectId: project.id,
        description: `Palier 2 (25%) débloqué après ${schedule.paidMonths}/${totalMonths} mensualités (seuil: ${moisP2}) — ${p2Amount.toLocaleString()} FCFA`
      }
    })
    await tx.notification.create({
      data: {
        userId: project.entrepreneurId,
        title: '🎉 Palier 2 débloqué !',
        body: `${p2Amount.toLocaleString()} FCFA (25%) supplémentaires crédités. Remboursez ${moisP3} mensualités au total pour débloquer le Palier 3 !`,
        type: 'PALIER_UNLOCKED',
        data: JSON.stringify({ projectId: project.id, palier: 2, amount: p2Amount })
      }
    })
    currentPalier = 2
  }
  // ── PALIER 3 : 35% après moisP3 mensualités payées (ou remboursement total) ──
  if (currentPalier === 2 && (schedule.paidMonths >= moisP3 || isFullyRepaid)) {
    const p3Amount = Math.round(netAmount * 0.35)
    const canUnlock = await checkProofAndMaybeUnlock(3, p3Amount, '35%')
    if (!canUnlock) return
    await tx.wallet.update({
      where: { userId: project.entrepreneurId },
      data: { balance: { increment: p3Amount }, depositBalance: { increment: p3Amount } }
    })
    await tx.project.update({
      where: { id: project.id },
      data: { disbursedP3: p3Amount, currentPalier: 3 }
    })
    await tx.platformRevenue.create({
      data: {
        type: 'DISBURSEMENT_P3',
        amount: p3Amount,
        projectId: project.id,
        description: `Palier 3 (35%) débloqué après ${schedule.paidMonths}/${totalMonths} mensualités (seuil: ${moisP3}) — ${p3Amount.toLocaleString()} FCFA`
      }
    })
    await tx.notification.create({
      data: {
        userId: project.entrepreneurId,
        title: '🎉 Palier 3 débloqué ! Cagnotte complète',
        body: `${p3Amount.toLocaleString()} FCFA (35%) finaux crédités. Vous avez reçu l'intégralité de votre cagnotte !`,
        type: 'PALIER_UNLOCKED',
        data: JSON.stringify({ projectId: project.id, palier: 3, amount: p3Amount })
      }
    })
  }
}
