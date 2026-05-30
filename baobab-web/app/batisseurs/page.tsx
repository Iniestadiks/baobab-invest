"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");

const BADGE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string; pts: number; desc: string }> = {
  SEMEUR:          { label: "Semeur",          icon: "🌱", color: "text-green-700",  bg: "bg-green-100",  pts: 0,    desc: "Votre premier pas — bienvenue dans la famille BAOBAB" },
  JARDINIER:       { label: "Jardinier",       icon: "🌿", color: "text-emerald-700",bg: "bg-emerald-100",pts: 50,   desc: "Vous cultivez l'espoir. 50 pts franchis !" },
  BAOBAB:          { label: "Baobab",          icon: "🌳", color: "text-teal-700",   bg: "bg-teal-100",   pts: 200,  desc: "Solide comme un baobab. Votre impact est réel." },
  GRAND_BATISSEUR: { label: "Grand Bâtisseur", icon: "🏆", color: "text-yellow-700", bg: "bg-yellow-100", pts: 500,  desc: "Vous bâtissez l'Afrique de demain." },
  GRAND_MECENE:    { label: "Grand Mécène",    icon: "💎", color: "text-purple-700", bg: "bg-purple-100", pts: 1500, desc: "Légende vivante. Votre nom restera gravé." },
};

const SPECIAL_BADGES = [
  { key: "ROI_FONDS",   icon: "👑", label: "Roi du Fonds",   color: "text-yellow-300", bg: "bg-yellow-900/30 border-yellow-500/40", desc: "Plus grand donateur all-time de la plateforme" },
  { key: "FONDATEUR",   icon: "⚡", label: "Fondateur",      color: "text-purple-300", bg: "bg-purple-900/30 border-purple-500/40", desc: "1er contributeur de l'histoire du Fonds Solidaire" },
  { key: "FIDELE",      icon: "🔥", label: "Fidèle",         color: "text-orange-300", bg: "bg-orange-900/30 border-orange-500/40", desc: "3 mois consécutifs de contributions actives" },
  { key: "AMBASSADEUR", icon: "🌍", label: "Ambassadeur",    color: "text-blue-300",   bg: "bg-blue-900/30 border-blue-500/40",    desc: "A parrainé 3+ autres Bâtisseurs actifs" },
];

const HOW_TO_EARN = [
  { icon: "💝", action: "Don au Fonds Solidaire",        pts: "+1 pt / 1 000 FCFA", color: "text-green-400",  desc: "Chaque don alimente directement les projets jeunes" },
  { icon: "📈", action: "Investissement direct projet",  pts: "+2 pts / 1 000 FCFA", color: "text-blue-400",   desc: "Investissez et touchez des remboursements + points" },
  { icon: "🚀", action: "Fonds utilise votre argent",   pts: "+3 pts bonus",         color: "text-purple-400", desc: "Quand BAOBAB alloue depuis le fonds, vous gagnez" },
  { icon: "✅", action: "Remboursement reçu à temps",   pts: "+5 pts bonus",         color: "text-yellow-400", desc: "Chaque mensualité remboursée vous récompense" },
  { icon: "🌍", action: "Parrainer un Bâtisseur",       pts: "+20 pts bonus",        color: "text-pink-400",   desc: "Invitez 3 amis → badge Ambassadeur débloqué" },
];

const LEVEL_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string; min: number }> = {
  GRAND_MECENE: { label: "Grand Mécène",    icon: "💎", color: "text-purple-400", bg: "bg-purple-900/20", min: 10000000 },
  OR:           { label: "Bâtisseur Or",    icon: "🥇", color: "text-yellow-400", bg: "bg-yellow-900/20", min: 2000000 },
  ARGENT:       { label: "Bâtisseur Argent",icon: "🥈", color: "text-gray-300",   bg: "bg-gray-700/30",   min: 500000 },
  BATISSEUR:    { label: "Bâtisseur",       icon: "🏗️", color: "text-orange-400", bg: "bg-orange-900/20", min: 100000 },
  CONTRIBUTEUR: { label: "Contributeur",    icon: "🌱", color: "text-green-400",  bg: "bg-green-900/20",  min: 0 },
};

export default function HallOfFame() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"classement"|"comment"|"badges">("classement");
  const API = process.env.NEXT_PUBLIC_API_URL || "http://46.202.132.161:3001";

  useEffect(() => {
    fetch(`${API}/api/fund/builders/public`)
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center text-white">
        <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-400">Chargement du Hall of Fame...</p>
      </div>
    </div>
  );

  const builders = data?.builders || [];
  const stats = data?.stats || {};
  const topDonor = builders[0];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* HERO */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-900/30 via-gray-950 to-purple-900/20" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-yellow-500/5 rounded-full blur-3xl" />
        <div className="relative max-w-5xl mx-auto px-4 py-16 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-yellow-400 text-sm mb-8 transition-colors">
            ← Retour à BAOBAB INVEST
          </Link>
          <div className="text-7xl mb-6 animate-bounce">🏛️</div>
          <h1 className="text-5xl font-black mb-3 bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400 bg-clip-text text-transparent">
            Hall of Fame
          </h1>
          <p className="text-yellow-500 text-xl font-semibold mb-2">Bâtisseurs BAOBAB INVEST</p>
          <p className="text-gray-400 max-w-lg mx-auto">Ces mécènes croient en la jeunesse africaine. Leur générosité finance des rêves, crée des emplois, bâtit l'Afrique de demain.</p>

          {/* Stats hero */}
          <div className="grid grid-cols-3 gap-4 mt-10 max-w-lg mx-auto">
            {[
              { label: "Total collecté", value: fmt(stats.totalRaised || 0) + " F", icon: "💰", color: "text-green-400" },
              { label: "Bâtisseurs", value: String(builders.length), icon: "🏗️", color: "text-yellow-400" },
              { label: "Projets aidés", value: String(stats.projectsHelped || 0), icon: "🚀", color: "text-purple-400" },
            ].map(s => (
              <div key={s.label} className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-4 hover:border-yellow-500/30 transition-all">
                <div className="text-2xl mb-2">{s.icon}</div>
                <div className={`font-black text-xl ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* NAV SECTIONS */}
      <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-1 py-3">
            {[
              { id: "classement", label: "🏆 Classement", },
              { id: "comment",    label: "⭐ Comment gagner", },
              { id: "badges",     label: "🎖️ Badges & niveaux", },
            ].map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id as any)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeSection === s.id ? "bg-yellow-500 text-gray-900" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* CLASSEMENT */}
        {activeSection === "classement" && (
          <div className="space-y-4">
            {/* Top donateur */}
            {topDonor && (
              <div className="relative overflow-hidden bg-gradient-to-r from-yellow-900/40 via-yellow-800/20 to-yellow-900/40 border border-yellow-500/40 rounded-3xl p-6 mb-6">
                <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-400/5 rounded-full -mr-24 -mt-24" />
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-3xl">👑</span>
                  <span className="text-yellow-400 font-black text-xl">Grand Donateur All-Time</span>
                </div>
                <div className="flex items-center gap-5 flex-wrap">
                  <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center text-gray-900 font-black text-3xl shadow-lg shadow-yellow-900/50">
                    {topDonor.firstName?.[0]}{topDonor.lastName?.[0]}
                  </div>
                  <div className="flex-1">
                    <div className="font-black text-2xl">{topDonor.firstName} {topDonor.lastName}</div>
                    {topDonor.companyName && <div className="text-yellow-400 font-medium">{topDonor.companyName}</div>}
                    <div className="text-gray-400 text-sm mt-0.5">{topDonor.sector || "Mécène"} · {topDonor.country}</div>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {(topDonor.specialBadges || []).map((sb: string) => {
                        const cfg = SPECIAL_BADGES.find(x => x.key === sb);
                        return cfg ? (
                          <span key={sb} className={`text-xs px-3 py-1 rounded-full border font-bold ${cfg.bg} ${cfg.color}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-black text-yellow-400">{fmt(topDonor.totalDonated)}</div>
                    <div className="text-yellow-600 font-medium">FCFA donnés</div>
                    <div className="text-gray-400 text-sm mt-1">{topDonor.contributions} contribution(s)</div>
                    <div className="text-purple-400 text-sm font-bold mt-1">⭐ {topDonor.reputationPoints || 0} pts</div>
                    {topDonor.donationStreak > 0 && <div className="text-orange-400 text-sm">🔥 {topDonor.donationStreak} mois streak</div>}
                  </div>
                </div>
              </div>
            )}

            {/* Liste classement */}
            {builders.map((b: any, i: number) => {
              const lvl = LEVEL_CONFIG[b.level] || LEVEL_CONFIG.CONTRIBUTEUR;
              return (
                <div key={b.userId} className={`group relative bg-white/3 hover:bg-white/6 border border-white/8 hover:border-yellow-500/30 rounded-2xl p-4 transition-all ${i === 0 ? 'ring-1 ring-yellow-500/30' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg flex-shrink-0 transition-all ${
                      i===0?'bg-yellow-500 text-gray-900 shadow-lg shadow-yellow-900/50':
                      i===1?'bg-gray-400 text-gray-900':
                      i===2?'bg-orange-700 text-white':
                      'bg-white/8 text-gray-500'}`}>
                      {i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-400/80 to-yellow-600/80 rounded-xl flex items-center justify-center text-gray-900 font-black text-lg flex-shrink-0">
                      {b.firstName?.[0]}{b.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white">{b.firstName} {b.lastName}</span>
                        {b.verified && <span className="text-xs bg-green-500/15 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">✅ Vérifié</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border border-white/10 ${lvl.color} ${lvl.bg}`}>{lvl.icon} {lvl.label}</span>
                      </div>
                      {b.companyName && <div className="text-yellow-500/70 text-xs mt-0.5">{b.companyName}</div>}
                      <div className="text-gray-600 text-xs">{b.country}</div>
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {(b.badges || []).map((badge: string) => {
                          const cfg = BADGE_CONFIG[badge];
                          return cfg ? (
                            <span key={badge} className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} font-medium`}>
                              {cfg.icon} {cfg.label}
                            </span>
                          ) : null;
                        })}
                        {(b.specialBadges || []).map((sb: string) => {
                          const cfg = SPECIAL_BADGES.find(x => x.key === sb);
                          return cfg ? (
                            <span key={sb} className={`text-xs px-2 py-0.5 rounded-full border font-bold ${cfg.bg} ${cfg.color}`}>
                              {cfg.icon} {cfg.label}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-black text-yellow-400 text-xl">{fmt(b.totalDonated)} F</div>
                      <div className="text-gray-500 text-xs">{b.contributions} don(s)</div>
                      <div className="text-purple-400 text-xs font-bold">⭐ {b.reputationPoints || 0} pts</div>
                      {b.donationStreak > 0 && <div className="text-orange-400 text-xs">🔥 {b.donationStreak} mois</div>}
                    </div>
                  </div>
                  {b.sharePercent > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <div className="flex justify-between text-xs text-gray-600 mb-1.5">
                        <span>Part du fonds total</span>
                        <span className="text-yellow-500 font-bold">{b.sharePercent}%</span>
                      </div>
                      <div className="bg-white/5 rounded-full h-1.5">
                        <div className="bg-gradient-to-r from-yellow-500 to-yellow-300 h-1.5 rounded-full transition-all" style={{width:`${b.sharePercent}%`}} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {builders.length === 0 && (
              <div className="text-center py-20 text-gray-600">
                <div className="text-5xl mb-4">🌱</div>
                <p>Soyez le premier Bâtisseur !</p>
              </div>
            )}
          </div>
        )}

        {/* COMMENT GAGNER */}
        {activeSection === "comment" && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black mb-2">Comment gagner des points ?</h2>
              <p className="text-gray-500">Chaque action compte. Chaque point rapproche d'un badge supérieur.</p>
            </div>
            <div className="grid gap-4">
              {HOW_TO_EARN.map((h, i) => (
                <div key={i} className="bg-white/3 border border-white/8 hover:border-yellow-500/20 rounded-2xl p-5 flex items-center gap-5 transition-all group">
                  <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 group-hover:scale-110 transition-transform">
                    {h.icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-white">{h.action}</div>
                    <div className="text-gray-500 text-sm mt-0.5">{h.desc}</div>
                  </div>
                  <div className={`font-black text-lg flex-shrink-0 ${h.color}`}>{h.pts}</div>
                </div>
              ))}
            </div>
            {/* Règle inactivité */}
            <div className="bg-red-900/20 border border-red-500/20 rounded-2xl p-5 mt-4">
              <div className="flex items-start gap-4">
                <div className="text-3xl">⚠️</div>
                <div>
                  <div className="font-bold text-red-400 mb-2">Attention : inactivité = perte de points</div>
                  <div className="space-y-1 text-sm text-gray-400">
                    <div>• Après <strong className="text-white">3 mois</strong> sans contribution : <strong className="text-red-400">-5 pts/mois</strong></div>
                    <div>• Après <strong className="text-white">6 mois</strong> sans contribution : <strong className="text-red-400">-10 pts/mois</strong></div>
                    <div className="text-green-400 mt-2">✅ Plancher protégé : vous ne pouvez pas perdre votre badge actuel (seulement les points au-dessus)</div>
                  </div>
                </div>
              </div>
            </div>
            {/* CTA */}
            <div className="text-center pt-4">
              <Link href="/auth/register?role=BUILDER"
                className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-black px-8 py-4 rounded-2xl inline-block transition-all hover:scale-105 shadow-lg shadow-yellow-900/30">
                Commencer à contribuer →
              </Link>
            </div>
          </div>
        )}

        {/* BADGES & NIVEAUX */}
        {activeSection === "badges" && (
          <div className="space-y-8">
            {/* Badges standards */}
            <div>
              <h2 className="text-xl font-black mb-5">🏅 Badges de progression</h2>
              <div className="space-y-3">
                {Object.entries(BADGE_CONFIG).map(([key, b]) => (
                  <div key={key} className={`flex items-center gap-4 p-4 rounded-2xl border border-white/8 ${b.bg.replace('100','900/20')}`}>
                    <div className="text-4xl">{b.icon}</div>
                    <div className="flex-1">
                      <div className={`font-bold text-lg ${b.color}`}>{b.label}</div>
                      <div className="text-gray-500 text-sm">{b.desc}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-black text-xl ${b.color}`}>{b.pts} pts</div>
                      <div className="text-gray-600 text-xs">requis</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Niveaux par montant */}
            <div>
              <h2 className="text-xl font-black mb-5">🏗️ Niveaux par montant donné</h2>
              <div className="space-y-3">
                {Object.entries(LEVEL_CONFIG).reverse().map(([key, l]) => (
                  <div key={key} className={`flex items-center gap-4 p-4 rounded-2xl border border-white/8 ${l.bg}`}>
                    <div className="text-4xl">{l.icon}</div>
                    <div className="flex-1">
                      <div className={`font-bold text-lg ${l.color}`}>{l.label}</div>
                    </div>
                    <div className={`font-black text-lg ${l.color}`}>
                      {l.min > 0 ? `${fmt(l.min)} FCFA+` : "Dès le 1er don"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Badges spéciaux */}
            <div>
              <h2 className="text-xl font-black mb-5">✨ Badges spéciaux</h2>
              <div className="grid md:grid-cols-2 gap-3">
                {SPECIAL_BADGES.map(b => (
                  <div key={b.key} className={`flex items-start gap-4 p-4 rounded-2xl border ${b.bg}`}>
                    <div className="text-4xl">{b.icon}</div>
                    <div>
                      <div className={`font-bold ${b.color}`}>{b.label}</div>
                      <div className="text-gray-500 text-sm mt-1">{b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CTA global */}
        <div className="text-center py-16 border-t border-white/5 mt-10">
          <div className="text-5xl mb-4">🌱</div>
          <h3 className="text-2xl font-black mb-2">Votre nom ici ?</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">Rejoignez les Bâtisseurs et financez la prochaine génération d'entrepreneurs africains.</p>
          <Link href="/auth/register?role=BUILDER"
            className="bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-yellow-300 text-gray-900 font-black px-10 py-4 rounded-2xl inline-block transition-all hover:scale-105 shadow-xl shadow-yellow-900/30">
            Devenir Bâtisseur BAOBAB
          </Link>
        </div>
      </div>
    </div>
  );
}
