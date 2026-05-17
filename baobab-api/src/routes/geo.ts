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
