import PDFDocument from 'pdfkit'
import { Response } from 'express'

// Couleurs BAOBAB INVEST
const GREEN = '#16a34a'
const DARK = '#1a1a2e'
const GRAY = '#6b7280'
const LIGHT = '#f0fdf4'

function header(doc: any, title: string, subtitle: string) {
  // Fond vert header
  doc.rect(0, 0, doc.page.width, 100).fill(GREEN)
  // Logo texte
  doc.fillColor('white').fontSize(22).font('Helvetica-Bold').text('🌳 BAOBAB INVEST', 40, 25)
  doc.fontSize(11).font('Helvetica').text(subtitle, 40, 55)
  // Titre du document
  doc.fillColor(DARK).fontSize(18).font('Helvetica-Bold').text(title, 40, 115)
  doc.moveDown(0.5)
  doc.strokeColor(GREEN).lineWidth(2).moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke()
  doc.moveDown(0.5)
}

function footer(doc: any) {
  const y = doc.page.height - 50
  doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(40, y).lineTo(doc.page.width - 40, y).stroke()
  doc.fillColor(GRAY).fontSize(9).font('Helvetica')
    .text('BAOBAB INVEST — Plateforme de micro-investissement UEMOA/CEMAC', 40, y + 8, { align: 'center' })
    .text(`Document généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} — Confidentiel`, 40, y + 20, { align: 'center' })
}

function section(doc: any, title: string) {
  doc.moveDown(0.5)
  doc.rect(40, doc.y, doc.page.width - 80, 24).fill(LIGHT)
  doc.fillColor(GREEN).fontSize(11).font('Helvetica-Bold').text(title, 50, doc.y - 18)
  doc.moveDown(0.8)
}

function row(doc: any, label: string, value: string, highlight = false) {
  const y = doc.y
  if (highlight) {
    doc.rect(40, y - 4, doc.page.width - 80, 22).fill('#fefce8')
  }
  doc.fillColor(GRAY).fontSize(10).font('Helvetica').text(label, 50, y, { width: 200 })
  doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold').text(value, 260, y)
  doc.moveDown(0.6)
}

// ============================================
// CERTIFICAT D'INVESTISSEMENT
// ============================================
export function generateInvestmentCertificate(res: Response, data: {
  investor: any, investment: any, project: any
}) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="certificat-investissement-${data.investment.id.substring(0,8)}.pdf"`)
  doc.pipe(res)

  header(doc, 'Certificat d\'Investissement', 'Preuve officielle de participation')

  // Numéro de certificat
  doc.fillColor(GREEN).fontSize(13).font('Helvetica-Bold')
    .text(`N° CERT-${data.investment.id.substring(0,8).toUpperCase()}`, { align: 'right' })
  doc.moveDown(0.5)

  section(doc, '👤 INVESTISSEUR')
  row(doc, 'Nom complet', `${data.investor.firstName} ${data.investor.lastName}`)
  row(doc, 'Email', data.investor.email)
  row(doc, 'Ville', data.investor.city || '—')
  row(doc, 'Statut KYC', data.investor.kycStatus === 'VERIFIED' ? '✓ Vérifié' : 'En attente')

  section(doc, '🚀 PROJET FINANCÉ')
  row(doc, 'Nom du projet', data.project.title)
  row(doc, 'Secteur', data.project.sector)
  row(doc, 'Localisation', data.project.location || '—')
  row(doc, 'Statut', data.project.status)
  row(doc, 'Objectif de levée', `${data.project.goalAmount?.toLocaleString()} FCFA`)

  section(doc, '💰 DÉTAILS DE L\'INVESTISSEMENT')
  row(doc, 'Montant investi', `${data.investment.amount?.toLocaleString()} FCFA`, true)
  row(doc, 'Taux de retour', `${data.project.expectedReturn || 0}%`)
  row(doc, 'Retour attendu', `${data.investment.expectedReturn?.toLocaleString()} FCFA`, true)
  row(doc, 'Contribution fonds garantie (2%)', `${data.investment.guaranteeContribution?.toLocaleString()} FCFA`)
  row(doc, 'Date d\'investissement', new Date(data.investment.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }))
  row(doc, 'Statut investissement', data.investment.status === 'COMPLETED' ? '✓ Remboursé' : '⏳ En cours')
  if (data.investment.returnedAmount) {
    row(doc, 'Montant reçu', `${data.investment.returnedAmount?.toLocaleString()} FCFA`, true)
  }

  // Cachet officiel
  doc.moveDown(1)
  doc.rect(40, doc.y, doc.page.width - 80, 60).stroke(GREEN)
  doc.fillColor(DARK).fontSize(10).font('Helvetica')
    .text('Ce document certifie la participation de l\'investisseur au projet mentionné ci-dessus sur la plateforme BAOBAB INVEST. Les fonds sont sécurisés en séquestre jusqu\'au remboursement.', 50, doc.y - 50, { width: doc.page.width - 100, align: 'center' })

  footer(doc)
  doc.end()
}

// ============================================
// RELEVÉ DE COMPTE INVESTISSEUR
// ============================================
export function generateInvestorStatement(res: Response, data: {
  investor: any, investments: any[], wallet: any, period: string
}) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="releve-investisseur-${Date.now()}.pdf"`)
  doc.pipe(res)

  header(doc, 'Relevé de Compte Investisseur', data.period)

  section(doc, '👤 TITULAIRE DU COMPTE')
  row(doc, 'Nom', `${data.investor.firstName} ${data.investor.lastName}`)
  row(doc, 'Email', data.investor.email)
  row(doc, 'Niveau Baobab', ['🌱 Graine','🌿 Jeune Baobab','🌳 Baobab','🏅 Grand Baobab'][data.investor.level - 1] || '—')

  section(doc, '💳 SITUATION WALLET')
  row(doc, 'Solde disponible', `${(data.wallet?.balance || 0).toLocaleString()} FCFA`, true)
  row(doc, 'En séquestre', `${(data.wallet?.escrowBalance || 0).toLocaleString()} FCFA`)
  row(doc, 'Total investi', `${(data.wallet?.totalInvested || 0).toLocaleString()} FCFA`)
  row(doc, 'Total gagné', `${(data.wallet?.totalEarned || 0).toLocaleString()} FCFA`, true)

  section(doc, '📊 RÉCAPITULATIF INVESTISSEMENTS')
  const totalInvested = data.investments.reduce((s, i) => s + i.amount, 0)
  const totalExpected = data.investments.reduce((s, i) => s + (i.expectedReturn || 0), 0)
  const totalReturned = data.investments.reduce((s, i) => s + (i.returnedAmount || 0), 0)
  row(doc, 'Nombre d\'investissements', String(data.investments.length))
  row(doc, 'Total investi', `${totalInvested.toLocaleString()} FCFA`, true)
  row(doc, 'Total retours attendus', `${totalExpected.toLocaleString()} FCFA`)
  row(doc, 'Total déjà reçu', `${totalReturned.toLocaleString()} FCFA`, true)
  row(doc, 'Rendement moyen', `${totalInvested > 0 ? ((totalExpected/totalInvested - 1)*100).toFixed(1) : 0}%`)

  section(doc, '📋 DÉTAIL DES INVESTISSEMENTS')
  data.investments.forEach((inv, i) => {
    if (doc.y > 700) { doc.addPage(); footer(doc) }
    doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold')
      .text(`${i+1}. ${inv.project?.title || '—'}`, 50, doc.y)
    doc.fillColor(GRAY).fontSize(9).font('Helvetica')
      .text(`${inv.amount?.toLocaleString()} FCFA · Retour: ${inv.expectedReturn?.toLocaleString()} FCFA · ${new Date(inv.createdAt).toLocaleDateString('fr-FR')} · ${inv.status}`, 50, doc.y)
    doc.moveDown(0.4)
  })

  footer(doc)
  doc.end()
}

// ============================================
// RAPPORT PROJET ENTREPRENEUR
// ============================================
export function generateProjectReport(res: Response, data: {
  entrepreneur: any, project: any, milestones: any[], investors: any[]
}) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="rapport-projet-${data.project.id.substring(0,8)}.pdf"`)
  doc.pipe(res)

  header(doc, 'Rapport de Projet', `${data.project.title} — ${data.project.sector}`)

  section(doc, '🚀 INFORMATIONS PROJET')
  row(doc, 'Titre', data.project.title)
  row(doc, 'Secteur', data.project.sector)
  row(doc, 'Localisation', data.project.location || '—')
  row(doc, 'Statut', data.project.status)
  row(doc, 'Date de soumission', new Date(data.project.createdAt).toLocaleDateString('fr-FR'))

  section(doc, '💰 FINANCEMENT')
  const pct = Math.round((data.project.raisedAmount / data.project.goalAmount) * 100)
  row(doc, 'Objectif', `${data.project.goalAmount?.toLocaleString()} FCFA`)
  row(doc, 'Montant levé', `${data.project.raisedAmount?.toLocaleString()} FCFA`, true)
  row(doc, 'Progression', `${pct}%`)
  row(doc, 'Nombre d\'investisseurs', String(data.investors.length))
  row(doc, 'Taux de retour promis', `${data.project.expectedReturn}%`)

  section(doc, '🏗️ JALONS')
  const approved = data.milestones.filter(m => ['APPROVED','PAID'].includes(m.status))
  const totalApproved = approved.reduce((s, m) => s + m.amount, 0)
  row(doc, 'Total jalons', String(data.milestones.length))
  row(doc, 'Jalons validés', String(approved.length))
  row(doc, 'Fonds débloqués', `${totalApproved.toLocaleString()} FCFA`, true)
  row(doc, 'Budget restant', `${(data.project.raisedAmount - totalApproved).toLocaleString()} FCFA`)

  doc.moveDown(0.3)
  data.milestones.forEach((m, i) => {
    if (doc.y > 700) { doc.addPage(); footer(doc) }
    const status = m.status === 'APPROVED' || m.status === 'PAID' ? '✓' : m.status === 'SUBMITTED' ? '⏳' : '○'
    doc.fillColor(DARK).fontSize(9).font('Helvetica')
      .text(`${status} Jalon ${i+1}: ${m.title} — ${m.amount?.toLocaleString()} FCFA [${m.status}]`, 50, doc.y)
    doc.moveDown(0.4)
  })

  section(doc, '👤 PORTEUR DE PROJET')
  row(doc, 'Nom', `${data.entrepreneur.firstName} ${data.entrepreneur.lastName}`)
  row(doc, 'Score réputation', `${data.entrepreneur.reputationScore || 50}/100`)

  footer(doc)
  doc.end()
}

// ============================================
// RAPPORT FINANCIER ADMIN
// ============================================
export function generateAdminReport(res: Response, data: {
  revenues: any[], investments: any[], users: any[], projects: any[], period: string
}) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="rapport-admin-${Date.now()}.pdf"`)
  doc.pipe(res)

  header(doc, 'Rapport Financier BAOBAB INVEST', data.period)

  section(doc, '📊 STATISTIQUES GLOBALES')
  row(doc, 'Utilisateurs total', String(data.users.length))
  row(doc, 'Investisseurs', String(data.users.filter(u => u.role === 'INVESTOR').length))
  row(doc, 'Entrepreneurs', String(data.users.filter(u => u.role === 'ENTREPRENEUR').length))
  row(doc, 'Mentors', String(data.users.filter(u => u.role === 'MENTOR').length))
  row(doc, 'KYC vérifiés', String(data.users.filter(u => u.kycStatus === 'VERIFIED').length))

  section(doc, '🚀 PROJETS')
  row(doc, 'Total projets', String(data.projects.length))
  row(doc, 'Actifs', String(data.projects.filter(p => p.status === 'ACTIVE').length))
  row(doc, 'Financés', String(data.projects.filter(p => p.status === 'FUNDED').length))
  row(doc, 'Terminés', String(data.projects.filter(p => p.status === 'COMPLETED').length))
  row(doc, 'Total levé', `${data.projects.reduce((s, p) => s + (p.raisedAmount||0), 0).toLocaleString()} FCFA`, true)

  section(doc, '💰 REVENUS BAOBAB INVEST')
  const byType: any = {}
  data.revenues.forEach(r => { byType[r.type] = (byType[r.type] || 0) + r.amount })
  const totalRev = data.revenues.reduce((s, r) => s + r.amount, 0)
  Object.entries(byType).forEach(([type, amount]: any) => {
    row(doc, type.replace(/_/g, ' '), `${amount.toLocaleString()} FCFA`)
  })
  row(doc, 'TOTAL REVENUS', `${totalRev.toLocaleString()} FCFA`, true)

  section(doc, '📋 DERNIÈRES TRANSACTIONS REVENUS')
  data.revenues.slice(0, 15).forEach(r => {
    if (doc.y > 700) { doc.addPage(); footer(doc) }
    doc.fillColor(DARK).fontSize(9).font('Helvetica')
      .text(`${new Date(r.createdAt).toLocaleDateString('fr-FR')} · ${r.description || r.type} · ${r.amount > 0 ? '+' : ''}${r.amount.toLocaleString()} FCFA`, 50, doc.y)
    doc.moveDown(0.4)
  })

  footer(doc)
  doc.end()
}

// ============================================
// RAPPORT MENTOR
// ============================================
export function generateMentorReport(res: Response, data: {
  mentor: any, projects: any[], wallet: any, period: string
}) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="rapport-mentor-${Date.now()}.pdf"`)
  doc.pipe(res)

  header(doc, 'Rapport Mentor', data.period)

  section(doc, '🎓 PROFIL MENTOR')
  row(doc, 'Nom', `${data.mentor.firstName} ${data.mentor.lastName}`)
  row(doc, 'Score réputation', `${data.mentor.reputationScore || 50}/100`)
  row(doc, 'Solde wallet', `${(data.wallet?.balance || 0).toLocaleString()} FCFA`, true)

  section(doc, '📊 PROJETS MENTORÉS')
  row(doc, 'Total projets', String(data.projects.length))
  row(doc, 'Actifs', String(data.projects.filter(p => ['ACTIVE','FUNDED','IN_PROGRESS'].includes(p.status)).length))
  row(doc, 'Terminés', String(data.projects.filter(p => p.status === 'COMPLETED').length))
  const totalRaised = data.projects.reduce((s, p) => s + (p.raisedAmount||0), 0)
  const totalCommission = Math.round(totalRaised * 0.02)
  row(doc, 'Total levé (tous projets)', `${totalRaised.toLocaleString()} FCFA`)
  row(doc, 'Commissions totales (2%)', `${totalCommission.toLocaleString()} FCFA`, true)

  section(doc, '📋 DÉTAIL PROJETS')
  data.projects.forEach((p, i) => {
    if (doc.y > 700) { doc.addPage(); footer(doc) }
    const commission = Math.round((p.raisedAmount||0) * 0.02)
    doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold').text(`${i+1}. ${p.title}`, 50, doc.y)
    doc.fillColor(GRAY).fontSize(9).font('Helvetica')
      .text(`${p.sector} · Levé: ${(p.raisedAmount||0).toLocaleString()} FCFA · Commission: ${commission.toLocaleString()} FCFA · ${p.status}`, 50, doc.y)
    doc.moveDown(0.5)
  })

  footer(doc)
  doc.end()
}
