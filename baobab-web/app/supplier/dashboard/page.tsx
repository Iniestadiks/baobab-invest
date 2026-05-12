"use client";
import { useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function SupplierDashboardPage() {
  const [email, setEmail] = useState("");
  const [supplier, setSupplier] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");

  const search = async () => {
    if (!email.trim()) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/api/suppliers/by-email/${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.success) {
        setSupplier(data.data.supplier);
        setPayments(data.data.payments || []);
      } else {
        setError("Fournisseur introuvable. Vérifiez votre email.");
      }
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally { setLoading(false); }
  };

  const totalRecu = payments.filter(p => p.status === "COMPLETED").reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter(p => p.status === "PENDING").reduce((s, p) => s + p.amount, 0);
  const filtered = filter === "ALL" ? payments : payments.filter(p => p.status === filter);

  if (!supplier) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🏪</div>
          <h1 className="text-xl font-bold text-gray-900">Espace Fournisseur</h1>
          <p className="text-sm text-gray-500 mt-1">Accédez à vos paiements et factures</p>
        </div>
        <div className="space-y-3">
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search()}
            placeholder="Votre adresse email professionnelle"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button onClick={search} disabled={loading}
            className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 disabled:opacity-50">
            {loading ? "Recherche..." : "Accéder à mon espace →"}
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center mt-4">
          Votre compte fournisseur est créé par l&apos;équipe BAOBAB INVEST.<br/>
          <a href="mailto:contact@baobabinvest.com" className="text-green-600 hover:underline">Contactez-nous</a> si vous n&apos;avez pas encore de compte.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌳</span>
            <span className="font-bold text-green-600">BAOBAB INVEST</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">🏪 {supplier.companyName}</span>
            <button onClick={() => { setSupplier(null); setEmail(""); }} className="text-xs text-red-400 hover:text-red-600">Déconnexion</button>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* En-tête */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bonjour, {supplier.companyName} 👋</h1>
          <p className="text-sm text-gray-400 mt-1">
            {supplier.isVerified ? "✅ Fournisseur vérifié" : "⏳ Vérification en cours"} ·
            {supplier.mobileMoneyProvider && ` ${supplier.mobileMoneyProvider} : ${supplier.mobileMoneyNumber}`}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total reçu", value: `${totalRecu.toLocaleString()} FCFA`, icon: "✅", color: "text-green-700", bg: "bg-green-50" },
            { label: "En attente", value: `${totalPending.toLocaleString()} FCFA`, icon: "⏳", color: "text-orange-700", bg: "bg-orange-50" },
            { label: "Paiements", value: String(payments.length), icon: "📋", color: "text-blue-700", bg: "bg-blue-50" },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center`}>
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className={`font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Info Mobile Money */}
        {supplier.mobileMoneyNumber && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm">
            <div className="font-semibold text-blue-800 mb-1">📱 Coordonnées de paiement</div>
            <div className="text-blue-700">
              {supplier.mobileMoneyProvider} : <strong>{supplier.mobileMoneyNumber}</strong>
            </div>
            <p className="text-xs text-blue-500 mt-1">Les paiements sont envoyés sur ce numéro après validation admin</p>
          </div>
        )}

        {/* Historique paiements */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">📋 Historique des paiements</h3>
            <div className="flex gap-1">
              {(["ALL","COMPLETED","PENDING"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`text-xs px-2 py-1 rounded-lg transition-colors ${filter === f ? "bg-green-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                  {f === "ALL" ? "Tout" : f === "COMPLETED" ? "✅ Reçus" : "⏳ Attente"}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-gray-400 text-sm">Aucun paiement {filter !== "ALL" ? filter.toLowerCase() : ""}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((pay: any) => (
                <div key={pay.id} className={`p-4 rounded-xl border ${pay.status === "COMPLETED" ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm">{pay.milestone?.title || "Jalon"}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Projet : {pay.milestone?.project?.title || "—"}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(pay.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                        {pay.paidAt && ` · Payé le ${new Date(pay.paidAt).toLocaleDateString("fr-FR")}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-green-700">{pay.amount.toLocaleString()} FCFA</div>
                      <div className={`text-xs font-medium mt-1 px-2 py-0.5 rounded-full inline-block ${pay.status === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                        {pay.status === "COMPLETED" ? "✅ Reçu" : "⏳ En cours"}
                      </div>
                    </div>
                  </div>
                  {pay.invoiceUrl && (
                    <a href={pay.invoiceUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-2 block">
                      📄 Voir la facture pro forma
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact support */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center text-sm text-gray-500">
          Une question sur un paiement ?{" "}
          <a href="mailto:support@baobabinvest.com" className="text-green-600 hover:underline">
            Contactez le support BAOBAB INVEST
          </a>
        </div>

      </div>
    </div>
  );
}
