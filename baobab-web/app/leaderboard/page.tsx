"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

const LEVEL_INFO: Record<number, {label: string, icon: string, color: string, bg: string, border: string}> = {
  1: {label: "Graine",       icon: "🌱", color: "text-gray-600",   bg: "bg-gray-100",   border: "border-gray-300"},
  2: {label: "Pousse",       icon: "🌿", color: "text-green-600",  bg: "bg-green-100",  border: "border-green-300"},
  3: {label: "Arbre",        icon: "🌳", color: "text-blue-600",   bg: "bg-blue-100",   border: "border-blue-300"},
  4: {label: "Baobab",       icon: "🌲", color: "text-purple-600", bg: "bg-purple-100", border: "border-purple-300"},
  5: {label: "Grand Baobab", icon: "🏆", color: "text-yellow-600", bg: "bg-yellow-100", border: "border-yellow-400"},
};

const HOW_TO_EARN = {
  INVESTOR: [
    { action: "KYC vérifié",                  pts: "+5",  icon: "✅" },
    { action: "Profil complété",              pts: "+5",  icon: "👤" },
    { action: "Premier investissement",       pts: "+10", icon: "🥇" },
    { action: "Chaque investissement",        pts: "+5",  icon: "💰" },
    { action: "Investissement > 50 000 FCFA", pts: "+10", icon: "📈" },
    { action: "Investissement > 100 000 FCFA",pts: "+15", icon: "💎" },
    { action: "Investissement > 500 000 FCFA",pts: "+25", icon: "🚀" },
    { action: "Investissement > 1 000 000 FCFA",pts: "+50",icon: "👑"},
    { action: "Complète le financement d un projet", pts: "+20", icon: "🎯" },
    { action: "Investi dans 5 secteurs différents",  pts: "+15", icon: "🌈" },
    { action: "Réinvestit chez le même entrepreneur",pts: "+10", icon: "🤝" },
    { action: "Parraine un ami qui investit",         pts: "+10", icon: "🌳" },
    { action: "Projet remboursé avec succès",         pts: "+20", icon: "✨" },
  ],
  ENTREPRENEUR: [
    { action: "KYC vérifié",                     pts: "+10", icon: "✅" },
    { action: "Profil complété",                 pts: "+5",  icon: "👤" },
    { action: "Business plan joint",             pts: "+10", icon: "📋" },
    { action: "Projet validé par l admin",       pts: "+20", icon: "🎉" },
    { action: "Projet financé à 100%",           pts: "+50", icon: "🚀" },
    { action: "Projet financé en moins de 48h",  pts: "+20", icon: "⚡" },
    { action: "Rapport mensuel publié",          pts: "+10", icon: "📸" },
    { action: "Remboursement à 100% dans les délais", pts: "+50", icon: "💯" },
    { action: "Remboursement anticipé",          pts: "+20", icon: "⏰" },
    { action: "2ème projet financé",             pts: "+100", icon: "🔄" },
    { action: "3ème projet et plus",             pts: "+150", icon: "🏆" },
    { action: "Mensualité en retard +7j",        pts: "-20", icon: "⚠️" },
    { action: "Projet échoué",                   pts: "-50", icon: "❌" },
  ],
  MENTOR: [
    { action: "KYC vérifié",                      pts: "+5",  icon: "✅" },
    { action: "Parrainage accepté",               pts: "+10", icon: "🎓" },
    { action: "Projet parrainé financé à 100%",   pts: "+20", icon: "🚀" },
    { action: "Projet remboursé dans les délais", pts: "+30", icon: "💯" },
    { action: "5 projets réussis",                pts: "+50", icon: "🏅" },
    { action: "Projet parrainé échoué",           pts: "-20", icon: "❌" },
  ]
};

const BADGES_INFO = [
  { icon: "🥇", label: "Premier pas",          desc: "Premier investissement effectué",         role: "Investisseur" },
  { icon: "💰", label: "Investisseur actif",   desc: "5 investissements réalisés",              role: "Investisseur" },
  { icon: "💎", label: "Diamant",              desc: "1 000 000 FCFA investi au total",         role: "Investisseur" },
  { icon: "⚡", label: "Éclair",               desc: "Investi dans les 6h d un projet",         role: "Investisseur" },
  { icon: "🔥", label: "En série",             desc: "3 investissements en 30 jours",           role: "Investisseur" },
  { icon: "🌍", label: "Diaspora",             desc: "Investisseur depuis l étranger",          role: "Investisseur" },
  { icon: "🌈", label: "Diversifié",           desc: "Investi dans 5 secteurs différents",      role: "Investisseur" },
  { icon: "👑", label: "Investisseur du mois", desc: "Top investisseur du mois",                role: "Investisseur" },
  { icon: "🚀", label: "Décollage rapide",     desc: "Projet financé en moins de 48h",          role: "Entrepreneur" },
  { icon: "⭐", label: "Sérieux",              desc: "3 rapports mensuels consécutifs publiés", role: "Entrepreneur" },
  { icon: "📅", label: "Ponctuel",             desc: "6 mensualités sans retard",               role: "Entrepreneur" },
  { icon: "💯", label: "Remboursé",            desc: "Projet remboursé à 100%",                 role: "Entrepreneur" },
  { icon: "🌟", label: "Coup de coeur",        desc: "Sélection coup de coeur admin",           role: "Entrepreneur" },
  { icon: "👑", label: "Entrepreneur du mois", desc: "Top entrepreneur du mois",                role: "Entrepreneur" },
  { icon: "🎓", label: "Mentor actif",         desc: "3 projets parrainés",                     role: "Mentor" },
  { icon: "🏅", label: "Excellence mentor",    desc: "5 projets réussis",                       role: "Mentor" },
];

function fmt(n: number) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

function Avatar({ user, size = "md" }: { user: any, size?: "sm"|"md"|"lg" }) {
  const sizes = { sm: "w-10 h-10 text-sm", md: "w-12 h-12 text-base", lg: "w-16 h-16 text-xl" };
  if (user.profileImageUrl) {
    return <img src={user.profileImageUrl} alt={user.firstName}
      className={`${sizes[size]} rounded-full object-cover border-2 border-white shadow-md`} />;
  }
  return (
    <div className={`${sizes[size]} bg-gradient-to-br from-green-500 to-green-700 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-md flex-shrink-0`}>
      {user.firstName?.[0]}{user.lastName?.[0]}
    </div>
  );
}

function DashboardLink() {
  const [href, setHref] = useState("/dashboard");
  useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) {
      const role = JSON.parse(user).role;
      if (role === "ENTREPRENEUR") setHref("/entrepreneur");
      else if (role === "MENTOR") setHref("/mentor");
      else if (role === "ADMIN") setHref("/admin");
      else setHref("/dashboard");
    }
  }, []);
  return <Link href={href} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 font-medium transition-colors">Mon espace →</Link>;
}

export default function LeaderboardPage() {
  const [role, setRole] = useState("INVESTOR");
  const [period, setPeriod] = useState("all");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHowTo, setShowHowTo] = useState(false);
  const [howToRole, setHowToRole] = useState("INVESTOR");

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/reputation/leaderboard?role=${role}&period=${period}`)
      .then(r => r.json())
      .then(d => { if (d.success) setUsers(d.data || []); setLoading(false); });
  }, [role, period]);

  const medals = ["🥇", "🥈", "🥉"];
  const howToKey = howToRole as keyof typeof HOW_TO_EARN;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="font-bold text-gray-900 hidden sm:block">BAOBAB INVEST</span>
          </Link>
          <span className="text-sm font-bold text-gray-700">🏆 Classement</span>
          <DashboardLink />
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {/* Hero */}
        <div className="bg-gradient-to-br from-green-700 to-green-900 rounded-3xl p-8 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24"></div>
          <div className="relative">
            <div className="text-5xl mb-3">🏆</div>
            <h1 className="text-3xl font-bold mb-2">Classement BAOBAB INVEST</h1>
            <p className="text-green-200 text-sm max-w-lg mx-auto">Investissez, remboursez, parrainez — montez dans le classement et devenez une référence de la communauté africaine de l investissement.</p>
            <button onClick={() => setShowHowTo(!showHowTo)}
              className="mt-4 bg-white/20 hover:bg-white/30 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors border border-white/30">
              {showHowTo ? "Masquer" : "💡 Comment gagner des points ?"}
            </button>
          </div>
        </div>

        {/* Section Comment gagner des points */}
        {showHowTo && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-1">💡 Comment fonctionne le système de réputation ?</h2>
              <p className="text-sm text-gray-500">Chaque action sur la plateforme vous rapporte des points. Plus vous êtes actif et sérieux, plus votre réputation grandit.</p>
            </div>

            {/* Niveaux */}
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4 text-sm">🌱 Les 5 niveaux</h3>
              <div className="grid grid-cols-5 gap-2">
                {[1,2,3,4,5].map(lvl => {
                  const l = LEVEL_INFO[lvl];
                  return (
                    <div key={lvl} className={`rounded-2xl p-3 text-center border-2 ${l.border} ${l.bg}`}>
                      <div className="text-2xl mb-1">{l.icon}</div>
                      <div className={`text-xs font-bold ${l.color}`}>Niv. {lvl}</div>
                      <div className={`text-xs font-semibold ${l.color}`}>{l.label}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {lvl === 1 ? "0-99 pts" : lvl === 2 ? "100-299" : lvl === 3 ? "300-599" : lvl === 4 ? "600-999" : "1000+"}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                {[
                  "Accès standard",
                  "Projets 24h avant",
                  "Projets 48h avant + badge",
                  "Projets 72h + exclusifs",
                  "VIP + frais réduits"
                ].map((benefit, i) => (
                  <div key={i} className={`rounded-xl p-2 text-center ${LEVEL_INFO[i+1].bg} ${LEVEL_INFO[i+1].color} font-medium`}>
                    {LEVEL_INFO[i+1].icon} {benefit}
                  </div>
                ))}
              </div>
            </div>

            {/* Points par rôle */}
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4 text-sm">⭐ Points par action</h3>
              <div className="flex gap-2 mb-4">
                {[["INVESTOR","💰 Investisseur"],["ENTREPRENEUR","🚀 Entrepreneur"],["MENTOR","🎓 Mentor"]].map(([r,l]) => (
                  <button key={r} onClick={() => setHowToRole(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${howToRole === r ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {HOW_TO_EARN[howToKey].map((item, i) => (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${item.pts.startsWith("-") ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{item.icon}</span>
                      <span className="text-xs text-gray-700">{item.action}</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.pts.startsWith("-") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      {item.pts} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Badges */}
            <div className="p-6">
              <h3 className="font-bold text-gray-900 mb-4 text-sm">🏅 Les badges à débloquer</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {BADGES_INFO.map((b, i) => (
                  <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center hover:bg-yellow-50 hover:border-yellow-200 transition-colors">
                    <div className="text-2xl mb-1">{b.icon}</div>
                    <div className="text-xs font-bold text-gray-900">{b.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{b.desc}</div>
                    <div className="text-xs text-green-600 font-medium mt-1">{b.role}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="flex flex-wrap gap-3 justify-center">
          <div className="flex bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
            {[["INVESTOR","💰 Investisseurs"],["ENTREPRENEUR","🚀 Entrepreneurs"],["MENTOR","🎓 Mentors"]].map(([r,l]) => (
              <button key={r} onClick={() => setRole(r)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${role === r ? "bg-green-600 text-white shadow-sm" : "text-gray-600 hover:text-green-600"}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
            {[["all","Tout temps"],["year","Cette année"],["month","Ce mois"]].map(([p,l]) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${period === p ? "bg-green-600 text-white shadow-sm" : "text-gray-600 hover:text-green-600"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Classement */}
        {loading ? (
          <div className="text-center py-16">
            <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-400 text-sm">Chargement du classement...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
            <div className="text-5xl mb-3">🌱</div>
            <p className="text-gray-700 font-bold text-lg mb-1">Aucun classement disponible</p>
            <p className="text-gray-400 text-sm">Soyez le premier à rejoindre la communauté !</p>
            <Link href="/auth/register" className="mt-4 inline-block bg-green-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-green-700">
              Rejoindre BAOBAB INVEST →
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Podium Top 3 */}
            {users.length >= 2 && (
              <div className="grid grid-cols-3 gap-3">
                {[users[1], users[0], users[2]].map((u, idx) => {
                  if (!u) return <div key={idx}></div>;
                  const pos = idx === 0 ? 2 : idx === 1 ? 1 : 3;
                  const level = LEVEL_INFO[u.level || 1];
                  return (
                    <div key={u.id} className={`bg-white rounded-3xl border-2 p-5 text-center shadow-sm transition-all ${pos === 1 ? "border-yellow-400 shadow-xl -translate-y-3" : pos === 2 ? "border-gray-300 shadow-md" : "border-orange-300 shadow-md"}`}>
                      <div className="text-4xl mb-3">{medals[pos-1]}</div>
                      <div className="flex justify-center mb-3">
                        <Avatar user={u} size="lg" />
                      </div>
                      <div className="font-bold text-gray-900">{u.firstName} {u.lastName?.[0]}.</div>
                      <div className="text-xs text-gray-400 mb-2">{u.city}{u.country && u.country !== "SN" ? " 🌍" : ""}</div>
                      <div className={`text-xs font-bold px-3 py-1 rounded-full inline-block mb-2 ${level.bg} ${level.color} border ${level.border}`}>
                        {level.icon} {level.label}
                      </div>
                      <div className="text-2xl font-bold text-green-600 mb-1">{u.reputationPoints} pts</div>
                      {u.totalInvested > 0 && <div className="text-xs text-gray-400 mb-2">{fmt(u.totalInvested)} FCFA investi</div>}
                      <div className="flex justify-center gap-1.5 mb-3">
                        {(u.userBadges || []).slice(0,4).map((b: any) => (
                          <span key={b.badge} title={b.label} className="text-xl">{b.icon}</span>
                        ))}
                      </div>
                      <Link href={`/profile/${u.id}`}
                        className="block text-xs bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 font-bold transition-colors">
                        Voir le profil →
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Liste complète */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <span className="font-bold text-gray-900">Classement complet</span>
                <span className="text-xs text-gray-400 bg-white border border-gray-200 px-2.5 py-1 rounded-lg">{users.length} participant(s)</span>
              </div>
              {users.map((u, idx) => {
                const level = LEVEL_INFO[u.level || 1];
                return (
                  <div key={u.id} className={`flex items-center gap-4 px-5 py-4 border-b border-gray-50 hover:bg-green-50/30 transition-colors ${idx === 0 ? "bg-yellow-50/30" : ""}`}>
                    <div className="w-8 text-center font-bold flex-shrink-0">
                      {idx < 3 ? <span className="text-xl">{medals[idx]}</span> : <span className="text-sm text-gray-400">#{idx+1}</span>}
                    </div>
                    <Avatar user={u} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900">{u.firstName} {u.lastName?.[0]}.</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${level.bg} ${level.color}`}>{level.icon} {level.label}</span>
                        {u.city && <span className="text-xs text-gray-400">{u.city}</span>}
                        {u.country && u.country !== "SN" && <span className="text-xs" title="Diaspora">🌍</span>}
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0 hidden sm:flex">
                      {(u.userBadges || []).slice(0,4).map((b: any) => (
                        <span key={b.badge} title={b.label} className="text-lg">{b.icon}</span>
                      ))}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-green-600 text-lg">{u.reputationPoints} pts</div>
                      {u.totalInvested > 0 && <div className="text-xs text-gray-400">{fmt(u.totalInvested)} FCFA</div>}
                    </div>
                    <Link href={`/profile/${u.id}`}
                      className="flex-shrink-0 text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-xl hover:bg-green-100 font-medium transition-colors">
                      Voir profil
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA bas de page */}
        <div className="bg-gradient-to-br from-green-700 to-green-900 rounded-3xl p-8 text-center text-white">
          <div className="text-3xl mb-3">🌱</div>
          <h3 className="text-xl font-bold mb-2">Rejoignez la communauté BAOBAB INVEST</h3>
          <p className="text-green-200 text-sm mb-4">Investissez dans l Afrique de demain et construisez votre réputation au sein de notre communauté.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/auth/register" className="bg-white text-green-700 font-bold px-6 py-2.5 rounded-xl hover:bg-green-50 text-sm transition-colors">
              Créer un compte →
            </Link>
            <Link href="/projects" className="bg-white/20 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-white/30 text-sm border border-white/30 transition-colors">
              Voir les projets
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
