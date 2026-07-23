'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const ROLE_DASHBOARDS: Record<string, string> = {
  INVESTOR: '/dashboard',
  ENTREPRENEUR: '/entrepreneur',
  MENTOR: '/mentor',
  BUILDER: '/builder',
  SUPPLIER: '/supplier/dashboard',
  ADMIN: '/admin',
}

/**
 * Hook de protection de route.
 * - Si non connecté → redirige vers /admin-access pour les pages admin, /auth/login sinon.
 * - Si connecté avec un rôle non autorisé → redirige vers son dashboard.
 */
export function useRequireRole(allowedRoles: string[]) {
  const router = useRouter()

  useEffect(() => {
    const stored = localStorage.getItem('user')
    const token = localStorage.getItem('accessToken')

    if (!stored || !token) {
      // Choisir la page de connexion selon le contexte
      const loginPath = allowedRoles.includes('ADMIN') ? '/admin-access' : '/auth/login'
      router.replace(loginPath)
      return
    }

    try {
      const user = JSON.parse(stored)

      if (!allowedRoles.includes(user.role)) {
        // Rediriger vers le dashboard du rôle actuel
        const dashboard = ROLE_DASHBOARDS[user.role as string] || '/dashboard'
        router.replace(dashboard)
      }
    } catch {
      localStorage.removeItem('user')
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      router.replace('/auth/login')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}