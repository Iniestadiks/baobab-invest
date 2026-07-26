// Catalogue des cours de l'Académie KORAPACT.
// Contenu texte (pas de vidéo hébergée — on ne promet que ce qu'on tient).
// "points" = bonus réel appliqué au score de bankabilité (entrepreneurs)
// ou aux points de réputation (investisseurs/tous), via l'attribution à
// la complétion (voir routes/academy.ts).

export interface Course {
  id: string
  title: string
  category: 'GESTION' | 'MARKETING' | 'AGRICULTURE' | 'PLATEFORME' | 'INVESTISSEMENT' | 'HYGIENE'
  targetRole: ('ENTREPRENEUR' | 'INVESTOR' | 'MENTOR' | 'BUILDER' | 'ALL')[]
  duration: string
  level: 'Débutant' | 'Intermédiaire'
  emoji: string
  certified: boolean
  points: number // bonus réel si certifiant
  desc: string
  content: string[] // paragraphes de la leçon
}

export const COURSE_CATALOG: Course[] = [
  // ── ENTREPRENEUR ──
  {
    id: 'gestion-base',
    title: "Gestion de base d'une entreprise",
    category: 'GESTION', targetRole: ['ENTREPRENEUR'],
    duration: '8 min', level: 'Débutant', emoji: '📊', certified: true, points: 10,
    desc: "Comptabilité de base, gestion de trésorerie et obligations légales.",
    content: [
      "Tenez un cahier de recettes/dépenses même simple — la première cause d'échec des petites entreprises est de ne pas savoir où va l'argent.",
      "Séparez toujours l'argent de l'entreprise et votre argent personnel, même sur un compte mobile money dédié.",
      "Prévoyez une réserve de trésorerie équivalente à 1-2 mois de charges avant de vous verser un salaire.",
      "Renseignez-vous sur le régime fiscal applicable à votre secteur (RCCM, NINEA au Sénégal) dès que votre activité devient régulière.",
    ],
  },
  {
    id: 'marketing-digital',
    title: "Marketing digital en Afrique",
    category: 'MARKETING', targetRole: ['ENTREPRENEUR'],
    duration: '12 min', level: 'Intermédiaire', emoji: '📱', certified: true, points: 10,
    desc: "WhatsApp Business, Facebook Ads, storytelling pour vendre plus.",
    content: [
      "WhatsApp Business (gratuit) permet un catalogue produit et des réponses automatiques — souvent plus efficace qu'un site web pour démarrer.",
      "Racontez une histoire vraie autour de votre produit (origine, impact local) plutôt que de lister des caractéristiques — ça se partage plus.",
      "Un petit budget Facebook/Instagram Ads ciblé sur votre ville/quartier est souvent plus rentable qu'une large campagne nationale.",
      "Répondez toujours en moins de 24h — la réactivité est le premier critère de confiance en ligne.",
    ],
  },
  {
    id: 'agriculture-rentable',
    title: "Agriculture rentable : production à la vente",
    category: 'AGRICULTURE', targetRole: ['ENTREPRENEUR'],
    duration: '15 min', level: 'Débutant', emoji: '🌾', certified: true, points: 10,
    desc: "Planification des cultures, gestion des stocks, circuits de distribution.",
    content: [
      "Planifiez vos cultures en fonction de la demande du marché, pas seulement de ce qui pousse facilement dans votre région.",
      "Diversifiez vos acheteurs — dépendre d'un seul grossiste vous expose à un rapport de force défavorable sur les prix.",
      "Investissez dans un stockage minimal (sacs hermétiques, local sec) pour réduire les pertes post-récolte, souvent 20-30% de la production.",
      "Un calendrier de trésorerie sur la durée du cycle de culture aide à anticiper les besoins de financement (comme sur KORAPACT).",
    ],
  },
  {
    id: 'lever-fonds-korapact',
    title: "Lever des fonds sur KORAPACT",
    category: 'PLATEFORME', targetRole: ['ENTREPRENEUR'],
    duration: '6 min', level: 'Débutant', emoji: '💰', certified: true, points: 15,
    desc: "Créer un dossier convaincant, choisir son mentor, gérer sa campagne.",
    content: [
      "Une description détaillée (200+ caractères), une vidéo de pitch et une image de couverture augmentent significativement votre score de bankabilité.",
      "Un mentor qui accepte de parrainer votre projet renforce fortement la confiance des investisseurs — et vous coûte 2% versés à la collecte, pas d'avance.",
      "Vos fonds sont débloqués en 3 paliers (40%/35%/25%) au fil de vos remboursements — pas en une seule fois à la clôture.",
      "Publiez un rapport d'avancement au moins tous les 21 jours : le silence prolongé pénalise votre score de réputation.",
    ],
  },
  {
    id: 'artisanat-ecommerce',
    title: "Artisanat et e-commerce",
    category: 'MARKETING', targetRole: ['ENTREPRENEUR'],
    duration: '10 min', level: 'Intermédiaire', emoji: '🎨', certified: true, points: 10,
    desc: "Vendre ses créations en ligne, fixer ses prix, gérer les commandes.",
    content: [
      "Calculez toujours votre prix à partir du coût réel (matière + temps + marge) — ne copiez pas le prix d'un concurrent sans connaître ses coûts.",
      "Des photos prises en lumière naturelle, sur fond neutre, augmentent nettement le taux de conversion en ligne.",
      "Proposez un acompte à la commande pour les pièces sur mesure — ça sécurise votre trésorerie et filtre les acheteurs sérieux.",
    ],
  },
  {
    id: 'hygiene-securite',
    title: "Hygiène et sécurité alimentaire",
    category: 'HYGIENE', targetRole: ['ENTREPRENEUR'],
    duration: '8 min', level: 'Débutant', emoji: '🍽️', certified: true, points: 10,
    desc: "Normes d'hygiène, gestion des stocks alimentaires, formation du personnel.",
    content: [
      "Respectez la chaîne du froid dès l'achat — un produit rompu même brièvement perd ses garanties de conservation.",
      "Formez chaque employé aux gestes de base (lavage des mains, gestion des dates de péremption) dès son arrivée, pas seulement à l'oral.",
      "Un registre simple des entrées/sorties de stock alimentaire limite le gaspillage et facilite la détection de pertes anormales.",
    ],
  },
  // ── INVESTISSEUR ──
  {
    id: 'bases-investissement',
    title: "Comprendre l'investissement communautaire",
    category: 'INVESTISSEMENT', targetRole: ['INVESTOR'],
    duration: '10 min', level: 'Débutant', emoji: '📈', certified: true, points: 10,
    desc: "Risque, rendement, et ce qui différencie KORAPACT d'un placement bancaire.",
    content: [
      "Contrairement à un dépôt bancaire, votre capital investi n'est pas garanti — il dépend de la capacité réelle de l'entrepreneur à rembourser.",
      "Le taux de retour affiché (minimum 22-24%) est un objectif contractuel, pas une garantie absolue — c'est le prix du risque que vous prenez.",
      "L'assurance capital (2% optionnel) couvre une partie de votre mise en cas d'échec avéré du projet, jamais 100%.",
      "Ne jamais investir une somme dont vous auriez besoin à court terme — vos fonds restent bloqués jusqu'au remboursement du projet.",
    ],
  },
  {
    id: 'lire-dossier-projet',
    title: "Comment lire un dossier de projet",
    category: 'INVESTISSEMENT', targetRole: ['INVESTOR'],
    duration: '8 min', level: 'Intermédiaire', emoji: '🔍', certified: true, points: 10,
    desc: "Score de bankabilité, présence d'un mentor, secteur — ce qui compte vraiment.",
    content: [
      "Le score de bankabilité reflète la qualité du dossier (description, vidéo, mentor) — c'est un indicateur de sérieux, pas une garantie de succès.",
      "Un projet parrainé par un mentor a un garant supplémentaire qui a mis sa réputation en jeu — un signal positif fort.",
      "Regardez le score de réputation de l'entrepreneur : un historique de remboursements à l'heure est le meilleur indicateur disponible.",
      "Vérifiez la cohérence entre le montant demandé et le secteur — un besoin trop élevé pour un petit commerce est un signal d'alerte.",
    ],
  },
  {
    id: 'diversification',
    title: "Diversifier son portefeuille",
    category: 'INVESTISSEMENT', targetRole: ['INVESTOR'],
    duration: '7 min', level: 'Intermédiaire', emoji: '🌈', certified: true, points: 10,
    desc: "Répartir ses investissements pour réduire le risque global.",
    content: [
      "Répartir de petits montants sur plusieurs projets réduit l'impact d'un échec isolé, plutôt que de tout miser sur un seul dossier.",
      "Variez les secteurs (agriculture, commerce, tech...) — ils ne réagissent pas aux mêmes risques économiques.",
      "Variez aussi les durées de projet pour lisser vos rentrées de remboursement dans le temps plutôt que tout au même moment.",
    ],
  },
  // ── PLATEFORME (tous rôles) ──
  {
    id: 'guide-demarrage',
    title: "Utiliser KORAPACT — Guide de démarrage",
    category: 'PLATEFORME', targetRole: ['ALL'],
    duration: '5 min', level: 'Débutant', emoji: '🧭', certified: false, points: 5,
    desc: "Déposer des fonds, investir, suivre ses projets, retirer ses gains.",
    content: [
      "Déposez des fonds depuis Wallet → Déposer, choisissez votre moyen de paiement, puis suivez le lien de paiement sécurisé.",
      "Chaque investissement se fait projet par projet, avec un montant minimum affiché sur la fiche du projet.",
      "Suivez vos remboursements dans l'onglet dédié de votre tableau de bord — chaque mensualité y apparaît avec sa date prévue.",
      "Le retrait de gains est gratuit ; le retrait de fonds jamais investis est soumis à des frais réduisant les abus.",
    ],
  },
  {
    id: 'paliers-remboursements',
    title: "Comprendre les paliers et remboursements",
    category: 'PLATEFORME', targetRole: ['ALL'],
    duration: '6 min', level: 'Intermédiaire', emoji: '📅', certified: false, points: 5,
    desc: "Comment l'argent circule concrètement entre collecte et remboursement.",
    content: [
      "Dès qu'un projet atteint son objectif, l'entrepreneur reçoit immédiatement 40% de la cagnotte nette (Palier 1).",
      "Les paliers suivants (35% puis 25%) se débloquent progressivement, au fil des mensualités effectivement remboursées.",
      "Les investisseurs sont remboursés au prorata de leur mise, à chaque mensualité payée par l'entrepreneur — pas en une seule fois à la fin.",
      "Un délai de grâce (1 à 2 mois selon le secteur) précède la toute première mensualité après le déblocage du Palier 1.",
    ],
  },
]

export function getCoursesForRole(role: string): Course[] {
  return COURSE_CATALOG.filter(c => c.targetRole.includes('ALL') || c.targetRole.includes(role as any))
}

export function getCourse(id: string): Course | undefined {
  return COURSE_CATALOG.find(c => c.id === id)
}
