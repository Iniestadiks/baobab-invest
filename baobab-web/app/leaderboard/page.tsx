"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

const LEVEL_INFO: Record<number, {label: string, icon: string, color: string}> = {
  1: {label: "Graine",       icon: "🌱", color: "text-gray-600"},
  2: {label: "Pousse",       icon: "🌿", color: "text-green-600"},
  3: {label: "Arbre",        icon: "🌳", color: "text-blue-600"},
  4: {label: "Baobab",       icon: "🌲", color: "text-purple-600"},
  5: {label: "Grand Baobab", icon: "🏆", color: "text-yellow-600"},
};

function fmt(n: number) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

export default function LeaderboardPage() {
  const [role, setRole] = useState("INVESTOR");
  const [period, setPeriod] = useState("all");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/reputation/leaderboard?role=${role}&period=${period}`)
      .then(r => r.json())
      .then(d => { if (d.success) setUsers(d.data); setLoading(false); });
  }, [role, period]);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="font-bold text-gray-900">BAOBAB INVEST</span>
          </Link>
          <span className="text-sm font-bold text-gray-700">🏆 Classement</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🏆 Classement BAOBAB INVEST</h1>
          <p className="text-gray-500">Les meilleurs investisseurs et entrepreneurs de la plateforme</p>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-3 justify-center mb-6">
          <div className="flex bg-white rounded-xl border border-gray-200 p-1">
            {[["INVESTOR","💰 Investisseurs"],["ENTREPRENEUR","🚀 Entrepreneurs"],["MENTOR","🎓 Mentors"]].map(([r,l]) => (
              <button key={r} onClick={() => setRole(r)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${role === r ? "bg-green-600 text-white" : "text-gray-600 hover:text-green-600"}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex bg-white rounded-xl border border-gray-200 p-1">
            {[["all","Tout temps"],["year","Cette année"],["month","Ce mois"]].map(([p,l]) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${period === p ? "bg-green-600 text-white" : "text-gray-600 hover:text-green-600"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Top 3 */}
        {users.length >= 3 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[users[1], users[0], users[2]].map((u, idx) => {
              const pos = idx === 0 ? 2 : idx === 1 ? 1 : 3;
              const level = LEVEL_INFO[u.level || 1];
              return (
                <div key={u.id} className={`bg-white rounded-2xl border-2 p-4 text-center ${pos === 1 ? "border-yellow-400 shadow-lg scale-105" : "border-gray-200"}`}>
                  <div className="text-3xl mb-1">{medals[pos-1]}</div>
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-2">
                    {u.firstName?.[0]}{u.lastName?.[0]}
                  </div>
                  <div className="font-bold text-gray-900 text-sm">{u.firstName} {u.lastName?.[0]}.</div>
                  <div className="text-xs text-gray-400">{u.city}</div>
                  <div className={`text-xs font-bold mt-1 ${level.color}`}>{level.icon} {level.label}</div>
                  <div className="text-lg font-bold text-green-600 mt-1">{u.reputationPoints} pts</div>
                  {u.totalInvested && <div className="text-xs text-gray-400">{fmt(u.totalInvested)} FCFA</div>}
                  <div className="flex justify-center gap-1 mt-2">
                    {(u.userBadges || []).slice(0,3).map((b: any) => (
                      <span key={b.badge} title={b.label} className="text-lg">{b.icon}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Liste complète */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Chargement...</div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-5xl mb-3">🌱</div>
              <p className="text-gray-500">Aucun classement disponible pour le moment</p>
            </div>
          ) : users.map((u, idx) => {
            const level = LEVEL_INFO[u.level || 1];
            return (
              <div key={u.id} className={`flex items-center gap-4 p-4 border-b border-gray-50 hover:bg-gray-50 ${idx < 3 ? "bg-yellow-50/30" : ""}`}>
                <div className="w-8 text-center font-bold text-gray-500 flex-shrink-0">
                  {idx < 3 ? medals[idx] : "#" + (idx+1)}
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                  {u.firstName?.[0]}{u.lastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900">{u.firstName} {u.lastName?.[0]}.</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs font-bold ${level.color}`}>{level.icon} {level.label}</span>
                    {u.city && <span className="text-xs text-gray-400">· {u.city}</span>}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {(u.userBadges || []).slice(0,3).map((b: any) => (
                    <span key={b.badge} title={b.label} className="text-lg">{b.icon}</span>
                  ))}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-green-600">{u.reputationPoints} pts</div>
                  {u.totalInvested > 0 && <div className="text-xs text-gray-400">{fmt(u.totalInvested)} FCFA</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
