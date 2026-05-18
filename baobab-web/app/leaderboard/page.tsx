"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

const LEVEL_INFO: Record<number, {label: string, icon: string, color: string, bg: string}> = {
  1: {label: "Graine",       icon: "🌱", color: "text-gray-600",   bg: "bg-gray-100"},
  2: {label: "Pousse",       icon: "🌿", color: "text-green-600",  bg: "bg-green-100"},
  3: {label: "Arbre",        icon: "🌳", color: "text-blue-600",   bg: "bg-blue-100"},
  4: {label: "Baobab",       icon: "🌲", color: "text-purple-600", bg: "bg-purple-100"},
  5: {label: "Grand Baobab", icon: "🏆", color: "text-yellow-600", bg: "bg-yellow-100"},
};

function fmt(n: number) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

function Avatar({ user, size = "md" }: { user: any, size?: "sm"|"md"|"lg" }) {
  const sizes = { sm: "w-8 h-8 text-sm", md: "w-12 h-12 text-base", lg: "w-16 h-16 text-xl" };
  if (user.profileImageUrl) {
    return <img src={user.profileImageUrl} alt={user.firstName}
      className={`${sizes[size]} rounded-full object-cover border-2 border-white shadow`} />;
  }
  return (
    <div className={`${sizes[size]} bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow flex-shrink-0`}>
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
  return <Link href={href} className="text-xs text-green-600 hover:underline font-medium">Mon espace →</Link>;
}

export default function LeaderboardPage() {
  const [role, setRole] = useState("INVESTOR");
  const [period, setPeriod] = useState("all");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/reputation/leaderboard?role=${role}&period=${period}`)
      .then(r => r.json())
      .then(d => { if (d.success) setUsers(d.data || []); setLoading(false); });
  }, [role, period]);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="font-bold text-gray-900">BAOBAB INVEST</span>
          </Link>
          <span className="text-sm font-bold text-gray-700">🏆 Classement</span>
          <DashboardLink />
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🏆 Classement BAOBAB INVEST</h1>
          <p className="text-gray-500">Les meilleurs investisseurs et entrepreneurs de la communauté</p>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-3 justify-center mb-8">
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

        {loading ? (
          <div className="text-center py-20 text-gray-400">
            <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            Chargement...
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
            <div className="text-5xl mb-3">🌱</div>
            <p className="text-gray-500 font-medium">Aucun classement disponible pour le moment</p>
            <p className="text-gray-400 text-sm mt-1">Soyez le premier à rejoindre !</p>
          </div>
        ) : (
          <>
            {/* Podium Top 3 */}
            {users.length >= 2 && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[users[1], users[0], users[2]].map((u, idx) => {
                  if (!u) return <div key={idx}></div>;
                  const pos = idx === 0 ? 2 : idx === 1 ? 1 : 3;
                  const level = LEVEL_INFO[u.level || 1];
                  return (
                    <div key={u.id} className={`bg-white rounded-2xl border-2 p-4 text-center transition-all ${pos === 1 ? "border-yellow-400 shadow-xl -translate-y-2" : pos === 2 ? "border-gray-300 shadow-md" : "border-orange-300 shadow-md"}`}>
                      <div className="text-3xl mb-2">{medals[pos-1]}</div>
                      <div className="flex justify-center mb-2">
                        <Avatar user={u} size="lg" />
                      </div>
                      <div className="font-bold text-gray-900">{u.firstName} {u.lastName?.[0]}.</div>
                      <div className="text-xs text-gray-400 mb-1">{u.city}{u.country && u.country !== "SN" ? " 🌍" : ""}</div>
                      <div className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block mb-2 ${level.bg} ${level.color}`}>
                        {level.icon} {level.label}
                      </div>
                      <div className="text-xl font-bold text-green-600">{u.reputationPoints} pts</div>
                      {u.totalInvested > 0 && <div className="text-xs text-gray-400 mt-0.5">{fmt(u.totalInvested)} FCFA</div>}
                      <div className="flex justify-center gap-1 mt-2 mb-3">
                        {(u.userBadges || []).slice(0,3).map((b: any) => (
                          <span key={b.badge} title={b.label} className="text-xl">{b.icon}</span>
                        ))}
                      </div>
                      <Link href={`/profile/${u.id}`}
                        className="block text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-xl hover:bg-green-100 font-medium transition-colors">
                        Voir le profil →
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Liste complète */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="font-bold text-gray-900 text-sm">Classement complet</span>
                <span className="text-xs text-gray-400">{users.length} participant(s)</span>
              </div>
              {users.map((u, idx) => {
                const level = LEVEL_INFO[u.level || 1];
                return (
                  <div key={u.id} className={`flex items-center gap-4 px-5 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${idx < 3 ? "bg-yellow-50/20" : ""}`}>
                    <div className="w-7 text-center font-bold text-gray-500 flex-shrink-0 text-sm">
                      {idx < 3 ? medals[idx] : <span className="text-gray-400">#{idx+1}</span>}
                    </div>
                    <Avatar user={u} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm">{u.firstName} {u.lastName?.[0]}.</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-xs font-bold ${level.color}`}>{level.icon} {level.label}</span>
                        {u.city && <span className="text-xs text-gray-400">· {u.city}</span>}
                        {u.country && u.country !== "SN" && <span className="text-xs">🌍</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {(u.userBadges || []).slice(0,4).map((b: any) => (
                        <span key={b.badge} title={b.label} className="text-lg">{b.icon}</span>
                      ))}
                    </div>
                    <div className="text-right flex-shrink-0 mr-3">
                      <div className="font-bold text-green-600">{u.reputationPoints} pts</div>
                      {u.totalInvested > 0 && <div className="text-xs text-gray-400">{fmt(u.totalInvested)} FCFA</div>}
                    </div>
                    <Link href={`/profile/${u.id}`}
                      className="flex-shrink-0 text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-xl hover:bg-green-100 font-medium transition-colors whitespace-nowrap">
                      Voir profil
                    </Link>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
