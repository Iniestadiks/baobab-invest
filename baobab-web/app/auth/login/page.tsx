'use client'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.korapact.com'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')
  const errorParam = searchParams.get('error')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })

  // Message d'erreur venant de l'URL (ex: OAuth échoué)
  useEffect(() => {
    if (errorParam === 'google_failed') {
      setError('La connexion avec Google a échoué. Réessayez ou utilisez votre email.')
    } else if (errorParam === 'account_blocked') {
      setError('Ce compte est bloqué. Contactez le support.')
    }
  }, [errorParam])

  // Si déjà connecté → rediriger selon le rôle
  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    const user = localStorage.getItem('user')
    if (!token || !user) return

    try {
      const u = JSON.parse(user)
      // Un admin connecté ne doit pas passer par /auth/login
      if (u.role === 'ADMIN') { router.replace('/admin'); return }
      if (redirect) { router.push(redirect); return }
      if (u.role === 'ENTREPRENEUR') router.replace('/entrepreneur')
      else if (u.role === 'MENTOR') router.replace('/mentor')
      else if (u.role === 'BUILDER') router.replace('/builder')
      else router.replace('/dashboard')
    } catch { /* localStorage corrompu */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.email.trim() || !form.password) {
      setError('Veuillez remplir tous les champs.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim().toLowerCase(), password: form.password }),
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.message || 'Identifiants invalides')
        return
      }

      localStorage.setItem('accessToken', data.data.accessToken)
      localStorage.setItem('refreshToken', data.data.refreshToken)
      localStorage.setItem('user', JSON.stringify(data.data.user))

      if (redirect) { router.push(redirect); return }

      const role = data.data.user.role
      if (role === 'ENTREPRENEUR') router.push('/entrepreneur')
      else if (role === 'MENTOR') router.push('/mentor')
      else if (role === 'BUILDER') router.push('/builder')
      else router.push('/dashboard')

    } catch {
      setError('Impossible de joindre le serveur. Vérifiez votre connexion.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden" style={{ background: '#050810' }}>
      {/* Ambient glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #2563EB, transparent)', filter: 'blur(80px)' }} />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #06B6D4, transparent)', filter: 'blur(80px)' }} />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 no-underline group mb-6">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xl text-white transition-transform group-hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #2563EB, #06B6D4)', boxShadow: '0 0 24px rgba(37,99,235,0.4)' }}
            >
              K
            </div>
            <span className="text-white font-black text-xl tracking-tight">KORAPACT</span>
          </Link>

          <h1 className="text-2xl font-black text-white tracking-tight mb-1">Bon retour 👋</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Connectez-vous à votre espace
          </p>

          {redirect && (
            <div className="mt-3 text-xs px-3 py-2 rounded-xl" style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)', color: '#93C5FD' }}>
              🔒 Connectez-vous pour accéder à cette page
            </div>
          )}
        </div>

        {/* Bouton Google */}
        <a
          href={`${API}/api/auth/google`}
          className="flex items-center justify-center gap-3 w-full py-3 rounded-xl font-semibold text-sm text-white transition-all mb-5 no-underline"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.09)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.05)' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z" />
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z" />
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z" />
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z" />
          </svg>
          Continuer avec Google
        </a>

        {/* Séparateur */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>ou avec votre email</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* Formulaire */}
        <div className="rounded-2xl p-7" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 text-sm rounded-xl px-4 py-3 mb-5"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}
            >
              <span aria-hidden>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div className="mb-4">
              <label htmlFor="email" className="block text-xs font-bold mb-2 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Adresse email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                placeholder="votre@email.com"
                required
                className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(37,99,235,0.6)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            {/* Mot de passe */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Mot de passe
                </label>
                <Link href="/auth/forgot-password" className="text-xs no-underline transition-colors" style={{ color: '#06B6D4' }}>
                  Oublié ?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all pr-12"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(37,99,235,0.6)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-lg transition-colors"
                  style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-base text-white transition-all"
                style={{
                  background: loading ? 'rgba(37,99,235,0.5)' : 'linear-gradient(135deg, #2563EB, #06B6D4)',
                  boxShadow: loading ? 'none' : '0 6px 24px rgba(37,99,235,0.35)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  border: 'none',
                  minHeight: '48px',
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Connexion en cours...
                  </span>
                ) : 'Se connecter →'}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-sm mt-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Pas encore de compte ?{' '}
          <Link href="/auth/register" className="font-semibold no-underline" style={{ color: '#06B6D4' }}>
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
