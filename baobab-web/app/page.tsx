"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://46.202.132.161:3001";

function fmt(n: number) {
  return Math.round(n).toLocaleString("fr-FR");
}

export default function LandingPage() {
  const [stats, setStats] = useState<any>({ totalRaised: 0, activeProjects: 0, totalUsers: 0, kycVerified: 0 });
  const [projects, setProjects] = useState<any[]>([]);
  const [fund, setFund] = useState<any>({ totalReceived: 0, totalContributors: 0, totalProjects: 0 });
  const [fees, setFees] = useState<any>({ commission_baobab_collection: 6, commission_mentor: 2, commission_guarantee: 2, payin_repayment: 4, return_min: 23, withdrawal_fee_standard: 0 });
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/projects?limit=3&status=ACTIVE`).then(r => r.json()).then(d => { if (d.success) setProjects(d.data?.projects || []); }).catch(() => {});
    fetch(`${API}/api/admin/stats/charts`).then(r => r.json()).then(d => { if (d.success) setStats(d.data?.kpis || {}); }).catch(() => {});
    fetch(`${API}/api/fund/stats`).then(r => r.json()).then(d => { if (d.success) setFund(d.data?.fund || {}); }).catch(() => {});
    fetch(`${API}/api/config/public`).then(r => r.json()).then(d => {
      if (d.success) {
        const cfg: any = {};
        d.data.forEach((c: any) => { cfg[c.key] = Number(c.value); });
        setFees(cfg);
      }
    }).catch(() => {});
  }, []);

  // Calcul simulation dynamique depuis la config
  const simAmount = 100000;
  const totalFeesPct = (fees.commission_baobab_collection || 6) + (fees.commission_mentor || 2) + (fees.commission_guarantee || 2);
  const simFees = Math.round(simAmount * totalFeesPct / 100);
  const simNet = simAmount - simFees;
  const simRetour = Math.round(simNet * (1 + (fees.return_min || 23) / 100));
  const simPayin = Math.round(simRetour * (fees.payin_repayment || 4) / 100);
  const simGain = simRetour - simPayin;
  const simGainNet = simGain - simAmount;
  const simGainPct = ((simGainNet / simAmount) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ═══ NAVBAR ═══ */}
      <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">🌳</span>
            </div>
            <span className="font-bold text-gray-900 text-lg">BAOBAB INVEST</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#comment" className="hover:text-green-600 transition-colors">Comment ça marche</a>
            <a href="#projets" className="hover:text-green-600 transition-colors">Projets</a>
            <Link href="/fund" className="hover:text-green-600 transition-colors flex items-center gap-1">
              🌱 Fonds Solidaire
            </Link>
            <a href="#batisseurs" className="hover:text-green-600 transition-colors">Bâtisseurs</a>
            <Link href="/batisseurs" className="hover:text-green-600 transition-colors">🏆 Hall of Fame</Link>
            <Link href="/transparence" className="hover:text-green-600 transition-colors">Transparence</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="hidden sm:block text-sm text-gray-600 hover:text-green-600 font-medium">
              Connexion
            </Link>
            <Link href="/auth/register" className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors shadow-sm">
              Commencer →
            </Link>
            <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden p-2 text-gray-600">
              {mobileMenu ? "✕" : "☰"}
            </button>
          </div>
        </div>
        {mobileMenu && (
          <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-3 text-sm">
            <a href="#comment" className="block text-gray-600 hover:text-green-600">Comment ça marche</a>
            <a href="#projets" className="block text-gray-600 hover:text-green-600">Projets</a>
            <Link href="/fund" className="block text-gray-600 hover:text-green-600">🌱 Fonds Solidaire</Link>
            <a href="#batisseurs" className="block text-gray-600 hover:text-green-600">Bâtisseurs</a>
            <Link href="/transparence" className="block text-gray-600 hover:text-green-600">Transparence</Link>
            <Link href="/auth/login" className="block text-gray-600 hover:text-green-600">Connexion</Link>
          </div>
        )}
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="pt-20 pb-0 bg-gradient-to-br from-green-950 via-green-900 to-green-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-yellow-400 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-green-400 rounded-full blur-3xl"></div>
        </div>
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-20 relative">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur text-white text-xs px-4 py-2 rounded-full mb-6 border border-white/20">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Plateforme de micro-investissement UEMOA / CEMAC · Africa First 🌍
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Investissez dans<br />
              <span className="text-yellow-400">l'Afrique de demain</span>
            </h1>
            <p className="text-green-100 text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
              Soutenez les jeunes entrepreneurs africains, faites fructifier votre épargne,
              ou contribuez au <strong className="text-yellow-300">Fonds Solidaire BAOBAB</strong>.
              À partir de <strong>500 FCFA</strong>.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-4">
              <Link href="/auth/register" className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-8 py-4 rounded-2xl text-lg transition-all transform hover:scale-105 shadow-xl">
                💰 Investir maintenant
              </Link>
              <Link href="/fund" className="bg-white/20 hover:bg-white/30 text-white font-bold px-8 py-4 rounded-2xl text-lg transition-all border border-white/30 backdrop-blur flex items-center gap-2 justify-center">
                🌱 Fonds Solidaire
              </Link>
            </div>
            <div className="flex flex-wrap justify-center gap-3 text-sm">
              <Link href="/projects" className="text-green-300 hover:text-white underline underline-offset-2">Explorer les projets →</Link>
              <span className="text-green-500">·</span>
              <Link href="/transparence" className="text-green-300 hover:text-white underline underline-offset-2">Voir les frais →</Link>
            </div>
          </div>

          {/* Stats temps réel */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total levé", value: `${((stats.totalRaised || 0) / 1000000).toFixed(1)}M FCFA`, icon: "💰", sub: "Capital investi" },
              { label: "Projets actifs", value: String(stats.activeProjects || 0), icon: "🚀", sub: "En cours de financement" },
              { label: "Membres", value: String(stats.totalUsers || 0), icon: "👥", sub: "Communauté BAOBAB" },
              { label: "Fonds Solidaire", value: `${fmt(fund.totalReceived || 0)} F`, icon: "🌱", sub: `${fund.totalContributors || 0} contributeurs` },
            ].map(s => (
              <div key={s.label} className="bg-white/10 backdrop-blur rounded-2xl p-5 text-center border border-white/15 hover:bg-white/15 transition-colors">
                <div className="text-2xl mb-2">{s.icon}</div>
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-green-200 text-xs mt-1 font-medium">{s.label}</div>
                <div className="text-green-400 text-xs mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Vague de transition */}
        <div className="relative h-16 overflow-hidden">
          <svg viewBox="0 0 1200 80" className="absolute bottom-0 w-full" preserveAspectRatio="none">
            <path d="M0,40 C300,80 900,0 1200,40 L1200,80 L0,80 Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* ═══ 4 PROFILS ═══ */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Une plateforme pour tous</h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">Quel que soit votre rôle, BAOBAB INVEST vous accompagne.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { role: "Investisseur", icon: "💼", color: "border-green-200 hover:border-green-400", bg: "bg-green-50", btn: "bg-green-600", desc: "Faites fructifier votre épargne en finançant des projets vérifiés. Retour minimum garanti.", gain: `+${fees.return_min || 23}% minimum`, href: "/auth/register?role=INVESTOR" },
              { role: "Entrepreneur", icon: "🚀", color: "border-blue-200 hover:border-blue-400", bg: "bg-blue-50", btn: "bg-blue-600", desc: "Obtenez un financement communautaire pour votre projet. Simple, rapide et sans banque.", gain: "Financé en 30 jours", href: "/auth/register?role=ENTREPRENEUR" },
              { role: "Mentor", icon: "🎓", color: "border-purple-200 hover:border-purple-400", bg: "bg-purple-50", btn: "bg-purple-600", desc: "Parrainez des projets, engagez votre réputation et touchez une commission à la clôture.", gain: `${fees.commission_mentor || 2}% à la clôture`, href: "/auth/register?role=MENTOR" },
              { role: "Bâtisseur", icon: "🏗️", color: "border-yellow-200 hover:border-yellow-400", bg: "bg-yellow-50", btn: "bg-yellow-500", desc: "Mécènes, entreprises et institutions : soutenez les jeunes talents africains à grande échelle.", gain: "Impact & visibilité", href: "/auth/register?role=BUILDER" },
            ].map(p => (
              <div key={p.role} className={`border-2 ${p.color} ${p.bg} rounded-3xl p-6 transition-all hover:shadow-lg group`}>
                <div className="text-4xl mb-4">{p.icon}</div>
                <h3 className="font-bold text-gray-900 text-xl mb-2">{p.role}</h3>
                <p className="text-gray-600 text-sm mb-4 leading-relaxed">{p.desc}</p>
                <div className="text-xs font-bold text-gray-500 bg-white rounded-xl px-3 py-1.5 inline-block mb-4">{p.gain}</div>
                <Link href={p.href} className={`block text-center ${p.btn} text-white font-bold py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity`}>
                  Commencer →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FONDS SOLIDAIRE ═══ */}
      <section className="py-20 bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full mb-4">
                🌱 NOUVEAU — Fonds Solidaire
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Le <span className="text-green-600">Fonds Solidaire</span><br />BAOBAB
              </h2>
              <p className="text-gray-600 text-lg mb-6 leading-relaxed">
                Une cagnotte participative communautaire où chacun contribue selon ses moyens 
                pour financer les rêves des jeunes entrepreneurs africains.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  { icon: "💝", text: "Contribution dès 500 FCFA — anonyme ou publique" },
                  { icon: "🌍", text: "Avec ou sans compte — ouvert à tous" },
                  { icon: "📊", text: "100% transparent — chaque franc tracé" },
                  { icon: "🏆", text: "Badges et reconnaissance pour les contributeurs" },
                ].map(i => (
                  <div key={i.text} className="flex items-center gap-3">
                    <span className="text-xl">{i.icon}</span>
                    <span className="text-gray-700 text-sm">{i.text}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Link href="/fund" className="bg-green-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-green-700 transition-colors">
                  🌱 Contribuer
                </Link>
                <Link href="/fund" className="border border-green-300 text-green-700 font-medium px-6 py-3 rounded-xl hover:bg-green-50 transition-colors">
                  Voir le fonds →
                </Link>
              </div>
            </div>
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-green-100">
              <h3 className="font-bold text-gray-900 text-xl mb-6 text-center">🏆 Impact du fonds</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  { label: "Total collecté", value: `${fmt(fund.totalReceived || 0)} FCFA`, color: "text-green-700", bg: "bg-green-50" },
                  { label: "Contributeurs", value: String(fund.totalContributors || 0), color: "text-blue-700", bg: "bg-blue-50" },
                  { label: "Projets aidés", value: String(fund.totalProjects || 0), color: "text-purple-700", bg: "bg-purple-50" },
                  { label: "Net aux projets", value: `${fmt((fund.totalReceived || 0) * 0.9)} F`, color: "text-orange-700", bg: "bg-orange-50" },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center`}>
                    <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="bg-gray-50 rounded-2xl p-4 text-sm text-gray-600 text-center">
                <strong>90%</strong> de chaque don va directement aux projets.<br />
                BAOBAB prend <strong>10%</strong> pour la gestion de la plateforme.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ COMMENT ÇA MARCHE ═══ */}
      <section id="comment" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Comment ça marche ?</h2>
            <p className="text-gray-500 text-lg">Simple, transparent et sécurisé. En 3 étapes.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Créez votre compte", desc: "Inscrivez-vous en 2 minutes et vérifiez votre identité (KYC). Choisissez votre rôle : investisseur, entrepreneur, mentor ou bâtisseur.", icon: "👤", color: "bg-blue-50 border-blue-200" },
              { step: "02", title: "Choisissez un projet", desc: "Parcourez les projets vérifiés. Chaque projet a un score de crédibilité, un mentor garant et des statistiques transparentes.", icon: "🔍", color: "bg-green-50 border-green-200" },
              { step: "03", title: "Percevez vos retours", desc: "Suivez vos investissements en temps réel. Recevez vos remboursements mensuels sur votre wallet. Retrait vers Mobile Money.", icon: "💸", color: "bg-yellow-50 border-yellow-200" },
            ].map(s => (
              <div key={s.step} className={`${s.color} border-2 rounded-3xl p-8 relative hover:shadow-lg transition-shadow`}>
                <div className="absolute -top-4 left-8 bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md">{s.step}</div>
                <div className="text-4xl mb-4">{s.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{s.title}</h3>
                <p className="text-gray-600 leading-relaxed text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PROJETS EN COURS ═══ */}
      {projects.length > 0 && (
        <section id="projets" className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex items-center justify-between mb-12 flex-wrap gap-4">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Projets en cours</h2>
                <p className="text-gray-500">Des opportunités vérifiées, près de chez vous.</p>
              </div>
              <Link href="/projects" className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-green-700 transition-colors">
                Voir tous →
              </Link>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {projects.map((p: any) => {
                const pct = Math.round(((p.raisedAmount || 0) / (p.goalAmount || 1)) * 100);
                return (
                  <Link key={p.id} href={`/projects/${p.id}`} className="bg-white border border-gray-100 rounded-3xl overflow-hidden hover:shadow-xl transition-all group">
                    <div className="h-2 bg-gray-100">
                      <div className="h-2 bg-green-500 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs bg-green-100 text-green-700 font-bold px-2.5 py-1 rounded-full">{p.sector}</span>
                        <span className="text-xs text-gray-400">📍 {p.city}</span>
                      </div>
                      <h3 className="font-bold text-gray-900 text-lg mb-2 group-hover:text-green-700 transition-colors line-clamp-1">{p.title}</h3>
                      <p className="text-gray-500 text-sm mb-4 line-clamp-2">{p.description}</p>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
                        <div className="bg-green-50 rounded-xl p-2">
                          <div className="font-bold text-green-700">{p.expectedReturn}%</div>
                          <div className="text-gray-400">Retour</div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2">
                          <div className="font-bold text-gray-900">{p.durationMonths}m</div>
                          <div className="text-gray-400">Durée</div>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-2">
                          <div className="font-bold text-blue-700">{pct}%</div>
                          <div className="text-gray-400">Levé</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-gray-900 text-sm">{fmt(p.raisedAmount || 0)} FCFA</div>
                          <div className="text-xs text-gray-400">sur {fmt(p.goalAmount || 0)} FCFA</div>
                        </div>
                        <span className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-xl font-medium group-hover:bg-green-700 transition-colors">
                          Investir →
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ═══ BÂTISSEURS ═══ */}
      <section id="batisseurs" className="py-20 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-yellow-400/20 text-yellow-300 text-xs font-bold px-3 py-1.5 rounded-full mb-4 border border-yellow-400/30">
                🏗️ NOUVEAU RÔLE — Bâtisseur d'avenir
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Devenez un<br />
                <span className="text-yellow-400">Bâtisseur d'avenir</span>
              </h2>
              <p className="text-gray-300 text-lg mb-6 leading-relaxed">
                Mécènes, grandes entreprises, institutions, diaspora fortunée —
                soutenez les jeunes entrepreneurs africains à grande échelle 
                et bénéficiez d'une visibilité exceptionnelle.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  { icon: "👁️", text: "Visibilité & reconnaissance publique sur la plateforme" },
                  { icon: "📊", text: "Dashboard dédié avec impact social mesuré" },
                  { icon: "🤝", text: "Connexion directe avec les entrepreneurs" },
                  { icon: "🏆", text: "Hall of Fame des plus grands Bâtisseurs" },
                  { icon: "📄", text: "Rapport d'impact annuel personnalisé" },
                ].map(i => (
                  <div key={i.text} className="flex items-center gap-3">
                    <span className="text-xl">{i.icon}</span>
                    <span className="text-gray-300 text-sm">{i.text}</span>
                  </div>
                ))}
              </div>
              <Link href="/auth/register?role=BUILDER" className="inline-block bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-8 py-3 rounded-xl transition-colors">
                🏗️ Devenir Bâtisseur →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { title: "Entreprises", icon: "🏢", desc: "RSE & impact social mesurable", color: "bg-yellow-400/10 border-yellow-400/30" },
                { title: "Institutions", icon: "🏛️", desc: "Partenariats officiels", color: "bg-blue-400/10 border-blue-400/30" },
                { title: "Diaspora", icon: "🌍", desc: "Investissez dans vos origines", color: "bg-green-400/10 border-green-400/30" },
                { title: "Mécènes", icon: "💎", desc: "Philanthropie africaine", color: "bg-purple-400/10 border-purple-400/30" },
              ].map(b => (
                <div key={b.title} className={`${b.color} border rounded-2xl p-5 text-center hover:opacity-90 transition-opacity`}>
                  <div className="text-3xl mb-2">{b.icon}</div>
                  <div className="font-bold text-white text-sm">{b.title}</div>
                  <div className="text-gray-400 text-xs mt-1">{b.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ AVANTAGES ═══ */}
      <section className="py-20 bg-green-900 text-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Pourquoi BAOBAB INVEST ?</h2>
            <p className="text-green-200 text-lg max-w-2xl mx-auto">Une plateforme construite pour la confiance et la transparence.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "KYC vérifié", desc: "Tous les participants sont vérifiés. Sécurité maximale pour vos investissements.", icon: "🛡️" },
              { title: "Mentors garants", desc: "Chaque projet supervisé par un mentor certifié qui engage sa réputation.", icon: "🎓" },
              { title: "Fonds sécurisés", desc: "Vos fonds en séquestre jusqu'au remboursement. Vous êtes protégés.", icon: "🔒" },
              { title: "Transparence totale", desc: "Tous les taux publics. Commission BAOBAB : 6% seulement à la clôture.", icon: "📊" },
              { title: "Remboursement progressif", desc: "L'entrepreneur rembourse mensuellement. Vous recevez votre part chaque mois.", icon: "📅" },
              { title: "Fonds Solidaire", desc: "Contribuez dès 500 FCFA au fonds communautaire pour les jeunes entrepreneurs.", icon: "🌱" },
            ].map(a => (
              <div key={a.title} className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/15 hover:bg-white/15 transition-colors">
                <div className="text-3xl mb-3">{a.icon}</div>
                <h3 className="font-bold text-lg mb-2">{a.title}</h3>
                <p className="text-green-200 text-sm leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TRANSPARENCE + SIMULATION ═══ */}
      <section id="transparence" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Transparence<br /><span className="text-green-600">totale sur les frais</span>
              </h2>
              <p className="text-gray-500 text-lg mb-8 leading-relaxed">
                Nous ne cachons rien. Tous nos taux sont publics et mis à jour en temps réel.
              </p>
              <div className="space-y-3">
                {[
                  { label: `Commission collecte BAOBAB`, value: `${fees.commission_baobab_collection || 6}%`, note: "Prélevé à la clôture du projet", color: "text-red-600" },
                  { label: `Commission mentor`, value: `${fees.commission_mentor || 2}%`, note: "Versé au mentor garant à la clôture", color: "text-purple-600" },
                  { label: `Fonds de garantie`, value: `${fees.commission_guarantee || 2}%`, note: "Réserve communautaire — optionnelle", color: "text-orange-600" },
                  { label: `Payin mensualités`, value: `${fees.payin_repayment || 4}%`, note: "Frais opérateur Mobile Money absorbés", color: "text-blue-600" },
                  { label: `Retrait gains`, value: `${fees.withdrawal_fee_standard || 0}%`, note: "Retrait sur gains — BAOBAB absorbe les frais", color: "text-green-600" },
                ].map(f => (
                  <div key={f.label} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{f.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{f.note}</div>
                    </div>
                    <span className={`font-bold ${f.color} bg-white border border-gray-200 px-3 py-1 rounded-xl text-sm`}>{f.value}</span>
                  </div>
                ))}
              </div>
              <Link href="/transparence" className="inline-block mt-6 text-green-600 font-medium hover:underline text-sm">
                Voir la page transparence complète →
              </Link>
            </div>

            {/* Simulation dynamique */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-3xl p-8 border border-green-200 sticky top-24">
              <h3 className="font-bold text-gray-900 text-xl mb-2">🧮 Simulation investissement</h3>
              <p className="text-xs text-gray-500 mb-6">Taux mis à jour en temps réel depuis la plateforme</p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-green-200">
                  <span className="text-gray-600">Vous investissez</span>
                  <span className="font-bold text-gray-900">{fmt(simAmount)} FCFA</span>
                </div>
                <div className="flex justify-between py-2 border-b border-green-200 text-red-500">
                  <span>Frais à la clôture ({totalFeesPct}%)</span>
                  <span>-{fmt(simFees)} FCFA</span>
                </div>
                <div className="flex justify-between py-2 border-b border-green-200">
                  <span className="text-gray-600">Net dans le projet</span>
                  <span className="font-bold">{fmt(simNet)} FCFA</span>
                </div>
                <div className="flex justify-between py-2 border-b border-green-200">
                  <span className="text-gray-600">Retour brut (min {fees.return_min || 23}%)</span>
                  <span className="font-bold text-orange-600">+{fmt(simRetour)} FCFA</span>
                </div>
                <div className="flex justify-between py-2 border-b border-green-200 text-blue-500">
                  <span>Payin mensualités ({fees.payin_repayment || 4}%)</span>
                  <span>-{fmt(simPayin)} FCFA</span>
                </div>
                <div className="flex justify-between py-2 border-b border-green-200 text-green-600">
                  <span>Retrait gains (0%)</span>
                  <span>Gratuit ✅</span>
                </div>
                <div className="flex justify-between py-3 bg-green-600 rounded-2xl px-4 mt-2 text-white">
                  <span className="font-bold">Vous recevez</span>
                  <span className="font-bold text-lg">{fmt(simGain)} FCFA</span>
                </div>
                <div className="text-center text-green-700 font-bold text-base pt-2">
                  Gain net : +{fmt(simGainNet)} FCFA (+{simGainPct}%) 🎉
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CTA FINAL ═══ */}
      <section className="py-20 bg-gradient-to-br from-green-700 via-green-800 to-green-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-400 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-white rounded-full blur-3xl"></div>
        </div>
        <div className="max-w-4xl mx-auto px-6 text-center relative">
          <div className="text-5xl mb-4">🌳</div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Prêt à construire l'Afrique de demain ?
          </h2>
          <p className="text-green-100 text-lg mb-10 max-w-2xl mx-auto">
            Rejoignez la communauté BAOBAB INVEST. Inscription gratuite, KYC rapide.
            Premiers retours en quelques mois.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
            <Link href="/auth/register?role=INVESTOR" className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-8 py-4 rounded-2xl text-lg transition-all transform hover:scale-105 shadow-xl">
              💰 Je veux investir
            </Link>
            <Link href="/auth/register?role=ENTREPRENEUR" className="bg-white/20 hover:bg-white/30 text-white font-bold px-8 py-4 rounded-2xl text-lg border border-white/30 backdrop-blur transition-all">
              🚀 Je cherche des fonds
            </Link>
            <Link href="/fund" className="bg-white/20 hover:bg-white/30 text-white font-bold px-8 py-4 rounded-2xl text-lg border border-white/30 backdrop-blur transition-all">
              🌱 Contribuer au fonds
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-gray-950 text-gray-400 py-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-5 gap-8 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-green-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-sm">🌳</span>
                </div>
                <span className="font-bold text-white text-lg">BAOBAB INVEST</span>
              </div>
              <p className="text-sm leading-relaxed mb-4">
                Plateforme de micro-investissement communautaire pour l'Afrique subsaharienne.
                UEMOA / CEMAC.
              </p>
              <div className="flex gap-3">
                <Link href="/fund" className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-green-700">🌱 Fonds Solidaire</Link>
                <Link href="/transparence" className="border border-gray-700 text-gray-400 text-xs px-3 py-1.5 rounded-lg hover:border-gray-500">Transparence</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">Plateforme</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/projects" className="hover:text-green-400 transition-colors">Projets</Link></li>
                <li><Link href="/fund" className="hover:text-green-400 transition-colors">Fonds Solidaire</Link></li>
                <li><Link href="/transparence" className="hover:text-green-400 transition-colors">Transparence</Link></li>
                <li><Link href="/leaderboard" className="hover:text-green-400 transition-colors">Classement</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">Rejoindre</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/auth/register?role=INVESTOR" className="hover:text-green-400 transition-colors">Investisseur</Link></li>
                <li><Link href="/auth/register?role=ENTREPRENEUR" className="hover:text-green-400 transition-colors">Entrepreneur</Link></li>
                <li><Link href="/auth/register?role=MENTOR" className="hover:text-green-400 transition-colors">Mentor</Link></li>
                <li><Link href="/auth/register?role=BUILDER" className="hover:text-green-400 transition-colors">🏗️ Bâtisseur</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">Partenaires</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/suppliers/register" className="hover:text-green-400 transition-colors">Fournisseurs</Link></li>
                <li><Link href="/auth/register?role=BUILDER" className="hover:text-green-400 transition-colors">Institutions</Link></li>
                <li><Link href="/fund" className="hover:text-green-400 transition-colors">Mécènes</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs">© 2026 BAOBAB INVEST. Tous droits réservés.</p>
            <p className="text-xs text-center">Plateforme régulée · L'investissement comporte des risques. Les performances passées ne préjugent pas des futures.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
