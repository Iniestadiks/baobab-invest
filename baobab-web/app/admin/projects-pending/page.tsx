"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function Redirect() {
  const router = useRouter();
  useEffect(() => { sessionStorage.setItem("adminTab", "projects"); router.replace("/admin"); }, [router]);
  return <div className="min-h-screen flex items-center justify-center"><div className="text-5xl animate-bounce">📋</div></div>;
}
