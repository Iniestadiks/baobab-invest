"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");
    const error = params.get("error");

    if (error || !accessToken) {
      router.push("/auth/login?error=google_failed");
      return;
    }

    localStorage.setItem("accessToken", accessToken);
    if (refreshToken) localStorage.setItem("refreshToken", refreshToken);

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    }).then(r => r.json()).then(d => {
      if (d.success) {
        localStorage.setItem("user", JSON.stringify(d.data));
        const role = d.data.role;
        if (role === "ENTREPRENEUR") router.push("/entrepreneur");
        else if (role === "MENTOR") router.push("/mentor");
        else if (role === "BUILDER") router.push("/builder");
        else router.push("/dashboard");
      } else {
        router.push("/auth/login");
      }
    }).catch(() => router.push("/auth/login"));
  }, []);

  return (
    <div style={{minHeight:"100vh",background:"#050810",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:52,height:52,borderRadius:14,background:"linear-gradient(135deg,#2563EB,#06B6D4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:900,color:"#fff",margin:"0 auto 24px"}}>K</div>
        <div style={{width:32,height:32,border:"3px solid rgba(37,99,235,0.3)",borderTop:"3px solid #2563EB",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 16px"}}/>
        <p style={{color:"rgba(255,255,255,0.5)",fontSize:15}}>Connexion en cours...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
