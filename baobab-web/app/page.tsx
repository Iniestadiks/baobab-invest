"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function LandingPage() {
  const [stats, setStats] = useState({ totalRaised: 0, activeProjects: 0, totalUsers: 0, kycVerified: 0 });
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL || "http://46.202.132.161:3001";
    fetch(`${API}/api/projects?limit=3&status=ACTIVE`)
      .then(r => r.json())
      .then(d => { if (d.success) setProjects(d.data?.projects || []); })
      .catch(() => {});
    fetch(`${API}/api/admin/stats/charts`)
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d.data?.kpis || {}); })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="font-bold text-gray-900 text-lg">BAOBAB INVEST</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#comment" className="hover:text-green-600 transition-colors">Comment ca marche</a>
            <a href="#projets" className="hover:text-green-600 transition-colors">Projets</a>
            <a href="#avantages" className="hover:text-green-600 transition-colors">Avantages</a>
            <a href="#transparence" className="hover:text-green-600 transition-colors">Transparence</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-gray-600 hover:text-green-600 font-medium transition-colors">
              Connexion
            </Link>
            <Link href="/auth/register" className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors">
              Commencer
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-24 pb-20 bg-gradient-to-br from-green-900 via-green-800 to-green-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-yellow-400 rounded-full blur-3xl"></div>
        </div>
        <div className="max-w-6xl mx-auto px-6 relative">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur text-white text-sm px-4 py-2 rounded-full mb-6 border border-white/30">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Plateforme de micro-investissement UEMOA / CEMAC
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Investissez dans<br />
              <span className="text-yellow-400">l Afrique de demain</span>
            </h1>
            <p className="text-green-100 text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
              Soutenez les entrepreneurs africains et faites fructifier votre argent. 
              A partir de 5 000 FCFA, participez a des projets verifies et rentables.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/register" className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-8 py-4 rounded-2xl text-lg transition-all transform hover:scale-105 shadow-lg">
                Investir maintenant
              </Link>
              <Link href="/projects" className="bg-white/20 hover:bg-white/30 text-white font-bold px-8 py-4 rounded-2xl text-lg transition-all border border-white/40 backdrop-blur">
                Voir les projets
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            {[
              { label: "Total leve", value: `${((stats.totalRaised || 0) / 1000000).toFixed(1)}M FCFA`, icon: "💰" },
              { label: "Projets actifs", value: String(stats.activeProjects || 0), icon: "🚀" },
              { label: "Membres", value: String(stats.totalUsers || 0), icon: "👥" },
              { label: "KYC verifies", value: String(stats.kycVerified || 0), icon: "✅" },
            ].map(s => (
              <div key={s.label} className="bg-white/15 backdrop-blur rounded-2xl p-5 text-center border border-white/20">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-green-200 text-xs mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMENT CA MARCHE */}
      <section id="comment" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Comment ca marche ?</h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">Simple, transparent et securise. En 3 etapes.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Creez votre compte", desc: "Inscrivez-vous en 2 minutes et verifiez votre identite (KYC). Votre securite est notre priorite.", icon: "👤", color: "bg-blue-50 border-blue-200" },
              { step: "02", title: "Choisissez un projet", desc: "Parcourez les projets verifies par notre equipe. Chaque projet a un score de bankabilite et un mentor garant.", icon: "🔍", color: "bg-green-50 border-green-200" },
              { step: "03", title: "Percevez vos retours", desc: "Suivez vos investissements en temps reel et recevez vos remboursements mensuels directement sur votre wallet.", icon: "💸", color: "bg-yellow-50 border-yellow-200" },
            ].map(s => (
              <div key={s.step} className={`${s.color} border-2 rounded-3xl p-8 relative`}>
                <div className="absolute -top-4 left-8 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">{s.step}</div>
                <div className="text-4xl mb-4">{s.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{s.title}</h3>
                <p className="text-gray-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROJETS EN COURS */}
      {projects.length > 0 && (
        <section id="projets" className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex items-center justify-between mb-12">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Projets en cours</h2>
                <p className="text-gray-500">Des opportunites verifiees, pres de chez vous.</p>
              </div>
              <Link href="/projects" className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-green-700 transition-colors hidden md:block">
                Voir tout
              </Link>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {projects.map((p: any) => {
                const pct = Math.round(((p.raisedAmount || 0) / (p.goalAmount || 1)) * 100);
                return (
                  <Link key={p.id} href={`/projects/${p.id}`} className="border border-gray-100 rounded-3xl overflow-hidden hover:shadow-xl transition-all group">
                    <div className="h-3 bg-gray-100">
                      <div className="h-3 bg-green-500 transition-all" style={{width: `${Math.min(pct, 100)}%`}} />
                    </div>
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs bg-green-100 text-green-700 font-bold px-2.5 py-1 rounded-full">{p.sector}</span>
                        <span className="text-xs text-gray-400">{p.city}</span>
                      </div>
                      <h3 className="font-bold text-gray-900 text-lg mb-2 group-hover:text-green-700 transition-colors">{p.title}</h3>
                      <p className="text-gray-500 text-sm mb-4 line-clamp-2">{p.description}</p>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
                        <div className="bg-gray-50 rounded-xl p-2">
                          <div className="font-bold text-green-700">{p.expectedReturn}%</div>
                          <div className="text-gray-400">Retour</div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2">
                          <div className="font-bold text-gray-900">{p.durationMonths}m</div>
                          <div className="text-gray-400">Duree</div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2">
                          <div className="font-bold text-blue-700">{pct}%</div>
                          <div className="text-gray-400">Leve</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-gray-900">{(p.raisedAmount || 0).toLocaleString()} FCFA</div>
                          <div className="text-xs text-gray-400">sur {(p.goalAmount || 0).toLocaleString()} FCFA</div>
                        </div>
                        <span className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-xl font-medium group-hover:bg-green-700 transition-colors">
                          Investir
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

      {/* AVANTAGES */}
      <section id="avantages" className="py-20 bg-green-900 text-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Pourquoi BAOBAB INVEST ?</h2>
            <p className="text-green-200 text-lg max-w-2xl mx-auto">Une plateforme construite pour la confiance et la transparence.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "KYC verifie", desc: "Tous les participants sont verifies. Aucun anonymat tolere.", icon: "🛡️" },
              { title: "Mentors garants", desc: "Chaque projet peut etre supervise par un mentor certifie qui engage sa reputation.", icon: "🎓" },
              { title: "Fonds securises", desc: "Vos fonds sont en sequestre jusqu au remboursement. Vous etes proteges.", icon: "🔒" },
              { title: "Transparence totale", desc: "Tous les taux et frais sont publics et modifiables uniquement par l administration.", icon: "📊" },
              { title: "Remboursement progressif", desc: "L entrepreneur rembourse mensuellement. Vous recevez votre part chaque mois.", icon: "📅" },
              { title: "A partir de 5 000 FCFA", desc: "Investissez a votre rythme. Pas de minimum eleve, l investissement pour tous.", icon: "💡" },
            ].map(a => (
              <div key={a.title} className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-colors">
                <div className="text-3xl mb-3">{a.icon}</div>
                <h3 className="font-bold text-lg mb-2">{a.title}</h3>
                <p className="text-green-200 text-sm leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRANSPARENCE */}
      <section id="transparence" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Transparence<br /><span className="text-green-600">totale sur les frais</span>
              </h2>
              <p className="text-gray-500 text-lg mb-8 leading-relaxed">
                Nous ne cachons rien. Tous nos taux sont publics. 
                BAOBAB INVEST se remunere uniquement via des commissions claires et justes.
              </p>
              <div className="space-y-4">
                {[
                  { label: "Commission collecte BAOBAB", value: "5%", note: "Preleve a la cloture du projet" },
                  { label: "Commission retours BAOBAB", value: "5%", note: "Preleve au remboursement" },
                  { label: "Commission mentor", value: "2%", note: "Verse directement au mentor garant" },
                  { label: "Fonds de garantie", value: "2%", note: "Reserve en cas de difficulte" },
                  { label: "Frais PayDunya", value: "Absorbes", note: "BAOBAB prend en charge les frais de paiement" },
                ].map(f => (
                  <div key={f.label} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{f.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{f.note}</div>
                    </div>
                    <span className="font-bold text-green-700 bg-green-100 px-3 py-1 rounded-xl text-sm">{f.value}</span>
                  </div>
                ))}
              </div>
              <Link href="/transparence" className="inline-block mt-6 text-green-600 font-medium hover:underline text-sm">
                Voir la page transparence complete
              </Link>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-3xl p-8 border border-green-200">
              <h3 className="font-bold text-gray-900 text-xl mb-6">Simulation investissement</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-green-200">
                  <span className="text-gray-600">Vous investissez</span>
                  <span className="font-bold text-gray-900">100 000 FCFA</span>
                </div>
                <div className="flex justify-between py-2 border-b border-green-200 text-red-500">
                  <span>Frais a la cloture (9%)</span>
                  <span>-9 000 FCFA</span>
                </div>
                <div className="flex justify-between py-2 border-b border-green-200">
                  <span className="text-gray-600">Net dans le projet</span>
                  <span className="font-bold">91 000 FCFA</span>
                </div>
                <div className="flex justify-between py-2 border-b border-green-200">
                  <span className="text-gray-600">Retour brut (15%)</span>
                  <span className="font-bold text-orange-600">+115 000 FCFA</span>
                </div>
                <div className="flex justify-between py-2 border-b border-green-200 text-red-400">
                  <span>Frais retour (8%)</span>
                  <span>-9 200 FCFA</span>
                </div>
                <div className="flex justify-between py-3 bg-green-200 rounded-xl px-3 mt-2">
                  <span className="font-bold text-gray-900">Vous recevez</span>
                  <span className="font-bold text-green-800 text-lg">105 800 FCFA</span>
                </div>
                <div className="text-center text-green-700 font-bold text-base pt-2">
                  Gain net : +5 800 FCFA (+5.8%)
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 bg-gradient-to-r from-green-600 to-green-800">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Pret a investir dans l Afrique de demain ?
          </h2>
          <p className="text-green-100 text-lg mb-10 max-w-2xl mx-auto">
            Rejoignez des centaines d investisseurs et entrepreneurs qui font confiance a BAOBAB INVEST.
            Inscription gratuite, KYC rapide, premiers retours en quelques mois.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register?role=investor" className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-8 py-4 rounded-2xl text-lg transition-all transform hover:scale-105">
              Je veux investir
            </Link>
            <Link href="/auth/register?role=entrepreneur" className="bg-white/20 hover:bg-white/30 text-white font-bold px-8 py-4 rounded-2xl text-lg transition-all border border-white/40">
              Je cherche des fonds
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs">B</span>
                </div>
                <span className="font-bold text-white">BAOBAB INVEST</span>
              </div>
              <p className="text-sm leading-relaxed">Plateforme de micro-investissement pour l Afrique subsaharienne. UEMOA / CEMAC.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">Plateforme</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/projects" className="hover:text-green-400 transition-colors">Projets</Link></li>
                <li><Link href="/transparence" className="hover:text-green-400 transition-colors">Transparence</Link></li>
                <li><Link href="/auth/register" className="hover:text-green-400 transition-colors">S inscrire</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">Investisseurs</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/auth/register?role=investor" className="hover:text-green-400 transition-colors">Commencer</Link></li>
                <li><Link href="/projects" className="hover:text-green-400 transition-colors">Explorer les projets</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">Entrepreneurs</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/auth/register?role=entrepreneur" className="hover:text-green-400 transition-colors">Soumettre un projet</Link></li>
                <li><Link href="/suppliers/register" className="hover:text-green-400 transition-colors">Devenir fournisseur</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs">2026 BAOBAB INVEST. Tous droits reserves.</p>
            <p className="text-xs">Plateforme regulee — Investissement comporte des risques. Les performances passees ne presagent pas des performances futures.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
