export const PROJECT_TAXONOMY: Record<string, string[]> = {
  AGRICULTURE: [
    "Maraîchage", "Élevage", "Pisciculture", "Céréales",
    "Arboriculture fruitière", "Apiculture", "Transformation agricole"
  ],
  COMMERCE: [
    "Commerce général", "Import/Export", "Boutique/Magasin",
    "E-commerce", "Marché", "Grossiste"
  ],
  TRANSPORT: [
    "Véhicule léger", "Moto-taxi", "Camion/Fret",
    "Transport en commun", "Logistique/Livraison"
  ],
  TECH: [
    "Application mobile", "Site web/E-commerce",
    "Équipement informatique", "Services numériques"
  ],
  RESTAURATION: [
    "Restaurant", "Street food/Snack", "Traiteur",
    "Boulangerie/Pâtisserie", "Café/Bar"
  ],
  ARTISANAT: [
    "Couture/Mode", "Menuiserie/Ébénisterie",
    "Bijouterie", "Poterie/Céramique", "Artisanat divers"
  ],
  SANTE: [
    "Pharmacie", "Cabinet médical/Clinique",
    "Matériel médical", "Bien-être/Beauté"
  ],
  EDUCATION: [
    "École privée", "Centre de formation professionnelle",
    "Centre de langues", "Cours particuliers/Soutien scolaire"
  ],
  ENERGIE: [
    "Panneaux solaires", "Groupe électrogène",
    "Économies d'énergie", "Énergie renouvelable"
  ],
  SERVICES: [
    "Services aux entreprises", "Événementiel",
    "Nettoyage/Entretien", "Sécurité privée", "Services divers"
  ],
  AUTRE: ["Autre secteur"]
}

// Limite max de projets actifs par sous-secteur et zone géographique
export const MAX_ACTIVE_PER_SUBSECTOR = 3

export function getSectors() {
  return Object.keys(PROJECT_TAXONOMY)
}

export function getSubSectors(sector: string): string[] {
  return PROJECT_TAXONOMY[sector] || []
}
