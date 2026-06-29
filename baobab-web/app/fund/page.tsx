"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;
const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");

const BADGE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  SEMEUR:          { label: "Semeur",          icon: "🌱", color: "bg-green-100 text-green-700" },
  JARDINIER:       { label: "Jardinier",       icon: "🌿", color: "bg-emerald-100 text-emerald-700" },
  BAOBAB:          { label: "Baobab",          icon: "🌳", color: "bg-teal-100 text-teal-700" },
  GRAND_BATISSEUR: { label: "Grand Bâtisseur", icon: "🏆", color: "bg-yellow-100 text-yellow-700" },
};

export default function FundPage() {
  const [stats, setStats] = useState<any>(null);
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [operator, setOperator] = useState("WAVE");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview"|"contributions"|"projects"|"campaigns">("overview");

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/fund/stats`).then(r => r.json()),
      fetch(`${API}/api/fund/contributions?limit=10`).then(r => r.json()),
    ]).then(([s, c]) => {
      if (s.success) setStats(s.data);
      if (c.success) setContributions(c.data.contributions || []);
    }).finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    if (!amount || Number(amount) < 500) { setError("Montant minimum : 500 FCFA"); return; }
    if (!phone) { setError("Numéro de téléphone requis"); return; }
    setSubmitting(true); setError("");
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const res = await fetch(`${API}/api/fund/contribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ amount: Number(amount), anonymous, message, paymentMethod: operator, operator, guestPhone: phone })
      });
      const data = await res.json();
      if (data.success) {
        // Confirmer immédiatement (mode test)
        await fetch(`${API}/api/fund/confirm/${data.data.contributionId}`, { method: "POST" });
        setSuccess(`✅ Merci ! Votre contribution de ${fmt(Number(amount))} FCFA a été enregistrée.`);
        setShowForm(false); setAmount(""); setMessage(""); setPhone("");
        // Recharger stats
        fetch(`${API}/api/fund/stats`).then(r => r.json()).then(s => { if (s.success) setStats(s.data); });
      } else setError(data.message);
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">Chargement du fonds...</p>
      </div>
    </div>
  );

  const fund = stats?.fund || {};
  const pct = fund.totalReceived > 0 ? Math.round((fund.totalAllocated / fund.totalReceived) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* NAV */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="font-bold text-gray-900">KORAPACT</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-gray-600 hover:text-green-600">Se connecter</Link>
            <button onClick={() => setShowForm(true)}
              className="bg-green-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-green-700">
              🌱 Contribuer
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <div className="bg-gradient-to-br from-green-700 via-green-800 to-green-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <div className="text-5xl mb-4">🌳</div>
          <h1 className="text-4xl font-bold mb-4">Fonds Solidaire BAOBAB</h1>
          <p className="text-green-200 text-lg max-w-2xl mx-auto mb-8">
            Ensemble, finançons les rêves des jeunes entrepreneurs africains. 
            Chaque contribution, même modeste, change une vie.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total collecté", value: fmt(fund.totalReceived || 0) + " FCFA", icon: "💰" },
              { label: "Disponible", value: fmt(fund.available || 0) + " FCFA", icon: "🏦" },
              { label: "Contributeurs", value: fund.totalContributors || 0, icon: "👥" },
              { label: "Projets aidés", value: fund.totalProjects || 0, icon: "🚀" },
            ].map(s => (
              <div key={s.label} className="bg-white/10 backdrop-blur rounded-2xl p-4">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-xl font-bold">{s.value}</div>
                <div className="text-xs text-green-200">{s.label}</div>
              </div>
            ))}
          </div>
          <button onClick={() => setShowForm(true)}
            className="bg-white text-green-700 font-bold px-8 py-4 rounded-2xl hover:bg-green-50 text-lg shadow-xl">
            🌱 Je contribue maintenant
          </button>
          <p className="text-green-300 text-xs mt-3">Dès 500 FCFA · Mobile Money · Anonyme possible</p>
        </div>
      </div>

      {/* SUCCESS MESSAGE */}
      {success && (
        <div className="max-w-5xl mx-auto px-6 mt-4">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-green-800 font-medium text-center">
            {success}
          </div>
        </div>
      )}

      {/* TABS */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {[
            { id: "overview", label: "Vue d'ensemble", icon: "📊" },
            { id: "contributions", label: "Contributions", icon: "💝" },
            { id: "projects", label: "Projets aidés", icon: "🚀" },
            { id: "campaigns", label: "Campagnes", icon: "🎯" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.id ? "bg-green-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-green-300"}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* VUE D'ENSEMBLE */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Barre progression */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-gray-900">Utilisation du fonds</h3>
                <span className="text-sm text-gray-500">{pct}% alloué</span>
              </div>
              <div className="bg-gray-100 rounded-full h-4 mb-4">
                <div className="bg-green-500 h-4 rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }}></div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center text-sm">
                <div>
                  <div className="font-bold text-green-700">{fmt(fund.totalReceived || 0)} FCFA</div>
                  <div className="text-gray-500">Total reçu</div>
                </div>
                <div>
                  <div className="font-bold text-blue-700">{fmt(fund.totalAllocated || 0)} FCFA</div>
                  <div className="text-gray-500">Alloué aux projets</div>
                </div>
                <div>
                  <div className="font-bold text-orange-700">{fmt(fund.available || 0)} FCFA</div>
                  <div className="text-gray-500">Disponible</div>
                </div>
              </div>
            </div>

            {/* Top contributeurs */}
            {stats?.topContributors?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-bold text-gray-900 mb-4">🏆 Hall of Fame — Top Contributeurs</h3>
                <div className="space-y-3">
                  {stats.topContributors.map((c: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center font-bold text-green-700 text-sm">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm">{c.firstName} {c.lastName}</div>
                        <div className="flex gap-1 mt-0.5">
                          {c.badges?.map((b: string) => (
                            <span key={b} className={`text-xs px-2 py-0.5 rounded-full ${BADGE_CONFIG[b]?.color}`}>
                              {BADGE_CONFIG[b]?.icon} {BADGE_CONFIG[b]?.label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="font-bold text-green-700 text-sm">{fmt(c.total)} FCFA</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Graphique mensuel */}
            {stats?.monthly?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-bold text-gray-900 mb-4">📈 Évolution mensuelle</h3>
                <div className="flex items-end gap-2 h-32">
                  {stats.monthly.slice(-6).map((m: any, i: number) => {
                    const max = Math.max(...stats.monthly.map((x: any) => Number(x.total)));
                    const h = max > 0 ? Math.round((Number(m.total) / max) * 100) : 0;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="text-xs text-gray-500">{fmt(Number(m.total))}</div>
                        <div className="w-full bg-green-500 rounded-t-lg" style={{ height: `${h}%` }}></div>
                        <div className="text-xs text-gray-400">{m.month?.substring(5)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Comment ça marche */}
            <div className="bg-green-50 rounded-2xl p-6">
              <h3 className="font-bold text-green-900 mb-4">💡 Comment fonctionne le fonds ?</h3>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { step: "1", title: "Tu contribues", desc: "Dès 500 FCFA via Mobile Money. Anonyme ou public.", icon: "💝" },
                  { step: "2", title: "Fonds mutualisé", desc: "90% de ton don va directement aux projets. BAOBAB prend 10% pour la gestion.", icon: "🏦" },
                  { step: "3", title: "Impact concret", desc: "L'admin BAOBAB alloue les fonds aux projets les plus méritants.", icon: "🚀" },
                ].map(s => (
                  <div key={s.step} className="bg-white rounded-xl p-4">
                    <div className="text-2xl mb-2">{s.icon}</div>
                    <div className="font-bold text-gray-900 text-sm mb-1">{s.title}</div>
                    <div className="text-xs text-gray-500">{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CONTRIBUTIONS */}
        {activeTab === "contributions" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Dernières contributions</h2>
              <span className="text-xs text-gray-500">{contributions.length} affichées</span>
            </div>
            {contributions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="text-4xl mb-3">💝</div>
                <p className="text-gray-400">Soyez le premier à contribuer !</p>
              </div>
            ) : contributions.map((c: any) => (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-700 font-bold">
                  {c.anonymous ? "🙈" : (c.displayName?.[0] || "?")}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 text-sm">{c.displayName}</div>
                  {c.message && <div className="text-xs text-gray-500 italic mt-0.5">"{c.message}"</div>}
                  {c.project && <div className="text-xs text-green-600 mt-0.5">→ {c.project.title}</div>}
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-700">{fmt(c.amount)} FCFA</div>
                  <div className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString("fr-FR")}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PROJETS AIDÉS */}
        {activeTab === "projects" && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-900">Projets financés par le fonds</h2>
            {!stats?.fundedProjects?.length ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="text-4xl mb-3">🚀</div>
                <p className="text-gray-400">Aucun projet encore financé</p>
              </div>
            ) : stats.fundedProjects.map((a: any) => (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-gray-900">{a.project?.title}</div>
                    <div className="text-xs text-gray-500">{a.project?.sector}</div>
                    {a.note && <div className="text-xs text-gray-400 mt-1 italic">{a.note}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-700">{fmt(a.amount)} FCFA</div>
                    <div className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleDateString("fr-FR")}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CAMPAGNES */}
        {activeTab === "campaigns" && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-900">Campagnes en cours</h2>
            {!stats?.campaigns?.length ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="text-4xl mb-3">🎯</div>
                <p className="text-gray-400">Aucune campagne active</p>
              </div>
            ) : stats.campaigns.map((c: any) => {
              const pct = Math.round((c.raised / c.goalAmount) * 100);
              const daysLeft = Math.max(0, Math.ceil((new Date(c.endDate).getTime() - Date.now()) / 86400000));
              return (
                <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-bold text-gray-900">{c.title}</div>
                      <div className="text-xs text-gray-500">{c.description}</div>
                    </div>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-lg font-medium">
                      ⏱️ {daysLeft}j restants
                    </span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-3 mb-2">
                    <div className="bg-green-500 h-3 rounded-full" style={{ width: `${Math.min(100, pct)}%` }}></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{fmt(c.raised)} FCFA collectés</span>
                    <span>Objectif : {fmt(c.goalAmount)} FCFA ({pct}%)</span>
                  </div>
                  <button onClick={() => { setShowForm(true); }}
                    className="mt-3 w-full bg-green-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-green-700">
                    Contribuer à cette campagne
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL CONTRIBUTION */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-gray-900">🌱 Contribuer au fonds</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4">{error}</div>}

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Montant (FCFA)</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[500, 1000, 2500, 5000, 10000, 25000, 50000, 100000].map(v => (
                    <button key={v} onClick={() => setAmount(String(v))}
                      className={`py-2 rounded-xl text-xs font-medium border transition-colors ${amount === String(v) ? "bg-green-600 text-white border-green-600" : "bg-gray-50 text-gray-700 border-gray-200 hover:border-green-300"}`}>
                      {v >= 1000 ? `${v/1000}k` : v}
                    </button>
                  ))}
                </div>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="Montant personnalisé..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400" />
                {amount && Number(amount) >= 500 && (
                  <div className="text-xs text-gray-500 mt-1">
                    Net au fonds : <strong className="text-green-600">{fmt(Math.round(Number(amount) * 0.9))} FCFA</strong> (90%)
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Opérateur Mobile Money</label>
                <div className="grid grid-cols-3 gap-2">
                  {["WAVE", "ORANGE_MONEY", "FREE_MONEY"].map(op => (
                    <button key={op} onClick={() => setOperator(op)}
                      className={`py-2 rounded-xl text-xs font-medium border ${operator === op ? "bg-green-600 text-white border-green-600" : "bg-gray-50 text-gray-700 border-gray-200"}`}>
                      {op === "WAVE" ? "🔵 Wave" : op === "ORANGE_MONEY" ? "🟠 Orange" : "🟢 Free"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Numéro de téléphone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="77 XXX XX XX"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400" />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Message (optionnel)</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Un mot d'encouragement pour les entrepreneurs..."
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400 resize-none" />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)}
                  className="w-4 h-4 accent-green-600" />
                <span className="text-sm text-gray-700">Contribution anonyme 🙈</span>
              </label>

              <button onClick={submit} disabled={submitting || !amount || Number(amount) < 500 || !phone}
                className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl hover:bg-green-700 disabled:opacity-50 text-lg">
                {submitting ? "Traitement..." : `💝 Donner ${amount ? fmt(Number(amount)) : "0"} FCFA`}
              </button>
              <p className="text-xs text-center text-gray-400">
                90% de votre don va directement aux projets • BAOBAB : 10%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
