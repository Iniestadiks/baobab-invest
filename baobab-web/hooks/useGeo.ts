import { useState, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL

export function useCountries() {
  const [countries, setCountries] = useState<any[]>([])
  useEffect(() => {
    fetch('/countries.json').then(r => r.json()).then(setCountries)
  }, [])
  return countries
}

export function useStates(countryCode: string) {
  const [states, setStates] = useState<any[]>([])
  useEffect(() => {
    if (!countryCode) { setStates([]); return }
    fetch(`${API}/api/geo/states/${countryCode}`)
      .then(r => r.json()).then(d => setStates(d.data || []))
  }, [countryCode])
  return states
}

export function useCities(countryCode: string, stateCode: string) {
  const [cities, setCities] = useState<string[]>([])
  useEffect(() => {
    if (!countryCode || !stateCode) { setCities([]); return }
    fetch(`${API}/api/geo/cities/${countryCode}/${stateCode}`)
      .then(r => r.json()).then(d => setCities(d.data || []))
  }, [countryCode, stateCode])
  return cities
}

// Composant sélecteur géographique réutilisable
export function GeoSelector({ value, onChange, className = '' }: {
  value: { country: string, countryCode: string, state: string, stateCode: string, city: string, indicatif: string },
  onChange: (v: any) => void,
  className?: string
}) {
  const countries = useCountries()
  const states = useStates(value.countryCode)
  const cities = useCities(value.countryCode, value.stateCode)

  const selectClass = `w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 bg-white ${className}`

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">Pays de résidence *</label>
        <select className={selectClass} value={value.countryCode}
          onChange={e => {
            const c = countries.find(x => x.code === e.target.value)
            onChange({ ...value, country: c?.name || '', countryCode: e.target.value, indicatif: c?.indicatif || '', state: '', stateCode: '', city: '' })
          }}>
          <option value="">-- Sélectionner un pays --</option>
          {countries.map(c => (
            <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.indicatif})</option>
          ))}
        </select>
      </div>
      {states.length > 0 && (
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Région *</label>
          <select className={selectClass} value={value.stateCode}
            onChange={e => {
              const s = states.find(x => x.code === e.target.value)
              onChange({ ...value, state: s?.name || '', stateCode: e.target.value, city: '' })
            }}>
            <option value="">-- Sélectionner une région --</option>
            {states.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>
      )}
      {cities.length > 0 && (
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Ville *</label>
          <select className={selectClass} value={value.city}
            onChange={e => onChange({ ...value, city: e.target.value })}>
            <option value="">-- Sélectionner une ville --</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}
      {value.countryCode && states.length === 0 && (
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Ville</label>
          <input type="text" placeholder="Votre ville" value={value.city}
            onChange={e => onChange({ ...value, city: e.target.value })}
            className={selectClass} />
        </div>
      )}
    </div>
  )
}
