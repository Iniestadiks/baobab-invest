import { PrismaClient } from '@prisma/client'
import { getFees } from '../config/fees'

const prisma = new PrismaClient()

export async function triggerFundedActions(projectId: string, tx: any) {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    include: { investments: true }
  })
  if (!project) return

  const fees = await getFees()
  const netAmount = project.netAmount || Math.round((project.goalAmount || 0) * 0.90)
  const returnRate = project.expectedReturn || 24
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

    // Créer les échéances
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
  await tx.notification.create({
    data: {
      userId: project.entrepreneurId,
      title: '🎉 Projet financé ! Palier 1 débloqué',
      body: `Félicitations ! ${p1Amount.toLocaleString()} FCFA (40%) ont été crédités sur votre wallet. Remboursez 2 mensualités pour débloquer le Palier 2 (35%).`,
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
  const totalDu = schedule.totalAmount
  const paidAmount = totalDu - schedule.remainingAmount
  const currentPalier = project.currentPalier || 1

  // Palier 2 : après avoir remboursé ≥ 40% du total dû SANS dépasser
  // = montant remboursé < 40% totalDu mais paidMonths >= 2
  const seuil2 = Math.round(totalDu * 0.40)  // 49 600
  const seuil3 = Math.round(totalDu * 0.75)  // 93 000

  if (currentPalier === 1 && paidAmount > 0) {
    // Vérifier si on a remboursé au moins 2 mensualités (juste en dessous de seuil2)
    if (schedule.paidMonths >= 2 && paidAmount <= seuil2) {
      const p2Amount = Math.round(netAmount * 0.35)
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
          description: `Palier 2 (35%) débloqué après M${schedule.paidMonths}`
        }
      })
      await tx.notification.create({
        data: {
          userId: project.entrepreneurId,
          title: '🎉 Palier 2 débloqué !',
          body: `${p2Amount.toLocaleString()} FCFA (35%) supplémentaires crédités. Continuez vos remboursements pour débloquer le Palier 3 !`,
          type: 'PALIER_UNLOCKED',
          data: JSON.stringify({ projectId: project.id, palier: 2, amount: p2Amount })
        }
      })
    }
  }

  if (currentPalier === 2 && paidAmount > 0) {
    // Palier 3 : paidMonths >= 4 et paidAmount <= seuil3
    if (schedule.paidMonths >= 4 && paidAmount <= seuil3) {
      const p3Amount = Math.round(netAmount * 0.25)
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
          description: `Palier 3 (25%) débloqué après M${schedule.paidMonths}`
        }
      })
      await tx.notification.create({
        data: {
          userId: project.entrepreneurId,
          title: '🎉 Palier 3 débloqué ! Cagnotte complète',
          body: `${p3Amount.toLocaleString()} FCFA (25%) finaux crédités. Vous avez reçu l'intégralité de votre cagnotte !`,
          type: 'PALIER_UNLOCKED',
          data: JSON.stringify({ projectId: project.id, palier: 3, amount: p3Amount })
        }
      })
    }
  }
}
