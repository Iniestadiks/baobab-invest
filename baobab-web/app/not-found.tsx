"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
export default function NotFound() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const fn = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", fn);
    return () => window.removeEventListener("mousemove", fn);
  }, []);
  return (
    <>
      <div className="cursor-glow" style={{left:mousePos.x,top:mousePos.y}}/>
      <nav style={{position:"fixed",top:0,width:"100%",zIndex:100,background:"rgba(251,250,247,0.9)",backdropFilter:"blur(20px)",borderBottom:"1px solid var(--line)",padding:"0 32px"}}>
        <div style={{maxWidth:1280,margin:"0 auto",display:"flex",alignItems:"center",height:72}}>
          <Link href="/" style={{display:"flex",alignItems:"center",gap:10}}>
            <img src="/logo.png" alt="KORAPACT" style={{width:38,height:38,objectFit:"contain"}} />
            <span className="logo-text">KORAPACT</span>
          </Link>
        </div>
      </nav>
      <div style={{minHeight:"100vh",background:"var(--cream)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,textAlign:"center",position:"relative",overflow:"hidden",paddingTop:72}}>
        <div style={{position:"absolute",width:700,height:700,borderRadius:"50%",background:"radial-gradient(circle,rgba(15,122,61,0.08) 0%,transparent 70%)",top:"45%",left:"50%",transform:"translate(-50%,-50%)",pointerEvents:"none"}}/>
        <div style={{position:"absolute",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(200,134,13,0.06) 0%,transparent 70%)",top:"55%",right:"10%",pointerEvents:"none"}}/>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{fontSize:"clamp(100px,20vw,200px)",fontWeight:900,lineHeight:1,letterSpacing:"-8px",background:"linear-gradient(135deg,#0F7A3D,#C8860D)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",marginBottom:8}}>404</div>
          <div style={{width:80,height:3,background:"linear-gradient(90deg,#0F7A3D,#C8860D)",borderRadius:2,margin:"0 auto 32px"}}/>
          <h1 style={{fontSize:"clamp(24px,4vw,40px)",fontWeight:900,letterSpacing:"-1.5px",marginBottom:16,color:"var(--ink)"}}>Page introuvable</h1>
          <p style={{fontSize:17,color:"var(--ink-soft)",lineHeight:1.7,maxWidth:440,margin:"0 auto 48px"}}>
            La page que vous cherchez n&apos;existe pas ou a été déplacée.
          </p>
          <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap",marginBottom:64}}>
            <Link href="/" className="btn-hero-primary">← Accueil</Link>
            <Link href="/projects" className="btn-hero-ghost">Explorer les projets</Link>
          </div>
          <div style={{display:"flex",gap:32,justifyContent:"center",flexWrap:"wrap"}}>
            {[{label:"Projets",href:"/projects",icon:"📋"},{label:"Fonds Solidaire",href:"/fund",icon:"🌱"},{label:"Transparence",href:"/transparence",icon:"🔍"},{label:"Support",href:"mailto:support@korapact.com",icon:"💬"}].map(l=>(
              <Link key={l.label} href={l.href} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,color:"var(--ink-faint)",fontSize:12,fontWeight:600,transition:"color 0.2s"}}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color="#0F7A3D"}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color="var(--ink-faint)"}>
                <span style={{fontSize:24}}>{l.icon}</span>{l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
