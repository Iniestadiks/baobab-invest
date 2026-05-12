const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://46.202.132.161:3001'

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token = localStorage.getItem('accessToken')

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

  // Ignorer le rate limit — ne pas déconnecter
  if (res.status === 429) {
    console.warn('Rate limit atteint — on attend 2s');
    await new Promise(r => setTimeout(r, 2000));
    return res;
  }

  // Token expiré (401) → on rafraîchit automatiquement
  if (res.status === 401) {
    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) {
      localStorage.clear()
      window.location.href = '/auth/login'
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
        localStorage.clear()
        window.location.href = '/auth/login'
        return res
      }

      // Nouveau token sauvegardé
      localStorage.setItem('accessToken', refreshData.data.accessToken)
      localStorage.setItem('refreshToken', refreshData.data.refreshToken)

      // On relance la requête originale avec le nouveau token
      res = await makeRequest(refreshData.data.accessToken)
    } catch {
      localStorage.clear()
      window.location.href = '/auth/login'
    }
  }

  return res
}

export async function authGet(url: string) {
  try {
    const res = await authFetch(url)
    const text = await res.text()
    try { return JSON.parse(text) }
    catch { return { success: false, message: "Erreur serveur" } }
  } catch (e: any) {
    return { success: false, message: e.message || "Erreur de connexion" }
  }
}

export async function authPost(url: string, body: any) {
  try {
    const res = await authFetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const text = await res.text()
    try { return JSON.parse(text) }
    catch { return { success: false, message: text || "Erreur serveur" } }
  } catch (e: any) {
    return { success: false, message: e.message || "Erreur de connexion" }
  }
}

export async function authPatch(url: string, body: any) {
  try {
    const res = await authFetch(url, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    const text = await res.text()
    try { return JSON.parse(text) }
    catch { return { success: false, message: "Erreur serveur" } }
  } catch (e: any) {
    return { success: false, message: e.message || "Erreur de connexion" }
  }
}

export async function authDelete(url: string) {
  const res = await authFetch(url, { method: 'DELETE' })
  return res.json()
}

export function redirectByRole(router: any) {
  const stored = localStorage.getItem("user")
  if (!stored) { router.push("/auth/login"); return; }
  const user = JSON.parse(stored)
  if (user.role === "ENTREPRENEUR") router.push("/entrepreneur")
  else if (user.role === "ADMIN") router.push("/admin")
  else if (user.role === "MENTOR") router.push("/mentor")
  else router.push("/dashboard")
}
