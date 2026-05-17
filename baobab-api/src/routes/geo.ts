import { Router, Request, Response } from 'express'
import { Country, State, City } from 'country-state-city'

const router = Router()

// Régions d'un pays
router.get('/states/:countryCode', (req: Request, res: Response) => {
  const states = State.getStatesOfCountry(req.params.countryCode)
  res.json({ success: true, data: states.map(s => ({ name: s.name, code: s.isoCode })) })
})

// Villes d'une région
router.get('/cities/:countryCode/:stateCode', (req: Request, res: Response) => {
  const cities = City.getCitiesOfState(req.params.countryCode, req.params.stateCode)
  res.json({ success: true, data: cities.map(c => c.name) })
})

export default router

// Taxonomie projets
import { PROJECT_TAXONOMY, MAX_ACTIVE_PER_SUBSECTOR } from '../config/taxonomy'

router.get('/taxonomy', (_req, res) => {
  res.json({ success: true, data: PROJECT_TAXONOMY })
})

router.get('/taxonomy/:sector', (req, res) => {
  const sub = PROJECT_TAXONOMY[req.params.sector.toUpperCase()]
  if (!sub) { res.status(404).json({ success: false, message: 'Secteur introuvable' }); return }
  res.json({ success: true, data: sub })
})

// Vérifier disponibilité sous-secteur
router.get('/check-subsector/:sector/:subSector/:city', async (req: any, res: any) => {
  try {
    const { sector, subSector, city } = req.params
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    const count = await prisma.project.count({
      where: {
        sector: sector as any,
        subSector: decodeURIComponent(subSector),
        city: { contains: decodeURIComponent(city), mode: 'insensitive' },
        status: { in: ['ACTIVE', 'FUNDED', 'IN_PROGRESS'] }
      }
    })
    const available = count < MAX_ACTIVE_PER_SUBSECTOR
    const projects = available ? [] : await prisma.project.findMany({
      where: {
        sector: sector as any,
        subSector: decodeURIComponent(subSector),
        city: { contains: decodeURIComponent(city), mode: 'insensitive' },
        status: { in: ['ACTIVE', 'FUNDED'] }
      },
      select: { id: true, title: true, raisedAmount: true, goalAmount: true, status: true }
    })
    await prisma.$disconnect()
    res.json({ success: true, data: { available, count, max: MAX_ACTIVE_PER_SUBSECTOR, projects } })
  } catch(e) { res.status(500).json({ success: false, message: 'Erreur' }) }
})
