const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();

async function seed() {
  const fatou = await p.user.findFirst({ where: { email: 'entrepreneur@test.com' } });
  const ousmane = await p.user.findFirst({ where: { email: 'mentor@test.com' } });
  const amadou = await p.user.findFirst({ where: { email: 'amadou@test.com' } });

  if (!fatou || !ousmane || !amadou) { console.error('Utilisateurs introuvables'); return; }

  const ferme = await p.project.create({ data: {
    title: 'Ferme avicole',
    description: 'Projet avicole moderne a Dakar avec 500 poulets de chair.',
    sector: 'AGRICULTURE', city: 'Dakar',
    goalAmount: 1000000, minimumInvestment: 5000,
    expectedReturn: 17, durationMonths: 12,
    status: 'FUNDED', entrepreneurId: fatou.id,
    raisedAmount: 1000000, commissionRate: 5
  }});

  const vetement = await p.project.create({ data: {
    title: 'Vente de vetement',
    description: 'Boutique de vente de vetements africains en ligne.',
    sector: 'COMMERCE', city: 'Saint-Louis',
    goalAmount: 1000000, minimumInvestment: 5000,
    expectedReturn: 15, durationMonths: 6,
    status: 'ACTIVE', entrepreneurId: fatou.id, mentorId: ousmane.id,
    raisedAmount: 49000, commissionRate: 5
  }});

  const sante = await p.project.create({ data: {
    title: 'sante pa',
    description: 'Clinique mobile de sante primaire.',
    sector: 'SANTE', city: 'Fatick',
    goalAmount: 3000000, minimumInvestment: 5000,
    expectedReturn: 17, durationMonths: 18,
    status: 'FUNDED', entrepreneurId: fatou.id,
    raisedAmount: 3000000, commissionRate: 5
  }});
  console.log('Projets crees');

  await p.investment.create({ data: { userId: amadou.id, projectId: ferme.id, amount: 98000, expectedReturn: Math.round(98000*1.17), guaranteeContribution: Math.round(98000*0.02), status: 'ACTIVE' }});
  await p.investment.create({ data: { userId: amadou.id, projectId: vetement.id, amount: 49000, expectedReturn: Math.round(49000*1.15), guaranteeContribution: Math.round(49000*0.02), status: 'ACTIVE' }});
  await p.investment.create({ data: { userId: amadou.id, projectId: sante.id, amount: 2940000, expectedReturn: Math.round(2940000*1.17), guaranteeContribution: Math.round(2940000*0.02), status: 'ACTIVE' }});
  await p.wallet.update({ where: { userId: amadou.id }, data: { escrowBalance: 3087000, totalInvested: 3087000 }});
  console.log('Investissements crees');

  await p.supplier.upsert({
    where: { email: 'contact@agri-equipements.sn' },
    update: {},
    create: { companyName: 'Agri Equipements SN', email: 'contact@agri-equipements.sn', phone: '221338001234', sector: 'AGRICULTURE', mobileMoneyProvider: 'Orange Money', mobileMoneyNumber: '221771234560', isVerified: true }
  });
  console.log('Fournisseur cree');

  // Commissions
  await p.platformRevenue.createMany({ data: [
    { type: 'COMMISSION_COLLECTION', amount: 4900, projectId: ferme.id, description: 'Commission 5% Ferme avicole' },
    { type: 'COMMISSION_COLLECTION', amount: 2450, projectId: vetement.id, description: 'Commission 5% Vente vetement' },
    { type: 'COMMISSION_COLLECTION', amount: 147000, projectId: sante.id, description: 'Commission 5% sante pa' },
    { type: 'MENTOR_COMMISSION', amount: 980, projectId: vetement.id, description: 'Commission mentor 2%' },
  ]});
  console.log('Commissions creees');

  console.log('RESEED TERMINE');
  await p.$disconnect();
}
seed().catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
