import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function getDashboardPath(role: string): string {
  switch (role) {
    case 'ENTREPRENEUR': return '/entrepreneur'
    case 'MENTOR': return '/mentor'
    case 'ADMIN': return '/admin'
    case 'INVESTOR': return '/dashboard'
    case 'BUILDER': return '/builder'
    case 'SUPPLIER': return '/supplier/dashboard'
    default: return '/dashboard'
  }
}

/**
 * Hook de redirection par rôle.
 * - Si non connecté → /admin-access si la page requiert ADMIN, sinon /auth/login.
 * - Si connecté avec un rôle non autorisé → dashboard du rôle actuel.
 */
export function useRoleRedirect(allowedRoles: string[]) {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    const userStr = localStorage.getItem('user')

    if (!token || !userStr) {
      const loginPath = allowedRoles.includes('ADMIN') ? '/admin-access' : '/auth/login'
      router.push(loginPath)
      return
    }

    try {
      const user = JSON.parse(userStr)
      if (!allowedRoles.includes(user.role as string)) {
        router.push(getDashboardPath(user.role as string))
      }
    } catch {
      router.push('/auth/login')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}