'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.korapact.com'

type Step = 'email' | 'code' | 'done'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Entrez votre email'); return }
    setLoading(true); setError('')
    try {
      await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      setStep('code')
    } catch { setError('Erreur de connexion') }
    finally { setLoading(false) }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) { setError('Le code doit contenir 6 chiffres'); return }
    if (newPassword.length < 8) { setError('Minimum 8 caractères'); return }
    if (newPassword !== confirmPassword) { setError('Les mots de passe ne correspondent pas'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim(), newPassword }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.message); return }
      setStep('done')
    } catch { setError('Erreur de connexion') }
    finally { setLoading(false) }
  }

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
    padding: '11px 14px', color: '#fff', fontSize: '14px',
    outline: 'none', boxSizing: 'border-box' as const,
  }

  const labelStyle = {
    fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase' as const, letterSpacing: '1px',
    display: 'block', marginBottom: '6px',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050810', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'fixed', top: '10%', left: '5%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(37,99,235,0.08) 0%,transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginBottom: '24px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '13px', background: 'linear-gradient(135deg,#2563EB,#06B6D4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '20px', color: '#fff', boxShadow: '0 0 24px rgba(37,99,235,0.4)' }}>K</div>
            <span style={{ fontWeight: 900, fontSize: '20px', color: '#fff', letterSpacing: '-0.5px' }}>KORAPACT</span>
          </Link>
          <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
            {step === 'email' && 'Mot de passe oublié ?'}
            {step === 'code' && 'Vérifiez votre email'}
            {step === 'done' && 'Mot de passe réinitialisé ✅'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px', margin: 0 }}>
            {step === 'email' && 'Entrez votre email pour recevoir un code'}
            {step === 'code' && `Code envoyé à ${email}`}
            {step === 'done' && 'Vous pouvez maintenant vous connecter'}
          </p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '32px' }}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', color: '#FCA5A5', marginBottom: '20px' }}>
              ⚠️ {error}
            </div>
          )}

          {step === 'email' && (
            <form onSubmit={handleEmail}>
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Adresse email</label>
                <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError('') }}
                  placeholder="votre@email.com" required style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(37,99,235,0.6)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }} />
              </div>
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '14px', borderRadius: '14px', fontWeight: 700, fontSize: '15px',
                color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg,#2563EB,#06B6D4)',
                boxShadow: '0 8px 24px rgba(37,99,235,0.35)', opacity: loading ? 0.7 : 1,
              }}>
                {loading ? 'Envoi en cours...' : 'Envoyer le code →'}
              </button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={handleReset}>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Code reçu par email (6 chiffres)</label>
                <input type="text" value={code}
                  onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
                  placeholder="000000" maxLength={6}
                  style={{ ...inputStyle, textAlign: 'center', letterSpacing: '12px', fontSize: '28px', fontWeight: 900, fontFamily: 'monospace' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(37,99,235,0.6)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Nouveau mot de passe</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setError('') }}
                    placeholder="Min. 8 caractères" required
                    style={{ ...inputStyle, paddingRight: '44px' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(37,99,235,0.6)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }} />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '16px' }}>
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Confirmer le mot de passe</label>
                <input type="password" value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                  placeholder="••••••••" required style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(37,99,235,0.6)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }} />
              </div>
              <button type="submit" disabled={loading || code.length !== 6} style={{
                width: '100%', padding: '14px', borderRadius: '14px', fontWeight: 700, fontSize: '15px',
                color: '#fff', border: 'none', cursor: (loading || code.length !== 6) ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg,#2563EB,#06B6D4)',
                opacity: (loading || code.length !== 6) ? 0.5 : 1,
              }}>
                {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe →'}
              </button>
              <button type="button" onClick={() => { setStep('email'); setCode(''); setError('') }}
                style={{ width: '100%', marginTop: '12px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>
                Renvoyer le code
              </button>
            </form>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '15px', marginBottom: '24px' }}>
                Votre mot de passe a été réinitialisé avec succès.
              </p>
              <button onClick={() => router.push('/auth/login')} style={{
                width: '100%', padding: '14px', borderRadius: '14px', fontWeight: 700,
                fontSize: '15px', color: '#fff', border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#2563EB,#06B6D4)',
              }}>
                Se connecter →
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '13px', marginTop: '24px' }}>
          <Link href="/auth/login" style={{ color: '#06B6D4', fontWeight: 600, textDecoration: 'none' }}>← Retour à la connexion</Link>
        </p>
      </div>
    </div>
  )
}
