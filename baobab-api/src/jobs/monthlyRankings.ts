// @ts-nocheck
import { PrismaClient } from "@prisma/client"
import { awardBadge } from "../services/reputationService"

const prisma = new PrismaClient()

export async function computeMonthlyRankings() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  console.log("[CRON RANKINGS] Calcul classement", month + "/" + year)

  try {
    // Top investisseur du mois
    const investors = await prisma.user.findMany({
      where: { role: "INVESTOR" },
      select: {
        id: true,
        reputationPoints: true,
        investments: {
          where: { createdAt: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) } },
          select: { amount: true }
        }
      }
    })

    const investorScores = investors
      .map(u => ({ userId: u.id, score: u.investments.reduce((s, i) => s + i.amount, 0) }))
      .filter(u => u.score > 0)
      .sort((a, b) => b.score - a.score)

    for (let i = 0; i < investorScores.length; i++) {
      await prisma.monthlyRanking.upsert({
        where: { userId_role_month_year: { userId: investorScores[i].userId, role: "INVESTOR", month, year } },
        update: { score: investorScores[i].score, rank: i + 1 },
        create: { userId: investorScores[i].userId, role: "INVESTOR", month, year, score: investorScores[i].score, rank: i + 1 }
      })
    }

    // Attribuer badge + notif top 1 investisseur
    if (investorScores.length > 0) {
      const topInvestor = investorScores[0].userId
      await awardBadge(topInvestor, "INVESTOR_MONTH")
      await prisma.notification.create({
        data: {
          userId: topInvestor,
          title: "👑 Investisseur du mois !",
          body: "Félicitations ! Vous êtes l Investisseur du mois de " + month + "/" + year + " ! Votre badge a été ajouté à votre profil.",
          type: "MONTHLY_AWARD",
          data: JSON.stringify({ rank: 1, role: "INVESTOR", month, year })
        }
      })
      // Notifier toute la plateforme (top 3)
      const top3 = investorScores.slice(0, 3)
      const users = await prisma.user.findMany({ where: { id: { in: top3.map(u => u.userId) } }, select: { firstName: true, lastName: true, id: true } })
      const top3Names = top3.map(t => { const u = users.find(u => u.id === t.userId); return u ? u.firstName + " " + u.lastName : "" }).join(", ")
      const allUsers = await prisma.user.findMany({ select: { id: true } })
      await prisma.notification.createMany({
        data: allUsers.map(u => ({
          userId: u.id,
          title: "👑 Classement du mois !",
          body: "Top investisseurs de " + month + "/" + year + " : " + top3Names,
          type: "MONTHLY_RANKING",
          data: JSON.stringify({ month, year })
        }))
      })
    }

    // Top entrepreneur du mois
    const entrepreneurs = await prisma.user.findMany({
      where: { role: "ENTREPRENEUR" },
      select: { id: true, reputationPoints: true, reputationScore: true }
    })
    const entrScores = entrepreneurs
      .filter(u => (u.reputationPoints || 0) > 0)
      .sort((a, b) => (b.reputationPoints || 0) - (a.reputationPoints || 0))

    for (let i = 0; i < entrScores.length; i++) {
      await prisma.monthlyRanking.upsert({
        where: { userId_role_month_year: { userId: entrScores[i].userId, role: "ENTREPRENEUR", month, year } },
        update: { score: entrScores[i].reputationPoints || 0, rank: i + 1 },
        create: { userId: entrScores[i].userId, role: "ENTREPRENEUR", month, year, score: entrScores[i].reputationPoints || 0, rank: i + 1 }
      })
    }

    if (entrScores.length > 0) {
      const topEntr = entrScores[0].userId
      await awardBadge(topEntr, "ENTREPRENEUR_MONTH")
      await prisma.notification.create({
        data: {
          userId: topEntr,
          title: "👑 Entrepreneur du mois !",
          body: "Félicitations ! Vous êtes l Entrepreneur du mois de " + month + "/" + year + " !",
          type: "MONTHLY_AWARD",
          data: JSON.stringify({ rank: 1, role: "ENTREPRENEUR", month, year })
        }
      })
    }

    console.log("[CRON RANKINGS] Classement calculé — Investisseurs:", investorScores.length, "Entrepreneurs:", entrScores.length)
  } catch(e) {
    console.error("[CRON RANKINGS] Erreur:", e)
  } finally {
    // Ne pas déconnecter — connexion partagée avec l'app
  }
}
