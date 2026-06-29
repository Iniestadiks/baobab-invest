"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const SECTORS = ["Tous","AGRICULTURE","COMMERCE","TECH","ARTISANAT","EDUCATION","SANTE","SERVICES","ENERGIE","TRANSPORT"];
const RISKS = [{ value: "", label: "Tous les risques" },{ value: "LOW", label: "🟢 Faible" },{ value: "MEDIUM", label: "🟡 Modéré" },{ value: "HIGH", label: "🔴 Élevé" }];
const SORTS = [{ value: "newest", label: "Plus récents" },{ value: "popular", label: "Plus populaires" },{ value: "ending", label: "Se terminent bientôt" }];

interface Project {
  id: string; title: string; description: string; sector: string;
  city: string; country: string; goalAmount: number; raisedAmount: number;
  minimumInvestment: number; expectedReturn: number; durationMonths: number;
  riskLevel: string; coverImageUrl?: string; investorCount: number;
  fundingPercent: number; daysLeft: number | null; bankabilityScore: number;
  entrepreneur: { firstName: string; lastName: string };
  mentor?: { firstName: string; lastName: string };
}

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  LOW:    { label: "Faible",  color: "text-green-700",  bg: "bg-green-100" },
  MEDIUM: { label: "Modéré",  color: "text-yellow-700", bg: "bg-yellow-100" },
  HIGH:   { label: "Élevé",   color: "text-red-700",    bg: "bg-red-100" },
};

const SECTOR_EMOJI: Record<string, string> = {
  AGRICULTURE:"🌾",COMMERCE:"🛒",TECH:"💻",ARTISANAT:"🎨",
  EDUCATION:"📚",SANTE:"🏥",SERVICES:"🔧",ENERGIE:"⚡",TRANSPORT:"🚌",AUTRE:"📦",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ sector: "", riskLevel: "", sortBy: "newest", search: "" });
  const [simulate, setSimulate] = useState<{ projectId: string; amount: string; result: any } | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.sector && filters.sector !== "Tous") params.set("sector", filters.sector);
      if (filters.riskLevel) params.set("riskLevel", filters.riskLevel);
      if (filters.sortBy) params.set("sortBy", filters.sortBy);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects?${params}`);
      const data = await res.json();
      if (data.success) { setProjects(data.data.projects); setTotal(data.data.pagination.total); }
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchProjects(); }, [filters.sector, filters.riskLevel, filters.sortBy]);

  const runSimulation = async (projectId: string) => {
    const amount = simulate?.amount;
    if (!amount || Number(amount) < 500) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects/${projectId}/simulate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(amount) }),
    });
    const data = await res.json();
    if (data.success) setSimulate(s => s ? { ...s, result: data.data } : null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🌳</span>
            <span className="font-bold text-green-600">KORAPACT</span>
          </Link>
          <div className="flex gap-3">
            <Link href="/dashboard/redirect" className="text-gray-600 hover:text-green-600 font-medium px-4 py-2 rounded-xl transition-colors">Dashboard</Link>
            <Link href="/auth/login" className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-xl transition-colors">Connexion</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="bg-gradient-to-r from-green-900 to-green-700 text-white py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Catalogue des Projets</h1>
          <p className="text-green-200">{total} projet{total > 1 ? "s" : ""} vérifié{total > 1 ? "s" : ""} disponible{total > 1 ? "s" : ""} — Investis dès 500 FCFA</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filtres */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-8 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">SECTEUR</label>
              <div className="flex flex-wrap gap-2">
                {SECTORS.map(s => (
                  <button key={s} onClick={() => setFilters(f => ({ ...f, sector: s === "Tous" ? "" : s }))}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      (s === "Tous" && !filters.sector) || filters.sector === s
                        ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-green-50"}`}>
                    {SECTOR_EMOJI[s] || ""} {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">RISQUE</label>
              <select value={filters.riskLevel} onChange={e => setFilters(f => ({ ...f, riskLevel: e.target.value }))} className="input-field">
                {RISKS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">TRIER PAR</label>
              <select value={filters.sortBy} onChange={e => setFilters(f => ({ ...f, sortBy: e.target.value }))} className="input-field">
                {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={fetchProjects} className="btn-primary w-full">
                Rechercher
              </button>
            </div>
          </div>
        </div>

        {/* Grille projets */}
        {loading ? (
          <div className="text-center py-20">
            <div className="text-5xl animate-bounce mb-4">🌳</div>
            <p className="text-gray-500">Chargement des projets...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <div className="text-5xl mb-4">🌱</div>
            <h3 className="font-bold text-gray-900 text-lg mb-2">Aucun projet trouvé</h3>
            <p className="text-gray-500">Essaie d'autres filtres</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(p => {
              const risk = RISK_CONFIG[p.riskLevel] || RISK_CONFIG.MEDIUM;
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
                  {/* Cover */}
                  <div className="h-44 bg-gradient-to-br from-green-100 to-green-200 relative overflow-hidden">
                    {p.coverImageUrl ? (
                      <img src={p.coverImageUrl} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl">
                        {SECTOR_EMOJI[p.sector] || "📦"}
                      </div>
                    )}
                    <div className="absolute top-3 left-3 flex gap-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${risk.bg} ${risk.color}`}>
                        {risk.label}
                      </span>
                      {p.mentor && (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                          🎓 Mentoré
                        </span>
                      )}
                    </div>
                    {p.daysLeft !== null && p.daysLeft <= 7 && (
                      <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        ⏰ {p.daysLeft}j restants
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs bg-green-50 text-green-700 font-medium px-2 py-0.5 rounded-full">
                        {SECTOR_EMOJI[p.sector]} {p.sector}
                      </span>
                      <span className="text-xs text-gray-400">📍 {p.city}</span>
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg mb-1 line-clamp-1">{p.title}</h3>
                    <p className="text-gray-500 text-sm line-clamp-2 mb-4">{p.description}</p>

                    {/* Jauge */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{p.raisedAmount.toLocaleString()} FCFA</span>
                        <span className="font-semibold text-green-600">{p.fundingPercent}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(p.fundingPercent, 100)}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Objectif : {p.goalAmount.toLocaleString()} FCFA</span>
                        <span>{p.investorCount} investisseur{p.investorCount > 1 ? "s" : ""}</span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                      <div className="bg-green-50 rounded-xl p-2">
                        <div className="text-sm font-bold text-green-700">+{p.expectedReturn}%</div>
                        <div className="text-xs text-gray-400">Retour</div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-2">
                        <div className="text-sm font-bold text-gray-700">{p.durationMonths} mois</div>
                        <div className="text-xs text-gray-400">Durée</div>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-2">
                        <div className="text-sm font-bold text-blue-700">{p.bankabilityScore}/100</div>
                        <div className="text-xs text-gray-400">Score</div>
                      </div>
                    </div>

                    {/* Simulation rapide */}
                    {simulate?.projectId === p.id ? (
                      <div className="mb-3 bg-green-50 border border-green-200 rounded-xl p-3">
                        <div className="flex gap-2 mb-2">
                          <input type="number" placeholder="Montant FCFA" value={simulate.amount}
                            onChange={e => setSimulate(s => s ? { ...s, amount: e.target.value } : null)}
                            className="input-field text-sm py-1 flex-1" />
                          <button onClick={() => runSimulation(p.id)} className="bg-green-600 text-white text-xs px-3 rounded-xl font-semibold">
                            Simuler
                          </button>
                        </div>
                        {simulate.result && (
                          <div className="text-xs text-green-800 space-y-1">
                            <div className="flex justify-between"><span>Investi</span><span className="font-bold">{simulate.result.invested?.toLocaleString()} FCFA</span></div>
                            <div className="flex justify-between"><span>Retour net estimé</span><span className="font-bold text-green-600">+{simulate.result.expectedNetReturn?.toLocaleString()} FCFA</span></div>
                            <div className="flex justify-between"><span>Total reçu</span><span className="font-bold">{simulate.result.totalReceived?.toLocaleString()} FCFA</span></div>
                            <div className="flex justify-between text-gray-500"><span>Fonds de garantie (2%)</span><span>{simulate.result.guaranteeFundContrib?.toLocaleString()} FCFA</span></div>
                          </div>
                        )}
                        <button onClick={() => setSimulate(null)} className="text-xs text-gray-400 mt-2 hover:text-gray-600">Fermer</button>
                      </div>
                    ) : (
                      <button onClick={() => setSimulate({ projectId: p.id, amount: "", result: null })}
                        className="w-full text-xs text-green-600 border border-green-200 rounded-xl py-2 mb-3 hover:bg-green-50 transition-colors font-medium">
                        💰 Simuler mon rendement
                      </button>
                    )}

                    <div className="flex gap-2">
                      <Link href={`/projects/${p.id}`} className="flex-1 btn-primary py-2 text-sm">
                        Voir le projet →
                      </Link>
                    </div>

                    <div className="text-xs text-gray-400 mt-3 flex items-center justify-between">
                      <span>Par {p.entrepreneur.firstName} {p.entrepreneur.lastName}</span>
                      <span>Min. {p.minimumInvestment.toLocaleString()} FCFA</span>
                    </div>
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
