"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");

const BADGE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  SEMEUR:          { label: "Semeur",          icon: "🌱", color: "text-green-700",  bg: "bg-green-100" },
  JARDINIER:       { label: "Jardinier",       icon: "🌿", color: "text-emerald-700",bg: "bg-emerald-100" },
  BAOBAB:          { label: "Baobab",          icon: "🌳", color: "text-teal-700",   bg: "bg-teal-100" },
  GRAND_BATISSEUR: { label: "Grand Bâtisseur", icon: "🏆", color: "text-yellow-700", bg: "bg-yellow-100" },
  GRAND_MECENE:    { label: "Grand Mécène",    icon: "💎", color: "text-purple-700", bg: "bg-purple-100" },
};

const LEVEL_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  GRAND_MECENE: { label: "Grand Mécène",    icon: "💎", color: "text-purple-700", bg: "bg-purple-50" },
  OR:           { label: "Bâtisseur Or",    icon: "🥇", color: "text-yellow-700", bg: "bg-yellow-50" },
  ARGENT:       { label: "Bâtisseur Argent",icon: "🥈", color: "text-gray-600",   bg: "bg-gray-50" },
  BATISSEUR:    { label: "Bâtisseur",       icon: "🏗️", color: "text-orange-700", bg: "bg-orange-50" },
  CONTRIBUTEUR: { label: "Contributeur",    icon: "🌱", color: "text-green-700",  bg: "bg-green-50" },
};

export default function HallOfFame() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const API = process.env.NEXT_PUBLIC_API_URL || "http://46.202.132.161:3001";

  useEffect(() => {
    fetch(`${API}/api/fund/builders/public`)
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center text-white">
        <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p>Chargement du Hall of Fame...</p>
      </div>
    </div>
  );

  const builders = data?.builders || [];
  const stats = data?.stats || {};
  const topDonor = builders[0];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-br from-gray-900 via-yellow-900/20 to-gray-900 border-b border-yellow-500/20">
        <div className="max-w-5xl mx-auto px-4 py-12 text-center">
          <Link href="/" className="inline-block mb-6 text-yellow-400 hover:underline text-sm">← Retour</Link>
          <div className="text-6xl mb-4">🏛️</div>
          <h1 className="text-4xl font-bold mb-2">Hall of Fame</h1>
          <p className="text-yellow-400 text-lg font-medium">Bâtisseurs BAOBAB INVEST</p>
          <p className="text-gray-400 text-sm mt-2">Ces mécènes croient en la jeunesse africaine. Chaque don finance un rêve.</p>
          {/* Stats globales */}
          <div className="grid grid-cols-3 gap-4 mt-8 max-w-lg mx-auto">
            {[
              { label: "Total collecté", value: fmt(stats.totalRaised || 0) + " FCFA", icon: "💰" },
              { label: "Bâtisseurs", value: String(builders.length), icon: "🏗️" },
              { label: "Projets aidés", value: String(stats.projectsHelped || 0), icon: "🚀" },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-2xl p-4">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="font-bold text-yellow-400">{s.value}</div>
                <div className="text-xs text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        {/* Top Donateur */}
        {topDonor && (
          <div className="bg-gradient-to-r from-yellow-900/40 to-yellow-800/20 border border-yellow-500/40 rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">👑</span>
              <span className="text-yellow-400 font-bold text-lg">Grand Donateur All-Time</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center text-gray-900 font-bold text-2xl">
                {topDonor.firstName?.[0]}{topDonor.lastName?.[0]}
              </div>
              <div className="flex-1">
                <div className="font-bold text-xl">{topDonor.firstName} {topDonor.lastName}</div>
                {topDonor.companyName && <div className="text-yellow-400">{topDonor.companyName}</div>}
                <div className="text-gray-400 text-sm">{topDonor.sector || ""} · {topDonor.country}</div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {(topDonor.specialBadges || []).map((sb: string) => (
                    <span key={sb} className="text-xs bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 px-2 py-0.5 rounded-full font-bold">
                      {sb==='ROI_FONDS'?'👑 Roi du Fonds':sb==='FONDATEUR'?'⚡ Fondateur':sb==='FIDELE'?'🔥 Fidèle':sb}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-yellow-400">{fmt(topDonor.totalDonated)} FCFA</div>
                <div className="text-sm text-gray-400">{topDonor.contributions} contribution(s)</div>
                <div className="text-xs text-purple-400 mt-1">⭐ {topDonor.reputationPoints || 0} pts</div>
              </div>
            </div>
          </div>
        )}

        {/* Classement */}
        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-200">🏆 Classement des Bâtisseurs</h2>
          <div className="space-y-3">
            {builders.map((b: any, i: number) => {
              const lvl = LEVEL_CONFIG[b.level] || LEVEL_CONFIG.CONTRIBUTEUR;
              return (
                <div key={b.userId} className="bg-white/5 border border-white/10 hover:border-yellow-500/30 rounded-2xl p-4 transition-all">
                  <div className="flex items-center gap-4">
                    {/* Rang */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0 ${
                      i===0?'bg-yellow-500 text-gray-900':i===1?'bg-gray-400 text-gray-900':i===2?'bg-orange-700 text-white':'bg-white/10 text-gray-400'}`}>
                      {i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}
                    </div>
                    {/* Avatar */}
                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center text-gray-900 font-bold flex-shrink-0">
                      {b.firstName?.[0]}{b.lastName?.[0]}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold">{b.firstName} {b.lastName}</span>
                        {b.verified && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">✅ Vérifié</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lvl.color} bg-white/10`}>{lvl.icon} {lvl.label}</span>
                      </div>
                      {b.companyName && <div className="text-yellow-400/70 text-xs">{b.companyName}</div>}
                      <div className="text-gray-500 text-xs">{b.sector || ""} {b.country && `· ${b.country}`}</div>
                      {/* Badges */}
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {(b.badges || []).map((badge: string) => (
                          <span key={badge} className={`text-xs px-2 py-0.5 rounded-full ${BADGE_CONFIG[badge]?.bg || 'bg-gray-700'} ${BADGE_CONFIG[badge]?.color || 'text-gray-300'}`}>
                            {BADGE_CONFIG[badge]?.icon} {BADGE_CONFIG[badge]?.label}
                          </span>
                        ))}
                        {(b.specialBadges || []).map((sb: string) => (
                          <span key={sb} className="text-xs bg-yellow-400/10 text-yellow-300 border border-yellow-400/20 px-2 py-0.5 rounded-full">
                            {sb==='ROI_FONDS'?'👑':sb==='FONDATEUR'?'⚡':sb==='FIDELE'?'🔥':''} {sb.replace('_',' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                    {/* Montant + points */}
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-yellow-400 text-lg">{fmt(b.totalDonated)} F</div>
                      <div className="text-xs text-gray-400">{b.contributions} don(s)</div>
                      <div className="text-xs text-purple-400">⭐ {b.reputationPoints || 0} pts</div>
                      {b.donationStreak > 0 && <div className="text-xs text-orange-400">🔥 {b.donationStreak} mois</div>}
                    </div>
                  </div>
                  {/* Barre progression */}
                  {b.sharePercent > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Part du fonds total</span>
                        <span>{b.sharePercent}%</span>
                      </div>
                      <div className="bg-white/10 rounded-full h-1.5">
                        <div className="bg-yellow-400 h-1.5 rounded-full" style={{width:`${b.sharePercent}%`}} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center py-10 border-t border-white/10">
          <div className="text-4xl mb-4">🌱</div>
          <h3 className="text-xl font-bold mb-2">Rejoignez les Bâtisseurs</h3>
          <p className="text-gray-400 text-sm mb-6">Votre nom pourrait figurer ici. Chaque FCFA compte.</p>
          <Link href="/auth/register?role=BUILDER"
            className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold px-8 py-3 rounded-2xl inline-block transition-colors">
            Devenir Bâtisseur
          </Link>
        </div>
      </div>
    </div>
  );
}
