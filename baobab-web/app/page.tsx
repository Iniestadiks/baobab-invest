"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [stats, setStats] = useState({ projects: 0, investors: 0, raised: 0, successRate: 95 });
  const [featuredProjects, setFeaturedProjects] = useState<any[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem("user");
    const token = localStorage.getItem("accessToken");
    if (user && token) setIsLoggedIn(true);

    // Stats live depuis l'API
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects?limit=3&sortBy=popular`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setFeaturedProjects(d.data.projects || []);
          setStats(s => ({ ...s, projects: d.data.pagination.total }));
        }
      });
  }, []);

  const handleCTA = () => {
    if (isLoggedIn) {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user.role === "ENTREPRENEUR") router.push("/entrepreneur");
      else if (user.role === "ADMIN") router.push("/admin");
      else router.push("/dashboard");
    } else {
      router.push("/auth/register");
    }
  };

  const SECTOR_EMOJI: Record<string, string> = {
    AGRICULTURE:"🌾",COMMERCE:"🛒",TECH:"💻",ARTISANAT:"🎨",
    EDUCATION:"📚",SANTE:"🏥",SERVICES:"🔧",ENERGIE:"⚡",TRANSPORT:"🚌",AUTRE:"📦"
  };

  const RISK_COLOR: Record<string, string> = {
    LOW: "text-green-600 bg-green-50",
    MEDIUM: "text-yellow-600 bg-yellow-50",
    HIGH: "text-red-600 bg-red-50",
  };

  return (
    <div className="min-h-screen bg-white">
      {/* NAVBAR */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🌳</span>
            <span className="font-bold text-green-600 text-xl">BAOBAB INVEST</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/transparence" className="text-xs text-gray-500 hover:text-green-600 underline">Transparence & Frais</Link>
          <Link href="/projects" className="text-gray-600 hover:text-green-600 font-medium text-sm transition-colors">Projets</Link>
            <Link href="/suppliers" className="text-gray-600 hover:text-green-600 font-medium text-sm transition-colors">Fournisseurs</Link>
            <Link href="/academy" className="text-gray-600 hover:text-green-600 font-medium text-sm transition-colors">Académie</Link>
          </div>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <button onClick={handleCTA} className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-xl transition-colors text-sm">
                Mon Dashboard →
              </button>
            ) : (
              <>
                <Link href="/auth/login" className="text-gray-600 hover:text-green-600 font-medium px-4 py-2 rounded-xl transition-colors text-sm">
                  Connexion
                </Link>
                <Link href="/auth/register" className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-xl transition-colors text-sm">
                  Commencer
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="bg-gradient-to-br from-green-900 via-green-800 to-green-700 text-white py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-yellow-300 rounded-full blur-3xl"></div>
        </div>
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-sm mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <span>Plateforme active · Projets en cours de financement</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Investis dans<br />
            <span className="text-yellow-300">l'Afrique de demain</span>
          </h1>
          <p className="text-xl text-green-100 mb-10 max-w-2xl mx-auto leading-relaxed">
            Soutiens des entrepreneurs locaux vérifiés dès <strong className="text-white">500 FCFA</strong>.
            Suis chaque franc investi. Perçois un retour sur investissement.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <button onClick={handleCTA} className="bg-yellow-400 hover:bg-yellow-300 text-green-900 font-bold px-8 py-4 rounded-xl transition-colors text-lg">
              {isLoggedIn ? "Voir mon dashboard →" : "Investir maintenant →"}
            </button>
            <Link href="/transparence" className="text-xs text-gray-500 hover:text-green-600 underline">Transparence & Frais</Link>
          <Link href="/projects" className="border-2 border-white/40 hover:bg-white/10 text-white font-semibold px-8 py-4 rounded-xl transition-colors text-lg">
              Voir les projets
            </Link>
          </div>

          {/* Stats live */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { value: `${stats.projects}+`, label: "Projets vérifiés", icon: "📋" },
              { value: "500 FCFA", label: "Investissement min.", icon: "💰" },
              { value: `${stats.successRate}%`, label: "Taux de réussite", icon: "✅" },
              { value: "5 pays", label: "Bientôt", icon: "🌍" },
            ].map(s => (
              <div key={s.label} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 text-center">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-2xl font-bold text-yellow-300">{s.value}</div>
                <div className="text-xs text-green-200 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Comment ça marche ?</h2>
            <p className="text-gray-500">Simple, sécurisé, transparent — en 4 étapes</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: "👤", step: "1", title: "Crée ton compte", desc: "Inscription gratuite en 2 min. Choisis ton rôle : Investisseur, Entrepreneur ou Mentor.", color: "bg-green-50 text-green-600" },
              { icon: "🔍", step: "2", title: "Explore les projets", desc: "Parcours les projets vérifiés. Regarde la vidéo pitch, le score de bankabilité, les indicateurs.", color: "bg-blue-50 text-blue-600" },
              { icon: "💰", step: "3", title: "Investis dès 500 FCFA", desc: "Investis via ton wallet rechargeable (Wave, Orange Money, MTN). 2% au Fonds de Garantie.", color: "bg-yellow-50 text-yellow-600" },
              { icon: "📈", step: "4", title: "Suis & perçois", desc: "Suis l'avancement en temps réel. Reçois ton capital + retour à la fin du projet.", color: "bg-purple-50 text-purple-600" },
            ].map(item => (
              <div key={item.step} className="text-center">
                <div className={`w-16 h-16 ${item.color} rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4`}>
                  {item.icon}
                </div>
                <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-3">
                  {item.step}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROJETS EN VEDETTE */}
      {featuredProjects.length > 0 && (
        <section className="py-20 px-6 bg-gray-50">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Projets en cours</h2>
                <p className="text-gray-500">Rejoins ces entrepreneurs et fais fructifier ton épargne</p>
              </div>
              <Link href="/transparence" className="text-xs text-gray-500 hover:text-green-600 underline">Transparence & Frais</Link>
          <Link href="/projects" className="btn-secondary text-sm py-2 px-5 hidden md:flex">
                Voir tous →
              </Link>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {featuredProjects.map(p => {
                const fundingPercent = Math.round((p.raisedAmount / p.goalAmount) * 100);
                return (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden group">
                    <div className="h-40 bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center text-6xl">
                      {SECTOR_EMOJI[p.sector] || "📦"}
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${RISK_COLOR[p.riskLevel]}`}>
                          {p.riskLevel === "LOW" ? "🟢 Faible" : p.riskLevel === "HIGH" ? "🔴 Élevé" : "🟡 Modéré"}
                        </span>
                        <span className="text-xs text-gray-400">{p.sector}</span>
                      </div>
                      <h3 className="font-bold text-gray-900 mb-1 group-hover:text-green-600 transition-colors">{p.title}</h3>
                      <p className="text-gray-500 text-xs line-clamp-2 mb-3">{p.description}</p>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
                        <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.min(fundingPercent, 100)}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{p.raisedAmount?.toLocaleString()} FCFA levés</span>
                        <span className="font-bold text-green-600">+{p.expectedReturn}% retour</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* SYSTÈME DE CONFIANCE */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">🛡️ Système de confiance unique</h2>
            <p className="text-gray-500">4 niveaux de protection pour chaque franc investi</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { icon: "🪪", title: "KYC & Vérification d'identité", desc: "Chaque utilisateur est vérifié avant d'investir ou de soumettre un projet. CNI, selfie, numéro de téléphone confirmé.", color: "border-blue-200 bg-blue-50" },
              { icon: "🔒", title: "Escrow sécurisé", desc: "Ton argent n'est jamais entre les mains de l'entrepreneur. Il est bloqué et libéré uniquement sur validation admin, directement au fournisseur.", color: "border-green-200 bg-green-50" },
              { icon: "🎓", title: "Mentor / Garant", desc: "Chaque projet peut être parrainé par un expert local qui engage publiquement sa réputation. Maximum 5 projets simultanés.", color: "border-purple-200 bg-purple-50" },
              { icon: "🛡️", title: "Fonds de Garantie Solidaire", desc: "2% de chaque investissement alimente un fonds communautaire. En cas de faillite de bonne foi, tu récupères jusqu'à 60% de ta mise.", color: "border-yellow-200 bg-yellow-50" },
            ].map(item => (
              <div key={item.title} className={`border-2 ${item.color} rounded-2xl p-6`}>
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* POUR LA DIASPORA */}
      <section className="py-16 px-6 bg-green-50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-5xl mb-4">✈️</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Tu es en Europe ? Investis au pays !</h2>
          <p className="text-gray-600 text-lg mb-6 max-w-2xl mx-auto">
            La diaspora africaine envoie plus de 40 milliards € par an vers l'Afrique.
            Avec BAOBAB INVEST, fais travailler cet argent intelligemment dans des projets vérifiés.
          </p>
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {[
              { icon: "📱", title: "100% mobile", desc: "Investis depuis ton smartphone, partout dans le monde" },
              { icon: "🔄", title: "Retour garanti", desc: "Reçois ton capital + retour directement sur ton Mobile Money" },
              { icon: "🌍", title: "Impact réel", desc: "Crée des emplois et finance l'économie réelle africaine" },
            ].map(item => (
              <div key={item.title} className="bg-white rounded-2xl p-5 text-center shadow-sm">
                <div className="text-3xl mb-2">{item.icon}</div>
                <div className="font-bold text-gray-900 mb-1">{item.title}</div>
                <div className="text-gray-500 text-sm">{item.desc}</div>
              </div>
            ))}
          </div>
          <button onClick={handleCTA} className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-xl transition-colors text-lg">
            Commencer à investir →
          </button>
        </div>
      </section>

      {/* TÉMOIGNAGES */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Ce qu'ils disent</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Amadou D.", role: "Investisseur · Sénégal", text: "J'ai investi 5 000 FCFA dans un projet agricole. 8 mois plus tard, j'ai reçu 5 750 FCFA. Et l'entrepreneur emploie maintenant 3 personnes.", avatar: "👨🏾" },
              { name: "Fatou S.", role: "Entrepreneur · Dakar", text: "Les banques m'ont refusé un prêt. Grâce à BAOBAB INVEST, j'ai levé 500 000 FCFA en 3 semaines auprès de 47 investisseurs.", avatar: "👩🏾" },
              { name: "Ousmane M.", role: "Mentor · Expert Agro", text: "En tant que mentor, j'accompagne les entrepreneurs et je contribue à construire une économie africaine forte et digne.", avatar: "👨🏾‍🏫" },
            ].map(t => (
              <div key={t.name} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <div className="text-4xl mb-4">{t.avatar}</div>
                <p className="text-gray-700 text-sm leading-relaxed mb-4 italic">"{t.text}"</p>
                <div>
                  <div className="font-bold text-gray-900 text-sm">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-gradient-to-br from-green-800 to-green-600 py-24 px-6 text-center text-white">
        <div className="max-w-2xl mx-auto">
          <div className="text-6xl mb-6">🌳</div>
          <h2 className="text-4xl font-bold mb-4">Prêt à faire fructifier ton épargne ?</h2>
          <p className="text-green-100 mb-8 text-lg">
            Rejoins la communauté BAOBAB INVEST et investis dans l'économie africaine réelle.
          </p>
          <button onClick={handleCTA} className="bg-yellow-400 hover:bg-yellow-300 text-green-900 font-bold px-10 py-4 rounded-xl transition-colors text-lg">
            {isLoggedIn ? "Accéder à mon dashboard" : "Créer mon compte gratuitement"}
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-green-900 text-green-300 py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🌳</span>
                <span className="font-bold text-white">BAOBAB INVEST</span>
              </div>
              <p className="text-sm text-green-400 leading-relaxed">
                Plateforme d'investissement communautaire pour la jeunesse africaine.
              </p>
            </div>
            <div>
              <div className="font-semibold text-white mb-3">Investisseurs</div>
              <div className="space-y-2 text-sm">
                <Link href="/transparence" className="text-xs text-gray-500 hover:text-green-600 underline">Transparence & Frais</Link>
          <Link href="/projects" className="block hover:text-white transition-colors">Catalogue projets</Link>
                <Link href="/auth/register" className="block hover:text-white transition-colors">Créer un compte</Link>
                <Link href="/academy" className="block hover:text-white transition-colors">Académie Baobab</Link>
              </div>
            </div>
            <div>
              <div className="font-semibold text-white mb-3">Entrepreneurs</div>
              <div className="space-y-2 text-sm">
                <Link href="/projects/submit" className="block hover:text-white transition-colors">Soumettre un projet</Link>
                <Link href="/suppliers" className="block hover:text-white transition-colors">Fournisseurs partenaires</Link>
                <Link href="/academy" className="block hover:text-white transition-colors">Se former</Link>
              </div>
            </div>
            <div>
              <div className="font-semibold text-white mb-3">Plateforme</div>
              <div className="space-y-2 text-sm">
                <Link href="/suppliers/register" className="block hover:text-white transition-colors">Devenir fournisseur</Link>
                <Link href="/auth/login" className="block hover:text-white transition-colors">Connexion</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-green-800 pt-6 text-center text-sm text-green-500">
            © 2025 BAOBAB INVEST — Plateforme d'investissement communautaire africaine · Confidentiel
          </div>
        </div>
      </footer>
    </div>
  );
}
