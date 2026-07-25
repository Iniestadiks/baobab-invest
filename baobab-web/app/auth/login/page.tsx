"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "https://api.korapact.com";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inp: React.CSSProperties = { width:"100%", background:"#fff", border:"1.5px solid #E5E1D8", borderRadius:12, padding:"12px 14px", color:"#0B1120", fontSize:14, outline:"none", boxSizing:"border-box", transition:"border-color 0.2s" };
  const lbl: React.CSSProperties = { fontSize:11, fontWeight:800, color:"#8891A3", textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:7 };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.message || "Email ou mot de passe incorrect"); return; }
      localStorage.setItem("accessToken", data.data.accessToken);
      localStorage.setItem("refreshToken", data.data.refreshToken);
      localStorage.setItem("user", JSON.stringify(data.data.user));
      const role = data.data.user.role;
      if (role === "ENTREPRENEUR") router.push("/entrepreneur");
      else if (role === "MENTOR") router.push("/mentor");
      else if (role === "BUILDER") router.push("/builder");
      else if (role === "ADMIN") router.push("/admin");
      else router.push("/dashboard");
    } catch { setError("Erreur de connexion au serveur"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{minHeight:"100vh",background:"var(--cream)",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"fixed",top:"10%",left:"5%",width:550,height:550,borderRadius:"50%",background:"radial-gradient(circle,rgba(15,122,61,0.08) 0%,transparent 70%)",filter:"blur(40px)",pointerEvents:"none"}}/>
      <div style={{position:"fixed",bottom:"5%",right:"5%",width:450,height:450,borderRadius:"50%",background:"radial-gradient(circle,rgba(200,134,13,0.07) 0%,transparent 70%)",filter:"blur(40px)",pointerEvents:"none"}}/>
      <div style={{width:"100%",maxWidth:440,position:"relative",zIndex:1}}>

        <div style={{textAlign:"center",marginBottom:32}}>
          <Link href="/" style={{display:"inline-flex",alignItems:"center",gap:10,textDecoration:"none",marginBottom:24}}>
            <img src="/logo.png" alt="KORAPACT" style={{width:38,height:38,objectFit:"contain"}} />
            <span className="logo-text">KORAPACT</span>
          </Link>
          <h1 style={{fontSize:28,fontWeight:900,color:"var(--ink)",margin:"0 0 8px",letterSpacing:"-0.5px"}}>Bon retour !</h1>
          <p style={{color:"var(--ink-soft)",fontSize:15,margin:0}}>Connectez-vous à votre compte KORAPACT</p>
        </div>

        <a href={`${API}/api/auth/google`} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,width:"100%",padding:"14px",borderRadius:14,background:"#fff",border:"1.5px solid #E5E1D8",color:"var(--ink)",textDecoration:"none",fontWeight:700,fontSize:14,marginBottom:20,boxShadow:"0 1px 3px rgba(11,17,32,0.04)"}}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/><path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/></svg>
          Continuer avec Google
        </a>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
          <div style={{flex:1,height:1,background:"#E5E1D8"}}/>
          <span style={{color:"var(--ink-faint)",fontSize:12,fontWeight:600}}>ou avec votre email</span>
          <div style={{flex:1,height:1,background:"#E5E1D8"}}/>
        </div>

        <div style={{background:"#fff",border:"1px solid var(--line)",borderRadius:24,padding:32,boxShadow:"0 4px 12px rgba(11,17,32,0.04), 0 20px 48px rgba(11,17,32,0.05)"}}>
          <form onSubmit={handleLogin}>
            {error && <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:12,padding:"12px 16px",fontSize:13,color:"#B91C1C",marginBottom:20,fontWeight:500}}>⚠️ {error}</div>}

            <div style={{marginBottom:14}}>
              <label style={lbl}>Email</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="votre@email.com" required style={inp}
                onFocus={e=>e.target.style.borderColor="#16A34A"} onBlur={e=>e.target.style.borderColor="#E5E1D8"}/>
            </div>

            <div style={{marginBottom:10}}>
              <label style={lbl}>Mot de passe</label>
              <div style={{position:"relative"}}>
                <input value={password} onChange={e=>setPassword(e.target.value)} type={showPass?"text":"password"} placeholder="••••••••" required
                  style={{...inp,paddingRight:44}} onFocus={e=>e.target.style.borderColor="#16A34A"} onBlur={e=>e.target.style.borderColor="#E5E1D8"}/>
                <button type="button" onClick={()=>setShowPass(!showPass)}
                  style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--ink-faint)",cursor:"pointer",fontSize:16}}>
                  {showPass?"🙈":"👁️"}
                </button>
              </div>
            </div>

            <div style={{textAlign:"right",marginBottom:24}}>
              <Link href="/auth/forgot-password" style={{fontSize:12.5,color:"#0F7A3D",fontWeight:600}}>Mot de passe oublié ?</Link>
            </div>

            <button type="submit" disabled={loading} style={{
              width:"100%",padding:"14px",borderRadius:14,fontWeight:700,fontSize:15,color:"#fff",
              cursor:loading?"not-allowed":"pointer",border:"none",
              background:"linear-gradient(135deg,#0F7A3D,#16A34A)",boxShadow:"0 8px 24px rgba(15,122,61,0.28)",
              opacity:loading?0.7:1,
            }}>
              {loading ? "Connexion..." : "Se connecter →"}
            </button>
          </form>
        </div>

        <p style={{textAlign:"center",color:"var(--ink-faint)",fontSize:13,marginTop:24}}>
          Pas encore de compte ?{" "}<Link href="/auth/register" style={{color:"#0F7A3D",fontWeight:700}}>Créer un compte</Link>
        </p>
      </div>
    </div>
  );
}
