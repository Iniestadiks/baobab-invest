"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
const API = process.env.NEXT_PUBLIC_API_URL || "https://api.korapact.com";
function fmt(n: number) { return Math.round(n).toLocaleString("fr-FR"); }
function Skeleton({ w = "100%", h = 24 }: { w?: string; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 8,
      background: "linear-gradient(90deg, rgba(11,17,32,0.05) 25%, rgba(11,17,32,0.09) 50%, rgba(11,17,32,0.05) 75%)",
      backgroundSize: "200% 100%",
      animation: "skeleton-shine 1.5s infinite",
    }} />
  );
}
const PROCESS_FLOWS: Record<string, { color: string; icon: string; label: string; steps: { icon: string; title: string; desc: string }[] }> = {
  ENTREPRENEUR: {
    color: "#16A34A", icon: "🚀", label: "Entrepreneur",
    steps: [
      { icon: "👤", title: "Créez votre compte", desc: "Inscription en 2 minutes, choisissez le rôle Entrepreneur." },
      { icon: "🪪", title: "Vérification KYC", desc: "Pièce d'identité + selfie. Validation sous 24h par l'équipe." },
      { icon: "📝", title: "Soumettez votre projet", desc: "Titre, secteur, montant à lever, durée et taux de retour proposé." },
      { icon: "🎬", title: "Ajoutez un pitch vidéo", desc: "Présentez votre projet en vidéo pour rassurer les investisseurs." },
      { icon: "✅", title: "Validation par l'équipe", desc: "Analyse du dossier et du score de crédibilité sous 48h ouvrées." },
      { icon: "🌱", title: "Cagnotte lancée", desc: "Votre projet est visible publiquement, les investisseurs contribuent." },
      { icon: "💰", title: "Fonds débloqués par paliers", desc: "40% au démarrage, 35% puis 25% selon l'avancement validé." },
      { icon: "🔁", title: "Remboursements mensuels", desc: "Vous remboursez selon l'échéancier — le projet se clôture, tout le monde est réglé." },
    ],
  },
  INVESTOR: {
    color: "#0F7A3D", icon: "💼", label: "Investisseur",
    steps: [
      { icon: "👤", title: "Créez votre compte", desc: "Inscription en 2 minutes, choisissez le rôle Investisseur." },
      { icon: "🪪", title: "Vérification KYC", desc: "Pièce d'identité + selfie. Validation sous 24h par l'équipe." },
      { icon: "💳", title: "Déposez des fonds", desc: "Dépôt sécurisé via mobile money (Orange Money, Wave...)." },
      { icon: "🔍", title: "Choisissez un projet", desc: "Parcourez des projets vérifiés avec score de crédibilité et mentor garant." },
      { icon: "📈", title: "Investissez dès 5 000 F", desc: "Votre contribution rejoint la cagnotte du projet choisi." },
      { icon: "👀", title: "Suivez la collecte", desc: "Progression en temps réel jusqu'à l'objectif atteint." },
      { icon: "💸", title: "Percevez vos retours", desc: "Remboursements mensuels automatiques dès le démarrage du projet." },
      { icon: "🏦", title: "Retirez vos gains", desc: "Retrait libre vers votre mobile money, à tout moment." },
    ],
  },
  MENTOR: {
    color: "#7C3AED", icon: "🎓", label: "Mentor",
    steps: [
      { icon: "👤", title: "Créez votre compte", desc: "Inscription en 2 minutes, choisissez le rôle Mentor." },
      { icon: "🪪", title: "Vérification KYC", desc: "Pièce d'identité + selfie. Validation sous 24h par l'équipe." },
      { icon: "🤝", title: "Parrainez un projet", desc: "Accompagnez un entrepreneur dans la préparation de son dossier." },
      { icon: "✅", title: "Co-validation du projet", desc: "Votre garantie renforce la crédibilité auprès des investisseurs." },
      { icon: "🌱", title: "Suivi de la collecte", desc: "Le projet parrainé est visible avec votre badge de mentor garant." },
      { icon: "💰", title: "Commission à la clôture", desc: "Vous percevez votre commission une fois le projet remboursé." },
    ],
  },
  BUILDER: {
    color: "#C8860D", icon: "🏗️", label: "Bâtisseur",
    steps: [
      { icon: "👤", title: "Créez votre compte", desc: "Inscription en 2 minutes — aucun KYC requis pour ce rôle." },
      { icon: "🌱", title: "Contribuez au Fonds Solidaire", desc: "Don libre, dès 5 000 F, avec ou sans création de compte." },
      { icon: "🎯", title: "Choisissez votre impact", desc: "Fonds général ou allocation ciblée vers un projet précis." },
      { icon: "📊", title: "Suivez l'impact en temps réel", desc: "Visualisez où va votre contribution et son effet concret." },
      { icon: "🏅", title: "Recevez votre badge", desc: "Reconnaissance publique selon votre niveau de contribution." },
      { icon: "👑", title: "Rejoignez le Hall of Fame", desc: "Classement des plus grands Bâtisseurs de la communauté." },
    ],
  },
};

export default function LandingPage() {
  const [stats, setStats] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [fund, setFund] = useState<any>(null);
  const [fees, setFees] = useState<any>({ commission_baobab_collection: 6, commission_mentor: 2, commission_guarantee: 2, payin_repayment: 4, return_min: 23, withdrawal_fee_standard: 0 });
  const [loading, setLoading] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [processRole, setProcessRole] = useState("ENTREPRENEUR");
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
      fetch(`${API}/api/stats/public`).then(r => r.json()).catch(() => null),
    ]).then(([proj, pub]) => {
      if (proj?.success) setProjects(proj.data?.projects || []);
      if (pub?.success) {
        setStats(pub.data?.kpis || {});
        setFund(pub.data?.fund || {});
        if (pub.data?.config) {
          const c: any = {};
          (pub.data.config as any[]).forEach((x: any) => { c[x.key] = Number(x.value); });
          setFees(c);
        }
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
    { label: "Capital levé", value: loading ? null : `${fmt(stats?.totalRaised || 0)} F`, color: "#0F7A3D" },
    { label: "Projets actifs", value: loading ? null : String(stats?.activeProjects || 0), color: "#16A34A" },
    { label: "Investisseurs", value: loading ? null : String(stats?.totalUsers || 0), color: "#C8860D" },
    { label: "Fonds Solidaire", value: loading ? null : `${fmt(fund?.totalReceived || 0)} F`, color: "#7C3AED" },
  ];
  return (
    <>
      <div className="cursor-glow" style={{ left: mousePos.x, top: mousePos.y }} />
      {/* NAVBAR */}
      <nav className={`nav ${scrolled ? "scrolled" : ""}`}>
        <div className="nav-inner">
          <Link href="/" className="logo">
            <img src="/logo.png" alt="KORAPACT" style={{width:38,height:38,objectFit:"contain"}} />
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
              style={{background:"none",border:"none",color:"var(--ink)",fontSize:22,cursor:"pointer",padding:4}}
              className="mobile-btn">
              {mobileMenu ? "✕" : "☰"}
            </button>
          </div>
        </div>
        {mobileMenu && (
          <div style={{background:"rgba(251,250,247,0.98)",backdropFilter:"blur(20px)",borderTop:"1px solid var(--line)",padding:"20px 32px",display:"flex",flexDirection:"column",gap:16}}>
            {[["Fonctionnement","#comment"],["Projets","#projets"],["Fonds Solidaire","/fund"],["Transparence","#transparence"],["Connexion","/auth/login"]].map(([l,h])=>(
              <a key={l} href={h} onClick={() => setMobileMenu(false)}
                style={{color:"var(--ink-soft)",fontSize:15,fontWeight:600}}>{l}</a>
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
          <div className="hero-grid">
            <div>
              <div className="hero-badge">
                <div className="badge-dot"><div className="badge-dot-inner"/></div>
                Plateforme d'investissement communautaire · 2026
              </div>
              <h1 className="hero-title">
                Faites fructifier<br/>
                <span className="gradient-text">votre capital.</span>
              </h1>
              <p className="hero-sub">
                Investissez dans des projets vérifiés, soutenez des entrepreneurs ambitieux et percevez des retours mensuels. Dès <strong style={{color:"#C8860D"}}>5 000 F</strong>.
              </p>
              <div className="hero-actions">
                <Link href="/auth/register" className="btn-hero-primary">Commencer maintenant →</Link>
                <Link href="/projects" className="btn-hero-ghost">Explorer les projets</Link>
              </div>
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
            <div className="hero-visual" style={{position:"relative", overflow:"hidden"}}>
              <video autoPlay loop muted playsInline
                style={{position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", borderRadius:24, zIndex:0}}>
                <source src="/hero-video.mp4" type="video/mp4" />
              </video>
              <div className="hv-ring"/>
              <div className="hv-ring hv-ring-2"/>
              <div className="hv-hand hv-hand-1">🤝</div>
              <div className="hv-hand hv-hand-2">💼</div>
              <div className="hv-hand hv-hand-3">🚀</div>
              <div className="hv-hand hv-hand-4">🎓</div>
              <div className="hv-hand hv-hand-5">🏗️</div>
              <div className="hv-hand hv-hand-6">💰</div>
            </div>
          </div>
        </div>
      </section>

      {/* ROLES */}
      <section className="section section-alt">
        <div className="section-inner">
          <div className="section-header" style={{textAlign:"center"}}>
            <div className="badge-light" style={{margin:"0 auto 20px",width:"fit-content"}}>👥 Votre profil</div>
            <h2 className="section-title">Une plateforme pour chaque ambition</h2>
            <p className="section-sub" style={{maxWidth:440,margin:"0 auto"}}>Investisseur, entrepreneur, mentor ou mécène — choisissez votre rôle.</p>
          </div>
          <div className="roles-grid">
            {[
              {role:"Investisseur",icon:"💼",href:"/auth/register?role=INVESTOR",color:"#0F7A3D",grad:"rgba(15,122,61,0.05)",desc:"Financez des projets vérifiés et percevez des retours mensuels.",gain:`+${fees.return_min||23}% min`},
              {role:"Entrepreneur",icon:"🚀",href:"/auth/register?role=ENTREPRENEUR",color:"#16A34A",grad:"rgba(22,163,74,0.05)",desc:"Obtenez un financement communautaire sans banque, en moins de 30 jours.",gain:"Financé en 30j"},
              {role:"Mentor",icon:"🎓",href:"/auth/register?role=MENTOR",color:"#7C3AED",grad:"rgba(124,58,237,0.05)",desc:"Parrainez des projets et percevez une commission à la collecte.",gain:`${fees.commission_mentor||2}% commission`},
              {role:"Bâtisseur",icon:"🏗️",href:"/auth/register?role=BUILDER",color:"#C8860D",grad:"rgba(200,134,13,0.05)",desc:"Mécènes et entreprises — soutenez à grande échelle.",gain:"Impact & prestige"},
            ].map(p => (
              <div key={p.role} className="role-card"
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = p.grad; el.style.borderColor = `${p.color}35`; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#fff"; el.style.borderColor = "var(--line)"; }}>
                <span className="role-icon">{p.icon}</span>
                <h3 className="role-title">{p.role}</h3>
                <p className="role-desc">{p.desc}</p>
                <span className="role-badge" style={{background:`${p.color}14`,color:p.color,border:`1px solid ${p.color}28`}}>{p.gain}</span>
                <Link href={p.href} className="role-btn"
                  style={{background:`linear-gradient(135deg,${p.color},${p.color}bb)`,color:"#fff"}}>
                  Commencer →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROCESS PAR RÔLE */}
      <section id="comment" className="section">
        <div className="section-inner">
          <div className="section-header" style={{textAlign:"center"}}>
            <div className="section-eyebrow">Processus</div>
            <h2 className="section-title">Un parcours guidé, pour chaque rôle</h2>
            <p className="section-sub">De l'inscription à la clôture du projet, chaque étape est claire.</p>
          </div>
          <div className="process-tabs">
            {Object.entries(PROCESS_FLOWS).map(([key, flow]) => (
              <button key={key} className={`process-tab ${processRole===key?"active":""}`}
                onClick={() => setProcessRole(key)}
                style={processRole===key?{background:`linear-gradient(135deg,${flow.color},${flow.color}cc)`}:{}}>
                <span>{flow.icon}</span>{flow.label}
              </button>
            ))}
          </div>
          <div className="timeline">
            {PROCESS_FLOWS[processRole].steps.map((s, i) => (
              <div key={i} className="timeline-item">
                <div className="timeline-dot" style={{background:`${PROCESS_FLOWS[processRole].color}12`,color:PROCESS_FLOWS[processRole].color}}>{s.icon}</div>
                <div className="timeline-content">
                  <div className="timeline-tag" style={{background:`${PROCESS_FLOWS[processRole].color}12`,color:PROCESS_FLOWS[processRole].color}}>Étape {i+1}</div>
                  <div className="timeline-title">{s.title}</div>
                  <div className="timeline-desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{textAlign:"center",marginTop:48}}>
            <Link href={`/devenir/${{ENTREPRENEUR:"entrepreneur",INVESTOR:"investisseur",MENTOR:"mentor",BUILDER:"batisseur"}[processRole]}`}
              className="btn-section-ghost" style={{borderColor:`${PROCESS_FLOWS[processRole].color}30`,color:PROCESS_FLOWS[processRole].color}}>
              En savoir plus sur le parcours {PROCESS_FLOWS[processRole].label} →
            </Link>
          </div>
        </div>
      </section>

      {/* PROJECTS */}
      {projects.length > 0 && (
        <section id="projets" className="section section-alt">
          <div className="section-inner">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:56,flexWrap:"wrap",gap:16}}>
              <div>
                <div className="badge-light" style={{marginBottom:16,width:"fit-content"}}>🟢 Live</div>
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
                        {[{l:"Retour",v:`${p.expectedReturn}%`,c:"#0F7A3D"},{l:"Durée",v:`${p.durationMonths}m`,c:"#0B1120"},{l:"Levé",v:`${pct}%`,c:"#C8860D"}].map(m=>(
                          <div key={m.l} className="metric">
                            <div className="metric-val" style={{color:m.c}}>{m.v}</div>
                            <div className="metric-label">{m.l}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <div style={{fontWeight:900,fontSize:14,color:"var(--ink)"}}>{fmt(p.raisedAmount||0)} F</div>
                          <div style={{fontSize:11.5,color:"var(--ink-faint)"}}>sur {fmt(p.goalAmount||0)} F</div>
                        </div>
                        <div style={{fontWeight:700,fontSize:13,color:"#fff",padding:"9px 18px",borderRadius:12,background:"linear-gradient(135deg,#0F7A3D,#16A34A)"}}>
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
      <section className="section" style={{position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:800,height:800,borderRadius:"50%",background:"radial-gradient(circle,rgba(124,58,237,0.05) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div className="section-inner" style={{position:"relative"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:80,alignItems:"center"}}>
            <div>
              <div className="section-eyebrow" style={{color:"#7C3AED"}}>Solidarité</div>
              <h2 className="section-title">Fonds Solidaire<br/>
                <span style={{background:"linear-gradient(135deg,#7C3AED,#16A34A)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>KORAPACT</span>
              </h2>
              <p style={{fontSize:17,color:"var(--ink-soft)",lineHeight:1.8,marginBottom:36}}>
                Une cagnotte communautaire. Contribuez dès <strong style={{color:"#7C3AED"}}>5 000 F</strong>, avec ou sans compte, pour soutenir des projets ambitieux.
              </p>
              <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                <Link href="/fund" className="btn-section-primary" style={{background:"linear-gradient(135deg,#7C3AED,#6D28D9)"}}>🌱 Contribuer</Link>
                <Link href="/fund" className="btn-section-ghost" style={{borderColor:"rgba(124,58,237,0.25)",color:"#7C3AED"}}>Voir le fonds →</Link>
              </div>
            </div>
            <div className="glass-card" style={{padding:36}}>
              <div style={{fontSize:11,fontWeight:800,color:"var(--ink-faint)",textAlign:"center",letterSpacing:3,textTransform:"uppercase",marginBottom:28}}>Impact en temps réel</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
                {[
                  {label:"Total collecté",value:loading?null:`${fmt(fund?.totalReceived||0)} F`,color:"#7C3AED"},
                  {label:"Contributeurs",value:loading?null:String(fund?.totalContributors||0),color:"#16A34A"},
                  {label:"Projets aidés",value:loading?null:String(fund?.totalProjects||0),color:"#0F7A3D"},
                  {label:"Net aux projets",value:loading?null:`${fmt((fund?.totalReceived||0)*0.9)} F`,color:"#C8860D"},
                ].map(s=>(
                  <div key={s.label} style={{background:"var(--cream-deep)",border:`1px solid ${s.color}20`,borderRadius:16,padding:"18px 14px",textAlign:"center"}}>
                    <div style={{fontSize:20,fontWeight:900,color:s.color,minHeight:28}}>
                      {s.value === null ? <Skeleton h={24} w="70%" /> : s.value}
                    </div>
                    <div style={{fontSize:11.5,color:"var(--ink-faint)",marginTop:6}}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{background:"rgba(124,58,237,0.06)",border:"1px solid rgba(124,58,237,0.14)",borderRadius:14,padding:"14px 18px",textAlign:"center",fontSize:13,color:"var(--ink-soft)",lineHeight:1.7}}>
                <span style={{color:"#7C3AED",fontWeight:700}}>90%</span> va directement aux projets.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BATISSEURS */}
      <section id="batisseurs" className="section section-alt">
        <div className="section-inner">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:80,alignItems:"center"}}>
            <div>
              <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"var(--gold-pale)",border:"1px solid rgba(200,134,13,0.2)",borderRadius:100,padding:"5px 14px",fontSize:11.5,fontWeight:700,color:"#B36B0A",marginBottom:24}}>
                🏗️ Rôle premium — Bâtisseur
              </div>
              <h2 className="section-title">Devenez un<br/><span style={{color:"#B36B0A"}}>Bâtisseur d'avenir</span></h2>
              <p style={{fontSize:17,color:"var(--ink-soft)",lineHeight:1.8,marginBottom:28}}>
                Mécènes, entreprises, fonds — investissez à grande échelle et bénéficiez d'une visibilité exceptionnelle.
              </p>
              {["Reconnaissance publique sur la plateforme","Dashboard dédié avec impact mesuré","Connexion directe avec les entrepreneurs","Hall of Fame des plus grands Bâtisseurs"].map(item=>(
                <div key={item} style={{display:"flex",alignItems:"center",gap:12,marginBottom:13}}>
                  <div style={{width:18,height:18,borderRadius:"50%",background:"var(--gold-pale)",border:"1px solid rgba(200,134,13,0.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:"#C8860D"}}/>
                  </div>
                  <span style={{fontSize:14,color:"var(--ink-soft)"}}>{item}</span>
                </div>
              ))}
              <Link href="/auth/register?role=BUILDER" className="btn-section-primary"
                style={{marginTop:28,background:"linear-gradient(135deg,#C8860D,#B36B0A)",boxShadow:"0 8px 24px rgba(200,134,13,0.28)"}}>
                🏗️ Devenir Bâtisseur →
              </Link>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              {[
                {icon:"🏢",title:"Entreprises",desc:"RSE & impact mesurable",color:"#C8860D"},
                {icon:"🏛️",title:"Institutions",desc:"Partenariats officiels",color:"#0F7A3D"},
                {icon:"🌐",title:"International",desc:"Accès global",color:"#16A34A"},
                {icon:"💎",title:"Mécènes",desc:"Philanthropie moderne",color:"#7C3AED"},
              ].map(b=>(
                <div key={b.title}
                  style={{background:"#fff",border:`1px solid ${b.color}18`,borderRadius:18,padding:"26px 18px",textAlign:"center",transition:"all 0.25s",cursor:"pointer",boxShadow:"0 1px 3px rgba(11,17,32,0.03), 0 8px 20px rgba(11,17,32,0.03)"}}
                  onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.transform="translateY(-4px)";el.style.borderColor=`${b.color}45`;}}
                  onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.transform="translateY(0)";el.style.borderColor=`${b.color}18`;}}>
                  <div style={{fontSize:36,marginBottom:12}}>{b.icon}</div>
                  <div style={{fontWeight:700,fontSize:14,color:"var(--ink)",marginBottom:4}}>{b.title}</div>
                  <div style={{fontSize:12,color:"var(--ink-faint)"}}>{b.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TRANSPARENCE + SIMULATION */}
      <section id="transparence" className="section">
        <div className="section-inner">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:80,alignItems:"start"}}>
            <div>
              <div className="section-eyebrow">Transparence</div>
              <h2 className="section-title">Zéro surprise.<br/><span style={{color:"#0F7A3D"}}>Tous les frais publics.</span></h2>
              <p style={{fontSize:17,color:"var(--ink-soft)",lineHeight:1.8,marginBottom:36}}>
                Tous nos taux sont mis à jour en temps réel. Aucun frais caché.
              </p>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {[
                  {label:"Commission collecte",value:`${fees.commission_baobab_collection||6}%`,note:"Prélevé à la clôture",color:"#DC2626"},
                  {label:"Commission mentor",value:`${fees.commission_mentor||2}%`,note:"Versé au mentor garant",color:"#7C3AED"},
                  {label:"Fonds de garantie",value:`${fees.commission_guarantee||2}%`,note:"Réserve communautaire",color:"#C8860D"},
                  {label:"Payin mensualités",value:`${fees.payin_repayment||4}%`,note:"Frais opérateur absorbés",color:"#0F7A3D"},
                  {label:"Retrait gains",value:`${fees.withdrawal_fee_standard||0}%`,note:"Nous absorbons les frais",color:"#16A34A"},
                ].map(f=>(
                  <div key={f.label} className="fee-row">
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:"var(--ink)"}}>{f.label}</div>
                      <div style={{fontSize:12,color:"var(--ink-faint)",marginTop:3}}>{f.note}</div>
                    </div>
                    <span className="fee-badge" style={{background:`${f.color}14`,color:f.color,border:`1px solid ${f.color}28`}}>{f.value}</span>
                  </div>
                ))}
              </div>
              <Link href="/transparence" style={{display:"inline-block",marginTop:22,color:"#0F7A3D",fontWeight:700,fontSize:13.5}}>
                Page transparence complète →
              </Link>
            </div>
            <div className="sim-card">
              <div style={{fontSize:11,fontWeight:800,color:"#4ADE80",letterSpacing:3,textTransform:"uppercase",marginBottom:6}}>Calculateur</div>
              <h3 style={{fontWeight:900,fontSize:22,marginBottom:4}}>🧮 Simulation</h3>
              <p style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:28}}>Basé sur les taux actuels</p>
              {[
                {l:"Vous investissez",v:`${fmt(simAmount)} F`,c:"#fff",bold:true},
                {l:`Frais clôture (${totalFeesPct}%)`,v:`-${fmt(simFees)} F`,c:"#F87171"},
                {l:"Net dans le projet",v:`${fmt(simNet)} F`,c:"rgba(255,255,255,0.6)"},
                {l:`Retour brut (min ${fees.return_min||23}%)`,v:`+${fmt(simRetour)} F`,c:"#E5A93B"},
                {l:`Payin (${fees.payin_repayment||4}%)`,v:`-${fmt(simPayin)} F`,c:"#86efac"},
                {l:"Retrait gains",v:"Gratuit ✅",c:"#4ADE80"},
              ].map((row,i)=>(
                <div key={i}>
                  <div className="sim-row">
                    <span style={{color:"rgba(255,255,255,0.5)",fontSize:13.5}}>{row.l}</span>
                    <span style={{fontWeight:row.bold?900:700,color:row.c,fontSize:13.5}}>{row.v}</span>
                  </div>
                  {i<5&&<hr className="sim-divider"/>}
                </div>
              ))}
              <div className="sim-result">
                <span style={{fontWeight:700,fontSize:16}}>Vous recevez</span>
                <span style={{fontWeight:900,fontSize:22}}>{fmt(simGain)} F</span>
              </div>
              <div style={{textAlign:"center",marginTop:14,color:"#4ADE80",fontWeight:700,fontSize:15}}>
                Gain net : +{fmt(simGainNet)} F (+{simGainPct}%) 🎉
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-glow"/>
        <div style={{maxWidth:860,margin:"0 auto",textAlign:"center",position:"relative"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.22)",borderRadius:100,padding:"5px 16px",fontSize:11.5,fontWeight:700,color:"#fff",marginBottom:32}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#fff",display:"inline-block"}}/>
            Rejoignez la communauté KORAPACT
          </div>
          <h2 style={{fontSize:"clamp(40px,6vw,76px)",fontWeight:900,letterSpacing:"-3px",lineHeight:1.02,marginBottom:24,color:"#fff"}}>
            Prêt à faire<br/>
            <span style={{color:"#FDE68A"}}>fructifier votre argent ?</span>
          </h2>
          <p style={{fontSize:19,color:"rgba(255,255,255,0.8)",lineHeight:1.75,maxWidth:460,margin:"0 auto 52px"}}>
            Inscription gratuite. Premiers retours en quelques mois.
          </p>
          <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap"}}>
            <Link href="/auth/register?role=INVESTOR" style={{fontSize:15,fontWeight:800,color:"#0F7A3D",padding:"16px 32px",borderRadius:14,background:"#fff",boxShadow:"0 12px 32px rgba(0,0,0,0.15)",display:"inline-block"}}>💰 Investir maintenant</Link>
            <Link href="/auth/register?role=ENTREPRENEUR" style={{fontSize:15,fontWeight:700,color:"#fff",padding:"16px 32px",borderRadius:14,border:"1.5px solid rgba(255,255,255,0.35)",display:"inline-block"}}>🚀 Financer un projet</Link>
            <Link href="/fund" style={{fontSize:15,fontWeight:600,color:"rgba(255,255,255,0.85)",padding:"16px 32px",borderRadius:14,border:"1px solid rgba(255,255,255,0.2)",display:"inline-block"}}>🌱 Fonds Solidaire</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-grid">
            <div>
              <Link href="/" className="logo" style={{marginBottom:20,display:"inline-flex"}}>
                <img src="/logo.png" alt="KORAPACT" style={{width:38,height:38,objectFit:"contain"}} />
                <span className="logo-text" style={{marginLeft:10,color:"#fff"}}>KORAPACT</span>
              </Link>
              <p style={{fontSize:13.5,color:"rgba(255,255,255,0.4)",lineHeight:1.7,marginTop:16,maxWidth:260}}>
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
