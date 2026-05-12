const {PrismaClient} = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();

async function seed() {
  console.log("Recreation des donnees...");
  const hash = await bcrypt.hash('motdepasse123', 10);
  const adminHash = await bcrypt.hash('Admin@Baobab2025', 10);

  const admin = await p.user.create({ data: {
    email: 'admin@baobabinvest.com', password: adminHash,
    firstName: 'Admin', lastName: 'Baobab', phone: '000000000000',
    role: 'ADMIN', kycStatus: 'VERIFIED', referralCode: 'ADMIN001',
    reputationScore: 100, level: 4
  }});
  await p.wallet.create({ data: { userId: admin.id, balance: 100000 }});
  console.log('Admin cree');

  const amadou = await p.user.create({ data: {
    email: 'amadou@test.com', password: hash,
    firstName: 'Amadou', lastName: 'Diallo', phone: '221771234567',
    role: 'INVESTOR', kycStatus: 'VERIFIED', referralCode: 'AMAD001',
    city: 'Dakar', country: 'SN', reputationScore: 75, level: 2
  }});
  await p.wallet.create({ data: { userId: amadou.id, balance: 500000 }});
  console.log('Investisseur Amadou cree');

  const fatou = await p.user.create({ data: {
    email: 'entrepreneur@test.com', password: hash,
    firstName: 'Fatou', lastName: 'Sow', phone: '221771234568',
    role: 'ENTREPRENEUR', kycStatus: 'VERIFIED', referralCode: 'FATOU01',
    city: 'Dakar', country: 'SN', reputationScore: 80, level: 2
  }});
  await p.wallet.create({ data: { userId: fatou.id, balance: 0 }});
  console.log('Entrepreneur Fatou cree');

  const ousmane = await p.user.create({ data: {
    email: 'mentor@test.com', password: hash,
    firstName: 'Ousmane', lastName: 'Mbaye', phone: '221771234569',
    role: 'MENTOR', kycStatus: 'VERIFIED', referralCode: 'OUSMANE1',
    city: 'Dakar', country: 'SN', reputationScore: 90, level: 3
  }});
  await p.wallet.create({ data: { userId: ousmane.id, balance: 980 }});
  console.log('Mentor Ousmane cree');

  const aissetou = await p.user.create({ data: {
    email: 'aissatousanogo4@gmail.com', password: hash,
    firstName: 'aissetou', lastName: 'sanogo', phone: '00221775000000',
    role: 'INVESTOR', kycStatus: 'NOT_SUBMITTED', referralCode: 'AISS001',
    city: 'Dakar', country: 'SN', reputationScore: 50, level: 1
  }});
  await p.wallet.create({ data: { userId: aissetou.id, balance: 0 }});
  console.log('Investisseur aissetou cree');

  // Récupérer les champs obligatoires du modèle Project
  const projectFields = Object.keys(p.project.fields || {});

  const ferme = await p.project.create({ data: {
    title: 'Ferme avicole',
    description: 'Projet avicole moderne a Dakar avec 500 poulets de chair.',
    sector: 'AGRICULTURE', city: 'Dakar', location: 'dakar',
    goalAmount: 1000000, minimumInvestment: 5000,
    expectedReturn: 17, durationMonths: 12,
    status: 'FUNDED', entrepreneurId: fatou.id,
    raisedAmount: 1000000, commissionRate: 5
  }});

  const vetement = await p.project.create({ data: {
    title: 'Vente de vetement',
    description: 'Boutique de vente de vetements africains en ligne.',
    sector: 'COMMERCE', city: 'Saint-Louis', location: 'Saint louis',
    goalAmount: 1000000, minimumInvestment: 5000,
    expectedReturn: 15, durationMonths: 6,
    status: 'ACTIVE', entrepreneurId: fatou.id, mentorId: ousmane.id,
    raisedAmount: 49000, commissionRate: 5
  }});

  const sante = await p.project.create({ data: {
    title: 'sante pa',
    description: 'Clinique mobile de sante primaire.',
    sector: 'SANTE', city: 'Fatick', location: 'Fatick',
    goalAmount: 3000000, minimumInvestment: 5000,
    expectedReturn: 17, durationMonths: 18,
    status: 'FUNDED', entrepreneurId: fatou.id,
    raisedAmount: 3000000, commissionRate: 5
  }});
  console.log('Projets crees');

  await p.investment.create({ data: {
    userId: amadou.id, projectId: ferme.id,
    amount: 98000, expectedReturn: Math.round(98000 * 1.17),
    guaranteeContribution: Math.round(98000 * 0.02), status: 'ACTIVE'
  }});
  await p.investment.create({ data: {
    userId: amadou.id, projectId: vetement.id,
    amount: 49000, expectedReturn: Math.round(49000 * 1.15),
    guaranteeContribution: Math.round(49000 * 0.02), status: 'ACTIVE'
  }});
  await p.investment.create({ data: {
    userId: amadou.id, projectId: sante.id,
    amount: 2940000, expectedReturn: Math.round(2940000 * 1.17),
    guaranteeContribution: Math.round(2940000 * 0.02), status: 'ACTIVE'
  }});
  await p.wallet.update({
    where: { userId: amadou.id },
    data: { escrowBalance: 3087000, totalInvested: 3087000 }
  });
  console.log('Investissements crees');

  await p.platformRevenue.createMany({ data: [
    { type: 'COMMISSION_COLLECTION', amount: 4900, projectId: ferme.id, description: 'Commission 5% Ferme avicole' },
    { type: 'COMMISSION_COLLECTION', amount: 2450, projectId: vetement.id, description: 'Commission 5% Vente vetement' },
    { type: 'COMMISSION_COLLECTION', amount: 147000, projectId: sante.id, description: 'Commission 5% sante pa' },
    { type: 'MENTOR_COMMISSION', amount: 980, projectId: vetement.id, description: 'Commission mentor 2%' },
  ]});
  await p.wallet.update({ where: { userId: ousmane.id }, data: { balance: 980 }});
  console.log('Commissions creees');

  await p.supplier.create({ data: {
    companyName: 'Agri Equipements SN', email: 'contact@agri-equipements.sn',
    phone: '221338001234', sector: 'AGRICULTURE',
    mobileMoneyProvider: 'Orange Money', mobileMoneyNumber: '221771234560',
    isVerified: true
  }});
  console.log('Fournisseur cree');

  const configs = [
    { key: 'commission_baobab_collection', value: 5, label: 'Commission BAOBAB cloture (%)' },
    { key: 'commission_mentor', value: 2, label: 'Commission mentor (%)' },
    { key: 'commission_guarantee', value: 2, label: 'Fonds de garantie (%)' },
    { key: 'commission_baobab_return', value: 5, label: 'Commission BAOBAB retours (%)' },
    { key: 'paydunya_payin', value: 3, label: 'PayDunya Payin (%)' },
    { key: 'paydunya_payout', value: 2, label: 'PayDunya Payout (%)' },
    { key: 'return_min_with_mentor', value: 15, label: 'Retour min avec mentor (%)' },
    { key: 'return_min_no_mentor', value: 17, label: 'Retour min sans mentor (%)' },
    { key: 'investment_min', value: 5000, label: 'Investissement minimum (FCFA)' },
    { key: 'withdrawal_min', value: 5000, label: 'Retrait minimum (FCFA)' },
  ];
  for (const c of configs) {
    await p.platformConfig.upsert({
      where: { key: c.key },
      update: { value: c.value, label: c.label },
      create: { key: c.key, value: c.value, label: c.label, description: c.label }
    });
  }
  console.log('Config creee');

  console.log('\n SEED TERMINE');
  console.log('admin@baobabinvest.com / Admin@Baobab2025');
  console.log('amadou@test.com / motdepasse123');
  console.log('entrepreneur@test.com / motdepasse123');
  console.log('mentor@test.com / motdepasse123');
  await p.$disconnect();
}
seed().catch(e => { console.error(e); process.exit(1); });
