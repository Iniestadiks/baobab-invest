import PDFDocument from 'pdfkit'
import { Response } from 'express'

const GREEN = '#16a34a'
const DARK = '#1a1a2e'
const GRAY = '#6b7280'
const LIGHT_GREEN = '#f0fdf4'
const LIGHT_GRAY = '#f9fafb'
const BORDER = '#e5e7eb'

function header(doc: any, title: string, subtitle: string) {
  doc.rect(0, 0, doc.page.width, 90).fill(GREEN)
  doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
    .text('KORAPACT', 40, 20)
  doc.fontSize(10).font('Helvetica')
    .text('Plateforme de micro-investissement UEMOA/CEMAC', 40, 45)
  doc.fontSize(10).font('Helvetica')
    .text(subtitle, 40, 62)
  doc.fillColor(DARK).fontSize(16).font('Helvetica-Bold')
    .text(title, 40, 108)
  doc.strokeColor(GREEN).lineWidth(2)
    .moveTo(40, 130).lineTo(doc.page.width - 40, 130).stroke()
  doc.y = 140
}

function footer(doc: any) {
  const y = doc.page.height - 55
  doc.strokeColor(BORDER).lineWidth(1)
    .moveTo(40, y).lineTo(doc.page.width - 40, y).stroke()
  doc.fillColor(GRAY).fontSize(8).font('Helvetica')
    .text('KORAPACT — Document confidentiel — Plateforme de micro-investissement', 40, y + 10, { align: 'center', width: doc.page.width - 80 })
    .text(`Genere le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`, 40, y + 22, { align: 'center', width: doc.page.width - 80 })
}

function section(doc: any, title: string) {
  doc.moveDown(0.8)
  const y = doc.y
  doc.rect(40, y, doc.page.width - 80, 22).fill(LIGHT_GREEN)
  doc.fillColor(GREEN).fontSize(10).font('Helvetica-Bold')
    .text(title, 50, y + 6)
  doc.y = y + 30
}

function row(doc: any, label: string, value: string, highlight = false) {
  if (doc.y > 720) { doc.addPage(); footer(doc); doc.y = 40 }
  const y = doc.y
  if (highlight) {
    doc.rect(40, y - 2, doc.page.width - 80, 18).fill('#fefce8')
  }
  doc.fillColor(GRAY).fontSize(9).font('Helvetica')
    .text(label, 50, y, { width: 220 })
  doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold')
    .text(value, 280, y, { width: 250 })
  doc.y = y + 18
}

function divider(doc: any) {
  doc.strokeColor(BORDER).lineWidth(0.5)
    .moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke()
  doc.y += 8
}

// ============================================
// CERTIFICAT D'INVESTISSEMENT
// ============================================
export function generateInvestmentCertificate(res: Response, data: {
  investor: any, investment: any, project: any, fees?: any
}) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="certificat-${data.investment.id.substring(0,8)}.pdf"`)
  doc.pipe(res)

  header(doc, 'CERTIFICAT D\'INVESTISSEMENT', 'Preuve officielle de participation')

  // Numero certificat
  const y0 = doc.y
  doc.fillColor(GREEN).fontSize(11).font('Helvetica-Bold')
    .text(`N° CERT-${data.investment.id.substring(0,8).toUpperCase()}`, 40, y0, { align: 'right', width: doc.page.width - 80 })
  doc.y = y0 + 20

  section(doc, 'INVESTISSEUR')
  row(doc, 'Nom complet', `${data.investor.firstName} ${data.investor.lastName}`)
  row(doc, 'Email', data.investor.email)
  row(doc, 'Ville', data.investor.city || '—')
  row(doc, 'Statut KYC', data.investor.kycStatus === 'VERIFIED' ? 'Verifie' : 'En attente')

  section(doc, 'PROJET FINANCE')
  row(doc, 'Nom du projet', data.project.title)
  row(doc, 'Secteur', data.project.sector)
  row(doc, 'Ville', data.project.city || '—')
  row(doc, 'Statut projet', data.project.status)
  row(doc, 'Objectif de levee', `${(data.project.goalAmount || 0).toLocaleString()} FCFA`)

  section(doc, 'DETAILS DE L\'INVESTISSEMENT')
  const fees = data.fees || {}
  const baobabRate = fees.payin_repayment || 4
  const paydunyaRate = 0
  const grossReturn = data.investment.expectedReturn || 0
  const netReturn = Math.round(grossReturn * (1 - baobabRate/100 - paydunyaRate/100))
  const gain = netReturn - data.investment.amount

  row(doc, 'Montant investi', `${(data.investment.amount || 0).toLocaleString()} FCFA`, true)
  row(doc, 'Taux de retour', `${data.project.expectedReturn || 0}%`)
  row(doc, 'Retour brut attendu', `${grossReturn.toLocaleString()} FCFA`)
  row(doc, `Commission BAOBAB retours (${baobabRate}%)`, `-${Math.round(grossReturn * baobabRate/100).toLocaleString()} FCFA`)
  row(doc, `Frais PayDunya (${paydunyaRate}%)`, `-${Math.round(grossReturn * paydunyaRate/100).toLocaleString()} FCFA`)
  row(doc, 'NET A RECEVOIR', `${netReturn.toLocaleString()} FCFA`, true)
  row(doc, 'Gain net', `+${gain.toLocaleString()} FCFA`, true)
  row(doc, 'Contribution fonds garantie', `${(data.investment.guaranteeContribution || 0).toLocaleString()} FCFA`)
  row(doc, 'Date d\'investissement', new Date(data.investment.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }))
  row(doc, 'Statut', data.investment.status === 'COMPLETED' ? 'Rembourse' : 'En cours')

  if (data.investment.returnedAmount) {
    section(doc, 'REMBOURSEMENT')
    row(doc, 'Montant recu', `${data.investment.returnedAmount.toLocaleString()} FCFA`, true)
    row(doc, 'Date remboursement', data.investment.returnedAt ? new Date(data.investment.returnedAt).toLocaleDateString('fr-FR') : '—')
  }

  // Encadre officiel
  doc.moveDown(1)
  const boxY = doc.y
  doc.rect(40, boxY, doc.page.width - 80, 50).stroke(GREEN)
  doc.fillColor(DARK).fontSize(9).font('Helvetica')
    .text(
      'Ce document certifie la participation de l\'investisseur au projet mentionne ci-dessus sur la plateforme KORAPACT. Les fonds sont securises en sequestre jusqu\'au remboursement conformement aux conditions generales.',
      50, boxY + 8, { width: doc.page.width - 100, align: 'center' }
    )

  footer(doc)
  doc.end()
}

// ============================================
// RELEVE DE COMPTE INVESTISSEUR
// ============================================
export function generateInvestorStatement(res: Response, data: {
  investor: any, investments: any[], wallet: any, period: string, fees?: any
}) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="releve-${Date.now()}.pdf"`)
  doc.pipe(res)

  header(doc, 'RELEVE DE COMPTE INVESTISSEUR', data.period)

  section(doc, 'TITULAIRE DU COMPTE')
  row(doc, 'Nom', `${data.investor.firstName} ${data.investor.lastName}`)
  row(doc, 'Email', data.investor.email)
  row(doc, 'Ville', data.investor.city || '—')
  const levels = ['Graine', 'Jeune Baobab', 'Baobab', 'Grand Baobab']
  row(doc, 'Niveau Baobab', levels[(data.investor.level || 1) - 1] || 'Graine')
  row(doc, 'Membre depuis', new Date(data.investor.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))

  section(doc, 'SITUATION WALLET')
  row(doc, 'Solde disponible', `${(data.wallet?.balance || 0).toLocaleString()} FCFA`, true)
  row(doc, 'En sequestre', `${(data.wallet?.escrowBalance || 0).toLocaleString()} FCFA`)
  row(doc, 'Total investi', `${(data.wallet?.totalInvested || 0).toLocaleString()} FCFA`)
  row(doc, 'Total gagne', `${(data.wallet?.totalEarned || 0).toLocaleString()} FCFA`, true)

  const fees = data.fees || {}
  const baobabRate = fees.payin_repayment || 4
  const paydunyaRate = 0
  const totalInvested = data.investments.reduce((s, i) => s + i.amount, 0)
  const totalGrossReturn = data.investments.reduce((s, i) => s + (i.expectedReturn || 0), 0)
  const totalNetReturn = Math.round(totalGrossReturn * (1 - baobabRate/100 - paydunyaRate/100))
  const totalReturned = data.investments.reduce((s, i) => s + (i.returnedAmount || 0), 0)
  const rendementNet = totalInvested > 0 ? ((totalNetReturn / totalInvested - 1) * 100).toFixed(1) : '0'

  section(doc, 'RECAPITULATIF FINANCIER')
  row(doc, 'Nombre d\'investissements', String(data.investments.length))
  row(doc, 'Total investi', `${totalInvested.toLocaleString()} FCFA`, true)
  row(doc, 'Retour brut attendu', `${totalGrossReturn.toLocaleString()} FCFA`)
  row(doc, `Commission BAOBAB ${baobabRate}% + PayDunya ${paydunyaRate}%`, `-${(totalGrossReturn - totalNetReturn).toLocaleString()} FCFA`)
  row(doc, 'NET A RECEVOIR (projete)', `${totalNetReturn.toLocaleString()} FCFA`, true)
  row(doc, 'Gain net projete', `+${(totalNetReturn - totalInvested).toLocaleString()} FCFA`, true)
  row(doc, 'Rendement net moyen', `+${rendementNet}%`)
  row(doc, 'Deja rembourse', `${totalReturned.toLocaleString()} FCFA`)

  section(doc, 'DETAIL DES INVESTISSEMENTS')
  // En-tetes colonnes
  const y0 = doc.y
  doc.rect(40, y0, doc.page.width - 80, 16).fill(LIGHT_GREEN)
  doc.fillColor(GREEN).fontSize(8).font('Helvetica-Bold')
    .text('Projet', 50, y0 + 4)
    .text('Investi', 230, y0 + 4)
    .text('Net attendu', 310, y0 + 4)
    .text('Statut', 410, y0 + 4)
  doc.y = y0 + 20

  data.investments.forEach((inv, i) => {
    if (doc.y > 720) { doc.addPage(); footer(doc); doc.y = 40 }
    const netRet = Math.round((inv.expectedReturn || 0) * (1 - baobabRate/100 - paydunyaRate/100))
    const rowY = doc.y
    if (i % 2 === 0) doc.rect(40, rowY - 2, doc.page.width - 80, 18).fill(LIGHT_GRAY)
    doc.fillColor(DARK).fontSize(8).font('Helvetica')
      .text(inv.project?.title?.substring(0, 28) || '—', 50, rowY, { width: 175 })
      .text(`${inv.amount.toLocaleString()}`, 230, rowY)
      .text(`${netRet.toLocaleString()}`, 310, rowY)
      .text(inv.status === 'COMPLETED' ? 'Rembourse' : 'En cours', 410, rowY)
    doc.y = rowY + 18
  })

  footer(doc)
  doc.end()
}

// ============================================
// RAPPORT PROJET ENTREPRENEUR
// ============================================
export function generateProjectReport(res: Response, data: {
  project: any, entrepreneur: any, investments: any[], milestones: any[], fees?: any
}) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="rapport-projet-${Date.now()}.pdf"`)
  doc.pipe(res)

  header(doc, 'RAPPORT DE PROJET', `Entrepreneur : ${data.entrepreneur.firstName} ${data.entrepreneur.lastName}`)

  section(doc, 'INFORMATIONS PROJET')
  row(doc, 'Titre', data.project.title)
  row(doc, 'Secteur', data.project.sector)
  row(doc, 'Ville', data.project.city || '—')
  row(doc, 'Statut', data.project.status)
  row(doc, 'Objectif de collecte', `${(data.project.goalAmount || 0).toLocaleString()} FCFA`)
  row(doc, 'Taux de retour promis', `${data.project.expectedReturn || 0}%`)
  row(doc, 'Duree', `${data.project.durationMonths || 0} mois`)

  const fees = data.fees || {}
  const baobabCol = fees.commission_baobab_collection || 5
  const mentorRate = fees.commission_mentor || 2
  const guaranteeRate = fees.commission_guarantee || 2
  const totalRaised = data.project.raisedAmount || 0
  const cagnotteNette = Math.round(totalRaised * (1 - (baobabCol + mentorRate + guaranteeRate)/100))

  section(doc, 'SITUATION FINANCIERE')
  row(doc, 'Leve brut', `${totalRaised.toLocaleString()} FCFA`, true)
  row(doc, `Commission BAOBAB (${baobabCol}%)`, `-${Math.round(totalRaised * baobabCol/100).toLocaleString()} FCFA`)
  row(doc, `Commission mentor (${mentorRate}%)`, `-${Math.round(totalRaised * mentorRate/100).toLocaleString()} FCFA`)
  row(doc, `Fonds garantie (${guaranteeRate}%)`, `-${Math.round(totalRaised * guaranteeRate/100).toLocaleString()} FCFA`)
  row(doc, 'CAGNOTTE NETTE', `${cagnotteNette.toLocaleString()} FCFA`, true)
  row(doc, 'Progression', `${Math.round((totalRaised / (data.project.goalAmount || 1)) * 100)}%`)
  row(doc, "Nombre d investisseurs", String(data.investments.length))

  if (data.milestones.length > 0) {
    section(doc, 'JALONS')
    data.milestones.forEach(m => {
      if (doc.y > 720) { doc.addPage(); footer(doc); doc.y = 40 }
      row(doc, m.title, `${(m.amount || 0).toLocaleString()} FCFA — ${m.status}`)
    })
  }

  if (data.investments.length > 0) {
    section(doc, 'INVESTISSEURS')
    const baobabRet = fees.payin_repayment || 4
    const paydunyaPayout = 0
    const y0 = doc.y
    doc.rect(40, y0, doc.page.width - 80, 16).fill(LIGHT_GREEN)
    doc.fillColor(GREEN).fontSize(8).font('Helvetica-Bold')
      .text('Investisseur', 50, y0 + 4)
      .text('Investi', 220, y0 + 4)
      .text('Retour brut', 300, y0 + 4)
      .text('Net investisseur', 390, y0 + 4)
    doc.y = y0 + 20
    data.investments.forEach((inv, i) => {
      if (doc.y > 720) { doc.addPage(); footer(doc); doc.y = 40 }
      const netRet = Math.round((inv.expectedReturn || 0) * (1 - baobabRet/100 - paydunyaPayout/100))
      const rowY = doc.y
      if (i % 2 === 0) doc.rect(40, rowY - 2, doc.page.width - 80, 18).fill(LIGHT_GRAY)
      doc.fillColor(DARK).fontSize(8).font('Helvetica')
        .text(`${inv.user?.firstName || ''} ${inv.user?.lastName || ''}`, 50, rowY, { width: 165 })
        .text(`${inv.amount.toLocaleString()}`, 220, rowY)
        .text(`${(inv.expectedReturn || 0).toLocaleString()}`, 300, rowY)
        .text(`${netRet.toLocaleString()}`, 390, rowY)
      doc.y = rowY + 18
    })
  }

  footer(doc)
  doc.end()
}

// ============================================
// RAPPORT MENTOR
// ============================================
export function generateMentorReport(res: Response, data: {
  mentor: any, projects: any[], wallet: any, fees?: any
}) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="rapport-mentor-${Date.now()}.pdf"`)
  doc.pipe(res)

  header(doc, 'RAPPORT MENTOR / GARANT', `Periode : ${new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`)

  section(doc, 'PROFIL MENTOR')
  row(doc, 'Nom', `${data.mentor.firstName} ${data.mentor.lastName}`)
  row(doc, 'Email', data.mentor.email)
  row(doc, 'Score reputation', `${data.mentor.reputationScore || 50}/100`)
  row(doc, 'Niveau', `${data.mentor.level || 1}`)
  row(doc, 'Statut KYC', data.mentor.kycStatus === 'VERIFIED' ? 'Verifie' : 'En attente')

  const fees = data.fees || {}
  const mentorRate = fees.commission_mentor || 2
  const totalCommissions = data.projects.reduce((s, p) => s + Math.round((p.raisedAmount || 0) * mentorRate / 100), 0)

  section(doc, 'SITUATION WALLET')
  row(doc, 'Solde disponible', `${(data.wallet?.balance || 0).toLocaleString()} FCFA`, true)
  row(doc, 'Total commissions percues', `${totalCommissions.toLocaleString()} FCFA`, true)

  section(doc, 'PROJETS MENTORES')
  const y0 = doc.y
  doc.rect(40, y0, doc.page.width - 80, 16).fill(LIGHT_GREEN)
  doc.fillColor(GREEN).fontSize(8).font('Helvetica-Bold')
    .text('Projet', 50, y0 + 4)
    .text('Leve', 220, y0 + 4)
    .text(`Commission ${mentorRate}%`, 300, y0 + 4)
    .text('Statut', 410, y0 + 4)
  doc.y = y0 + 20

  data.projects.forEach((p, i) => {
    if (doc.y > 720) { doc.addPage(); footer(doc); doc.y = 40 }
    const commission = Math.round((p.raisedAmount || 0) * mentorRate / 100)
    const rowY = doc.y
    if (i % 2 === 0) doc.rect(40, rowY - 2, doc.page.width - 80, 18).fill(LIGHT_GRAY)
    doc.fillColor(DARK).fontSize(8).font('Helvetica')
      .text(p.title?.substring(0, 28) || '—', 50, rowY, { width: 165 })
      .text(`${(p.raisedAmount || 0).toLocaleString()}`, 220, rowY)
      .text(`${commission.toLocaleString()}`, 300, rowY)
      .text(p.status, 410, rowY)
    doc.y = rowY + 18
  })

  footer(doc)
  doc.end()
}

// ============================================
// RAPPORT ADMIN
// ============================================
export function generateAdminReport(res: Response, data: {
  stats: any, projects: any[], revenues: any[], fees?: any
}) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="rapport-admin-${Date.now()}.pdf"`)
  doc.pipe(res)

  header(doc, 'RAPPORT ADMINISTRATEUR', `Genere le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`)

  const fees = data.fees || {}

  section(doc, 'RESUME PLATEFORME')
  row(doc, 'Total utilisateurs', String(data.stats.totalUsers || 0))
  row(doc, 'Total investissements', `${(data.stats.totalRaised || 0).toLocaleString()} FCFA`)
  row(doc, 'Cagnotte nette projets', `${(data.stats.totalCagnotteNette || 0).toLocaleString()} FCFA`, true)
  row(doc, 'Retours nets investisseurs', `${(data.stats.totalNetInvestors || 0).toLocaleString()} FCFA`)
  row(doc, 'Revenu net BAOBAB', `${(data.stats.revenuNetBAOBAB || 0).toLocaleString()} FCFA`, true)
  row(doc, 'Projets actifs', String(data.stats.activeProjects || 0))
  row(doc, 'Projets finances', String(data.stats.fundedProjects || 0))
  row(doc, 'Projets termines', String(data.stats.completedProjects || 0))
  row(doc, 'KYC verifies', `${data.stats.kycVerified || 0} / ${data.stats.totalUsers || 0} (${data.stats.kycRate || 0}%)`)

  section(doc, 'TAUX EN VIGUEUR')
  row(doc, 'Commission BAOBAB collecte', `${fees.commission_baobab_collection || 5}%`)
  row(doc, 'Payin mensualités remboursement', `${fees.payin_repayment || 4}%`)
  row(doc, 'Commission mentor', `${fees.commission_mentor || 2}%`)
  row(doc, 'Fonds garantie', `${fees.commission_guarantee || 2}%`)
  row(doc, 'Récupération Payin investissement', `${fees.payin_recovery || 4}%`)
  row(doc, 'Frais retrait standard', `${0}%`)

  section(doc, 'DERNIERS REVENUS')
  const y0 = doc.y
  doc.rect(40, y0, doc.page.width - 80, 16).fill(LIGHT_GREEN)
  doc.fillColor(GREEN).fontSize(8).font('Helvetica-Bold')
    .text('Type', 50, y0 + 4)
    .text('Montant', 280, y0 + 4)
    .text('Date', 380, y0 + 4)
  doc.y = y0 + 20

  data.revenues.slice(0, 15).forEach((r, i) => {
    if (doc.y > 720) { doc.addPage(); footer(doc); doc.y = 40 }
    const rowY = doc.y
    if (i % 2 === 0) doc.rect(40, rowY - 2, doc.page.width - 80, 18).fill(LIGHT_GRAY)
    doc.fillColor(DARK).fontSize(8).font('Helvetica')
      .text(r.description?.substring(0, 40) || r.type, 50, rowY, { width: 225 })
      .text(`${r.amount.toLocaleString()} FCFA`, 280, rowY)
      .text(new Date(r.createdAt).toLocaleDateString('fr-FR'), 380, rowY)
    doc.y = rowY + 18
  })

  footer(doc)
  doc.end()
}

// ============================================
// RAPPORT BÂTISSEUR
// ============================================
export function generateBuilderReport(res: Response, data: {
  builder: any, contributions: any[], wallet: any, badges: any[], impactData: any
}) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="rapport-batisseur-${Date.now()}.pdf"`)
  doc.pipe(res)
  header(doc, 'RAPPORT BÂTISSEUR', `Fonds Solidaire KORAPACT — ${new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`)

  // Profil
  section(doc, 'PROFIL BÂTISSEUR')
  row(doc, 'Nom', `${data.builder.firstName} ${data.builder.lastName}`)
  row(doc, 'Email', data.builder.email)
  row(doc, 'Organisation', data.builder.builderProfile?.companyName || 'Non renseigné')
  row(doc, 'Secteur', data.builder.builderProfile?.sector || 'Non renseigné')
  row(doc, 'Statut', data.builder.builderProfile?.verified ? 'Vérifié ✅' : 'En attente de vérification')
  row(doc, 'Niveau', data.impactData?.level || 'BATISSEUR')

  // Wallet
  section(doc, 'WALLET')
  row(doc, 'Solde disponible', `${(data.wallet?.balance || 0).toLocaleString()} FCFA`, true)
  row(doc, 'Total déposé', `${(data.wallet?.totalDeposited || 0).toLocaleString()} FCFA`)

  // Impact
  const totalDonated = data.contributions.reduce((s, c) => s + (c.amount || 0), 0)
  const totalNet = Math.round(totalDonated * 0.84)
  const projectsSupported = [...new Set(data.contributions.filter(c => c.projectId).map(c => c.projectId))].length
  section(doc, 'IMPACT SOLIDAIRE')
  row(doc, 'Total contribué', `${totalDonated.toLocaleString()} FCFA`, true)
  row(doc, 'Commission BAOBAB (16%)', `${Math.round(totalDonated * 0.16).toLocaleString()} FCFA`)
  row(doc, 'Net reversé aux projets (84%)', `${totalNet.toLocaleString()} FCFA`, true)
  row(doc, 'Projets soutenus', String(projectsSupported))
  row(doc, 'Nombre de contributions', String(data.contributions.length))

  // Badges
  if (data.badges.length > 0) {
    section(doc, 'BADGES OBTENUS')
    const BADGE_LABELS: Record<string, string> = {
      SEMEUR: '🌱 Semeur', JARDINIER: '🌿 Jardinier',
      BAOBAB: '🌳 Baobab', GRAND_BATISSEUR: '🏆 Grand Bâtisseur'
    }
    data.badges.forEach(b => {
      row(doc, BADGE_LABELS[b.badge] || b.badge, `Obtenu le ${new Date(b.earnedAt || b.createdAt).toLocaleDateString('fr-FR')}`)
    })
  }

  // Historique contributions
  section(doc, 'HISTORIQUE DES CONTRIBUTIONS')
  const y0 = doc.y
  doc.rect(40, y0, doc.page.width - 80, 16).fill(LIGHT_GREEN)
  doc.fillColor(GREEN).fontSize(8).font('Helvetica-Bold')
    .text('Date', 50, y0 + 4)
    .text('Montant', 160, y0 + 4)
    .text('Net fonds', 240, y0 + 4)
    .text('Projet', 320, y0 + 4)
    .text('Statut', 470, y0 + 4)
  doc.y = y0 + 20
  data.contributions.slice(0, 30).forEach((c, i) => {
    if (doc.y > 720) { doc.addPage(); footer(doc); doc.y = 40 }
    const rowY = doc.y
    if (i % 2 === 0) doc.rect(40, rowY - 2, doc.page.width - 80, 18).fill(LIGHT_GRAY)
    doc.fillColor(DARK).fontSize(7).font('Helvetica')
      .text(new Date(c.createdAt).toLocaleDateString('fr-FR'), 50, rowY)
      .text(`${(c.amount || 0).toLocaleString()} F`, 160, rowY)
      .text(`${(c.netAmount || 0).toLocaleString()} F`, 240, rowY)
      .text((c.project?.title || 'Fonds général').substring(0, 20), 320, rowY, { width: 140 })
      .text(c.status === 'COMPLETED' ? 'Confirmé' : 'En attente', 470, rowY)
    doc.y = rowY + 18
  })

  footer(doc)
  doc.end()
}
