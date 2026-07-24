"use client";
import Link from "next/link";
import { useState } from "react";

const SECTIONS = [
  { id: "collecte", title: "1. Données collectées", icon: "📋", content: "KORAPACT collecte :\n\n• Identité : nom, prénom, nationalité\n• Contact : email, téléphone\n• Documents KYC : pièce d'identité, selfie, RCCM/NINEA\n• Données financières : transactions, investissements, retraits\n• Données techniques : adresse IP, navigateur, appareil\n• Données comportementales : pages visitées, clics" },
  { id: "utilisation", title: "2. Utilisation", icon: "🎯", content: "Vos données sont utilisées pour :\n\n• Créer et gérer votre compte\n• Effectuer la vérification KYC\n• Traiter vos transactions\n• Vous envoyer des notifications liées à vos activités\n• Améliorer nos services\n• Prévenir la fraude et respecter nos obligations légales\n\nNous ne vendons jamais vos données à des tiers." },
  { id: "partage", title: "3. Partage", icon: "🤝", content: "Vos données peuvent être partagées avec :\n\n• Prestataires techniques : hébergement, emails\n• Opérateurs mobile money : uniquement pour les transactions\n• Autorités compétentes : en cas d'obligation légale\n\nTout partage est encadré par des accords de confidentialité stricts." },
  { id: "conservation", title: "4. Conservation", icon: "🗄️", content: "Durées de conservation :\n\n• Données de compte actif : pendant toute la relation contractuelle\n• Documents KYC : 5 ans après clôture (obligation LCB-FT)\n• Données de transactions : 10 ans (obligation comptable)\n• Logs techniques : 12 mois maximum\n\nAprès ces délais, vos données sont supprimées ou anonymisées." },
  { id: "droits", title: "5. Vos droits", icon: "⚖️", content: "Vous disposez des droits suivants :\n\n• Droit d'accès : obtenir une copie de vos données\n• Droit de rectification : corriger des données inexactes\n• Droit à l'effacement : sous réserve des obligations légales\n• Droit à la portabilité : recevoir vos données en format structuré\n• Droit d'opposition : au traitement à des fins de marketing\n\nContact : privacy@korapact.com — Délai : 30 jours maximum." },
  { id: "securite", title: "6. Sécurité", icon: "🔒", content: "Mesures de sécurité mises en place :\n\n• Chiffrement SSL/TLS pour toutes les communications\n• Chiffrement des données sensibles en base\n• Authentification JWT à durée limitée\n• Mots de passe hachés bcrypt (jamais en clair)\n• Accès restreint au personnel autorisé\n• Journalisation des accès administrateurs\n• Sauvegardes régulières sur serveurs sécurisés" },
  { id: "cookies", title: "7. Cookies", icon: "🍪", content: "Types de cookies utilisés :\n\n• Cookies essentiels (obligatoires) : authentification, sécurité. Ne peuvent pas être désactivés.\n• Cookies analytiques (optionnels) : mesure d'audience anonymisée.\n• Cookies de personnalisation (optionnels) : préférences d'affichage.\n\nNous n'utilisons pas de cookies publicitaires ou de tracking tiers." },
  { id: "contact", title: "8. Contact", icon: "📬", content: "Responsable du traitement : KORAPACT SAS\n\nEmail dédié : privacy@korapact.com\nEmail général : support@korapact.com\n\nDélai de réponse : 30 jours maximum.\n\nDernière mise à jour : juillet 2026." },
];

export default function PrivacyPage() {
  const [active, setActive] = useState("collecte");
  return (
    <>
      <nav style={{position:"fixed",top:0,width:"100%",zIndex:100,background:"rgba(5,8,16,0.92)",backdropFilter:"blur(24px)",borderBottom:"1px solid rgba(255,255,255,0.07)",padding:"0 32px"}}>
        <div style={{maxWidth:1280,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:68}}>
          <Link href="/" style={{display:"flex",alignItems:"center",gap:10}}>
            <div className="logo-mark">K</div>
            <span className="logo-text">KORAPACT</span>
          </Link>
          <Link href="/" style={{fontSize:13,color:"rgba(255,255,255,0.5)",fontWeight:500}}>← Retour</Link>
        </div>
      </nav>
      <div style={{minHeight:"100vh",background:"var(--dark)",paddingTop:68}}>
        <div style={{background:"linear-gradient(180deg,rgba(139,92,246,0.08) 0%,transparent 100%)",borderBottom:"1px solid rgba(255,255,255,0.07)",padding:"64px 32px 48px"}}>
          <div style={{maxWidth:1280,margin:"0 auto"}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(139,92,246,0.1)",border:"1px solid rgba(139,92,246,0.25)",borderRadius:100,padding:"5px 14px",fontSize:11.5,fontWeight:700,color:"#C4B5FD",marginBottom:24}}>🔒 Vie privée</div>
            <h1 style={{fontSize:"clamp(32px,5vw,56px)",fontWeight:900,letterSpacing:"-2px",marginBottom:16}}>Politique de<br/><span style={{background:"linear-gradient(135deg,#8B5CF6,#06B6D4)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Confidentialité</span></h1>
            <p style={{fontSize:15,color:"rgba(255,255,255,0.4)"}}>Dernière mise à jour : juillet 2026</p>
            <div style={{display:"flex",gap:24,marginTop:20,flexWrap:"wrap"}}>
              {[{icon:"🚫",label:"Données jamais vendues"},{icon:"🔒",label:"Chiffrement SSL/TLS"},{icon:"✅",label:"Droits RGPD respectés"}].map(b=>(
                <div key={b.label} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"rgba(255,255,255,0.45)"}}>
                  <span>{b.icon}</span><span>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{maxWidth:1280,margin:"0 auto",padding:"64px 32px",display:"grid",gridTemplateColumns:"260px 1fr",gap:48,alignItems:"start"}}>
          <div style={{position:"sticky",top:96,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:20,padding:20}}>
            <div style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.3)",letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>Sommaire</div>
            {SECTIONS.map(s => (
              <a key={s.id} href={"#"+s.id} onClick={() => setActive(s.id)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:12,marginBottom:4,fontSize:13,fontWeight:active===s.id?700:500,color:active===s.id?"#C4B5FD":"rgba(255,255,255,0.42)",background:active===s.id?"rgba(139,92,246,0.1)":"transparent",transition:"all 0.2s",borderLeft:active===s.id?"2px solid #8B5CF6":"2px solid transparent"}}>
                <span>{s.icon}</span><span>{s.title}</span>
              </a>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:24}}>
            {SECTIONS.map(s => (
              <div key={s.id} id={s.id} style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:24,padding:40,scrollMarginTop:96}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                  <span style={{fontSize:28}}>{s.icon}</span>
                  <h2 style={{fontSize:20,fontWeight:800}}>{s.title}</h2>
                </div>
                <div style={{fontSize:14.5,color:"rgba(255,255,255,0.52)",lineHeight:1.85,whiteSpace:"pre-line"}}>{s.content}</div>
              </div>
            ))}
            <div style={{background:"linear-gradient(135deg,rgba(139,92,246,0.12),rgba(6,182,212,0.08))",border:"1px solid rgba(139,92,246,0.2)",borderRadius:24,padding:40,textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:16}}>🔐</div>
              <h3 style={{fontSize:20,fontWeight:800,marginBottom:10}}>Exercer vos droits</h3>
              <p style={{fontSize:14,color:"rgba(255,255,255,0.45)",marginBottom:24}}>Réponse sous 30 jours maximum.</p>
              <a href="mailto:privacy@korapact.com" style={{display:"inline-block",background:"linear-gradient(135deg,#8B5CF6,#6D28D9)",color:"#fff",fontWeight:700,fontSize:14,padding:"13px 28px",borderRadius:14}}>privacy@korapact.com →</a>
            </div>
          </div>
        </div>
        <div style={{borderTop:"1px solid rgba(255,255,255,0.07)",padding:32,textAlign:"center"}}>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.2)"}}>© 2026 KORAPACT · <Link href="/privacy" style={{color:"rgba(255,255,255,0.35)"}}>Confidentialité</Link> · <Link href="/cgu" style={{color:"rgba(255,255,255,0.35)"}}>CGU</Link></p>
        </div>
      </div>
    </>
  );
}
