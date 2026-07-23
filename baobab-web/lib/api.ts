const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.korapact.com'

/** Renvoie le chemin de connexion selon le rôle stocké localement. */
function getLoginPath(): string {
  if (typeof window === 'undefined') return '/auth/login'
  try {
    const stored = localStorage.getItem('user')
    if (stored) {
      const user = JSON.parse(stored)
      if (user?.role === 'ADMIN') return '/admin-access'
    }
  } catch {
    // localStorage corrompu — on nettoie
    localStorage.clear()
  }
  return '/auth/login'
}

function clearSessionAndRedirect(path: string): void {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
  window.location.href = path
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('accessToken')

  const makeRequest = (t: string) =>
    fetch(`${API_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${t}`,
        ...options.headers,
      },
    })

  let res = await makeRequest(token || '')

  // Rate limit — ne pas déconnecter, juste attendre
  if (res.status === 429) {
    console.warn('[API] Rate limit — attente 2s')
    await new Promise(r => setTimeout(r, 2000))
    return res
  }

  // Token expiré → tentative de refresh
  if (res.status === 401) {
    const refreshToken = localStorage.getItem('refreshToken')
    const loginPath = getLoginPath()

    if (!refreshToken) {
      clearSessionAndRedirect(loginPath)
      return res
    }

    try {
      const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })

      const refreshData = await refreshRes.json()

      if (!refreshData.success) {
        clearSessionAndRedirect(loginPath)
        return res
      }

      localStorage.setItem('accessToken', refreshData.data.accessToken)
      localStorage.setItem('refreshToken', refreshData.data.refreshToken)

      res = await makeRequest(refreshData.data.accessToken)
    } catch {
      clearSessionAndRedirect(loginPath)
    }
  }

  return res
}

export async function authGet(url: string): Promise<Record<string, unknown>> {
  try {
    const res = await authFetch(url)
    const text = await res.text()
    try { return JSON.parse(text) } catch { return { success: false, message: 'Erreur serveur' } }
  } catch (e) {
    const err = e as Error
    return { success: false, message: err.message || 'Erreur de connexion' }
  }
}

export async function authPost(url: string, body: unknown): Promise<Record<string, unknown>> {
  try {
    const res = await authFetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const text = await res.text()
    try { return JSON.parse(text) } catch { return { success: false, message: text || 'Erreur serveur' } }
  } catch (e) {
    const err = e as Error
    return { success: false, message: err.message || 'Erreur de connexion' }
  }
}

export async function authPatch(url: string, body: unknown): Promise<Record<string, unknown>> {
  try {
    const res = await authFetch(url, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    const text = await res.text()
    try { return JSON.parse(text) } catch { return { success: false, message: 'Erreur serveur' } }
  } catch (e) {
    const err = e as Error
    return { success: false, message: err.message || 'Erreur de connexion' }
  }
}

export async function authDelete(url: string): Promise<Record<string, unknown>> {
  try {
    const res = await authFetch(url, { method: 'DELETE' })
    return res.json()
  } catch (e) {
    const err = e as Error
    return { success: false, message: err.message || 'Erreur de connexion' }
  }
}

/** Redirige selon le rôle utilisateur stocké en local. */
export function redirectByRole(router: { push: (path: string) => void }): void {
  const stored = localStorage.getItem('user')
  if (!stored) { router.push('/auth/login'); return }

  try {
    const user = JSON.parse(stored)
    switch (user.role) {
      case 'ENTREPRENEUR': router.push('/entrepreneur'); break
      case 'ADMIN': router.push('/admin'); break
      case 'MENTOR': router.push('/mentor'); break
      case 'BUILDER': router.push('/builder'); break
      default: router.push('/dashboard')
    }
  } catch {
    router.push('/auth/login')
  }
}