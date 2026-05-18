import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function getDashboardPath(role: string): string {
  switch(role) {
    case 'ENTREPRENEUR': return '/entrepreneur'
    case 'MENTOR':       return '/mentor'
    case 'ADMIN':        return '/admin'
    case 'INVESTOR':     return '/dashboard'
    default:             return '/dashboard'
  }
}

export function useRoleRedirect(allowedRoles: string[]) {
  const router = useRouter()
  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    const userStr = localStorage.getItem('user')
    if (!token || !userStr) { router.push('/auth/login'); return }
    const user = JSON.parse(userStr)
    if (!allowedRoles.includes(user.role)) {
      router.push(getDashboardPath(user.role))
    }
  }, [])
}
