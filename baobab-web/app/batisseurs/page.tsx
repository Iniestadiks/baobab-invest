"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;
const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");

const LEVEL_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string; min: string }> = {
  GRAND_MECENE: { label: "Grand Mécène",  icon: "💎", color: "text-purple-700", bg: "bg-purple-50 border-purple-200", min: "10M+" },
  OR:           { label: "Bâtisseur Or",  icon: "🥇", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", min: "2M+" },
  ARGENT:       { label: "Bâtisseur Argent", icon: "🥈", color: "text-gray-600", bg: "bg-gray-50 border-gray-200", min: "500k+" },
  BATISSEUR:    { label: "Bâtisseur",     icon: "🏗️", color: "text-orange-700", bg: "bg-orange-50 border-orange-200", min: "100k+" },
};

const BADGE_CONFIG: Record<string, { label: string; icon: string }> = {
  SEMEUR:          { label: "Semeur",          icon: "🌱" },
  JARDINIER:       { label: "Jardinier",       icon: "🌿" },
  BAOBAB:          { label: "Baobab",          icon: "🌳" },
  GRAND_BATISSEUR: { label: "Grand Bâtisseur", icon: "🏆" },
};

export default function BatisseursPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/fund/builders/public`)
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">Chargement...</p>
      </div>
    </div>
  );

  const builders = data?.builders || [];
  const stats = data?.stats || {};
  const grandMecenes = builders.filter((b: any) => b.level === "GRAND_MECENE");
  const orBuilders = builders.filter((b: any) => b.level === "OR");
  const argentBuilders = builders.filter((b: any) => b.level === "ARGENT");
  const batisseurs = builders.filter((b: any) => b.level === "BATISSEUR");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* NAV */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">🏗️</span>
            </div>
            <span className="font-bold text-gray-900">BAOBAB INVEST</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/fund" className="text-sm text-gray-600 hover:text-green-600">🌱 Fonds Solidaire</Link>
            <Link href="/auth/register?role=BUILDER" className="bg-yellow-500 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-yellow-600">
              Devenir Bâtisseur →
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <div className="text-5xl mb-4">🏗️</div>
          <h1 className="text-4xl font-bold mb-4">Hall of Fame — Bâtisseurs d'Avenir</h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto mb-10">
            Ces entreprises, institutions et mécènes font confiance à BAOBAB INVEST 
            pour soutenir les jeunes entrepreneurs africains. Rejoignez-les.
          </p>

          {/* Stats globales */}
          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-10">
            {[
              { label: "Total collecté", value: `${fmt(stats.totalRaised || 0)} FCFA`, icon: "💰" },
              { label: "Contributeurs", value: String(stats.totalContributors || 0), icon: "👥" },
              { label: "Projets aidés", value: String(stats.projectsHelped || 0), icon: "🚀" },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-2xl p-4 border border-white/15">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-xl font-bold">{s.value}</div>
                <div className="text-gray-400 text-xs mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <Link href="/auth/register?role=BUILDER" className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-8 py-4 rounded-2xl text-lg transition-all hover:scale-105 inline-block shadow-xl">
            🏗️ Rejoindre les Bâtisseurs
          </Link>
        </div>
      </div>

      {/* NIVEAUX */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">Les niveaux Bâtisseur</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {Object.entries(LEVEL_CONFIG).map(([key, lvl]) => (
            <div key={key} className={`border-2 ${lvl.bg} rounded-2xl p-4 text-center`}>
              <div className="text-3xl mb-2">{lvl.icon}</div>
              <div className={`font-bold text-sm ${lvl.color}`}>{lvl.label}</div>
              <div className="text-xs text-gray-500 mt-1">Dès {lvl.min} FCFA</div>
              <div className="mt-3 text-xs text-gray-600 space-y-1">
                {key === 'BATISSEUR' && <>
                  <div>✅ Badge + rapport mensuel</div>
                  <div>✅ Mention sur projets</div>
                </>}
                {key === 'ARGENT' && <>
                  <div>✅ Logo sur le site</div>
                  <div>✅ Attestation RSE</div>
                  <div>✅ Accès projets anticipé</div>
                </>}
                {key === 'OR' && <>
                  <div>✅ Page dédiée</div>
                  <div>✅ Contact entrepreneurs</div>
                  <div>✅ Rapport certifié annuel</div>
                </>}
                {key === 'GRAND_MECENE' && <>
                  <div>✅ Naming campagne</div>
                  <div>✅ Partenariat officiel</div>
                  <div>✅ Siège consultatif</div>
                </>}
              </div>
            </div>
          ))}
        </div>

        {/* GRAND MÉCÈNES */}
        {grandMecenes.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>💎</span> Grands Mécènes
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">10M+ FCFA</span>
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {grandMecenes.map((b: any, i: number) => <BuilderCard key={i} builder={b} size="large" />)}
            </div>
          </div>
        )}

        {/* BÂTISSEURS OR */}
        {orBuilders.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>🥇</span> Bâtisseurs Or
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">2M+ FCFA</span>
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orBuilders.map((b: any, i: number) => <BuilderCard key={i} builder={b} size="medium" />)}
            </div>
          </div>
        )}

        {/* BÂTISSEURS ARGENT */}
        {argentBuilders.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>🥈</span> Bâtisseurs Argent
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">500k+ FCFA</span>
            </h2>
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
              {argentBuilders.map((b: any, i: number) => <BuilderCard key={i} builder={b} size="small" />)}
            </div>
          </div>
        )}

        {/* BÂTISSEURS */}
        {batisseurs.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>🏗️</span> Bâtisseurs
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">100k+ FCFA</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {batisseurs.map((b: any, i: number) => <BuilderCard key={i} builder={b} size="mini" />)}
            </div>
          </div>
        )}

        {/* Aucun bâtisseur */}
        {builders.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🏗️</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Soyez le premier Bâtisseur !</h3>
            <p className="text-gray-500 mb-6">Rejoignez le mouvement et soutenez les jeunes entrepreneurs africains.</p>
            <Link href="/auth/register?role=BUILDER" className="bg-yellow-500 text-white font-bold px-8 py-3 rounded-2xl hover:bg-yellow-600 inline-block">
              Devenir Bâtisseur →
            </Link>
          </div>
        )}

        {/* CTA */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 text-white text-center mt-8">
          <h3 className="text-2xl font-bold mb-3">Votre entreprise veut avoir un impact ?</h3>
          <p className="text-gray-300 mb-6">Rejoignez les Bâtisseurs BAOBAB INVEST. Transparence totale, impact mesurable, visibilité garantie.</p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/auth/register?role=BUILDER" className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-8 py-3 rounded-xl">
              🏗️ Devenir Bâtisseur
            </Link>
            <Link href="/fund" className="bg-white/20 hover:bg-white/30 text-white font-bold px-8 py-3 rounded-xl border border-white/30">
              🌱 Voir le Fonds Solidaire
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function BuilderCard({ builder: b, size }: { builder: any; size: "large"|"medium"|"small"|"mini" }) {
  const lvl = LEVEL_CONFIG[b.level] || LEVEL_CONFIG.BATISSEUR;

  if (size === "mini") return (
    <div className={`border ${lvl.bg} rounded-xl p-3 text-center hover:shadow-md transition-shadow`}>
      <div className="text-2xl mb-1">{lvl.icon}</div>
      <div className="font-bold text-gray-900 text-xs truncate">{b.companyName || `${b.firstName} ${b.lastName}`}</div>
      <div className="text-xs text-gray-500 mt-0.5">{fmt(b.totalDonated)} FCFA</div>
    </div>
  );

  if (size === "small") return (
    <div className={`border-2 ${lvl.bg} rounded-2xl p-4 text-center hover:shadow-lg transition-shadow`}>
      <div className="text-3xl mb-2">{lvl.icon}</div>
      <div className="font-bold text-gray-900 text-sm">{b.companyName || `${b.firstName} ${b.lastName}`}</div>
      {b.sector && <div className="text-xs text-gray-500 mt-0.5">{b.sector}</div>}
      <div className={`text-sm font-bold mt-2 ${lvl.color}`}>{fmt(b.totalDonated)} FCFA</div>
      <div className="flex justify-center gap-1 mt-2">
        {b.badges?.slice(0, 2).map((badge: string) => (
          <span key={badge} className="text-xs">{BADGE_CONFIG[badge]?.icon}</span>
        ))}
      </div>
    </div>
  );

  if (size === "medium") return (
    <div className={`border-2 ${lvl.bg} rounded-2xl p-5 hover:shadow-lg transition-shadow`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border-2 ${lvl.bg}`}>
          {lvl.icon}
        </div>
        <div>
          <div className="font-bold text-gray-900">{b.companyName || `${b.firstName} ${b.lastName}`}</div>
          {b.sector && <div className="text-xs text-gray-500">{b.sector.replace(/_/g, " ")}</div>}
        </div>
      </div>
      {b.description && <p className="text-xs text-gray-600 mb-3 line-clamp-2">{b.description}</p>}
      <div className="flex justify-between items-center">
        <div>
          <div className={`font-bold ${lvl.color}`}>{fmt(b.totalDonated)} FCFA</div>
          <div className="text-xs text-gray-400">{b.contributions} contribution(s)</div>
        </div>
        <div className="flex gap-1">
          {b.badges?.map((badge: string) => (
            <span key={badge} title={BADGE_CONFIG[badge]?.label} className="text-lg">{BADGE_CONFIG[badge]?.icon}</span>
          ))}
        </div>
      </div>
      {b.website && (
        <a href={b.website} target="_blank" rel="noopener noreferrer" className="mt-2 text-xs text-blue-600 hover:underline block truncate">
          🌐 {b.website}
        </a>
      )}
    </div>
  );

  // large
  return (
    <div className={`border-2 ${lvl.bg} rounded-3xl p-6 hover:shadow-xl transition-shadow`}>
      <div className="flex items-start gap-4 mb-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-3xl shadow-lg">
          {lvl.icon}
        </div>
        <div className="flex-1">
          <div className="font-bold text-gray-900 text-xl">{b.companyName || `${b.firstName} ${b.lastName}`}</div>
          {b.sector && <div className="text-sm text-gray-500">{b.sector.replace(/_/g, " ")}</div>}
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${lvl.bg} ${lvl.color} border mt-1 inline-block`}>
            {lvl.icon} {lvl.label}
          </span>
        </div>
      </div>
      {b.description && <p className="text-sm text-gray-600 mb-4 leading-relaxed">{b.description}</p>}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl p-3 text-center">
          <div className={`text-xl font-bold ${lvl.color}`}>{fmt(b.totalDonated)} FCFA</div>
          <div className="text-xs text-gray-500">Total donné</div>
        </div>
        <div className="bg-white rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-gray-900">{b.contributions}</div>
          <div className="text-xs text-gray-500">Contributions</div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {b.badges?.map((badge: string) => (
            <span key={badge} title={BADGE_CONFIG[badge]?.label} className="text-xl">{BADGE_CONFIG[badge]?.icon}</span>
          ))}
        </div>
        {b.website && (
          <a href={b.website} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
            🌐 {b.website}
          </a>
        )}
      </div>
    </div>
  );
}
