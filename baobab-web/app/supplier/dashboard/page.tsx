"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

function fmt(n: number) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0"); }

export default function SupplierDashboardPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [supplier, setSupplier] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const token = localStorage.getItem("supplierToken");
    const data = localStorage.getItem("supplierData");
    if (token && data) {
      setSupplier(JSON.parse(data));
      loadPayments(token);
    }
  }, []);

  const loadPayments = async (token: string) => {
    const res = await fetch(`${API}/api/suppliers/my-payments`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) setPayments(data.data || []);
  };

  const login = async () => {
    if (!email.trim() || !password.trim()) { setError("Email et mot de passe requis"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/api/suppliers/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("supplierToken", data.data.token);
        localStorage.setItem("supplierData", JSON.stringify(data.data.supplier));
        setSupplier(data.data.supplier);
        await loadPayments(data.data.token);
      } else {
        setError(data.message || "Identifiants incorrects");
      }
    } catch { setError("Erreur de connexion"); }
    finally { setLoading(false); }
  };

  const logout = () => {
    localStorage.removeItem("supplierToken");
    localStorage.removeItem("supplierData");
    setSupplier(null); setPayments([]); setEmail(""); setPassword("");
  };

  const totalRecu = payments.filter(p => p.status === "COMPLETED").reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter(p => p.status === "PENDING").reduce((s, p) => s + p.amount, 0);
  const filtered = filter === "ALL" ? payments : payments.filter(p => p.status === filter);

  if (!supplier) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">B</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">BAOBAB INVEST</h1>
          <p className="text-sm text-gray-500 mt-1">Espace Fournisseur</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Adresse email professionnelle</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="votre@email.com"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && login()}
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400" />
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs">{error}</div>}
          <button onClick={login} disabled={loading}
            className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors">
            {loading ? "Connexion..." : "Se connecter →"}
          </button>
        </div>
        <div className="mt-6 bg-gray-50 rounded-xl p-4 text-center text-xs text-gray-500">
          Votre compte est créé par l&apos;équipe BAOBAB INVEST.<br/>
          <a href="mailto:contact@baobabinvest.com" className="text-green-600 hover:underline mt-1 inline-block">Contactez-nous pour obtenir vos identifiants</a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="font-bold text-gray-900 hidden sm:block">BAOBAB INVEST</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full font-medium">
              🏪 {supplier.companyName}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${supplier.isVerified ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
              {supplier.isVerified ? "✅ Vérifié" : "⏳ En attente"}
            </span>
            <button onClick={logout} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Déconnexion</button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Hero */}
        <div className="bg-gradient-to-br from-green-700 to-green-900 rounded-3xl p-6 mb-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24"></div>
          <div className="relative">
            <p className="text-green-200 text-sm mb-1">Bonjour 👋</p>
            <h1 className="text-2xl font-bold mb-4">{supplier.companyName}</h1>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-green-200 text-xs mb-1">Total reçu</div>
                <div className="text-xl font-bold">{fmt(totalRecu)} FCFA</div>
              </div>
              <div>
                <div className="text-green-200 text-xs mb-1">En attente</div>
                <div className="text-xl font-bold">{fmt(totalPending)} FCFA</div>
              </div>
              <div>
                <div className="text-green-200 text-xs mb-1">Paiements</div>
                <div className="text-xl font-bold">{payments.length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: "overview", label: "Vue générale", icon: "📊" },
            { id: "payments", label: "Paiements", icon: "💸", badge: payments.length },
            { id: "profile",  label: "Mon profil",  icon: "🏪" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id ? "bg-green-600 text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:border-green-300"}`}>
              <span>{tab.icon}</span><span>{tab.label}</span>
              {tab.badge && tab.badge > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.id ? "bg-white/30 text-white" : "bg-gray-100 text-gray-600"}`}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* VUE GÉNÉRALE */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total reçu", value: fmt(totalRecu) + " FCFA", icon: "✅", color: "text-green-700 bg-green-50" },
                { label: "En attente", value: fmt(totalPending) + " FCFA", icon: "⏳", color: "text-orange-700 bg-orange-50" },
                { label: "Paiements total", value: payments.length + "", icon: "📋", color: "text-blue-700 bg-blue-50" },
              ].map(s => (
                <div key={s.label} className={`rounded-2xl p-4 text-center ${s.color}`}>
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <div className="font-bold text-lg">{s.value}</div>
                  <div className="text-xs opacity-70">{s.label}</div>
                </div>
              ))}
            </div>
            {/* Coordonnées Mobile Money */}
            {supplier.mobileMoneyNumber && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 mb-3">📱 Coordonnées de paiement</h3>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="text-sm text-gray-700">
                    <span className="font-semibold">{supplier.mobileMoneyProvider}</span> : <strong>{supplier.mobileMoneyNumber}</strong>
                  </div>
                  <p className="text-xs text-green-600 mt-1">Les paiements sont envoyés sur ce numéro après validation</p>
                </div>
              </div>
            )}
            {/* Derniers paiements */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-900">Derniers paiements</h3>
                <button onClick={() => setActiveTab("payments")} className="text-xs text-green-600 hover:underline">Voir tout →</button>
              </div>
              {payments.slice(0, 3).map((pay: any) => (
                <div key={pay.id} className={`flex items-center justify-between p-3 rounded-xl mb-2 ${pay.status === "COMPLETED" ? "bg-green-50" : "bg-orange-50"}`}>
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{pay.milestone?.title || "Jalon"}</div>
                    <div className="text-xs text-gray-400">{pay.milestone?.project?.title} · {new Date(pay.createdAt).toLocaleDateString("fr-FR")}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-700">{fmt(pay.amount)} FCFA</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${pay.status === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                      {pay.status === "COMPLETED" ? "✅ Reçu" : "⏳ En cours"}
                    </span>
                  </div>
                </div>
              ))}
              {payments.length === 0 && (
                <div className="text-center py-6 text-gray-400 text-sm">Aucun paiement pour l&apos;instant</div>
              )}
            </div>
          </div>
        )}

        {/* PAIEMENTS */}
        {activeTab === "payments" && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Historique des paiements</h3>
              <div className="flex gap-1">
                {(["ALL","COMPLETED","PENDING"] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`text-xs px-3 py-1.5 rounded-lg ${filter === f ? "bg-green-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                    {f === "ALL" ? "Tout" : f === "COMPLETED" ? "✅ Reçus" : "⏳ Attente"}
                  </button>
                ))}
              </div>
            </div>
            {filtered.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-gray-400 text-sm">Aucun paiement</p>
              </div>
            ) : filtered.map((pay: any) => (
              <div key={pay.id} className={`p-4 rounded-2xl border mb-3 ${pay.status === "COMPLETED" ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{pay.milestone?.title || "Jalon"}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Projet : {pay.milestone?.project?.title || "—"}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(pay.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      {pay.paidAt && ` · Payé le ${new Date(pay.paidAt).toLocaleDateString("fr-FR")}`}
                    </div>
                    {pay.invoiceUrl && (
                      <a href={pay.invoiceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 block">📄 Voir la facture</a>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <div className="font-bold text-xl text-green-700">{fmt(pay.amount)} FCFA</div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block mt-1 ${pay.status === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                      {pay.status === "COMPLETED" ? "✅ Reçu" : "⏳ En cours"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PROFIL */}
        {activeTab === "profile" && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h3 className="font-bold text-gray-900">🏪 Mon profil fournisseur</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Entreprise", value: supplier.companyName },
                { label: "Email", value: supplier.email },
                { label: "Statut", value: supplier.isVerified ? "✅ Vérifié" : "⏳ En attente" },
                { label: "Opérateur", value: supplier.mobileMoneyProvider },
                { label: "Numéro paiement", value: supplier.mobileMoneyNumber },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-400">{s.label}</div>
                  <div className="font-semibold text-gray-900 text-sm mt-0.5">{s.value}</div>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center text-xs text-gray-500">
              Pour modifier vos informations, contactez<br/>
              <a href="mailto:support@baobabinvest.com" className="text-green-600 hover:underline">support@baobabinvest.com</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
