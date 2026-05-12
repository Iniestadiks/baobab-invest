"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ROLE_DASHBOARDS: Record<string, string> = {
  INVESTOR: "/dashboard",
  ENTREPRENEUR: "/entrepreneur",
  MENTOR: "/mentor",
  SUPPLIER: "/supplier/dashboard",
  ADMIN: "/admin",
};

export function useRequireRole(allowedRoles: string[]) {
  const router = useRouter();
  useEffect(() => {
    const stored = localStorage.getItem("user");
    const token = localStorage.getItem("accessToken");
    if (!stored || !token) { router.replace("/auth/login"); return; }
    try {
      const user = JSON.parse(stored);
      if (!allowedRoles.includes(user.role)) {
        router.replace(ROLE_DASHBOARDS[user.role] || "/auth/login");
      }
    } catch { router.replace("/auth/login"); }
  }, []);
}
