"use client";
import Link from "next/link";
import { useState } from "react";

const SECTIONS = [
  { id: "objet", title: "1. Objet", content: "Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme KORAPACT, accessible à l'adresse korapact.com.\n\nEn créant un compte, vous acceptez sans réserve les présentes CGU." },
  { id: "services", title: "2. Services proposés", content: "KORAPACT est une plateforme d'investissement communautaire permettant :\n\n• Aux investisseurs de financer des projets vérifiés et percevoir des retours\n• Aux entrepreneurs de lever des fonds sans recours bancaire\n• Aux mentors de parrainer des projets et percevoir une commission\n• Aux Bâtisseurs de contribuer au Fonds Solidaire KORAPACT\n\nKORAPACT ne garantit pas les rendements présentés, qui sont des projections." },
  { id: "inscription", title: "3. Inscription et KYC", content: "3.1 L'utilisation est réservée aux personnes majeures (18 ans et plus).\n\n3.2 Vous êtes responsable de la confidentialité de vos identifiants.\n\n3.3 La vérification KYC est obligatoire pour investir ou lever des fonds :\n• Pièce d'identité valide (CNI ou passeport)\n• Selfie de vérification\n• Pour les entrepreneurs : RCCM et/ou NINEA" },
  { id: "investissement", title: "4. Investissement et risques", content: "4.1 Tout investissement comporte des risques :\n• Risque de perte partielle ou totale du capital\n• Risque de retard ou défaut de remboursement\n• Risque de liquidité — les investissements ne sont pas remboursables avant la fin du projet\n\n4.2 Le Fonds de Garantie (2%) peut partiellement couvrir les défauts.\n\n4.3 Les frais sont consultables en temps réel sur la page Transparence." },
  { id: "wallet", title: "5. Wallet et transactions", content: "5.1 Les fonds déposés sont conservés en compte séquestre et ne sont pas des dépôts bancaires.\n\n5.2 Les retraits sont traités sous 24 à 72h ouvrées après validation.\n\n5.3 Des frais s'appliquent selon les conditions en vigueur (voir page Transparence)." },
  { id: "responsabilites", title: "6. Responsabilités", content: "KORAPACT ne peut être tenu responsable :\n• Des décisions d'investissement des utilisateurs\n• Des défauts de remboursement des entrepreneurs\n• Des interruptions de service dues à des causes techniques indépendantes\n\nVous êtes seul responsable de vos décisions d'investissement et de la sécurité de vos identifiants." },
  { id: "donnees", title: "7. Données personnelles", content: "KORAPACT traite vos données conformément à sa Politique de Confidentialité disponible sur korapact.com/privacy.\n\nVous disposez d'un droit d'accès, rectification et suppression de vos données.\nContact : privacy@korapact.com" },
  { id: "droit", title: "8. Droit applicable", content: "Les présentes CGU sont soumises au droit applicable dans les pays membres de l'UEMOA et de la CEMAC.\n\nEn cas de litige, une résolution amiable sera recherchée en priorité.\n\nContact : support@korapact.com" },
];

export default function CGUPage() {
  const [active, setActive] = useState("objet");
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
        <div style={{background:"linear-gradient(180deg,rgba(15,122,61,0.05) 0%,transparent 100%)",borderBottom:"1px solid var(--line)",padding:"64px 32px 48px"}}>
          <div style={{maxWidth:1280,margin:"0 auto"}}>
            <div className="badge-light" style={{marginBottom:24,width:"fit-content"}}>📄 Document légal</div>
            <h1 style={{fontSize:"clamp(32px,5vw,56px)",fontWeight:900,letterSpacing:"-2px",marginBottom:16,color:"var(--ink)"}}>Conditions Générales<br/><span style={{color:"#0F7A3D"}}>d&apos;Utilisation</span></h1>
            <p style={{fontSize:15,color:"var(--ink-soft)"}}>Dernière mise à jour : juillet 2026</p>
          </div>
        </div>
        <div style={{maxWidth:1280,margin:"0 auto",padding:"64px 32px",display:"grid",gridTemplateColumns:"260px 1fr",gap:48,alignItems:"start"}}>
          <div style={{position:"sticky",top:96,background:"#fff",border:"1px solid var(--line)",borderRadius:20,padding:20,boxShadow:"0 1px 3px rgba(11,17,32,0.03)"}}>
            <div style={{fontSize:11,fontWeight:800,color:"var(--ink-faint)",letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>Sommaire</div>
            {SECTIONS.map(s => (
              <a key={s.id} href={"#"+s.id} onClick={() => setActive(s.id)}
                style={{display:"block",padding:"10px 14px",borderRadius:12,marginBottom:4,fontSize:13,fontWeight:active===s.id?700:500,color:active===s.id?"#0F7A3D":"var(--ink-soft)",background:active===s.id?"var(--emerald-pale)":"transparent",transition:"all 0.2s",borderLeft:active===s.id?"2px solid #0F7A3D":"2px solid transparent"}}>
                {s.title}
              </a>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:24}}>
            {SECTIONS.map(s => (
              <div key={s.id} id={s.id} style={{background:"#fff",border:"1px solid var(--line)",borderRadius:24,padding:40,scrollMarginTop:96,boxShadow:"0 1px 3px rgba(11,17,32,0.03), 0 8px 20px rgba(11,17,32,0.02)"}}>
                <h2 style={{fontSize:20,fontWeight:800,marginBottom:20,color:"var(--ink)"}}>{s.title}</h2>
                <div style={{fontSize:14.5,color:"var(--ink-soft)",lineHeight:1.85,whiteSpace:"pre-line"}}>{s.content}</div>
              </div>
            ))}
            <div style={{background:"linear-gradient(135deg,rgba(15,122,61,0.06),rgba(22,163,74,0.04))",border:"1px solid rgba(15,122,61,0.14)",borderRadius:24,padding:40,textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:16}}>💬</div>
              <h3 style={{fontSize:20,fontWeight:800,marginBottom:10,color:"var(--ink)"}}>Une question ?</h3>
              <p style={{fontSize:14,color:"var(--ink-soft)",marginBottom:24}}>Notre équipe répond sous 48h ouvrées.</p>
              <a href="mailto:support@korapact.com" style={{display:"inline-block",background:"linear-gradient(135deg,#0F7A3D,#16A34A)",color:"#fff",fontWeight:700,fontSize:14,padding:"13px 28px",borderRadius:14,boxShadow:"0 8px 20px rgba(15,122,61,0.25)"}}>Contacter le support →</a>
            </div>
          </div>
        </div>
        <div style={{borderTop:"1px solid var(--line)",padding:32,textAlign:"center"}}>
          <p style={{fontSize:12,color:"var(--ink-faint)"}}>© 2026 KORAPACT · <Link href="/privacy" style={{color:"var(--ink-soft)"}}>Confidentialité</Link> · <Link href="/cgu" style={{color:"var(--ink-soft)"}}>CGU</Link></p>
        </div>
      </div>
    </>
  );
}
