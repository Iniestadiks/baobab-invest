'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.korapact.com'

export default function AdminAccessPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })
  const [attempts, setAttempts] = useState(0)
  const [locked, setLocked] = useState(false)
  const [lockUntil, setLockUntil] = useState<number | null>(null)

  // Si déjà connecté en tant qu'admin → rediriger
  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    const user = localStorage.getItem('user')
    if (token && user) {
      try {
        const u = JSON.parse(user)
        if (u.role === 'ADMIN') { router.replace('/admin'); return }
      } catch { /* ignoré */ }
    }
  }, [router])

  // Minuterie de verrouillage local (protection brute-force côté client)
  useEffect(() => {
    if (!lockUntil) return
    const remaining = lockUntil - Date.now()
    if (remaining <= 0) { setLocked(false); setLockUntil(null); return }
    const timer = setTimeout(() => { setLocked(false); setLockUntil(null) }, remaining)
    return () => clearTimeout(timer)
  }, [lockUntil])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (locked) {
      const remaining = Math.ceil(((lockUntil || 0) - Date.now()) / 1000)
      setError(`Trop de tentatives. Réessayez dans ${remaining} secondes.`)
      return
    }

    if (!form.email.trim() || !form.password) {
      setError('Veuillez remplir tous les champs.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API}/api/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim().toLowerCase(), password: form.password }),
      })

      const data = await res.json()

      if (!data.success) {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)

        // Verrouillage local après 5 tentatives — en complément du rate limit serveur
        if (newAttempts >= 5) {
          const until = Date.now() + 5 * 60 * 1000 // 5 minutes
          setLocked(true)
          setLockUntil(until)
          setError('Trop de tentatives incorrectes. Accès verrouillé 5 minutes.')
        } else {
          setError(data.message || 'Accès refusé')
        }
        return
      }

      // Connexion réussie
      setAttempts(0)
      localStorage.setItem('accessToken', data.data.accessToken)
      localStorage.setItem('refreshToken', data.data.refreshToken)
      localStorage.setItem('user', JSON.stringify(data.data.user))
      router.push('/admin')

    } catch {
      setError('Impossible de joindre le serveur. Vérifiez votre connexion.')
    } finally {
      setLoading(false)
    }
  }

  const isDisabled = loading || locked

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden"
      style={{ background: '#050810' }}
    >
      {/* Ambient glow doré */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(ellipse, #F59E0B, transparent)', filter: 'blur(100px)' }}
        />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo doré */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl mx-auto mb-5"
            style={{
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              boxShadow: '0 0 32px rgba(245,158,11,0.35)',
              color: '#050810',
            }}
          >
            K
          </div>
          <h1 className="text-xl font-black text-white tracking-tight mb-1">Espace Administrateur</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Accès restreint — toutes les connexions sont enregistrées
          </p>
        </div>

        {/* Formulaire */}
        <div
          className="rounded-2xl p-7"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(245,158,11,0.18)' }}
        >
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 text-xs rounded-xl px-4 py-3 mb-5"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}
            >
              <span aria-hidden>🚫</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div className="mb-4">
              <label
                htmlFor="admin-email"
                className="block text-xs font-bold mb-2 uppercase tracking-widest"
                style={{ color: 'rgba(255,255,255,0.45)' }}
              >
                Email administrateur
              </label>
              <input
                id="admin-email"
                name="email"
                type="email"
                autoComplete="username"
                value={form.email}
                onChange={handleChange}
                required
                disabled={isDisabled}
                className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  opacity: isDisabled ? 0.6 : 1,
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.08)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            {/* Mot de passe */}
            <div className="mb-6">
              <label
                htmlFor="admin-password"
                className="block text-xs font-bold mb-2 uppercase tracking-widest"
                style={{ color: 'rgba(255,255,255,0.45)' }}
              >
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  disabled={isDisabled}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all pr-12"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    opacity: isDisabled ? 0.6 : 1,
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.08)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  onClick={() => setShowPassword(v => !v)}
                  disabled={isDisabled}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '16px', padding: '4px' }}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isDisabled}
              className="w-full py-3 rounded-xl font-bold text-base transition-all"
              style={{
                background: isDisabled ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg, #F59E0B, #D97706)',
                color: isDisabled ? 'rgba(255,255,255,0.5)' : '#050810',
                boxShadow: isDisabled ? 'none' : '0 6px 24px rgba(245,158,11,0.3)',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                border: 'none',
                minHeight: '48px',
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Vérification...
                </span>
              ) : locked ? '⏳ Accès temporairement verrouillé' : '🔐 Accéder à l\'administration'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Accès non autorisé sanctionné par nos conditions d&apos;utilisation.
        </p>
      </div>
    </div>
  )
}
