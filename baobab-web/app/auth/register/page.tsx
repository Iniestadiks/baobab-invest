"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GeoSelector } from "@/hooks/useGeo";

const API = process.env.NEXT_PUBLIC_API_URL || "https://api.korapact.com";

const ROLES = [
  { value: "INVESTOR",     icon: "💼", label: "Investisseur",  desc: "Investissez dans des projets vérifiés et percevez des retours mensuels.", color: "#0F7A3D" },
  { value: "ENTREPRENEUR", icon: "🚀", label: "Entrepreneur",  desc: "Obtenez un financement communautaire pour votre projet.", color: "#16A34A" },
  { value: "MENTOR",       icon: "🎓", label: "Mentor",        desc: "Parrainez des projets et percevez une commission.", color: "#7C3AED" },
  { value: "BUILDER",      icon: "🏗️", label: "Bâtisseur",    desc: "Mécènes et entreprises — soutenez à grande échelle.", color: "#C8860D" },
];

function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score, label: "Très faible", color: "#DC2626" };
  if (score === 2) return { score, label: "Faible",      color: "#EA580C" };
  if (score === 3) return { score, label: "Moyen",       color: "#CA8A04" };
  if (score === 4) return { score, label: "Fort",        color: "#16A34A" };
  return { score, label: "Très fort", color: "#0F7A3D" };
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

  const inp: React.CSSProperties = { width:"100%", background:"#fff", border:"1.5px solid #E5E1D8", borderRadius:12, padding:"12px 14px", color:"#0B1120", fontSize:14, outline:"none", boxSizing:"border-box", transition:"border-color 0.2s" };
  const lbl: React.CSSProperties = { fontSize:11, fontWeight:800, color:"#8891A3", textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:7 };
  const selectedRole = ROLES.find(r => r.value === form.role)!;

  return (
    <div style={{minHeight:"100vh",background:"var(--cream)",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"fixed",top:"5%",left:"0%",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(15,122,61,0.08) 0%,transparent 70%)",filter:"blur(40px)",pointerEvents:"none"}}/>
      <div style={{position:"fixed",bottom:"0%",right:"0%",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(200,134,13,0.07) 0%,transparent 70%)",filter:"blur(40px)",pointerEvents:"none"}}/>
      <div style={{width:"100%",maxWidth:560,position:"relative",zIndex:1}}>

        <div style={{textAlign:"center",marginBottom:32}}>
          <Link href="/" style={{display:"inline-flex",alignItems:"center",gap:10,textDecoration:"none",marginBottom:24}}>
            <img src="/logo.png" alt="KORAPACT" style={{width:38,height:38,objectFit:"contain"}} />
            <span className="logo-text">KORAPACT</span>
          </Link>
          {step !== "verify" && <>
            <h1 style={{fontSize:28,fontWeight:900,color:"var(--ink)",margin:"0 0 8px",letterSpacing:"-0.5px"}}>Créer votre compte</h1>
            <p style={{color:"var(--ink-soft)",fontSize:15,margin:0}}>Rejoignez la plateforme d&apos;investissement communautaire</p>
          </>}
        </div>

        {/* Stepper */}
        {step !== "verify" && (
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:28}}>
            {[{id:"role",label:"Profil"},{id:"info",label:"Informations"}].map((s,i) => {
              const isActive = step === s.id;
              const isDone = s.id === "role" && step === "info";
              return (
                <div key={s.id} style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:26,height:26,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color: isActive||isDone ? "#fff" : "#8891A3",background: isDone ? "#16A34A" : isActive ? "linear-gradient(135deg,#0F7A3D,#16A34A)" : "#EFEDE6"}}>{isDone ? "✓" : i+1}</div>
                    <span style={{fontSize:12.5,fontWeight:isActive?700:500,color:isActive?"var(--ink)":"var(--ink-faint)"}}>{s.label}</span>
                  </div>
                  {i === 0 && <div style={{width:32,height:2,borderRadius:2,background: isDone ? "#16A34A" : "#EFEDE6"}}/>}
                </div>
              );
            })}
          </div>
        )}

        {step !== "verify" && <>
          <a href={`${API}/api/auth/google`} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,width:"100%",padding:"14px",borderRadius:14,background:"#fff",border:"1.5px solid #E5E1D8",color:"var(--ink)",textDecoration:"none",fontWeight:700,fontSize:14,marginBottom:20,boxShadow:"0 1px 3px rgba(11,17,32,0.04)"}}>
            <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/><path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/></svg>
            Continuer avec Google
          </a>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
            <div style={{flex:1,height:1,background:"#E5E1D8"}}/>
            <span style={{color:"var(--ink-faint)",fontSize:12,fontWeight:600}}>ou avec votre email</span>
            <div style={{flex:1,height:1,background:"#E5E1D8"}}/>
          </div>
        </>}

        <div style={{background:"#fff",border:"1px solid var(--line)",borderRadius:24,padding:32,boxShadow:"0 4px 12px rgba(11,17,32,0.04), 0 20px 48px rgba(11,17,32,0.05)"}}>

          {step === "role" && <>
            <div style={{fontSize:11,fontWeight:800,color:"var(--ink-faint)",letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>Je suis un...</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:24}}>
              {ROLES.map(r => (
                <button key={r.value} type="button" onClick={() => set("role", r.value)} style={{
                  padding:"16px 14px",borderRadius:16,textAlign:"left",cursor:"pointer",
                  background:form.role===r.value?`${r.color}0D`:"#FAFAF7",
                  border:form.role===r.value?`1.5px solid ${r.color}50`:"1px solid var(--line)",
                  transition:"all 0.2s",
                }}>
                  <div style={{fontSize:24,marginBottom:8}}>{r.icon}</div>
                  <div style={{fontWeight:800,fontSize:13,color:"var(--ink)",marginBottom:4}}>{r.label}</div>
                  <div style={{fontSize:11.5,color:"var(--ink-soft)",lineHeight:1.5}}>{r.desc}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setStep("info")} style={{width:"100%",padding:"14px",borderRadius:14,fontWeight:700,fontSize:15,color:"#fff",cursor:"pointer",border:"none",background:"linear-gradient(135deg,#0F7A3D,#16A34A)",boxShadow:"0 8px 24px rgba(15,122,61,0.28)"}}>
              Continuer — {selectedRole.icon} {selectedRole.label}
            </button>
            <div style={{textAlign:"center",marginTop:16}}>
              <a href={`/devenir/${({INVESTOR:"investisseur",ENTREPRENEUR:"entrepreneur",MENTOR:"mentor",BUILDER:"batisseur"} as any)[form.role]}`}
                target="_blank" rel="noopener noreferrer"
                style={{fontSize:12.5,color:"var(--ink-faint)",fontWeight:600,textDecoration:"underline"}}>
                Comment ça marche pour {selectedRole.label} ? →
              </a>
            </div>
          </>}

          {step === "info" && (
            <form onSubmit={handleRegister}>
              <button type="button" onClick={() => setStep("role")} style={{background:"none",border:"none",color:"var(--ink-faint)",fontSize:13,cursor:"pointer",marginBottom:20,padding:0,display:"flex",alignItems:"center",gap:6,fontWeight:600}}>← Changer de rôle</button>
              <div style={{display:"inline-flex",alignItems:"center",gap:8,background:`${selectedRole.color}0D`,border:`1px solid ${selectedRole.color}30`,borderRadius:100,padding:"5px 14px",fontSize:12,fontWeight:700,color:selectedRole.color,marginBottom:24}}>
                {selectedRole.icon} {selectedRole.label}
              </div>
              {error && <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:12,padding:"12px 16px",fontSize:13,color:"#B91C1C",marginBottom:20,fontWeight:500}}>⚠️ {error}</div>}

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                {[{k:"firstName",ph:"Prénom",label:"Prénom *"},{k:"lastName",ph:"Nom",label:"Nom *"}].map(f=>(
                  <div key={f.k}>
                    <label style={lbl}>{f.label}</label>
                    <input value={form[f.k as keyof typeof form]} onChange={e=>set(f.k,e.target.value)} placeholder={f.ph} required style={inp} onFocus={e=>e.target.style.borderColor="#16A34A"} onBlur={e=>e.target.style.borderColor="#E5E1D8"}/>
                  </div>
                ))}
              </div>

              <div style={{marginBottom:14}}>
                <label style={lbl}>Email *</label>
                <input value={form.email} onChange={e=>set("email",e.target.value)} type="email" placeholder="votre@email.com" required style={inp} onFocus={e=>e.target.style.borderColor="#16A34A"} onBlur={e=>e.target.style.borderColor="#E5E1D8"}/>
              </div>

              <div style={{marginBottom:14,background:"#FAFAF7",border:"1px solid var(--line)",borderRadius:16,padding:16}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                  <div style={{width:26,height:26,borderRadius:8,background:"#E8F5EC",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>📍</div>
                  <div style={{fontSize:11,fontWeight:800,color:"var(--ink-soft)",letterSpacing:2,textTransform:"uppercase"}}>Localisation</div>
                </div>
                <style>{`.geo-light select,.geo-light input{background:#fff!important;border:1.5px solid #E5E1D8!important;color:#0B1120!important;border-radius:12px!important;padding:12px 14px!important;font-size:14px!important}.geo-light select:focus,.geo-light input:focus{border-color:#16A34A!important}.geo-light label{color:#8891A3!important;font-size:11px!important;font-weight:800!important;text-transform:uppercase!important;letter-spacing:0.5px!important;margin-bottom:7px!important}.geo-light>div{margin-bottom:12px}.geo-light>div:last-child{margin-bottom:0}`}</style>
                <div className="geo-light">
                  <GeoSelector value={geo} onChange={v => {
                    setGeo(v);
                    setForm(f => ({...f, country: v.countryCode, countryCode: v.countryCode, region: v.state, stateCode: v.stateCode, city: v.city, indicatif: v.indicatif}));
                  }}/>
                </div>
                {geo.countryCode && (
                  <div style={{marginTop:12,display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--ink-soft)"}}>
                    <span style={{color:"#16A34A"}}>✓</span>
                    <span>Indicatif détecté : <strong style={{color:"#0F7A3D"}}>{geo.indicatif}</strong></span>
                  </div>
                )}
              </div>

              <div style={{marginBottom:14}}>
                <label style={lbl}>Téléphone *</label>
                <div style={{display:"flex",gap:8}}>
                  <div style={{...inp,width:"auto",minWidth:72,padding:"12px",color:"var(--ink-soft)",fontSize:13,flexShrink:0,background:"#FAFAF7"}}>{geo.indicatif||"+221"}</div>
                  <input value={form.phone} onChange={e=>set("phone",e.target.value)} type="tel" placeholder="77 000 00 00" required style={{...inp,flex:1}} onFocus={e=>e.target.style.borderColor="#16A34A"} onBlur={e=>e.target.style.borderColor="#E5E1D8"}/>
                </div>
              </div>

              <div style={{marginBottom:14}}>
                <label style={lbl}>Mot de passe * (min. 8 car.)</label>
                <div style={{position:"relative"}}>
                  <input value={form.password} onChange={e=>set("password",e.target.value)} type={showPass?"text":"password"} placeholder="••••••••" required style={{...inp,paddingRight:44}} onFocus={e=>e.target.style.borderColor="#16A34A"} onBlur={e=>e.target.style.borderColor="#E5E1D8"}/>
                  <button type="button" onClick={()=>setShowPass(!showPass)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--ink-faint)",cursor:"pointer",fontSize:16}}>{showPass?"🙈":"👁️"}</button>
                </div>
                {form.password.length > 0 && (
                  <div style={{marginTop:8}}>
                    <div style={{display:"flex",gap:4,marginBottom:5}}>
                      {[1,2,3,4,5].map(i=>(<div key={i} style={{flex:1,height:4,borderRadius:4,background:i<=strength.score?strength.color:"#EFEDE6",transition:"background 0.3s"}}/>))}
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <span style={{fontSize:11,color:strength.color,fontWeight:700}}>{strength.label}</span>
                      <span style={{fontSize:10,color:"var(--ink-faint)"}}>{strength.score<3?"Ajoutez maj., chiffres, symboles":"Bon mot de passe 👍"}</span>
                    </div>
                  </div>
                )}
              </div>

              <div style={{marginBottom:20}}>
                <label style={lbl}>Confirmer *</label>
                <div style={{position:"relative"}}>
                  <input value={form.confirmPassword} onChange={e=>set("confirmPassword",e.target.value)} type={showConfirm?"text":"password"} placeholder="••••••••" required
                    style={{...inp,paddingRight:44,borderColor:form.confirmPassword&&form.confirmPassword!==form.password?"#FCA5A5":form.confirmPassword&&form.confirmPassword===form.password?"#86EFAC":"#E5E1D8"}}/>
                  <button type="button" onClick={()=>setShowConfirm(!showConfirm)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--ink-faint)",cursor:"pointer",fontSize:16}}>{showConfirm?"🙈":"👁️"}</button>
                </div>
                {form.confirmPassword && form.confirmPassword===form.password && <div style={{fontSize:11,color:"#16A34A",marginTop:4,fontWeight:600}}>✅ Les mots de passe correspondent</div>}
                {form.confirmPassword && form.confirmPassword!==form.password && <div style={{fontSize:11,color:"#DC2626",marginTop:4,fontWeight:600}}>❌ Ne correspondent pas</div>}
              </div>

              <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:24}}>
                <input type="checkbox" required id="cgu" style={{marginTop:3,accentColor:"#16A34A"}}/>
                <label htmlFor="cgu" style={{fontSize:12.5,color:"var(--ink-soft)",lineHeight:1.6}}>
                  J&apos;accepte les <Link href="/cgu" style={{color:"#0F7A3D",fontWeight:600}}>CGU</Link> et la <Link href="/privacy" style={{color:"#0F7A3D",fontWeight:600}}>Politique de Confidentialité</Link>
                </label>
              </div>
              <button type="submit" disabled={loading} style={{width:"100%",padding:"14px",borderRadius:14,fontWeight:700,fontSize:15,color:"#fff",cursor:loading?"not-allowed":"pointer",border:"none",background:"linear-gradient(135deg,#0F7A3D,#16A34A)",boxShadow:"0 8px 24px rgba(15,122,61,0.28)",opacity:loading?0.7:1}}>
                {loading?"Création du compte...":`Créer mon compte ${selectedRole.icon}`}
              </button>
            </form>
          )}

          {step === "verify" && (
            <form onSubmit={handleVerify} style={{textAlign:"center"}}>
              <div style={{fontSize:48,marginBottom:16}}>📬</div>
              <h2 style={{fontWeight:900,fontSize:22,color:"var(--ink)",margin:"0 0 8px"}}>Vérifiez votre email</h2>
              <p style={{color:"var(--ink-soft)",fontSize:14,lineHeight:1.7,marginBottom:32}}>Code à 6 chiffres envoyé à<br/><strong style={{color:"#0F7A3D"}}>{userEmail}</strong></p>
              {error && <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:12,padding:"12px 16px",fontSize:13,color:"#B91C1C",marginBottom:20}}>⚠️ {error}</div>}
              <input value={verifyCode} onChange={e=>{setVerifyCode(e.target.value.replace(/\D/g,"").slice(0,6));setError("");}} placeholder="000000" maxLength={6}
                style={{width:"100%",textAlign:"center",letterSpacing:12,fontSize:32,fontWeight:900,background:"#F0FDF4",border:"2px solid #86EFAC",borderRadius:16,padding:"20px",color:"#0F7A3D",outline:"none",boxSizing:"border-box",fontFamily:"monospace",marginBottom:24}}/>
              <button type="submit" disabled={loading||verifyCode.length!==6} style={{width:"100%",padding:"14px",borderRadius:14,fontWeight:700,fontSize:15,color:"#fff",cursor:"pointer",border:"none",background:"linear-gradient(135deg,#0F7A3D,#16A34A)",opacity:(loading||verifyCode.length!==6)?0.5:1,marginBottom:16}}>
                {loading?"Vérification...":"Confirmer mon compte ✅"}
              </button>
              <button type="button" onClick={resendCode} disabled={resendLoading} style={{background:"none",border:"none",color:"var(--ink-faint)",fontSize:13,cursor:"pointer",textDecoration:"underline",fontWeight:600}}>
                {resendLoading?"Envoi...":"Renvoyer le code"}
              </button>
              {resendMsg && <div style={{color:"#0F7A3D",fontSize:13,marginTop:8,fontWeight:600}}>{resendMsg}</div>}
            </form>
          )}
        </div>
        <p style={{textAlign:"center",color:"var(--ink-faint)",fontSize:13,marginTop:24}}>
          Déjà un compte ?{" "}<Link href="/auth/login" style={{color:"#0F7A3D",fontWeight:700}}>Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
