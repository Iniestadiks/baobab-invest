"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GeoSelector } from "@/hooks/useGeo";

const API = process.env.NEXT_PUBLIC_API_URL || "https://api.korapact.com";

const ROLES = [
  { value: "INVESTOR",     icon: "💼", label: "Investisseur",  desc: "Investissez dans des projets vérifiés et percevez des retours mensuels." },
  { value: "ENTREPRENEUR", icon: "🚀", label: "Entrepreneur",  desc: "Obtenez un financement communautaire pour votre projet." },
  { value: "MENTOR",       icon: "🎓", label: "Mentor",        desc: "Parrainez des projets et percevez une commission." },
  { value: "BUILDER",      icon: "🏗️", label: "Bâtisseur",    desc: "Mécènes et entreprises — soutenez à grande échelle." },
];

function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score, label: "Très faible", color: "#ef4444" };
  if (score === 2) return { score, label: "Faible",      color: "#f97316" };
  if (score === 3) return { score, label: "Moyen",       color: "#eab308" };
  if (score === 4) return { score, label: "Fort",        color: "#22c55e" };
  return { score, label: "Très fort", color: "#06B6D4" };
}

type Step = "role" | "info" | "verify";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("role");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [geo, setGeo] = useState({ country: "Senegal", countryCode: "SN", indicatif: "+221", state: "", stateCode: "", city: "" });
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "",
    phone: "", password: "", confirmPassword: "",
    role: "INVESTOR", country: "SN", countryCode: "SN", region: "", stateCode: "", city: "", indicatif: "+221",
  });

  const set = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setError(""); };
  const strength = getPasswordStrength(form.password);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { setError("Les mots de passe ne correspondent pas"); return; }
    if (form.password.length < 8) { setError("Mot de passe : 8 caractères minimum"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          phone: geo.indicatif && form.phone && !form.phone.startsWith("+")
            ? `${geo.indicatif}${form.phone.replace(/^0/, "")}`
            : form.phone,
        }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.message || "Erreur lors de l'inscription"); return; }
      localStorage.setItem("accessToken", data.data.accessToken);
      localStorage.setItem("refreshToken", data.data.refreshToken);
      localStorage.setItem("user", JSON.stringify(data.data.user));
      if (data.data.requiresVerification) { setUserEmail(form.email); setStep("verify"); }
      else {
        const role = form.role;
        if (role === "ENTREPRENEUR") router.push("/entrepreneur");
        else if (role === "MENTOR") router.push("/mentor");
        else if (role === "BUILDER") router.push("/builder");
        else router.push("/dashboard");
      }
    } catch { setError("Erreur de connexion au serveur"); }
    finally { setLoading(false); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyCode.length !== 6) { setError("Le code doit contenir 6 chiffres"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/api/auth/verify-email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, code: verifyCode }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.message); return; }
      const role = form.role;
      if (role === "ENTREPRENEUR") router.push("/entrepreneur");
      else if (role === "MENTOR") router.push("/mentor");
      else if (role === "BUILDER") router.push("/builder");
      else router.push("/dashboard");
    } catch { setError("Erreur de connexion"); }
    finally { setLoading(false); }
  };

  const resendCode = async () => {
    setResendLoading(true); setResendMsg("");
    try {
      await fetch(`${API}/api/auth/resend-verify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });
      setResendMsg("Nouveau code envoyé !");
    } catch { setResendMsg("Erreur — réessayez"); }
    finally { setResendLoading(false); }
  };

  const inp: React.CSSProperties = { width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:"11px 14px", color:"#fff", fontSize:14, outline:"none", boxSizing:"border-box" };
  const lbl: React.CSSProperties = { fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:6 };
  const selectedRole = ROLES.find(r => r.value === form.role)!;

  return (
    <div style={{minHeight:"100vh",background:"#050810",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"fixed",top:"10%",left:"5%",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(37,99,235,0.1) 0%,transparent 70%)",filter:"blur(80px)",pointerEvents:"none"}}/>
      <div style={{position:"fixed",bottom:"5%",right:"5%",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(6,182,212,0.08) 0%,transparent 70%)",filter:"blur(80px)",pointerEvents:"none"}}/>
      <div style={{width:"100%",maxWidth:540,position:"relative",zIndex:1}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <Link href="/" style={{display:"inline-flex",alignItems:"center",gap:10,textDecoration:"none",marginBottom:24}}>
            <div style={{width:44,height:44,borderRadius:13,background:"linear-gradient(135deg,#2563EB,#06B6D4)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:20,color:"#fff",boxShadow:"0 0 24px rgba(37,99,235,0.4)"}}>K</div>
            <span style={{fontWeight:900,fontSize:20,color:"#fff",letterSpacing:"-0.5px"}}>KORAPACT</span>
          </Link>
          {step !== "verify" && <>
            <h1 style={{fontSize:28,fontWeight:900,color:"#fff",margin:"0 0 8px",letterSpacing:"-0.5px"}}>Créer votre compte</h1>
            <p style={{color:"rgba(255,255,255,0.45)",fontSize:15,margin:0}}>Rejoignez la plateforme d&apos;investissement communautaire</p>
          </>}
        </div>

        {step !== "verify" && <>
          <a href={`${API}/api/auth/google`} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,width:"100%",padding:"14px",borderRadius:14,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",color:"#fff",textDecoration:"none",fontWeight:600,fontSize:14,marginBottom:20}}>
            <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/><path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/></svg>
            Continuer avec Google
          </a>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
            <div style={{flex:1,height:1,background:"rgba(255,255,255,0.08)"}}/>
            <span style={{color:"rgba(255,255,255,0.3)",fontSize:12,fontWeight:500}}>ou avec votre email</span>
            <div style={{flex:1,height:1,background:"rgba(255,255,255,0.08)"}}/>
          </div>
        </>}

        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:24,padding:32}}>

          {/* STEP 1 */}
          {step === "role" && <>
            <div style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.4)",letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>Je suis un...</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:24}}>
              {ROLES.map(r => (
                <button key={r.value} type="button" onClick={() => set("role", r.value)} style={{padding:"16px 14px",borderRadius:16,textAlign:"left",cursor:"pointer",background:form.role===r.value?"rgba(37,99,235,0.15)":"rgba(255,255,255,0.03)",border:form.role===r.value?"1.5px solid rgba(37,99,235,0.5)":"1px solid rgba(255,255,255,0.08)",transition:"all 0.2s"}}>
                  <div style={{fontSize:24,marginBottom:8}}>{r.icon}</div>
                  <div style={{fontWeight:700,fontSize:13,color:"#fff",marginBottom:4}}>{r.label}</div>
                  <div style={{fontSize:11.5,color:"rgba(255,255,255,0.4)",lineHeight:1.5}}>{r.desc}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setStep("info")} style={{width:"100%",padding:"14px",borderRadius:14,fontWeight:700,fontSize:15,color:"#fff",cursor:"pointer",border:"none",background:"linear-gradient(135deg,#2563EB,#06B6D4)",boxShadow:"0 8px 24px rgba(37,99,235,0.35)"}}>
              Continuer — {selectedRole.icon} {selectedRole.label}
            </button>
          </>}

          {/* STEP 2 */}
          {step === "info" && (
            <form onSubmit={handleRegister}>
              <button type="button" onClick={() => setStep("role")} style={{background:"none",border:"none",color:"rgba(255,255,255,0.45)",fontSize:13,cursor:"pointer",marginBottom:20,padding:0,display:"flex",alignItems:"center",gap:6}}>← Changer de rôle</button>
              <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(37,99,235,0.1)",border:"1px solid rgba(37,99,235,0.25)",borderRadius:100,padding:"5px 14px",fontSize:12,fontWeight:700,color:"#93C5FD",marginBottom:24}}>
                {selectedRole.icon} {selectedRole.label}
              </div>
              {error && <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:12,padding:"12px 16px",fontSize:13,color:"#FCA5A5",marginBottom:20}}>⚠️ {error}</div>}

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                {[{k:"firstName",ph:"Prénom",label:"Prénom *"},{k:"lastName",ph:"Nom",label:"Nom *"}].map(f=>(
                  <div key={f.k}>
                    <label style={lbl}>{f.label}</label>
                    <input value={form[f.k as keyof typeof form]} onChange={e=>set(f.k,e.target.value)} placeholder={f.ph} required style={inp}/>
                  </div>
                ))}
              </div>

              <div style={{marginBottom:14}}>
                <label style={lbl}>Email *</label>
                <input value={form.email} onChange={e=>set("email",e.target.value)} type="email" placeholder="votre@email.com" required style={inp}/>
              </div>

              {/* GeoSelector dark */}
              <div style={{marginBottom:14,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:16}}>
                <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:2,textTransform:"uppercase",marginBottom:14}}>📍 Localisation</div>
                <style>{`.geo-dark select,.geo-dark input{background:rgba(255,255,255,0.06)!important;border:1px solid rgba(255,255,255,0.12)!important;color:#fff!important;border-radius:12px!important}.geo-dark select option{background:#0C1024;color:#fff}.geo-dark label{color:rgba(255,255,255,0.5)!important}`}</style>
                <div className="geo-dark">
                  <GeoSelector value={geo} onChange={v => {
                    setGeo(v);
                    setForm(f => ({...f, country: v.countryCode, countryCode: v.countryCode, region: v.state, stateCode: v.stateCode, city: v.city, indicatif: v.indicatif}));
                  }}/>
                </div>
              </div>

              {/* Téléphone */}
              <div style={{marginBottom:14}}>
                <label style={lbl}>Téléphone *</label>
                <div style={{display:"flex",gap:8}}>
                  <div style={{...inp,width:"auto",minWidth:72,padding:"11px 12px",color:"rgba(255,255,255,0.7)",fontSize:13,flexShrink:0}}>{geo.indicatif||"+221"}</div>
                  <input value={form.phone} onChange={e=>set("phone",e.target.value)} type="tel" placeholder="77 000 00 00" required style={{...inp,flex:1}}/>
                </div>
              </div>

              {/* Mot de passe */}
              <div style={{marginBottom:14}}>
                <label style={lbl}>Mot de passe * (min. 8 car.)</label>
                <div style={{position:"relative"}}>
                  <input value={form.password} onChange={e=>set("password",e.target.value)} type={showPass?"text":"password"} placeholder="••••••••" required style={{...inp,paddingRight:44}}/>
                  <button type="button" onClick={()=>setShowPass(!showPass)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:16}}>{showPass?"🙈":"👁️"}</button>
                </div>
                {form.password.length > 0 && (
                  <div style={{marginTop:8}}>
                    <div style={{display:"flex",gap:4,marginBottom:5}}>
                      {[1,2,3,4,5].map(i=>(
                        <div key={i} style={{flex:1,height:4,borderRadius:4,background:i<=strength.score?strength.color:"rgba(255,255,255,0.1)",transition:"background 0.3s"}}/>
                      ))}
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <span style={{fontSize:11,color:strength.color,fontWeight:600}}>{strength.label}</span>
                      <span style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{strength.score<3?"Ajoutez maj., chiffres, symboles":"Bon mot de passe 👍"}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirmer */}
              <div style={{marginBottom:20}}>
                <label style={lbl}>Confirmer *</label>
                <div style={{position:"relative"}}>
                  <input value={form.confirmPassword} onChange={e=>set("confirmPassword",e.target.value)} type={showConfirm?"text":"password"} placeholder="••••••••" required
                    style={{...inp,paddingRight:44,borderColor:form.confirmPassword&&form.confirmPassword!==form.password?"rgba(239,68,68,0.5)":form.confirmPassword&&form.confirmPassword===form.password?"rgba(34,197,94,0.5)":"rgba(255,255,255,0.1)"}}/>
                  <button type="button" onClick={()=>setShowConfirm(!showConfirm)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:16}}>{showConfirm?"🙈":"👁️"}</button>
                </div>
                {form.confirmPassword && form.confirmPassword===form.password && <div style={{fontSize:11,color:"#22c55e",marginTop:4}}>✅ Les mots de passe correspondent</div>}
                {form.confirmPassword && form.confirmPassword!==form.password && <div style={{fontSize:11,color:"#ef4444",marginTop:4}}>❌ Ne correspondent pas</div>}
              </div>

              <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:24}}>
                <input type="checkbox" required id="cgu" style={{marginTop:3,accentColor:"#2563EB"}}/>
                <label htmlFor="cgu" style={{fontSize:12.5,color:"rgba(255,255,255,0.4)",lineHeight:1.6}}>
                  J&apos;accepte les <Link href="/cgu" style={{color:"#06B6D4"}}>CGU</Link> et la <Link href="/privacy" style={{color:"#06B6D4"}}>Politique de Confidentialité</Link>
                </label>
              </div>
              <button type="submit" disabled={loading} style={{width:"100%",padding:"14px",borderRadius:14,fontWeight:700,fontSize:15,color:"#fff",cursor:loading?"not-allowed":"pointer",border:"none",background:"linear-gradient(135deg,#2563EB,#06B6D4)",boxShadow:"0 8px 24px rgba(37,99,235,0.35)",opacity:loading?0.7:1,transition:"all 0.2s"}}>
                {loading?"Création du compte...":`Créer mon compte ${selectedRole.icon}`}
              </button>
            </form>
          )}

          {/* STEP 3 */}
          {step === "verify" && (
            <form onSubmit={handleVerify} style={{textAlign:"center"}}>
              <div style={{fontSize:48,marginBottom:16}}>📬</div>
              <h2 style={{fontWeight:900,fontSize:22,color:"#fff",margin:"0 0 8px"}}>Vérifiez votre email</h2>
              <p style={{color:"rgba(255,255,255,0.45)",fontSize:14,lineHeight:1.7,marginBottom:32}}>Code à 6 chiffres envoyé à<br/><strong style={{color:"#06B6D4"}}>{userEmail}</strong></p>
              {error && <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:12,padding:"12px 16px",fontSize:13,color:"#FCA5A5",marginBottom:20}}>⚠️ {error}</div>}
              <input value={verifyCode} onChange={e=>{setVerifyCode(e.target.value.replace(/\D/g,"").slice(0,6));setError("");}} placeholder="000000" maxLength={6}
                style={{width:"100%",textAlign:"center",letterSpacing:12,fontSize:32,fontWeight:900,background:"rgba(37,99,235,0.08)",border:"2px solid rgba(37,99,235,0.3)",borderRadius:16,padding:"20px",color:"#fff",outline:"none",boxSizing:"border-box",fontFamily:"monospace",marginBottom:24}}/>
              <button type="submit" disabled={loading||verifyCode.length!==6} style={{width:"100%",padding:"14px",borderRadius:14,fontWeight:700,fontSize:15,color:"#fff",cursor:"pointer",border:"none",background:"linear-gradient(135deg,#2563EB,#06B6D4)",opacity:(loading||verifyCode.length!==6)?0.5:1,marginBottom:16}}>
                {loading?"Vérification...":"Confirmer mon compte ✅"}
              </button>
              <button type="button" onClick={resendCode} disabled={resendLoading} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",fontSize:13,cursor:"pointer",textDecoration:"underline"}}>
                {resendLoading?"Envoi...":"Renvoyer le code"}
              </button>
              {resendMsg && <div style={{color:"#06B6D4",fontSize:13,marginTop:8}}>{resendMsg}</div>}
            </form>
          )}
        </div>
        <p style={{textAlign:"center",color:"rgba(255,255,255,0.35)",fontSize:13,marginTop:24}}>
          Déjà un compte ?{" "}<Link href="/auth/login" style={{color:"#06B6D4",fontWeight:600}}>Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
