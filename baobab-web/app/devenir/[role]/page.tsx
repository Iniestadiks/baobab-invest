"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";

const ROLE_DATA: Record<string, {
  key: string; label: string; icon: string; color: string;
  headline: string; sub: string;
  stats: { label: string; value: string }[];
  steps: { icon: string; title: string; desc: string }[];
  faq: { q: string; a: string }[];
  ctaLabel: string;
}> = {
  investisseur: {
    key: "INVESTOR", label: "Investisseur", icon: "💼", color: "#0F7A3D",
    headline: "Faites fructifier votre argent en soutenant des entrepreneurs vérifiés.",
    sub: "Investissez dès 5 000 F dans des projets analysés par notre équipe, avec un mentor garant, et percevez des retours mensuels transparents.",
    stats: [
      { label: "Investissement minimum", value: "5 000 F" },
      { label: "Retour minimum", value: "+23%" },
      { label: "Vérification KYC", value: "24h" },
      { label: "Retrait des gains", value: "Gratuit" },
    ],
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
    faq: [
      { q: "Que se passe-t-il si l'entrepreneur ne rembourse pas ?", a: "Un Fonds de Garantie communautaire (2% par investissement) peut couvrir partiellement les défauts de paiement." },
      { q: "Puis-je retirer mon argent avant la fin du projet ?", a: "Non, les fonds investis sont bloqués jusqu'au remboursement, comme pour tout investissement participatif." },
      { q: "Combien de temps dure un projet ?", a: "La durée varie selon le projet, généralement entre 6 et 24 mois, indiquée avant l'investissement." },
    ],
    ctaLabel: "Commencer à investir",
  },
  entrepreneur: {
    key: "ENTREPRENEUR", label: "Entrepreneur", icon: "🚀", color: "#16A34A",
    headline: "Financez votre projet sans passer par une banque.",
    sub: "Soumettez votre dossier, présentez-le en vidéo, et laissez la communauté vous faire confiance. Fonds débloqués par paliers, à votre rythme.",
    stats: [
      { label: "Validation dossier", value: "48h" },
      { label: "Financement possible en", value: "30 jours" },
      { label: "Commission collecte", value: "6%" },
      { label: "Paliers de déblocage", value: "3" },
    ],
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
    faq: [
      { q: "Quels documents dois-je fournir ?", a: "Pièce d'identité, selfie de vérification, et pour les entreprises un RCCM et/ou NINEA." },
      { q: "Que se passe-t-il si mon projet n'atteint pas l'objectif ?", a: "Les fonds collectés sont remboursés aux investisseurs, le projet n'est pas financé." },
      { q: "Puis-je avoir un mentor ?", a: "Oui, un mentor peut parrainer votre projet et renforcer sa crédibilité auprès des investisseurs." },
    ],
    ctaLabel: "Soumettre mon projet",
  },
  mentor: {
    key: "MENTOR", label: "Mentor", icon: "🎓", color: "#7C3AED",
    headline: "Accompagnez des entrepreneurs et soyez rémunéré pour votre expertise.",
    sub: "Parrainez des projets prometteurs, renforcez leur crédibilité auprès des investisseurs, et percevez une commission à la clôture.",
    stats: [
      { label: "Commission mentor", value: "2%" },
      { label: "Vérification KYC", value: "24h" },
      { label: "Versement", value: "À la clôture" },
      { label: "Projets suivis", value: "Illimité" },
    ],
    steps: [
      { icon: "👤", title: "Créez votre compte", desc: "Inscription en 2 minutes, choisissez le rôle Mentor." },
      { icon: "🪪", title: "Vérification KYC", desc: "Pièce d'identité + selfie. Validation sous 24h par l'équipe." },
      { icon: "🤝", title: "Parrainez un projet", desc: "Accompagnez un entrepreneur dans la préparation de son dossier." },
      { icon: "✅", title: "Co-validation du projet", desc: "Votre garantie renforce la crédibilité auprès des investisseurs." },
      { icon: "🌱", title: "Suivi de la collecte", desc: "Le projet parrainé est visible avec votre badge de mentor garant." },
      { icon: "💰", title: "Commission à la clôture", desc: "Vous percevez votre commission une fois le projet remboursé." },
    ],
    faq: [
      { q: "Comment choisir un projet à parrainer ?", a: "Vous pouvez parcourir les projets soumis et proposer votre parrainage à l'entrepreneur." },
      { q: "Suis-je responsable en cas de défaut ?", a: "Non, votre rôle est un accompagnement et une caution de crédibilité, pas une garantie financière personnelle." },
      { q: "Combien de projets puis-je suivre en même temps ?", a: "Aucune limite — vous pouvez parrainer autant de projets que vous le souhaitez." },
    ],
    ctaLabel: "Devenir mentor",
  },
  batisseur: {
    key: "BUILDER", label: "Bâtisseur", icon: "🏗️", color: "#C8860D",
    headline: "Soutenez la communauté à grande échelle, sans démarche complexe.",
    sub: "Mécènes, entreprises, institutions — contribuez au Fonds Solidaire KORAPACT et suivez l'impact concret de votre don, sans KYC requis.",
    stats: [
      { label: "KYC requis", value: "Aucun" },
      { label: "Contribution minimum", value: "5 000 F" },
      { label: "Reversé aux projets", value: "90%" },
      { label: "Niveaux de reconnaissance", value: "5" },
    ],
    steps: [
      { icon: "👤", title: "Créez votre compte", desc: "Inscription en 2 minutes — aucun KYC requis pour ce rôle." },
      { icon: "🌱", title: "Contribuez au Fonds Solidaire", desc: "Don libre, dès 5 000 F, avec ou sans création de compte." },
      { icon: "🎯", title: "Choisissez votre impact", desc: "Fonds général ou allocation ciblée vers un projet précis." },
      { icon: "📊", title: "Suivez l'impact en temps réel", desc: "Visualisez où va votre contribution et son effet concret." },
      { icon: "🏅", title: "Recevez votre badge", desc: "Reconnaissance publique selon votre niveau de contribution." },
      { icon: "👑", title: "Rejoignez le Hall of Fame", desc: "Classement des plus grands Bâtisseurs de la communauté." },
    ],
    faq: [
      { q: "Pourquoi pas de KYC pour les Bâtisseurs ?", a: "Vous êtes donateur, pas investisseur — vous ne recevez pas de retour financier, donc pas de vérification d'identité requise." },
      { q: "Puis-je cibler un projet précis ?", a: "Oui, vous pouvez orienter votre contribution vers le Fonds général ou un projet spécifique." },
      { q: "Mon don est-il public ?", a: "Vous choisissez d'apparaître publiquement ou de rester anonyme sur le classement." },
    ],
    ctaLabel: "Devenir Bâtisseur",
  },
};

export default function RolePage() {
  const params = useParams();
  const roleKey = (params?.role as string) || "";
  const role = ROLE_DATA[roleKey];

  if (!role) {
    return (
      <div style={{minHeight:"100vh",background:"var(--cream)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20}}>
        <h1 style={{fontSize:28,fontWeight:900,color:"var(--ink)"}}>Rôle introuvable</h1>
        <Link href="/" className="btn-hero-primary">← Retour à l&apos;accueil</Link>
      </div>
    );
  }

  return (
    <>
      <nav style={{position:"fixed",top:0,width:"100%",zIndex:100,background:"rgba(251,250,247,0.9)",backdropFilter:"blur(20px)",borderBottom:"1px solid var(--line)",padding:"0 32px"}}>
        <div style={{maxWidth:1280,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:72}}>
          <Link href="/" style={{display:"flex",alignItems:"center",gap:10}}>
            <img src="/logo.png" alt="KORAPACT" style={{width:38,height:38,objectFit:"contain"}} />
            <span className="logo-text">KORAPACT</span>
          </Link>
          <Link href="/" style={{fontSize:13,color:"var(--ink-soft)",fontWeight:600}}>← Retour</Link>
        </div>
      </nav>

      <div style={{minHeight:"100vh",background:"var(--cream)",paddingTop:72}}>
        {/* HERO */}
        <div style={{background:`linear-gradient(180deg,${role.color}0D 0%,transparent 100%)`,borderBottom:"1px solid var(--line)",padding:"72px 32px 56px"}}>
          <div style={{maxWidth:900,margin:"0 auto",textAlign:"center"}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:8,background:`${role.color}12`,border:`1px solid ${role.color}30`,borderRadius:100,padding:"6px 16px",fontSize:12,fontWeight:700,color:role.color,marginBottom:24}}>
              {role.icon} Devenir {role.label}
            </div>
            <h1 style={{fontSize:"clamp(30px,5vw,48px)",fontWeight:900,letterSpacing:"-1.5px",marginBottom:20,color:"var(--ink)",lineHeight:1.1}}>{role.headline}</h1>
            <p style={{fontSize:17,color:"var(--ink-soft)",lineHeight:1.75,maxWidth:620,margin:"0 auto 36px"}}>{role.sub}</p>
            <Link href={`/auth/register?role=${role.key}`} className="btn-hero-primary" style={{background:`linear-gradient(135deg,${role.color},${role.color}cc)`}}>
              {role.ctaLabel} →
            </Link>
          </div>
        </div>

        {/* STATS */}
        <div style={{maxWidth:1000,margin:"0 auto",padding:"48px 32px 0"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
            {role.stats.map(s => (
              <div key={s.label} style={{background:"#fff",border:"1px solid var(--line)",borderRadius:16,padding:"20px 16px",textAlign:"center",boxShadow:"0 1px 3px rgba(11,17,32,0.03)"}}>
                <div style={{fontSize:20,fontWeight:900,color:role.color}}>{s.value}</div>
                <div style={{fontSize:11.5,color:"var(--ink-faint)",marginTop:4}}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* TIMELINE */}
        <div className="section">
          <div className="section-inner">
            <div className="section-header" style={{textAlign:"center"}}>
              <div className="section-eyebrow" style={{color:role.color}}>Le parcours</div>
              <h2 className="section-title">Étape par étape</h2>
            </div>
            <div className="timeline">
              {role.steps.map((s, i) => (
                <div key={i} className="timeline-item">
                  <div className="timeline-dot" style={{background:`${role.color}12`,color:role.color}}>{s.icon}</div>
                  <div className="timeline-content">
                    <div className="timeline-tag" style={{background:`${role.color}12`,color:role.color}}>Étape {i+1}</div>
                    <div className="timeline-title">{s.title}</div>
                    <div className="timeline-desc">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="section section-alt">
          <div className="section-inner" style={{maxWidth:760}}>
            <div className="section-header" style={{textAlign:"center"}}>
              <div className="section-eyebrow" style={{color:role.color}}>Questions fréquentes</div>
              <h2 className="section-title">Ce qu&apos;il faut savoir</h2>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {role.faq.map((f, i) => (
                <div key={i} style={{background:"#fff",border:"1px solid var(--line)",borderRadius:18,padding:24,boxShadow:"0 1px 3px rgba(11,17,32,0.03)"}}>
                  <div style={{fontWeight:800,fontSize:15,color:"var(--ink)",marginBottom:8}}>{f.q}</div>
                  <div style={{fontSize:14,color:"var(--ink-soft)",lineHeight:1.7}}>{f.a}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA FINAL */}
        <section className="cta-section">
          <div className="cta-glow"/>
          <div style={{maxWidth:700,margin:"0 auto",textAlign:"center",position:"relative"}}>
            <h2 style={{fontSize:"clamp(28px,4vw,42px)",fontWeight:900,letterSpacing:"-1.5px",marginBottom:20,color:"#fff"}}>
              Prêt à devenir {role.label} ?
            </h2>
            <p style={{fontSize:17,color:"rgba(255,255,255,0.8)",lineHeight:1.7,marginBottom:36}}>
              Inscription gratuite, en moins de 2 minutes.
            </p>
            <Link href={`/auth/register?role=${role.key}`} style={{fontSize:15,fontWeight:800,color:"#0F7A3D",padding:"16px 32px",borderRadius:14,background:"#fff",boxShadow:"0 12px 32px rgba(0,0,0,0.15)",display:"inline-block"}}>
              {role.ctaLabel} →
            </Link>
          </div>
        </section>

        <div style={{borderTop:"1px solid var(--line)",padding:32,textAlign:"center",background:"var(--ink)"}}>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>© 2026 KORAPACT · <Link href="/cgu" style={{color:"rgba(255,255,255,0.5)"}}>CGU</Link> · <Link href="/privacy" style={{color:"rgba(255,255,255,0.5)"}}>Confidentialité</Link></p>
        </div>
      </div>
    </>
  );
}
