"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "https://api.korapact.com";
function fmt(n: number) { return Math.round(n).toLocaleString("fr-FR"); }

function Skeleton({ w = "100%", h = 24 }: { w?: string; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 8,
      background: "linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 75%)",
      backgroundSize: "200% 100%",
      animation: "skeleton-shine 1.5s infinite",
    }} />
  );
}

export default function LandingPage() {
  const [stats, setStats] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [fund, setFund] = useState<any>(null);
  const [fees, setFees] = useState<any>({ commission_baobab_collection: 6, commission_mentor: 2, commission_guarantee: 2, payin_repayment: 4, return_min: 23, withdrawal_fee_standard: 0 });
  const [loading, setLoading] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    const onMouse = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("scroll", onScroll);
    window.addEventListener("mousemove", onMouse);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("mousemove", onMouse); };
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/projects?limit=3&status=ACTIVE`).then(r => r.json()).catch(() => null),
      fetch(`${API}/api/admin/stats/charts`).then(r => r.json()).catch(() => null),
      fetch(`${API}/api/fund/stats`).then(r => r.json()).catch(() => null),
      fetch(`${API}/api/config/public`).then(r => r.json()).catch(() => null),
    ]).then(([proj, st, fd, cfg]) => {
      if (proj?.success) setProjects(proj.data?.projects || []);
      if (st?.success) setStats(st.data?.kpis || {});
      if (fd?.success) setFund(fd.data?.fund || {});
      if (cfg?.success) {
        const c: any = {};
        cfg.data.forEach((x: any) => { c[x.key] = Number(x.value); });
        setFees(c);
      }
      setLoading(false);
    });
  }, []);

  const simAmount = 100000;
  const totalFeesPct = (fees.commission_baobab_collection || 6) + (fees.commission_mentor || 2) + (fees.commission_guarantee || 2);
  const simFees = Math.round(simAmount * totalFeesPct / 100);
  const simNet = simAmount - simFees;
  const simRetour = Math.round(simNet * (1 + (fees.return_min || 23) / 100));
  const simPayin = Math.round(simRetour * (fees.payin_repayment || 4) / 100);
  const simGain = simRetour - simPayin;
  const simGainNet = simGain - simAmount;
  const simGainPct = ((simGainNet / simAmount) * 100).toFixed(1);

  const statItems = [
    {
      label: "Capital levé",
      value: loading ? null : `${fmt(stats?.totalRaised || 0)} F`,
      color: "#2563EB"
    },
    {
      label: "Projets actifs",
      value: loading ? null : String(stats?.activeProjects || 0),
      color: "#06B6D4"
    },
    {
      label: "Investisseurs",
      value: loading ? null : String(stats?.totalUsers || 0),
      color: "#F59E0B"
    },
    {
      label: "Fonds Solidaire",
      value: loading ? null : `${fmt(fund?.totalReceived || 0)} F`,
      color: "#8B5CF6"
    },
  ];

  return (
    <>
      <div className="cursor-glow" style={{ left: mousePos.x, top: mousePos.y }} />

      {/* NAVBAR */}
      <nav className={`nav ${scrolled ? "scrolled" : ""}`}>
        <div className="nav-inner">
          <Link href="/" className="logo">
            <div className="logo-mark">K</div>
            <span className="logo-text">KORAPACT</span>
          </Link>
          <div className="nav-links">
            {[["Fonctionnement","#comment"],["Projets","#projets"],["Fonds Solidaire","/fund"],["Bâtisseurs","#batisseurs"],["Transparence","#transparence"]].map(([l,h])=>(
              <a key={l} href={h} className="nav-link">{l}</a>
            ))}
          </div>
          <div className="nav-actions">
            <Link href="/auth/login" className="btn-ghost">Connexion</Link>
            <Link href="/auth/register" className="btn-cta">Commencer →</Link>
            <button onClick={() => setMobileMenu(!mobileMenu)}
              style={{background:"none",border:"none",color:"rgba(255,255,255,0.7)",fontSize:22,cursor:"pointer",padding:4}}
              className="mobile-btn">
              {mobileMenu ? "✕" : "☰"}
            </button>
          </div>
        </div>
        {mobileMenu && (
          <div style={{background:"rgba(5,8,16,0.97)",backdropFilter:"blur(24px)",borderTop:"1px solid var(--border)",padding:"20px 32px",display:"flex",flexDirection:"column",gap:16}}>
            {[["Fonctionnement","#comment"],["Projets","#projets"],["Fonds Solidaire","/fund"],["Transparence","#transparence"],["Connexion","/auth/login"]].map(([l,h])=>(
              <a key={l} href={h} onClick={() => setMobileMenu(false)}
                style={{color:"rgba(255,255,255,0.65)",fontSize:15,fontWeight:500}}>{l}</a>
            ))}
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-bg">
          <div className="grid-bg"/>
          <div className="orb orb-1"/><div className="orb orb-2"/><div className="orb orb-3"/>
        </div>
        <div className="hero-content">
          <div className="hero-badge">
            <div className="badge-dot"><div className="badge-dot-inner"/></div>
            Plateforme d'investissement communautaire · 2026
          </div>
          <h1 className="hero-title">
            Faites fructifier<br/>
            <span className="gradient-text">votre capital.</span>
          </h1>
          <p className="hero-sub">
            Investissez dans des projets vérifiés, soutenez des entrepreneurs ambitieux et percevez des retours mensuels. Dès <strong style={{color:"#F59E0B"}}>5 000 F</strong>.
          </p>
          <div className="hero-actions">
            <Link href="/auth/register" className="btn-hero-primary">Commencer maintenant →</Link>
            <Link href="/projects" className="btn-hero-ghost">Explorer les projets</Link>
          </div>

          {/* STATS avec skeletons */}
          <div className="stats-grid">
            {statItems.map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-accent" style={{background:`linear-gradient(90deg,${s.color},transparent)`}}/>
                <div className="stat-value">
                  {s.value === null ? <Skeleton h={28} w="80%" /> : s.value}
                </div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROLES */}
      <section className="section" style={{background:"#0C1024"}}>
        <div className="section-inner">
          <div className="section-header" style={{textAlign:"center"}}>
            <div className="section-eyebrow" style={{color:"#06B6D4"}}>Votre profil</div>
            <h2 className="section-title">Une plateforme pour chaque ambition</h2>
            <p className="section-sub" style={{maxWidth:440,margin:"0 auto"}}>Investisseur, entrepreneur, mentor ou mécène — choisissez votre rôle.</p>
          </div>
          <div className="roles-grid">
            {[
              {role:"Investisseur",icon:"💼",href:"/auth/register?role=INVESTOR",color:"#2563EB",grad:"rgba(37,99,235,0.12)",desc:"Financez des projets vérifiés et percevez des retours mensuels.",gain:`+${fees.return_min||23}% min`},
              {role:"Entrepreneur",icon:"🚀",href:"/auth/register?role=ENTREPRENEUR",color:"#06B6D4",grad:"rgba(6,182,212,0.12)",desc:"Obtenez un financement communautaire sans banque, en moins de 30 jours.",gain:"Financé en 30j"},
              {role:"Mentor",icon:"🎓",href:"/auth/register?role=MENTOR",color:"#8B5CF6",grad:"rgba(139,92,246,0.12)",desc:"Parrainez des projets et percevez une commission à la clôture.",gain:`${fees.commission_mentor||2}% commission`},
              {role:"Bâtisseur",icon:"🏗️",href:"/auth/register?role=BUILDER",color:"#F59E0B",grad:"rgba(245,158,11,0.12)",desc:"Mécènes et entreprises — soutenez à grande échelle.",gain:"Impact & prestige"},
            ].map(p => (
              <div key={p.role} className="role-card"
                style={{borderColor:`${p.color}20`}}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = p.grad;
                  el.style.borderColor = `${p.color}40`;
                  el.style.boxShadow = `0 24px 64px ${p.color}18`;
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "rgba(255,255,255,0.025)";
                  el.style.borderColor = `${p.color}20`;
                  el.style.boxShadow = "none";
                }}>
                <span className="role-icon">{p.icon}</span>
                <h3 className="role-title">{p.role}</h3>
                <p className="role-desc">{p.desc}</p>
                <span className="role-badge" style={{background:`${p.color}18`,color:p.color,border:`1px solid ${p.color}30`}}>{p.gain}</span>
                <Link href={p.href} className="role-btn"
                  style={{background:`linear-gradient(135deg,${p.color},${p.color}bb)`,color:p.role==="Bâtisseur"?"#050810":"#fff"}}>
                  Commencer →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STEPS */}
      <section id="comment" className="section" style={{background:"#050810"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(37,99,235,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(37,99,235,0.025) 1px,transparent 1px)",backgroundSize:"72px 72px",pointerEvents:"none"}}/>
        <div className="section-inner" style={{position:"relative"}}>
          <div className="section-header" style={{textAlign:"center"}}>
            <div className="section-eyebrow" style={{color:"#2563EB"}}>Processus</div>
            <h2 className="section-title">3 étapes, zéro complexité</h2>
            <p className="section-sub">De l'inscription au premier remboursement, tout est guidé.</p>
          </div>
          <div className="steps-grid">
            {[
              {num:"01",title:"Créez votre compte",desc:"Inscription en 2 minutes. Vérification KYC rapide. Choisissez votre rôle.",icon:"👤",color:"#2563EB"},
              {num:"02",title:"Sélectionnez un projet",desc:"Parcourez des projets vérifiés avec scores de crédibilité et mentors garants.",icon:"🔍",color:"#06B6D4"},
              {num:"03",title:"Percevez vos retours",desc:"Remboursements mensuels automatiques. Retrait vers votre compte à tout moment.",icon:"💸",color:"#F59E0B"},
            ].map((s, i) => (
              <div key={s.num} className="step-card">
                <div className="step-num" style={{color:`${s.color}10`}}>{s.num}</div>
                <div className="step-icon-wrap" style={{background:`${s.color}12`,border:`1px solid ${s.color}25`}}>{s.icon}</div>
                <div className="step-label" style={{color:s.color}}>Étape {i+1}</div>
                <h3 className="step-title">{s.title}</h3>
                <p className="step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROJECTS */}
      {projects.length > 0 && (
        <section id="projets" className="section" style={{background:"#0C1024"}}>
          <div className="section-inner">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:56,flexWrap:"wrap",gap:16}}>
              <div>
                <div className="section-eyebrow" style={{color:"#06B6D4"}}>Live</div>
                <h2 className="section-title" style={{marginBottom:0}}>Projets en cours</h2>
              </div>
              <Link href="/projects" className="btn-section-ghost">Voir tous →</Link>
            </div>
            <div className="projects-grid">
              {projects.map((p: any) => {
                const pct = Math.round(((p.raisedAmount || 0) / (p.goalAmount || 1)) * 100);
                return (
                  <Link key={p.id} href={`/projects/${p.id}`} className="project-card">
                    <div className="progress-bar"><div className="progress-fill" style={{width:`${Math.min(pct,100)}%`}}/></div>
                    <div className="project-body">
                      <span className="project-sector">{p.sector}</span>
                      <h3 className="project-title">{p.title}</h3>
                      <p className="project-desc">{p.description}</p>
                      <div className="project-metrics">
                        {[{l:"Retour",v:`${p.expectedReturn}%`,c:"#06B6D4"},{l:"Durée",v:`${p.durationMonths}m`,c:"#93C5FD"},{l:"Levé",v:`${pct}%`,c:"#F59E0B"}].map(m=>(
                          <div key={m.l} className="metric">
                            <div className="metric-val" style={{color:m.c}}>{m.v}</div>
                            <div className="metric-label">{m.l}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <div style={{fontWeight:900,fontSize:14}}>{fmt(p.raisedAmount||0)} F</div>
                          <div style={{fontSize:11.5,color:"rgba(255,255,255,0.32)"}}>sur {fmt(p.goalAmount||0)} F</div>
                        </div>
                        <div style={{fontWeight:700,fontSize:13,color:"#fff",padding:"9px 18px",borderRadius:12,background:"linear-gradient(135deg,#2563EB,#06B6D4)"}}>
                          Investir →
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* FONDS SOLIDAIRE */}
      <section className="section" style={{background:"#050810",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:800,height:800,borderRadius:"50%",background:"radial-gradient(circle,rgba(139,92,246,0.06) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div className="section-inner" style={{position:"relative"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:80,alignItems:"center"}}>
            <div>
              <div className="section-eyebrow" style={{color:"#8B5CF6"}}>Solidarité</div>
              <h2 className="section-title">Fonds Solidaire<br/>
                <span style={{background:"linear-gradient(135deg,#8B5CF6,#06B6D4)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>KORAPACT</span>
              </h2>
              <p style={{fontSize:17,color:"rgba(255,255,255,0.45)",lineHeight:1.8,marginBottom:36}}>
                Une cagnotte communautaire. Contribuez dès <strong style={{color:"#8B5CF6"}}>5 000 F</strong>, avec ou sans compte, pour soutenir des projets ambitieux.
              </p>
              <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                <Link href="/fund" className="btn-section-primary" style={{background:"linear-gradient(135deg,#8B5CF6,#6D28D9)"}}>🌱 Contribuer</Link>
                <Link href="/fund" className="btn-section-ghost" style={{borderColor:"rgba(139,92,246,0.3)",color:"#A78BFA"}}>Voir le fonds →</Link>
              </div>
            </div>
            <div className="glass-card" style={{padding:36,borderColor:"rgba(139,92,246,0.18)"}}>
              <div style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.35)",textAlign:"center",letterSpacing:3,textTransform:"uppercase",marginBottom:28}}>Impact en temps réel</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
                {[
                  {label:"Total collecté",value:loading?null:`${fmt(fund?.totalReceived||0)} F`,color:"#8B5CF6"},
                  {label:"Contributeurs",value:loading?null:String(fund?.totalContributors||0),color:"#06B6D4"},
                  {label:"Projets aidés",value:loading?null:String(fund?.totalProjects||0),color:"#2563EB"},
                  {label:"Net aux projets",value:loading?null:`${fmt((fund?.totalReceived||0)*0.9)} F`,color:"#F59E0B"},
                ].map(s=>(
                  <div key={s.label} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${s.color}20`,borderRadius:16,padding:"18px 14px",textAlign:"center"}}>
                    <div style={{fontSize:20,fontWeight:900,color:s.color,minHeight:28}}>
                      {s.value === null ? <Skeleton h={24} w="70%" /> : s.value}
                    </div>
                    <div style={{fontSize:11.5,color:"rgba(255,255,255,0.32)",marginTop:6}}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.15)",borderRadius:14,padding:"14px 18px",textAlign:"center",fontSize:13,color:"rgba(255,255,255,0.48)",lineHeight:1.7}}>
                <span style={{color:"#A78BFA",fontWeight:700}}>90%</span> va directement aux projets.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BATISSEURS */}
      <section id="batisseurs" className="section" style={{background:"#0C1024"}}>
        <div className="section-inner">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:80,alignItems:"center"}}>
            <div>
              <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:100,padding:"5px 14px",fontSize:11.5,fontWeight:700,color:"#F59E0B",marginBottom:24}}>
                🏗️ Rôle premium — Bâtisseur
              </div>
              <h2 className="section-title">Devenez un<br/><span style={{color:"#F59E0B"}}>Bâtisseur d'avenir</span></h2>
              <p style={{fontSize:17,color:"rgba(255,255,255,0.45)",lineHeight:1.8,marginBottom:28}}>
                Mécènes, entreprises, fonds — investissez à grande échelle et bénéficiez d'une visibilité exceptionnelle.
              </p>
              {["Reconnaissance publique sur la plateforme","Dashboard dédié avec impact mesuré","Connexion directe avec les entrepreneurs","Hall of Fame des plus grands Bâtisseurs"].map(item=>(
                <div key={item} style={{display:"flex",alignItems:"center",gap:12,marginBottom:13}}>
                  <div style={{width:18,height:18,borderRadius:"50%",background:"rgba(245,158,11,0.15)",border:"1px solid rgba(245,158,11,0.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:"#F59E0B"}}/>
                  </div>
                  <span style={{fontSize:14,color:"rgba(255,255,255,0.55)"}}>{item}</span>
                </div>
              ))}
              <Link href="/auth/register?role=BUILDER" className="btn-section-primary"
                style={{marginTop:28,background:"linear-gradient(135deg,#F59E0B,#D97706)",color:"#050810"}}>
                🏗️ Devenir Bâtisseur →
              </Link>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              {[
                {icon:"🏢",title:"Entreprises",desc:"RSE & impact mesurable",color:"#F59E0B"},
                {icon:"🏛️",title:"Institutions",desc:"Partenariats officiels",color:"#2563EB"},
                {icon:"🌐",title:"International",desc:"Accès global",color:"#06B6D4"},
                {icon:"💎",title:"Mécènes",desc:"Philanthropie moderne",color:"#8B5CF6"},
              ].map(b=>(
                <div key={b.title}
                  style={{background:`${b.color}08`,border:`1px solid ${b.color}20`,borderRadius:20,padding:"26px 18px",textAlign:"center",transition:"all 0.25s",cursor:"pointer"}}
                  onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.transform="translateY(-4px)";el.style.borderColor=`${b.color}40`;}}
                  onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.transform="translateY(0)";el.style.borderColor=`${b.color}20`;}}>
                  <div style={{fontSize:36,marginBottom:12}}>{b.icon}</div>
                  <div style={{fontWeight:700,fontSize:14,color:"#fff",marginBottom:4}}>{b.title}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>{b.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TRANSPARENCE + SIMULATION */}
      <section id="transparence" className="section" style={{background:"#050810"}}>
        <div className="section-inner">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:80,alignItems:"start"}}>
            <div>
              <div className="section-eyebrow" style={{color:"#06B6D4"}}>Transparence</div>
              <h2 className="section-title">Zéro surprise.<br/><span style={{color:"#06B6D4"}}>Tous les frais publics.</span></h2>
              <p style={{fontSize:17,color:"rgba(255,255,255,0.42)",lineHeight:1.8,marginBottom:36}}>
                Tous nos taux sont mis à jour en temps réel. Aucun frais caché.
              </p>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {[
                  {label:"Commission collecte",value:`${fees.commission_baobab_collection||6}%`,note:"Prélevé à la clôture",color:"#EF4444"},
                  {label:"Commission mentor",value:`${fees.commission_mentor||2}%`,note:"Versé au mentor garant",color:"#8B5CF6"},
                  {label:"Fonds de garantie",value:`${fees.commission_guarantee||2}%`,note:"Réserve communautaire",color:"#F59E0B"},
                  {label:"Payin mensualités",value:`${fees.payin_repayment||4}%`,note:"Frais opérateur absorbés",color:"#2563EB"},
                  {label:"Retrait gains",value:`${fees.withdrawal_fee_standard||0}%`,note:"Nous absorbons les frais",color:"#06B6D4"},
                ].map(f=>(
                  <div key={f.label} className="fee-row">
                    <div>
                      <div style={{fontWeight:600,fontSize:14,color:"#fff"}}>{f.label}</div>
                      <div style={{fontSize:12,color:"rgba(255,255,255,0.32)",marginTop:3}}>{f.note}</div>
                    </div>
                    <span className="fee-badge" style={{background:`${f.color}14`,color:f.color,border:`1px solid ${f.color}28`}}>{f.value}</span>
                  </div>
                ))}
              </div>
              <Link href="/transparence" style={{display:"inline-block",marginTop:22,color:"#06B6D4",fontWeight:600,fontSize:13.5}}>
                Page transparence complète →
              </Link>
            </div>
            <div className="sim-card">
              <div style={{fontSize:11,fontWeight:800,color:"#2563EB",letterSpacing:3,textTransform:"uppercase",marginBottom:6}}>Calculateur</div>
              <h3 style={{fontWeight:900,fontSize:22,marginBottom:4}}>🧮 Simulation</h3>
              <p style={{fontSize:12,color:"rgba(255,255,255,0.3)",marginBottom:28}}>Basé sur les taux actuels</p>
              {[
                {l:"Vous investissez",v:`${fmt(simAmount)} F`,c:"#fff",bold:true},
                {l:`Frais clôture (${totalFeesPct}%)`,v:`-${fmt(simFees)} F`,c:"#EF4444"},
                {l:"Net dans le projet",v:`${fmt(simNet)} F`,c:"rgba(255,255,255,0.55)"},
                {l:`Retour brut (min ${fees.return_min||23}%)`,v:`+${fmt(simRetour)} F`,c:"#F59E0B"},
                {l:`Payin (${fees.payin_repayment||4}%)`,v:`-${fmt(simPayin)} F`,c:"#93C5FD"},
                {l:"Retrait gains",v:"Gratuit ✅",c:"#06B6D4"},
              ].map((row,i)=>(
                <div key={i}>
                  <div className="sim-row">
                    <span style={{color:"rgba(255,255,255,0.42)",fontSize:13.5}}>{row.l}</span>
                    <span style={{fontWeight:row.bold?900:700,color:row.c,fontSize:13.5}}>{row.v}</span>
                  </div>
                  {i<5&&<hr className="sim-divider"/>}
                </div>
              ))}
              <div className="sim-result">
                <span style={{fontWeight:700,fontSize:16}}>Vous recevez</span>
                <span style={{fontWeight:900,fontSize:22}}>{fmt(simGain)} F</span>
              </div>
              <div style={{textAlign:"center",marginTop:14,color:"#06B6D4",fontWeight:700,fontSize:15}}>
                Gain net : +{fmt(simGainNet)} F (+{simGainPct}%) 🎉
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section" style={{background:"#0C1024"}}>
        <div className="cta-glow"/>
        <div style={{maxWidth:860,margin:"0 auto",textAlign:"center",position:"relative"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(37,99,235,0.1)",border:"1px solid rgba(37,99,235,0.22)",borderRadius:100,padding:"5px 16px",fontSize:11.5,fontWeight:700,color:"#93C5FD",marginBottom:32}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#06B6D4",display:"inline-block"}}/>
            Rejoignez la communauté KORAPACT
          </div>
          <h2 style={{fontSize:"clamp(40px,6vw,76px)",fontWeight:900,letterSpacing:"-3px",lineHeight:1.02,marginBottom:24}}>
            Prêt à faire<br/>
            <span style={{background:"linear-gradient(135deg,#2563EB,#06B6D4,#F59E0B)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
              fructifier votre argent ?
            </span>
          </h2>
          <p style={{fontSize:19,color:"rgba(255,255,255,0.42)",lineHeight:1.75,maxWidth:460,margin:"0 auto 52px"}}>
            Inscription gratuite. Premiers retours en quelques mois.
          </p>
          <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap"}}>
            <Link href="/auth/register?role=INVESTOR" className="btn-hero-primary">💰 Investir maintenant</Link>
            <Link href="/auth/register?role=ENTREPRENEUR" className="btn-hero-ghost">🚀 Financer un projet</Link>
            <Link href="/fund" style={{fontSize:15,fontWeight:600,color:"#A78BFA",padding:"15px 32px",borderRadius:14,border:"1px solid rgba(139,92,246,0.25)",transition:"all 0.25s",display:"inline-block"}}>🌱 Fonds Solidaire</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-grid">
            <div>
              <Link href="/" className="logo" style={{marginBottom:20,display:"inline-flex"}}>
                <div className="logo-mark">K</div>
                <span className="logo-text" style={{marginLeft:10}}>KORAPACT</span>
              </Link>
              <p style={{fontSize:13.5,color:"rgba(255,255,255,0.3)",lineHeight:1.7,marginTop:16,maxWidth:260}}>
                Plateforme d'investissement communautaire. Lancée en 2026.
              </p>
            </div>
            {[
              {title:"Plateforme",links:[["Projets","/projects"],["Fonds Solidaire","/fund"],["Transparence","/transparence"],["Classement","/leaderboard"]]},
              {title:"Rejoindre",links:[["Investisseur","/auth/register?role=INVESTOR"],["Entrepreneur","/auth/register?role=ENTREPRENEUR"],["Mentor","/auth/register?role=MENTOR"],["Bâtisseur","/auth/register?role=BUILDER"]]},
              {title:"Partenaires",links:[["Fournisseurs","/suppliers/register"],["Institutions","/auth/register?role=BUILDER"],["Mécènes","/fund"]]},
            ].map(col=>(
              <div key={col.title}>
                <div style={{fontWeight:700,fontSize:13,color:"#fff",marginBottom:18}}>{col.title}</div>
                {col.links.map(([l,h])=>(
                  <Link key={l} href={h} className="footer-link">{l}</Link>
                ))}
              </div>
            ))}
          </div>
          <div className="footer-bottom">
            <p className="footer-small">© 2026 KORAPACT. Tous droits réservés.</p>
            <p className="footer-small">L'investissement comporte des risques.</p>
          </div>
        </div>
      </footer>
    </>
  );
}