"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminMilestonesRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    // Stocker l'onglet à ouvrir et rediriger
    sessionStorage.setItem("adminTab", "milestones");
    router.replace("/admin");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-5xl animate-bounce mb-4">🏗️</div>
        <p className="text-gray-500">Redirection vers les jalons...</p>
      </div>
    </div>
  );
}
