"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

const LEVEL_INFO: Record<number, {label: string, icon: string, color: string, bg: string, border: string}> = {
  1: {label: "Graine",       icon: "🌱", color: "text-gray-600",   bg: "bg-gray-100",   border: "border-gray-300"},
  2: {label: "Pousse",       icon: "🌿", color: "text-green-600",  bg: "bg-green-100",  border: "border-green-300"},
  3: {label: "Arbre",        icon: "🌳", color: "text-blue-600",   bg: "bg-blue-100",   border: "border-blue-300"},
  4: {label: "Baobab",       icon: "🌲", color: "text-purple-600", bg: "bg-purple-100", border: "border-purple-300"},
  5: {label: "Grand Baobab", icon: "🏆", color: "text-yellow-600", bg: "bg-yellow-100", border: "border-yellow-400"},
};

const STATUS_LABELS: Record<string, {label: string, color: string}> = {
  ACTIVE:      {label: "En ligne",   color: "text-green-700 bg-green-100"},
  FUNDED:      {label: "Financé",    color: "text-blue-700 bg-blue-100"},
  IN_PROGRESS: {label: "En cours",   color: "text-purple-700 bg-purple-100"},
  COMPLETED:   {label: "Terminé",    color: "text-emerald-700 bg-emerald-100"},
};

const ROLE_LABELS: Record<string, string> = {
  INVESTOR: "💰 Investisseur",
  ENTREPRENEUR: "🚀 Entrepreneur",
  MENTOR: "🎓 Mentor",
  ADMIN: "⚙️ Admin",
};

function fmt(n: number) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

export default function PublicProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetch(`${API}/api/reputation/user/${id}`)
      .then(r => r.json())
      .then(d => { if (d.success) setUser(d.data); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-5xl mb-3">👤</div>
        <p className="text-gray-500">Profil introuvable</p>
        <button onClick={() => router.back()} className="mt-3 text-green-600 hover:underline text-sm">← Retour</button>
      </div>
    </div>
  );

  const level = LEVEL_INFO[user.level || 1];
  const pts = user.reputationPoints || 0;
  const prevPts = user.level <= 1 ? 0 : user.level === 2 ? 100 : user.level === 3 ? 300 : user.level === 4 ? 600 : 1000;
  const nextPts = user.levelInfo?.nextLevelPoints || 100;
  const progress = user.level >= 5 ? 100 : Math.round(((pts - prevPts) / (nextPts - prevPts)) * 100);
  const projects = user.projectsOwned || [];
  const badges = user.userBadges || [];
  const events = user.reputationEvents || [];
  const memberSince = user.createdAt ? new Date(user.createdAt).toLocaleDateString("fr-FR", {month: "long", year: "numeric"}) : "";

  const TABS = [
    {id: "overview", label: "Vue générale", icon: "📊"},
    {id: "badges",   label: "Badges",       icon: "🏅", badge: badges.length},
    {id: "history",  label: "Historique",   icon: "⭐", badge: events.length},
    ...(projects.length > 0 ? [{id: "projects", label: "Projets", icon: "🚀", badge: projects.length}] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-green-600 flex items-center gap-1 text-sm">
            ← Retour
          </button>
          <span className="font-bold text-gray-900">Profil</span>
          <Link href="/leaderboard" className="text-xs text-green-600 hover:underline">Classement 🏆</Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Card profil */}
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
          {/* Bannière */}
          <div className={`h-20 bg-gradient-to-br from-green-600 to-green-800`}></div>
          <div className="px-6 pb-6">
            {/* Avatar */}
            <div className="flex items-end justify-between -mt-10 mb-4">
              <div className="w-20 h-20 rounded-2xl border-4 border-white shadow-lg overflow-hidden bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-2xl font-bold">
                {user.profileImageUrl
                  ? <img src={user.profileImageUrl} alt="" className="w-full h-full object-cover" />
                  : `${user.firstName?.[0]}${user.lastName?.[0]}`}
              </div>
              <div className="flex gap-2 mt-2">
                {user.kycStatus === "VERIFIED"
                  ? <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-2.5 py-1 rounded-full font-bold">✅ KYC Vérifié</span>
                  : <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full font-bold">⏳ KYC En attente</span>}
              </div>
            </div>

            {/* Infos */}
            <h1 className="text-xl font-bold text-gray-900">{user.firstName} {user.lastName}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm text-gray-500">{ROLE_LABELS[user.role] || user.role}</span>
              {user.city && <span className="text-xs text-gray-400">· 📍 {user.city}</span>}
              {memberSince && <span className="text-xs text-gray-400">· Membre depuis {memberSince}</span>}
            </div>
            {user.bio && <p className="text-sm text-gray-600 mt-3 leading-relaxed">{user.bio}</p>}

            {/* Niveau + progression */}
            <div className={`mt-4 rounded-2xl border-2 ${level.border} ${level.bg} p-4`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`font-bold ${level.color}`}>{level.icon} Niveau {user.level || 1} — {level.label}</span>
                <span className={`font-bold text-lg ${level.color}`}>{pts} pts</span>
              </div>
              {user.level < 5 && (
                <>
                  <div className="bg-white/60 rounded-full h-2 mb-1">
                    <div className={`h-2 rounded-full bg-current ${level.color}`} style={{width: Math.min(100, progress) + "%"}} />
                  </div>
                  <div className={`text-xs ${level.color} opacity-70`}>{nextPts - pts} pts pour atteindre le niveau {(user.level||1)+1}</div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {icon: "⭐", label: "Score", value: user.reputationScore || 0},
            {icon: "🏅", label: "Badges", value: badges.length},
            {icon: "🚀", label: "Projets", value: projects.length},
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.id ? "bg-green-600 text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:border-green-300"}`}>
              <span>{tab.icon}</span><span>{tab.label}</span>
              {tab.badge > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.id ? "bg-white/30 text-white" : "bg-gray-100 text-gray-600"}`}>{tab.badge}</span>}
            </button>
          ))}
        </div>

        {/* Vue générale */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {badges.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-3 text-sm">🏅 Badges récents</h3>
                <div className="flex flex-wrap gap-2">
                  {badges.slice(0,6).map((b: any) => (
                    <div key={b.badge} title={b.label} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:bg-yellow-50 hover:border-yellow-200 transition-colors">
                      <span className="text-lg">{b.icon}</span>
                      <span>{b.label}</span>
                    </div>
                  ))}
                  {badges.length > 6 && <span className="text-xs text-gray-400 self-center">+{badges.length-6} autres</span>}
                </div>
              </div>
            )}
            {events.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-3 text-sm">⭐ Dernière activité</h3>
                <div className="space-y-2">
                  {events.slice(0,3).map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                      <span className="text-sm text-gray-600">{e.description}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${e.points > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {e.points > 0 ? "+" : ""}{e.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Badges */}
        {activeTab === "badges" && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4 text-sm">🏅 Tous les badges ({badges.length})</h3>
            {badges.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">🌱</div>
                <p className="text-gray-400 text-sm">Aucun badge pour le moment</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {badges.map((b: any) => (
                  <div key={b.badge} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center gap-3 hover:bg-yellow-50 hover:border-yellow-200 transition-colors">
                    <span className="text-3xl">{b.icon}</span>
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{b.label}</div>
                      <div className="text-xs text-gray-400">{new Date(b.awardedAt).toLocaleDateString("fr-FR")}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Historique points */}
        {activeTab === "history" && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4 text-sm">⭐ Historique des points ({events.length})</h3>
            {events.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">📋</div>
                <p className="text-gray-400 text-sm">Aucun événement pour le moment</p>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((e: any) => (
                  <div key={e.id} className={`flex items-center justify-between p-3 rounded-xl border ${e.points > 0 ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{e.description}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{new Date(e.createdAt).toLocaleDateString("fr-FR", {day:"numeric", month:"long", year:"numeric"})}</div>
                    </div>
                    <span className={`text-sm font-bold px-3 py-1 rounded-full flex-shrink-0 ml-3 ${e.points > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {e.points > 0 ? "+" : ""}{e.points} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Projets */}
        {activeTab === "projects" && (
          <div className="space-y-3">
            {projects.map((p: any) => {
              const s = STATUS_LABELS[p.status] || {label: p.status, color: "text-gray-600 bg-gray-100"};
              const pct = Math.round(((p.raisedAmount||0)/(p.goalAmount||1))*100);
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.color} mb-1 inline-block`}>{s.label}</span>
                      <h4 className="font-bold text-gray-900">{p.title}</h4>
                      <div className="text-xs text-gray-400">{p.sector} · {p.city}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-700">{fmt(p.raisedAmount||0)} FCFA</div>
                      <div className="text-xs text-gray-400">/ {fmt(p.goalAmount||0)} FCFA</div>
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2 mb-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{width: Math.min(100,pct)+"%"}} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">{pct}% collecté</span>
                    <Link href={"/projects/"+p.id} className="text-xs text-green-600 hover:underline font-medium">Voir le projet →</Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
