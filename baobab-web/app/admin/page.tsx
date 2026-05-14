"use client";
import React from "react";
import { useRequireRole } from "@/hooks/useRequireRole";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authGet, authPost, authPatch } from "@/lib/api";
import AdminCharts from "./charts";

const TABS = [
  { id: "overview", label: "📊 Vue générale" },
  { id: "projects", label: "📋 Projets" },
  { id: "users", label: "👥 Utilisateurs" },
  { id: "kyc", label: "🪪 KYC" },
  { id: "suppliers", label: "🏪 Fournisseurs" },
  { id: "milestones", label: "🏗️ Jalons" },
  { id: "reimburse", label: "💰 Remboursements" },
  { id: "finances", label: "💵 Finances BAOBAB" },
  { id: "transactions", label: "💳 Transactions" },
  { id: "config", label: "⚙️ Configuration" },
  { id: "active_projects", label: "🚀 Projets actifs" },
  { id: "stats", label: "📈 Statistiques" },
];

const RISK_LABELS: Record<string, string> = {
  LOW: "🟢 Faible", MEDIUM: "🟡 Modéré", HIGH: "🔴 Élevé"
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_REVIEW: "bg-orange-100 text-orange-700",
  ACTIVE: "bg-green-100 text-green-700",
  FUNDED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-gray-100 text-gray-700",
  FAILED: "bg-red-100 text-red-700",
};

function TransactionsTab({ flash }: { flash: (m: string) => void }) {
  const [txs, setTxs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [processing, setProcessing] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"ALL"|"PENDING"|"COMPLETED"|"REJECTED">("PENDING");

  const load = () => {
    authGet("/api/wallet/admin/pending").then(res => {
      if (res.success) setTxs(res.data);
    }).finally(() => setLoading(false));
  };

  React.useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    if (!confirm("Valider cette transaction ?")) return;
    setProcessing(id);
    const res = await authPost(`/api/wallet/admin/approve/${id}`, {});
    if (res.success) { flash("✅ Transaction validée — wallet crédité"); load(); }
    else flash("❌ " + res.message);
    setProcessing(null);
  };

  const reject = async (id: string) => {
    const reason = prompt("Raison du rejet (optionnel):");
    setProcessing(id);
    const res = await authPost(`/api/wallet/admin/reject/${id}`, { reason });
    if (res.success) { flash("✅ Transaction rejetée"); load(); }
    else flash("❌ " + res.message);
    setProcessing(null);
  };

  const filtered = filter === "ALL" ? txs : txs.filter(t => t.status === filter);
  const pending = txs.filter(t => t.status === "PENDING").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">💳 Transactions wallet</h2>
          <p className="text-sm text-gray-500">{pending > 0 ? `⚠️ ${pending} en attente de validation` : "Aucune transaction en attente"}</p>
        </div>
        <button onClick={load} className="text-sm text-green-600 hover:underline">🔄 Actualiser</button>
      </div>

      <div className="flex gap-2">
        {(["PENDING","ALL","COMPLETED","REJECTED"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${filter === f ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>
            {f === "ALL" ? "Tout" : f === "PENDING" ? `⏳ En attente (${txs.filter(t=>t.status==="PENDING").length})` : f === "COMPLETED" ? "✅ Validé" : "❌ Rejeté"}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-10 text-gray-400">Chargement...</div> :
      filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-gray-400 text-sm">Aucune transaction {filter === "PENDING" ? "en attente" : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(tx => (
            <div key={tx.id} className={`bg-white rounded-2xl border p-4 ${tx.status === "PENDING" ? "border-orange-200 bg-orange-50/20" : "border-gray-100"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${tx.type === "DEPOSIT" ? "bg-green-100" : "bg-orange-100"}`}>
                    {tx.type === "DEPOSIT" ? "💳" : "💸"}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">
                      {tx.type === "DEPOSIT" ? "Dépôt" : "Retrait"} — {tx.user?.firstName} {tx.user?.lastName}
                    </div>
                    <div className="text-xs text-gray-500">{tx.user?.email} · {tx.user?.role}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {tx.operator} · {tx.phoneNumber} · {new Date(tx.createdAt).toLocaleString("fr-FR")}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`font-bold text-lg ${tx.type === "DEPOSIT" ? "text-green-700" : "text-orange-600"}`}>
                    {tx.type === "DEPOSIT" ? "+" : "-"}{tx.amount.toLocaleString()} FCFA
                  </div>
                  <div className={`text-xs font-medium mt-1 px-2 py-0.5 rounded-full inline-block ${
                    tx.status === "PENDING" ? "bg-orange-100 text-orange-700" :
                    tx.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {tx.status === "PENDING" ? "⏳ En attente" : tx.status === "COMPLETED" ? "✅ Validé" : "❌ Rejeté"}
                  </div>
                </div>
              </div>
              {tx.status === "PENDING" && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button onClick={() => approve(tx.id)} disabled={processing === tx.id}
                    className="flex-1 bg-green-600 text-white text-sm font-bold py-2 rounded-xl hover:bg-green-700 disabled:opacity-50">
                    {processing === tx.id ? "..." : "✅ Valider"}
                  </button>
                  <button onClick={() => reject(tx.id)} disabled={processing === tx.id}
                    className="flex-1 bg-red-100 text-red-700 text-sm font-bold py-2 rounded-xl hover:bg-red-200 disabled:opacity-50">
                    ❌ Rejeter
                  </button>
                </div>
              )}
              {tx.status === "COMPLETED" && tx.processedAt && (
                <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
                  Traité le {new Date(tx.processedAt).toLocaleString("fr-FR")}
                  {tx.type === "WITHDRAWAL" && <span className="ml-2 text-orange-600">⚠️ TODO: Déclencher PayDunya Payout</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfigTab({ flash }: { flash: (m: string) => void }) {
  const [configs, setConfigs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [values, setValues] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    authGet("/api/config").then(res => {
      if (res.success) {
        setConfigs(res.data);
        const v: Record<string, string> = {};
        res.data.forEach((c: any) => { v[c.key] = String(c.value); });
        setValues(v);
      }
    }).finally(() => setLoading(false));
  }, []);

  const save = async (key: string) => {
    setSaving(key);
    try {
      const res = await authPatch(`/api/config/${key}`, { value: Number(values[key]) });
      if (res.success) flash(`✅ ${res.message}`);
      else flash("❌ " + res.message);
    } finally { setSaving(null); }
  };

  const reset = async () => {
    if (!confirm("Réinitialiser tous les taux aux valeurs par défaut ?")) return;
    const res = await authPost("/api/config/reset", {});
    if (res.success) {
      flash("✅ Taux réinitialisés");
      window.location.reload();
    }
  };

  if (loading) return <div className="text-center py-10 text-gray-400">Chargement...</div>;

  const groups = [
    { title: "💰 Commissions BAOBAB", keys: ["commission_baobab_collection", "commission_baobab_return"] },
    { title: "🎓 Mentor & Garantie", keys: ["commission_mentor", "commission_guarantee"] },
    { title: "📱 PayDunya (absorbé BAOBAB)", keys: ["paydunya_payin", "paydunya_payout"] },
    { title: "📈 Taux de retour minimum", keys: ["return_min_with_mentor", "return_min_no_mentor"] },
    { title: "💵 Montants minimum", keys: ["investment_min", "withdrawal_min"] },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">⚙️ Configuration des taux</h2>
          <p className="text-sm text-gray-500 mt-1">Les modifications s&apos;appliquent immédiatement sur les prochains investissements.</p>
        </div>
        <button onClick={reset} className="text-sm text-red-500 hover:underline border border-red-200 px-3 py-1.5 rounded-xl">
          🔄 Réinitialiser les défauts
        </button>
      </div>
      {groups.map(g => (
        <div key={g.title} className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4">{g.title}</h3>
          <div className="space-y-3">
            {g.keys.map(key => {
              const c = configs.find(x => x.key === key);
              if (!c) return null;
              const isPercent = !key.includes("_min");
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{c.label}</div>
                    <div className="text-xs text-gray-400">{c.description}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        value={values[key] || ""}
                        onChange={e => setValues(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm text-right focus:outline-none focus:border-green-400"
                        step={isPercent ? "0.5" : "1000"}
                        min="0"
                        max={isPercent ? "50" : "1000000"}
                      />
                      <span className="absolute right-2 top-2 text-xs text-gray-400">{isPercent ? "%" : "F"}</span>
                    </div>
                    <button
                      onClick={() => save(key)}
                      disabled={saving === key}
                      className="bg-green-600 text-white text-xs px-3 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50 font-medium"
                    >
                      {saving === key ? "..." : "Sauver"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-700">
        <strong>⚠️ Important :</strong> Ces taux s&apos;appliquent uniquement aux <strong>nouveaux investissements</strong>. Les investissements existants conservent leurs taux d&apos;origine.
      </div>
    </div>
  );
}


function KycTab({ flash, authPost, authPatch, authGet }: any) {
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState("PENDING");
  const [roleFilter, setRoleFilter] = React.useState("ALL");
  const [selected, setSelected] = React.useState<any>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [processing, setProcessing] = React.useState<string | null>(null);
  const [lightbox, setLightbox] = React.useState<string | null>(null);

  const load = () => {
    setLoading(true);
    authGet(`/api/admin/users${filter !== "ALL" ? `?status=${filter}` : ""}${roleFilter !== "ALL" ? `${filter !== "ALL" ? "&" : "?"}role=${roleFilter}` : ""}`)
      .then((res: any) => { if (res.success) setUsers(res.data || []); })
      .finally(() => setLoading(false));
  };

  React.useEffect(() => { load(); }, [filter, roleFilter]);

  const verify = async (userId: string) => {
    setProcessing(userId);
    const res = await authPatch(`/api/kyc/admin/verify/${userId}`, { action: "VERIFIED" });
    if (res.success) { flash("✅ KYC validé !"); load(); setSelected(null); }
    else flash("❌ " + res.message);
    setProcessing(null);
  };

  const reject = async (userId: string) => {
    if (!rejectReason.trim()) { flash("❌ Motif de rejet obligatoire"); return; }
    setProcessing(userId);
    const res = await authPatch(`/api/kyc/admin/verify/${userId}`, { action: "REJECTED", reason: rejectReason });
    if (res.success) { flash("KYC rejeté"); load(); setSelected(null); setRejectReason(""); }
    else flash("❌ " + res.message);
    setProcessing(null);
  };

  const statusColor = (s: string) => {
    if (s === "VERIFIED") return "bg-green-100 text-green-700";
    if (s === "PENDING") return "bg-orange-100 text-orange-700";
    if (s === "REJECTED") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-500";
  };

  const statusLabel = (s: string) => {
    if (s === "VERIFIED") return "✅ Vérifié";
    if (s === "PENDING") return "⏳ En attente";
    if (s === "REJECTED") return "❌ Rejeté";
    return "📄 Non soumis";
  };

  const API = process.env.NEXT_PUBLIC_API_URL || "http://46.202.132.161:3001";

  return (
    <div className="space-y-5">
      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-3xl w-full">
            <button className="absolute -top-10 right-0 text-white text-2xl">✕</button>
            {lightbox.endsWith('.pdf') ? (
              <iframe src={`${API}${lightbox}`} className="w-full h-[80vh] rounded-xl" />
            ) : (
              <img src={`${API}${lightbox}`} alt="Document KYC" className="w-full max-h-[85vh] object-contain rounded-xl" />
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-900">🪪 Dossiers KYC</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="🔍 Rechercher par nom, email..."
            onChange={e => {
              const q = e.target.value.toLowerCase();
              if (!q) { load(); return; }
              setUsers(prev => prev.filter(u =>
                u.firstName?.toLowerCase().includes(q) ||
                u.lastName?.toLowerCase().includes(q) ||
                u.email?.toLowerCase().includes(q)
              ));
            }}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-green-400 w-48"
          />
          <button onClick={load} className="text-sm text-green-600 hover:underline">🔄 Actualiser</button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {["PENDING","ALL","VERIFIED","REJECTED","NOT_SUBMITTED"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${filter === f ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>
            {f === "ALL" ? "Tout" : f === "PENDING" ? `⏳ En attente (${users.filter((u:any) => u.kycStatus==="PENDING").length})` : f === "VERIFIED" ? "✅ Vérifiés" : f === "REJECTED" ? "❌ Rejetés" : "📄 Non soumis"}
          </button>
        ))}
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white">
          <option value="ALL">Tous les rôles</option>
          <option value="INVESTOR">Investisseurs</option>
          <option value="ENTREPRENEUR">Entrepreneurs</option>
          <option value="MENTOR">Mentors</option>
        </select>
      </div>

      {loading ? <div className="text-center py-10 text-gray-400">Chargement...</div> :
      users.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-3">✅</div>
          <p className="text-gray-500">Aucun dossier pour ce filtre</p>
        </div>
      ) : (
        <div className="space-y-4">
          {users.map((u: any) => (
            <div key={u.id} className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${u.kycStatus === "PENDING" ? "border-orange-200" : "border-gray-100"}`}>
              {/* En-tête dossier */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-lg font-bold text-blue-700 flex-shrink-0">
                    {u.firstName?.[0]}{u.lastName?.[0]}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{u.firstName} {u.lastName}</div>
                    <div className="text-xs text-gray-500">{u.email} · {u.phone}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {u.role} · {u.city} · {u.country}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusColor(u.kycStatus)}`}>
                    {statusLabel(u.kycStatus)}
                  </span>
                  {u.kycAttempts > 0 && <div className="text-xs text-gray-400 mt-1">Tentative #{u.kycAttempts}</div>}
                </div>
              </div>

              {/* Infos document */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-xs">
                <div className="bg-gray-50 rounded-xl p-2">
                  <div className="text-gray-400">Type document</div>
                  <div className="font-medium">{u.kycDocumentType || "CNI"}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-2">
                  <div className="text-gray-400">Soumis le</div>
                  <div className="font-medium">{u.kycSubmittedAt ? new Date(u.kycSubmittedAt).toLocaleDateString("fr-FR") : "—"}</div>
                </div>
                <div className={`rounded-xl p-2 ${u.daysUntilExpiry !== null && u.daysUntilExpiry <= 30 ? "bg-red-50" : u.daysUntilExpiry !== null && u.daysUntilExpiry <= 90 ? "bg-orange-50" : "bg-gray-50"}`}>
                  <div className="text-gray-400">Expiration</div>
                  <div className={`font-medium ${u.daysUntilExpiry !== null && u.daysUntilExpiry <= 30 ? "text-red-600" : u.daysUntilExpiry !== null && u.daysUntilExpiry <= 90 ? "text-orange-600" : ""}`}>
                    {u.kycDocumentExpiry ? new Date(u.kycDocumentExpiry).toLocaleDateString("fr-FR") : "—"}
                    {u.daysUntilExpiry !== null && u.daysUntilExpiry <= 0 && <span className="ml-1 text-red-600 font-bold">EXPIRÉ</span>}
                    {u.daysUntilExpiry !== null && u.daysUntilExpiry > 0 && u.daysUntilExpiry <= 30 && <span className="ml-1">({u.daysUntilExpiry}j)</span>}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-2">
                  <div className="text-gray-400">Vérifié le</div>
                  <div className="font-medium">{u.kycVerifiedAt ? new Date(u.kycVerifiedAt).toLocaleDateString("fr-FR") : "—"}</div>
                </div>
              </div>

              {/* RCCM/NINEA pour entrepreneurs */}
              {u.role === "ENTREPRENEUR" && (u.rccmNumber || u.nineaNumber) && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4 text-xs">
                  <div className="font-semibold text-orange-800 mb-1">🏢 Informations entreprise</div>
                  {u.rccmNumber && <div className="text-orange-700">RCCM : <strong>{u.rccmNumber}</strong></div>}
                  {u.nineaNumber && <div className="text-orange-700">NINEA : <strong>{u.nineaNumber}</strong></div>}
                </div>
              )}

              {/* Documents — liens directs */}
              <div className="flex gap-3 mb-4 flex-wrap">
                {u.kycDocumentUrl && (
                  <a href={`${API}${u.kycDocumentUrl}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors">
                    🪪 Voir CNI/Passeport ↗
                  </a>
                )}
                {u.kycSelfieUrl && (
                  <a href={`${API}${u.kycSelfieUrl}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-purple-50 border border-purple-200 rounded-xl text-purple-700 text-sm font-medium hover:bg-purple-100 transition-colors">
                    🤳 Voir Selfie ↗
                  </a>
                )}
                {u.kycRccmUrl && (
                  <a href={`${API}${u.kycRccmUrl}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-xl text-orange-700 text-sm font-medium hover:bg-orange-100 transition-colors">
                    📋 Voir RCCM ↗
                  </a>
                )}
                {!u.kycDocumentUrl && !u.kycSelfieUrl && (
                  <div className="text-gray-400 text-sm py-2">📭 Aucun document soumis</div>
                )}
              </div>

              {/* Motif rejet si rejeté */}
              {u.kycRejectedReason && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700">
                  <strong>Motif rejet :</strong> {u.kycRejectedReason}
                </div>
              )}

              {/* Actions si PENDING */}
              {u.kycStatus === "PENDING" && (
                <div className="space-y-2">
                  {selected === u.id && (
                    <div>
                      <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                        placeholder="Motif de rejet obligatoire..."
                        className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm mb-2 focus:outline-none focus:border-red-400" />
                      <div className="flex gap-2">
                        <button onClick={() => reject(u.id)} disabled={processing === u.id}
                          className="flex-1 bg-red-600 text-white font-bold py-2 rounded-xl text-sm hover:bg-red-700 disabled:opacity-50">
                          {processing === u.id ? "..." : "❌ Confirmer le rejet"}
                        </button>
                        <button onClick={() => setSelected(null)} className="px-4 bg-gray-100 text-gray-700 rounded-xl text-sm">
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                  {selected !== u.id && (
                    <div className="flex gap-2">
                      <button onClick={() => verify(u.id)} disabled={processing === u.id}
                        className="flex-1 bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50">
                        {processing === u.id ? "..." : "✅ Valider le KYC"}
                      </button>
                      <button onClick={() => setSelected(u.id)}
                        className="flex-1 bg-red-50 text-red-600 font-bold py-2.5 rounded-xl border border-red-200 hover:bg-red-100">
                        ❌ Rejeter
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



function ReimburseTab({ allProjects, flash, authPost, authGet, loadData }: any) {
  const [details, setDetails] = React.useState<Record<string, any>>({});
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const [processing, setProcessing] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  const [fees, setFees] = React.useState<any>({
    commission_baobab_collection: 5, commission_baobab_return: 5,
    commission_guarantee: 2, commission_mentor: 2,
    paydunya_payin: 3, paydunya_payout: 2
  });
  React.useEffect(() => {
    authGet("/api/config/public").then((res: any) => {
      if (res.success) {
        const f: any = {};
        (res.data || []).forEach((c: any) => { f[c.key] = parseFloat(c.value); });
        setFees(f);
      }
    });
  }, []);

  const fundedProjects = allProjects.filter((p: any) => p.status === "FUNDED" || p.status === "IN_PROGRESS");
  const activeNotFunded = allProjects.filter((p: any) => p.status === "ACTIVE");
  const completedProjects = allProjects.filter((p: any) => p.status === "COMPLETED");

  const loadDetails = async (projectId: string) => {
    if (details[projectId]) return;
    const res = await authGet("/api/admin/finances/details");
    if (res.success) {
      const proj = res.data.projects.find((p: any) => p.id === projectId);
      if (proj) setDetails(d => ({ ...d, [projectId]: proj }));
    }
  };

  const reimburse = async (projectId: string) => {
    setProcessing(projectId);
    const res = await authPost(`/api/admin/projects/${projectId}/reimburse`, { note });
    if (res.success) {
      flash("✅ Remboursements effectués !");
      setConfirming(null);
      setNote("");
      loadData();
    } else {
      flash("❌ " + res.message);
    }
    setProcessing(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">💰 Remboursements</h2>
        <div className="text-sm text-gray-500">{fundedProjects.length} projet(s) éligible(s)</div>
      </div>

      {/* Projets éligibles au remboursement */}
      {fundedProjects.length > 0 && (
        <div className="space-y-4">
          <div className="font-semibold text-gray-700">✅ Projets éligibles — collecte terminée (FUNDED)</div>
          {fundedProjects.map((p: any) => {
            const det = details[p.id];
            const grossReturn = Math.round((p.raisedAmount || 0) * (1 + (p.expectedReturn || 15) / 100));
            const baobabOnReturn = Math.round(grossReturn * (fees.commission_baobab_return || 5) / 100);
            const paydunyaPayout = Math.round(grossReturn * (fees.paydunya_payout || 2) / 100);
            const netInvestors = grossReturn - baobabOnReturn - paydunyaPayout;
            const revenueBAOBAB = Math.round((p.raisedAmount || 0) * (fees.commission_baobab_collection || 5) / 100) - Math.round((p.raisedAmount || 0) * (fees.paydunya_payin || 3) / 100) + baobabOnReturn - paydunyaPayout;
            const garantie = Math.round((p.raisedAmount || 0) * (fees.commission_guarantee || 2) / 100);

            return (
              <div key={p.id} className="bg-white rounded-2xl border border-green-200 shadow-sm overflow-hidden">
                {/* En-tête */}
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">✅ FUNDED — Éligible</span>
                        <span className="text-xs text-gray-400">{p.sector}</span>
                      </div>
                      <h3 className="font-bold text-gray-900 text-lg">{p.title}</h3>
                      <div className="text-sm text-gray-500">Entrepreneur : {p.entrepreneur?.firstName} {p.entrepreneur?.lastName}</div>
                      {p.mentor && <div className="text-xs text-purple-600">Mentor : {p.mentor?.firstName} {p.mentor?.lastName}</div>}
                    </div>
                    <button onClick={() => { loadDetails(p.id); setConfirming(confirming === p.id ? null : p.id); }}
                      className="bg-blue-50 text-blue-600 border border-blue-200 text-sm font-medium px-4 py-2 rounded-xl hover:bg-blue-100">
                      {confirming === p.id ? "▲ Masquer" : "🔍 Simuler le remboursement"}
                    </button>
                  </div>
                </div>

                {/* Simulation détaillée */}
                {confirming === p.id && (
                  <div className="p-5 bg-gray-50 space-y-4">
                    {/* KPIs simulation */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div className="bg-white rounded-xl p-3 border border-gray-100">
                        <div className="text-xs text-gray-400">Capital levé (brut)</div>
                        <div className="font-bold text-gray-900">{(p.raisedAmount || 0).toLocaleString()} FCFA</div>
                      </div>
                      <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
                        <div className="text-xs text-gray-400">Retour brut ({p.expectedReturn}%)</div>
                        <div className="font-bold text-orange-700">{grossReturn.toLocaleString()} FCFA</div>
                      </div>
                      <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                        <div className="text-xs text-gray-400">Net versé investisseurs</div>
                        <div className="font-bold text-green-700">{netInvestors.toLocaleString()} FCFA</div>
                      </div>
                      <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                        <div className="text-xs text-gray-400">Revenu total BAOBAB</div>
                        <div className="font-bold text-purple-700">+{revenueBAOBAB.toLocaleString()} FCFA</div>
                      </div>
                    </div>

                    {/* Décomposition complète */}
                    <div className="bg-white rounded-xl p-4 border border-gray-100 text-sm space-y-2">
                      <div className="font-semibold text-gray-800 mb-3">📊 Décomposition complète du remboursement</div>
                      <div className="flex justify-between py-1 border-b border-gray-50">
                        <span className="text-gray-600">Retour brut à distribuer ({p.expectedReturn}%)</span>
                        <span className="font-bold">{grossReturn.toLocaleString()} FCFA</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-50 text-red-600">
                        <span>— Commission BAOBAB retours ({fees.commission_baobab_return || 5}%)</span>
                        <span>-{baobabOnReturn.toLocaleString()} FCFA</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-50 text-red-500">
                        <span>— PayDunya Payout ({fees.paydunya_payout || 2}%) absorbé BAOBAB</span>
                        <span>-{paydunyaPayout.toLocaleString()} FCFA</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-50 font-bold text-green-700">
                        <span>= Net versé aux investisseurs</span>
                        <span>{netInvestors.toLocaleString()} FCFA</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-50 text-blue-600">
                        <span>Fonds de garantie libéré ({fees.commission_guarantee || 2}%)</span>
                        <span>+{garantie.toLocaleString()} FCFA</span>
                      </div>
                    </div>

                    {/* Détail par investisseur */}
                    {det?.investors?.length > 0 && (
                      <div className="bg-white rounded-xl p-4 border border-gray-100">
                        <div className="font-semibold text-gray-800 mb-3">👥 Versement par investisseur</div>
                        <div className="space-y-2">
                          {det.investors.map((inv: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm">
                              <div>
                                <div className="font-medium text-gray-900">{inv.name}</div>
                                <div className="text-xs text-gray-500">Investi : {inv.amount.toLocaleString()} FCFA</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-gray-400">Retour brut : {inv.expectedReturn.toLocaleString()} FCFA</div>
                                <div className="font-bold text-green-700">Net reçu : {inv.netReturn.toLocaleString()} FCFA</div>
                                <div className="text-xs text-green-500">Gain : +{(inv.netReturn - inv.amount).toLocaleString()} FCFA</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Note admin + confirmation */}
                    <div className="space-y-3">
                      <input value={note} onChange={e => setNote(e.target.value)}
                        placeholder="Note de clôture (optionnelle — visible dans le rapport)"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400" />
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                        ⚠️ <strong>Action irréversible</strong> — Les fonds seront crédités sur les wallets des investisseurs. Le projet passera en statut COMPLETED.
                      </div>
                      <button onClick={() => reimburse(p.id)} disabled={processing === p.id}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-colors">
                        {processing === p.id ? "⏳ Traitement en cours..." : `💰 Confirmer le remboursement — ${netInvestors.toLocaleString()} FCFA aux investisseurs`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Projets actifs mais pas encore funded */}
      {activeNotFunded.length > 0 && (
        <div className="space-y-3">
          <div className="font-semibold text-gray-500 text-sm">🔒 Collecte en cours — remboursement non disponible</div>
          {activeNotFunded.map((p: any) => {
            const pct = Math.round(((p.raisedAmount || 0) / (p.goalAmount || 1)) * 100);
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4 opacity-75">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium text-gray-900">{p.title}</div>
                    <div className="text-xs text-gray-500">{p.entrepreneur?.firstName} {p.entrepreneur?.lastName} · {p.sector}</div>
                  </div>
                  <span className="text-xs bg-orange-100 text-orange-700 font-bold px-2 py-1 rounded-full">⏳ {pct}% levé</span>
                </div>
                <div className="bg-gray-100 rounded-full h-2">
                  <div className="bg-orange-400 h-2 rounded-full" style={{width: `${Math.min(pct, 100)}%`}} />
                </div>
                <div className="text-xs text-gray-400 mt-1">{(p.raisedAmount || 0).toLocaleString()} / {(p.goalAmount || 0).toLocaleString()} FCFA — Il manque {((p.goalAmount || 0) - (p.raisedAmount || 0)).toLocaleString()} FCFA pour débloquer le remboursement</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Projets terminés */}
      {completedProjects.length > 0 && (
        <div className="space-y-3">
          <div className="font-semibold text-gray-500 text-sm">✅ Projets terminés et remboursés</div>
          {completedProjects.map((p: any) => (
            <div key={p.id} className="bg-green-50 border border-green-100 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{p.title}</div>
                  <div className="text-xs text-gray-500">{p.entrepreneur?.firstName} {p.entrepreneur?.lastName}</div>
                </div>
                <span className="text-xs bg-green-200 text-green-800 font-bold px-2 py-1 rounded-full">✅ COMPLÉTÉ</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {fundedProjects.length === 0 && activeNotFunded.length === 0 && completedProjects.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-3">💰</div>
          <p className="text-gray-400">Aucun projet à rembourser</p>
        </div>
      )}
    </div>
  );
}


function StatsTab({ authGet }: any) {
  const [period, setPeriod] = React.useState("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const API = process.env.NEXT_PUBLIC_API_URL || "http://46.202.132.161:3001";

  const getDateRange = (p: string) => {
    const now = new Date();
    if (p === "month") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: from.toISOString().split("T")[0], to: now.toISOString().split("T")[0] };
    }
    if (p === "year") {
      const from = new Date(now.getFullYear(), 0, 1);
      return { from: from.toISOString().split("T")[0], to: now.toISOString().split("T")[0] };
    }
    if (p === "last3") {
      const from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      return { from: from.toISOString().split("T")[0], to: now.toISOString().split("T")[0] };
    }
    if (p === "custom") return { from: dateFrom, to: dateTo };
    return { from: "", to: "" };
  };

  const downloadPDF = async () => {
    const token = localStorage.getItem("accessToken");
    const { from, to } = getDateRange(period);
    const params = from && to ? `?from=${from}&to=${to}` : "";
    const res = await fetch(`${API}/api/pdf/report/admin${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) { alert("Erreur génération PDF"); return; }
    const blob = await res.blob();
    const label = period === "month" ? "mensuel" : period === "year" ? "annuel" : period === "last3" ? "trimestriel" : "complet";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rapport-baobab-${label}-${new Date().toISOString().split("T")[0]}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadCSV = async () => {
    const token = localStorage.getItem("accessToken");
    const res = await fetch(`${API}/api/exports/admin`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) { alert("Erreur export CSV"); return; }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `stats-baobab-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-5">
      {/* En-tête avec filtres de période */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
          <h2 className="text-xl font-bold text-gray-900">📈 Statistiques & Rapports</h2>
          <div className="flex gap-2">
            <button onClick={downloadPDF}
              className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-2 rounded-xl flex items-center gap-2">
              📄 Télécharger PDF
            </button>
            <button onClick={downloadCSV}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2 rounded-xl flex items-center gap-2">
              📥 Export CSV
            </button>
          </div>
        </div>

        {/* Filtres période */}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-gray-500 font-medium">Période du rapport :</span>
          {[
            { id: "all", label: "Tout" },
            { id: "month", label: "Ce mois" },
            { id: "last3", label: "3 derniers mois" },
            { id: "year", label: "Cette année" },
            { id: "custom", label: "Personnalisé" },
          ].map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors ${period === p.id ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Dates personnalisées */}
        {period === "custom" && (
          <div className="flex gap-3 mt-3 items-center">
            <div>
              <label className="text-xs text-gray-500">Du</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm ml-2 focus:outline-none focus:border-green-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Au</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm ml-2 focus:outline-none focus:border-green-400" />
            </div>
            {dateFrom && dateTo && (
              <span className="text-xs text-green-600 font-medium">
                Rapport du {new Date(dateFrom).toLocaleDateString("fr-FR")} au {new Date(dateTo).toLocaleDateString("fr-FR")}
              </span>
            )}
          </div>
        )}

        {/* Info période sélectionnée */}
        <div className="mt-3 text-xs text-gray-400">
          {period === "month" && "Rapport mensuel — du 1er du mois à aujourd'hui"}
          {period === "last3" && "Rapport trimestriel — 90 derniers jours"}
          {period === "year" && "Rapport annuel — du 1er janvier à aujourd'hui"}
          {period === "all" && "Rapport complet — toutes les données depuis le lancement"}
        </div>
      </div>

      {/* Graphiques AdminCharts */}
      <AdminCharts />
    </div>
  );
}

function FinancesTab({ authGet }: any) {
  const [data, setData] = React.useState<any>(null);
  const [revenues, setRevenues] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [openProject, setOpenProject] = React.useState<string | null>(null);
  const API = process.env.NEXT_PUBLIC_API_URL || "http://46.202.132.161:3001";

  React.useEffect(() => {
    Promise.all([
      authGet("/api/admin/finances/details"),
      authGet("/api/admin/platform-revenues"),
    ]).then(([det, rev]) => {
      if (det.success) setData(det.data);
      if (rev.success) setRevenues(rev.data);
    }).finally(() => setLoading(false));
  }, []);

  const downloadAdminPDF = async () => {
    const token = localStorage.getItem("accessToken");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://46.202.132.161:3001';
    const res = await fetch(`${apiUrl}/api/pdf/report/admin`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "rapport-admin.pdf"; a.click(); URL.revokeObjectURL(a.href);
  };

  if (loading) return <div className="text-center py-10 text-gray-400">Chargement...</div>;

  const projects = data?.projects || [];
  const activeProjects = projects.filter((p: any) => p.totalInvested > 0);
  const totalInvested = projects.reduce((s: number, p: any) => s + p.totalInvested, 0);
  const totalCagnotteNette = projects.reduce((s: number, p: any) => s + p.cagnotteNette, 0);
  const totalRevenuBAOBAB = projects.reduce((s: number, p: any) => s + p.revenueNetBAOBABProjet, 0);
  const totalRetourInvestisseurs = projects.reduce((s: number, p: any) => s + p.netInvestors, 0);
  const totalFournisseurs = projects.reduce((s: number, p: any) => s + p.totalFournisseurs, 0);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-900">💵 Finances BAOBAB INVEST</h2>
        <div className="flex gap-2">
          <button onClick={downloadAdminPDF} className="bg-purple-600 text-white text-sm px-4 py-2 rounded-xl font-medium hover:bg-purple-700">
            📄 Rapport PDF
          </button>
        </div>
      </div>

      {/* KPIs globaux */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Total levé", value: totalInvested, icon: "💰", color: "text-green-700", bg: "bg-green-50", note: "Brut investisseurs" },
          { label: "Cagnotte nette projets", value: totalCagnotteNette, icon: "🏗️", color: "text-blue-700", bg: "bg-blue-50", note: "Après frais clôture" },
          { label: "Revenu net BAOBAB", value: revenues?.revenueNetBAOBAB || totalRevenuBAOBAB, icon: "🏦", color: "text-purple-700", bg: "bg-purple-50", note: "Encaissé à ce jour" },
          { label: "Retours investisseurs", value: totalRetourInvestisseurs, icon: "📈", color: "text-orange-700", bg: "bg-orange-50", note: "Projetés net (à venir)" },
          { label: "Payé fournisseurs", value: totalFournisseurs, icon: "🏪", color: "text-gray-700", bg: "bg-gray-50", note: "Via jalons validés" },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-2xl p-4`}>
            <div className="text-xl mb-1">{k.icon}</div>
            <div className={`font-bold text-lg ${k.color}`}>{k.value.toLocaleString()} FCFA</div>
            <div className="text-xs text-gray-600 font-medium">{k.label}</div>
            <div className="text-xs text-gray-400">{k.note}</div>
          </div>
        ))}
      </div>

      {/* Résumé revenus */}
      {revenues && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4">📊 Détail revenus BAOBAB encaissés</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="bg-green-50 rounded-xl p-3">
              <div className="text-xs text-gray-500">Commission collecte (brut)</div>
              <div className="font-bold text-green-700">+{(revenues.revenuBrutBAOBAB || 0).toLocaleString()} FCFA</div>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <div className="text-xs text-gray-500">PayDunya Payin absorbé</div>
              <div className="font-bold text-red-600">-{(revenues.coutPaydunya || 0).toLocaleString()} FCFA</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-3">
              <div className="text-xs text-gray-500">Commissions mentors versées</div>
              <div className="font-bold text-purple-700">{(revenues.totalMentorCommission || 0).toLocaleString()} FCFA</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-3">
              <div className="text-xs text-gray-500">Projection annuelle (net)</div>
              <div className="font-bold text-blue-700">{(revenues.projectionAnnuelle || 0).toLocaleString()} FCFA</div>
            </div>
          </div>
        </div>
      )}

      {/* Détail par projet */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-4">📋 Détail financier par projet</h3>
        {activeProjects.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Aucun projet avec investissement</div>
        ) : (
          <div className="space-y-3">
            {activeProjects.map((p: any) => (
              <div key={p.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                {/* En-tête projet */}
                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setOpenProject(openProject === p.id ? null : p.id)}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-10 rounded-full ${p.status === 'ACTIVE' ? 'bg-green-400' : p.status === 'FUNDED' ? 'bg-blue-400' : p.status === 'COMPLETED' ? 'bg-purple-400' : 'bg-gray-300'}`} />
                    <div>
                      <div className="font-semibold text-gray-900">{p.title}</div>
                      <div className="text-xs text-gray-500">{p.sector} · {p.entrepreneur} · {p.status}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <div className="text-xs text-gray-400">Levé</div>
                      <div className="font-bold text-green-700">{p.totalInvested.toLocaleString()} FCFA</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Revenu BAOBAB</div>
                      <div className="font-bold text-purple-700">+{p.revenueNetBAOBABProjet.toLocaleString()} FCFA</div>
                    </div>
                    <span className="text-gray-400">{openProject === p.id ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Détail dépliable */}
                {openProject === p.id && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
                    {/* Flux financier */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-white rounded-xl p-3 border border-gray-100">
                        <div className="text-gray-400">Levé brut</div>
                        <div className="font-bold text-gray-900">{p.totalInvested.toLocaleString()} FCFA</div>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-green-100">
                        <div className="text-gray-400">Cagnotte nette entrepreneur</div>
                        <div className="font-bold text-green-700">{p.cagnotteNette.toLocaleString()} FCFA</div>
                        <div className="text-gray-400 mt-1">Après -BAOBAB {p.baobabOnCollection.toLocaleString()} -mentor {p.mentorFee.toLocaleString()} -garantie {p.guaranteeFee.toLocaleString()}</div>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-orange-100">
                        <div className="text-gray-400">Retour projeté investisseurs (net)</div>
                        <div className="font-bold text-orange-700">{p.netInvestors.toLocaleString()} FCFA</div>
                        <div className="text-gray-400 mt-1">Brut {p.totalExpectedReturn.toLocaleString()} - BAOBAB {p.baobabOnReturn.toLocaleString()} - PayDunya {p.paydunyaPayout.toLocaleString()}</div>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-purple-100">
                        <div className="text-gray-400">Revenu net BAOBAB</div>
                        <div className="font-bold text-purple-700">+{p.revenueNetBAOBABProjet.toLocaleString()} FCFA</div>
                        <div className="text-gray-400 mt-1">Collecte {p.baobabOnCollection.toLocaleString()} - PayDunya {p.paydunyaPayin.toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Investisseurs */}
                    {p.investors.length > 0 && (
                      <div>
                        <div className="font-semibold text-gray-700 text-xs mb-2">👥 Investisseurs ({p.investors.length})</div>
                        <div className="space-y-1">
                          {p.investors.map((inv: any, i: number) => (
                            <div key={i} className="flex items-center justify-between bg-white rounded-xl p-2 border border-gray-100 text-xs">
                              <span className="font-medium text-gray-700">{inv.name}</span>
                              <div className="flex gap-4 text-right">
                                <div><span className="text-gray-400">Investi: </span><span className="font-bold">{inv.amount.toLocaleString()} FCFA</span></div>
                                <div><span className="text-gray-400">Retour brut: </span><span className="text-orange-600">+{inv.expectedReturn.toLocaleString()} FCFA</span></div>
                                <div><span className="text-gray-400">Net: </span><span className="text-green-600 font-bold">+{inv.netReturn.toLocaleString()} FCFA</span></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Jalons et fournisseurs */}
                    {p.milestones.length > 0 && (
                      <div>
                        <div className="font-semibold text-gray-700 text-xs mb-2">🏗️ Jalons & Fournisseurs</div>
                        <div className="space-y-1">
                          {p.milestones.map((m: any, i: number) => (
                            <div key={i} className="bg-white rounded-xl p-2 border border-gray-100 text-xs">
                              <div className="flex justify-between">
                                <span className="font-medium">{m.title}</span>
                                <span className={`font-bold ${m.status === 'APPROVED' || m.status === 'PAID' ? 'text-green-600' : 'text-orange-600'}`}>
                                  {m.amount.toLocaleString()} FCFA · {m.status}
                                </span>
                              </div>
                              {m.payments.map((pay: any, j: number) => (
                                <div key={j} className="text-gray-500 mt-0.5 ml-2">
                                  🏪 {pay.supplier} — {pay.amount.toLocaleString()} FCFA [{pay.status}]
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fournisseurs payés par projet */}
                    <div className="bg-white rounded-xl p-3 border border-gray-100 text-xs">
                      <div className="font-semibold text-gray-700 mb-2">🏪 Fournisseurs (via jalons validés)</div>
                      {p.milestones.filter((m: any) => m.payments.length > 0).length === 0 ? (
                        <div className="text-gray-400">Aucun paiement fournisseur pour ce projet</div>
                      ) : (
                        <div className="space-y-1">
                          {p.milestones.filter((m: any) => m.payments.length > 0).map((m: any, i: number) => (
                            <div key={i}>
                              <div className="text-gray-500 font-medium mb-0.5">Jalon: {m.title} ({m.status})</div>
                              {m.payments.map((pay: any, j: number) => (
                                <div key={j} className={`flex justify-between ml-2 py-0.5 ${pay.status === 'COMPLETED' ? 'text-green-700' : 'text-orange-600'}`}>
                                  <span>🏪 {pay.supplier || "Fournisseur"}</span>
                                  <span className="font-bold">{pay.amount.toLocaleString()} FCFA [{pay.status === 'COMPLETED' ? '✅ Payé' : '⏳ En attente'}]</span>
                                </div>
                              ))}
                            </div>
                          ))}
                          <div className="border-t border-gray-100 pt-1 mt-1 flex justify-between font-bold">
                            <span>Total payé fournisseurs</span>
                            <span className="text-green-700">{p.totalFournisseurs.toLocaleString()} FCFA</span>
                          </div>
                          {p.fournisseursPending > 0 && (
                            <div className="flex justify-between text-orange-600">
                              <span>En attente paiement</span>
                              <span>{p.fournisseursPending.toLocaleString()} FCFA</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Mentor */}
                    {p.mentor && (
                      <div className="bg-purple-50 rounded-xl p-3 text-xs">
                        <span className="font-semibold text-purple-800">🎓 Mentor: </span>
                        <span className="text-purple-700">{p.mentor} — Commission versée: {p.mentorFee.toLocaleString()} FCFA</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dernières transactions revenus */}
      {revenues?.revenues?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4">📋 Dernières transactions</h3>
          <div className="space-y-2">
            {revenues.revenues.slice(0, 15).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                <div>
                  <div className="font-medium text-gray-900">{r.description || r.type}</div>
                  <div className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString("fr-FR")}</div>
                </div>
                <div className={`font-bold ${r.amount >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {r.amount >= 0 ? "+" : ""}{r.amount.toLocaleString()} FCFA
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  useRequireRole(["ADMIN"]);
  const [tab, setTab] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("adminTab");
      if (saved) { sessionStorage.removeItem("adminTab"); return saved; }
    }
    return "overview";
  });
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [milestoneNote, setMilestoneNote] = useState("");
  const [kycUsers, setKycUsers] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [search, setSearch] = useState("");
  const [unread, setUnread] = useState(0);
  const [revenues, setRevenues] = useState<any>(null);
  const [globalStats, setGlobalStats] = useState<any>({
    pendingProjects: 0, pendingKyc: 0, totalUsers: 0,
    pendingSuppliers: 0, pendingMilestones: 0, activeProjects: 0, pendingTransactions: 0,
    totalInvested: 0, totalRaised: 0,
  });

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) { router.push("/auth/login"); return; }
    const u = JSON.parse(user);
    if (u.role !== "ADMIN") { router.push("/dashboard"); return; }
    loadData();
  }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 5000); };

  const loadData = async () => {
    setLoading(true);
    // Vérification automatique des projets inactifs
    // Vérification inactive — uniquement via bouton manuel dans Vue générale
    try {
      const [pendingProj, allProj, usrs, suppl, notif, mils, rev, txs] = await Promise.all([
        authGet("/api/projects?status=PENDING_REVIEW&limit=50"),
        authGet("/api/projects?limit=100"),
        authGet("/api/admin/users"),
        authGet("/api/suppliers/admin/all"),
        authGet("/api/notifications"),
        authGet("/api/admin/milestones/pending"),
        authGet("/api/admin/platform-revenues"),
        authGet("/api/wallet/admin/pending"),
      ]);

      const pendingList = pendingProj.data?.projects || [];
      const allProjList = allProj.data?.projects || [];
      const userList = usrs.data || [];
      const supplList = suppl.data || [];

      setProjects(pendingList);
      setAllProjects(allProjList);
      setUsers(userList);
      setSuppliers(supplList);
      if (notif.success) setUnread(notif.data.unreadCount || 0);
      if (mils?.success) setMilestones(Array.isArray(mils.data) ? mils.data : []);
      if (rev?.success) setRevenues(rev.data);

      // KYC en attente
      const kycPending = userList.filter((u: any) => u.kycStatus === "PENDING");
      setKycUsers(kycPending);

      // Stats globales
      setGlobalStats({
        pendingProjects: pendingList.length,
        pendingKyc: kycPending.length,
        pendingTransactions: (txs?.data || []).filter((t: any) => t.status === "PENDING").length,
        totalUsers: userList.length,
        pendingSuppliers: supplList.filter((s: any) => !s.isVerified).length,
        activeProjects: allProjList.filter((p: any) => p.status === "ACTIVE").length,
        totalRaised: allProjList.reduce((s: number, p: any) => s + (p.raisedAmount || 0), 0),
        investors: userList.filter((u: any) => u.role === "INVESTOR").length,
        entrepreneurs: userList.filter((u: any) => u.role === "ENTREPRENEUR").length,
      });

      // Jalons soumis en attente
      // On les récupère via les projets actifs
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const approveProject = async (id: string) => {
    const token = localStorage.getItem("accessToken");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects/${id}/approve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ adminNote: adminNote || "Approuvé par l'admin" }),
    });
    const data = await res.json();
    if (data.success) { flash("✅ Projet approuvé !"); setAdminNote(""); loadData(); }
    else flash("❌ " + data.message);
  };

  const rejectProject = async (id: string) => {
    if (!adminNote.trim()) { flash("❌ Saisis une raison de refus"); return; }
    const token = localStorage.getItem("accessToken");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects/${id}/reject`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ adminNote }),
    });
    const data = await res.json();
    if (data.success) { flash("Projet rejeté"); setAdminNote(""); loadData(); }
    else flash("❌ " + data.message);
  };

  const verifyKyc = async (userId: string) => {
    const res = await authPost(`/api/admin/users/${userId}/verify-kyc`, {});
    if (res.success) { flash("✅ KYC validé !"); loadData(); }
    else flash("❌ " + res.message);
  };

  const rejectKyc = async (userId: string) => {
    const reason = prompt("Raison du rejet KYC :");
    if (!reason) return;
    const res = await authPost(`/api/admin/users/${userId}/reject-kyc`, { reason });
    if (res.success) { flash("KYC rejeté"); loadData(); }
    else flash("❌ " + res.message);
  };

  const banUser = async (userId: string, isBanned: boolean) => {
    const action = isBanned ? "unban" : "ban";
    const res = await authPost(`/api/admin/users/${userId}/${action}`, {});
    if (res.success) { flash(`✅ Utilisateur ${isBanned ? "réhabilité" : "banni"}`); loadData(); }
    else flash("❌ " + res.message);
  };

  const verifySupplier = async (supplierId: string) => {
    const res = await authPatch(`/api/suppliers/${supplierId}/verify`, {});
    if (res.success) { flash("✅ Fournisseur vérifié !"); loadData(); }
    else flash("❌ " + res.message);
  };

  const reimburseProject = async (projectId: string) => {
    if (!confirm("Confirmer le remboursement de tous les investisseurs de ce projet ?")) return;
    const res = await authPost(`/api/admin/projects/${projectId}/reimburse`, {});
    if (res.success) { flash(`✅ ${res.data?.investorsReimbursed || 0} investisseur(s) remboursé(s) !`); loadData(); }
    else flash("❌ " + res.message);
  };

  const checkInactiveProjects = async () => {
    const res = await authPost("/api/admin/check-inactive-projects", {});
    if (res.success) flash(`✅ ${res.data?.alertCount || 0} alerte(s) envoyée(s)`);
    else flash("❌ " + res.message);
  };

  const logout = () => { localStorage.clear(); router.push("/"); };

  const filteredUsers = users.filter(u =>
    !search || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const urgentActions = [
    ...projects.slice(0, 3).map(p => ({ type: "project", label: `Projet à valider : "${p.title}"`, id: p.id, color: "orange" })),
    ...kycUsers.slice(0, 3).map(u => ({ type: "kyc", label: `KYC en attente : ${u.firstName} ${u.lastName}`, id: u.id, color: "blue" })),
    ...suppliers.filter(s => !s.isVerified).slice(0, 2).map(s => ({ type: "supplier", label: `Fournisseur à vérifier : ${s.companyName}`, id: s.id, color: "purple" })),
  ];

  function MilestonesTab({ flash, authPatch }: any) {
    const [mils, setMils] = useState<any[]>([]);
    const [note, setNote] = useState("");
    const [loading2, setLoading2] = useState(true);

    useEffect(() => {
      authGet("/api/admin/milestones/pending").then(r => {
        if (r.success) setMils(Array.isArray(r.data) ? r.data : []);
      }).finally(() => setLoading2(false));
    }, []);

    const reload = () => {
      setLoading2(true);
      authGet("/api/admin/milestones/pending").then(r => {
        if (r.success) setMils(Array.isArray(r.data) ? r.data : []);
      }).finally(() => setLoading2(false));
    };

    if (loading2) return <div className="text-center py-12"><div className="text-5xl animate-bounce">🏗️</div></div>;

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">🏗️ Demandes de déblocage ({mils.length})</h2>
          <button onClick={reload} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-xl transition-colors">🔄 Actualiser</button>
        </div>
        {mils.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-5xl mb-3">✅</div>
            <p className="text-gray-500 font-medium">Aucune demande de déblocage en attente</p>
          </div>
        ) : mils.map((m: any) => (
          <div key={m.id} className="bg-white rounded-2xl border border-orange-200 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded-full">⏳ En attente</span>
                  <span className="text-xs text-gray-400">{m.project?.title}</span>
                </div>
                <h3 className="font-bold text-gray-900 text-lg">{m.title}</h3>
                <div className="text-sm text-gray-500 mt-0.5">
                  {m.project?.entrepreneur?.firstName} {m.project?.entrepreneur?.lastName} · {m.project?.entrepreneur?.email}
                </div>
                {m.description && <p className="text-sm text-gray-600 mt-2">{m.description}</p>}
                {m.invoiceUrl && (
                  <a href={m.invoiceUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-lg border border-blue-200">
                    📎 Voir la facture →
                  </a>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-bold text-green-700 text-2xl">{m.amount?.toLocaleString()} FCFA</div>
                <div className="text-xs text-gray-400 mt-1">Soumis le {new Date(m.updatedAt).toLocaleDateString("fr-FR")}</div>
              </div>
            </div>
            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Note admin</label>
              <input value={note} onChange={e => setNote(e.target.value)}
                placeholder="Note optionnelle pour l'approbation, obligatoire pour le rejet..."
                className="input-field text-sm" />
            </div>
            <div className="flex gap-3">
              <button onClick={async () => {
                const res = await authPatch(`/api/admin/milestones/${m.id}/approve`, { adminNote: note || "Approuvé" });
                if (res.success) { flash("✅ Jalon approuvé !"); setNote(""); reload(); }
                else flash("❌ " + res.message);
              }} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors">
                ✅ Approuver et débloquer
              </button>
              <button onClick={async () => {
                if (!note.trim()) { flash("❌ Saisis une raison de rejet"); return; }
                const res = await authPatch(`/api/admin/milestones/${m.id}/reject`, { adminNote: note });
                if (res.success) { flash("Jalon rejeté"); setNote(""); reload(); }
                else flash("❌ " + res.message);
              }} className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold py-3 rounded-xl border border-red-200 transition-colors">
                ❌ Rejeter
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center"><div className="text-5xl animate-bounce mb-4">🛡️</div><p className="text-gray-500">Chargement du back-office...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar Admin */}
      <nav className="bg-green-900 text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌳</span>
            <div>
              <span className="font-bold text-lg">BAOBAB INVEST</span>
              <span className="text-green-300 text-xs ml-2">Back-office Admin</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {urgentActions.length > 0 && (
              <div className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                🚨 {urgentActions.length} action(s) urgente(s)
              </div>
            )}
            <Link href="/notifications" className="relative group">
              <span className={`text-2xl inline-block transition-all ${unread > 0 ? "animate-bounce" : "group-hover:scale-110"}`}>🔔</span>
              {unread > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-xs rounded-full flex items-center justify-center font-bold animate-pulse">{unread}</span>}
            </Link>
            <Link href="/messages" className="text-green-300 hover:text-white text-sm transition-colors">💬 Messages</Link>
            <button onClick={logout} className="text-green-300 hover:text-white text-sm transition-colors">Déconnexion</button>
          </div>
        </div>
      </nav>

      {msg && (
        <div className={`px-6 py-3 text-sm font-medium text-center ${msg.startsWith("✅") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {msg}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                {t.label}
                {t.id === "projects" && projects.length > 0 && <span className="ml-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">{projects.length}</span>}
                {t.id === "kyc" && kycUsers.length > 0 && <span className="ml-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">{kycUsers.length}</span>}
                {t.id === "suppliers" && suppliers.filter(s => !s.isVerified).length > 0 && <span className="ml-1 bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full">{suppliers.filter(s => !s.isVerified).length}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* VUE GÉNÉRALE */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Projets à valider", value: globalStats.pendingProjects, icon: "📋", bg: "bg-orange-50", color: "text-orange-700", border: "border-orange-200", action: () => setTab("projects") },
                { label: "Projets actifs", value: globalStats.activeProjects, icon: "🚀", bg: "bg-green-50", color: "text-green-700", border: "border-green-200", action: () => setTab("active_projects") },
                { label: "Transactions en attente", value: globalStats.pendingTransactions, icon: "💳", bg: "bg-red-50", color: "text-red-700", border: "border-red-200", action: () => setTab("transactions") },
                { label: "KYC en attente", value: globalStats.pendingKyc, icon: "🪪", bg: "bg-blue-50", color: "text-blue-700", border: "border-blue-200", action: () => setTab("kyc") },
                { label: "Fournisseurs à vérifier", value: globalStats.pendingSuppliers, icon: "🏪", bg: "bg-purple-50", color: "text-purple-700", border: "border-purple-200", action: () => setTab("suppliers") },
              ].map((s, i) => (
                <div key={i} onClick={s.action}
                  className={`${s.bg} border ${s.border} rounded-2xl p-5 cursor-pointer hover:shadow-md transition-all`}>
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <div className={`text-3xl font-bold ${s.color} mb-1`}>{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                  {s.value > 0 && <div className="text-xs text-gray-400 mt-1">Cliquer pour voir →</div>}
                </div>
              ))}
            </div>

            {/* Stats secondaires */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Utilisateurs total", value: globalStats.totalUsers, icon: "👥", color: "text-gray-700" },
                { label: "Investisseurs", value: globalStats.investors, icon: "🌳", color: "text-green-700" },
                { label: "Entrepreneurs", value: globalStats.entrepreneurs, icon: "🚀", color: "text-blue-700" },
                { label: "Total levé (FCFA)", value: `${(globalStats.totalRaised / 1000).toFixed(0)}k`, icon: "💰", color: "text-yellow-700" },
              ].map(s => (
                <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-5">
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <div className={`text-2xl font-bold ${s.color} mb-1`}>{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Actions urgentes */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 text-lg">🚨 Actions prioritaires</h3>
                <button onClick={checkInactiveProjects}
                  className="text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-xl transition-colors font-medium">
                  ⚠️ Vérifier inactivité 21j
                </button>
              </div>
              {urgentActions.length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-4xl mb-2">✅</div>
                  <p className="text-gray-500 font-medium">Aucune action urgente — tout est à jour !</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {urgentActions.map((action, i) => {
                    const colors: Record<string, string> = {
                      orange: "bg-orange-50 border-orange-200 text-orange-800",
                      blue: "bg-blue-50 border-blue-200 text-blue-800",
                      purple: "bg-purple-50 border-purple-200 text-purple-800",
                    };
                    const tabMap: Record<string, string> = { project: "projects", kyc: "kyc", supplier: "suppliers" };
                    return (
                      <div key={i} onClick={() => setTab(tabMap[action.type])}
                        className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer hover:shadow-sm transition-all ${colors[action.color]}`}>
                        <span className="font-medium text-sm">{action.label}</span>
                        <span className="text-sm font-bold">Traiter →</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Activité récente */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-4">📅 Projets récents</h3>
              <div className="space-y-3">
                {allProjects.slice(0, 5).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <div className="font-medium text-sm text-gray-900">{p.title}</div>
                      <div className="text-xs text-gray-500">{p.sector} · {p.city}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-bold text-green-700">{p.raisedAmount?.toLocaleString()} FCFA</div>
                        <div className="text-xs text-gray-400">{Math.round((p.raisedAmount / p.goalAmount) * 100)}%</div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_COLORS[p.status] || "bg-gray-100 text-gray-600"}`}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PROJETS À VALIDER */}
        {tab === "projects" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">📋 Projets à valider ({projects.length})</h2>
              <div className="text-sm text-gray-500">Délai de réponse : 48h ouvrées</div>
            </div>
            {projects.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="text-5xl mb-3">✅</div>
                <p className="text-gray-500 font-medium">Aucun projet en attente de validation</p>
              </div>
            ) : projects.map((p: any) => (
              <div key={p.id} className="bg-white rounded-2xl border border-orange-200 p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded-full">⏳ En attente</span>
                      <span className="text-xs text-gray-400">{RISK_LABELS[p.riskLevel]} · {p.sector}</span>
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg">{p.title}</h3>
                    <div className="text-sm text-gray-500 mt-0.5">
                      Par {p.entrepreneur?.firstName} {p.entrepreneur?.lastName} · Score réputation : {p.entrepreneur?.reputationScore}/100
                    </div>
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{p.description}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-green-700 text-xl">{p.goalAmount?.toLocaleString()} FCFA</div>
                    <div className="text-xs text-gray-400">Objectif · {p.durationMonths} mois</div>
                    <div className="text-sm font-medium text-blue-600 mt-1">+{p.expectedReturn}% retour</div>
                    <div className="text-sm font-bold text-purple-600">Score : {p.bankabilityScore}/100</div>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Note admin (obligatoire pour le rejet)</label>
                  <input value={adminNote} onChange={e => setAdminNote(e.target.value)}
                    placeholder="Ex: Dossier incomplet, business plan insuffisant..." className="input-field text-sm" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => approveProject(p.id)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors">
                    ✅ Approuver le projet
                  </button>
                  <button onClick={() => rejectProject(p.id)}
                    className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold py-3 rounded-xl border border-red-200 transition-colors">
                    ❌ Rejeter
                  </button>
                  <Link href={`/projects/${p.id}`} target="_blank"
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-5 rounded-xl transition-colors text-sm">
                    🔍 Voir
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* UTILISATEURS */}
        {tab === "users" && (
          <div className="space-y-5">
            {/* En-tête + stats rapides */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-xl font-bold text-gray-900">👥 Utilisateurs ({users.length})</h2>
              <div className="flex gap-2 text-xs">
                {[
                  { label: "Investisseurs", count: users.filter((u:any)=>u.role==="INVESTOR").length, color: "bg-green-100 text-green-700" },
                  { label: "Entrepreneurs", count: users.filter((u:any)=>u.role==="ENTREPRENEUR").length, color: "bg-blue-100 text-blue-700" },
                  { label: "Mentors", count: users.filter((u:any)=>u.role==="MENTOR").length, color: "bg-purple-100 text-purple-700" },
                  { label: "KYC en attente", count: users.filter((u:any)=>u.kycStatus==="PENDING").length, color: "bg-orange-100 text-orange-700" },
                  { label: "Non soumis", count: users.filter((u:any)=>u.kycStatus==="NOT_SUBMITTED"||!u.kycStatus).length, color: "bg-gray-100 text-gray-700" },
                ].map(s => (
                  <span key={s.label} className={`px-2 py-1 rounded-lg font-medium ${s.color}`}>{s.label}: {s.count}</span>
                ))}
              </div>
            </div>

            {/* Filtres */}
            <div className="flex gap-2 flex-wrap items-center">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="🔍 Rechercher par nom, email, téléphone..." className="input-field text-sm flex-1 min-w-48" />
              <select onChange={e => setSearch(e.target.value === "ALL" ? "" : e.target.value)}
                className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-600">
                <option value="ALL">Tous les rôles</option>
                <option value="INVESTOR">Investisseurs</option>
                <option value="ENTREPRENEUR">Entrepreneurs</option>
                <option value="MENTOR">Mentors</option>
                <option value="ADMIN">Admins</option>
              </select>
              <select onChange={e => {
                const v = e.target.value;
                if (v === "ALL") setSearch("");
                else if (v === "PENDING") setSearch("PENDING");
                else if (v === "NOT_SUBMITTED") setSearch("NOT_SUBMITTED");
                else if (v === "VERIFIED") setSearch("VERIFIED");
              }} className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-600">
                <option value="ALL">Tous KYC</option>
                <option value="PENDING">⏳ KYC en attente</option>
                <option value="NOT_SUBMITTED">📄 Non soumis</option>
                <option value="VERIFIED">✅ Vérifiés</option>
              </select>
            </div>

            {/* Table enrichie */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {["Utilisateur", "Rôle", "KYC & Documents", "Activité", "Wallet", "Actions"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map((u: any) => (
                    <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${u.isBanned ? "opacity-50 bg-red-50" : ""}`}>
                      {/* Identité */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {u.firstName?.[0]}{u.lastName?.[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 text-sm">{u.firstName} {u.lastName}</div>
                            <div className="text-xs text-gray-400">{u.email}</div>
                            <div className="text-xs text-gray-400">{u.phone}</div>
                            <div className="text-xs text-gray-400">{u.city}{u.country ? ` · ${u.country}` : ""}</div>
                          </div>
                        </div>
                      </td>
                      {/* Rôle + Score */}
                      <td className="px-4 py-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full block w-fit mb-1 ${
                          u.role === "ADMIN" ? "bg-red-100 text-red-700" :
                          u.role === "ENTREPRENEUR" ? "bg-blue-100 text-blue-700" :
                          u.role === "MENTOR" ? "bg-purple-100 text-purple-700" :
                          "bg-green-100 text-green-700"}`}>
                          {u.role}
                        </span>
                        <div className="text-xs text-gray-400">⭐ {u.reputationScore || 50}/100</div>
                        <div className="text-xs text-gray-400">Niv. {u.level || 1}</div>
                        <div className="text-xs text-gray-400">Inscrit {new Date(u.createdAt).toLocaleDateString("fr-FR")}</div>
                      </td>
                      {/* KYC */}
                      <td className="px-4 py-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full block w-fit mb-1 ${
                          u.kycStatus === "VERIFIED" ? "bg-green-100 text-green-700" :
                          u.kycStatus === "PENDING" ? "bg-orange-100 text-orange-700" :
                          u.kycStatus === "REJECTED" ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-600"}`}>
                          {u.kycStatus === "VERIFIED" ? "✅ Vérifié" : u.kycStatus === "PENDING" ? "⏳ En attente" : u.kycStatus === "REJECTED" ? "❌ Rejeté" : "📄 Non soumis"}
                        </span>
                        {u.kycDocumentType && <div className="text-xs text-gray-400">{u.kycDocumentType}</div>}
                        {u.kycSubmittedAt && <div className="text-xs text-gray-400">Soumis {new Date(u.kycSubmittedAt).toLocaleDateString("fr-FR")}</div>}
                        {u.kycDocumentExpiry && (
                          <div className={`text-xs font-medium ${
                            new Date(u.kycDocumentExpiry) < new Date() ? "text-red-600" :
                            new Date(u.kycDocumentExpiry) < new Date(Date.now()+30*24*60*60*1000) ? "text-orange-600" : "text-gray-400"
                          }`}>
                            Exp: {new Date(u.kycDocumentExpiry).toLocaleDateString("fr-FR")}
                            {new Date(u.kycDocumentExpiry) < new Date() && " ⚠️ EXPIRÉ"}
                          </div>
                        )}
                        {u.kycDocumentUrl && (
                          <div className="flex gap-1 mt-1">
                            <a href={`${process.env.NEXT_PUBLIC_API_URL}${u.kycDocumentUrl}`} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline">🪪 CNI</a>
                            {u.kycSelfieUrl && <a href={`${process.env.NEXT_PUBLIC_API_URL}${u.kycSelfieUrl}`} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-purple-600 hover:underline ml-1">🤳 Selfie</a>}
                          </div>
                        )}
                        {u.rccmNumber && <div className="text-xs text-orange-600">RCCM: {u.rccmNumber}</div>}
                        {u.kycRejectedReason && <div className="text-xs text-red-500 mt-0.5">Motif: {u.kycRejectedReason}</div>}
                      </td>
                      {/* Activité */}
                      <td className="px-4 py-4 text-xs text-gray-500">
                        {u.referralCode && <div className="text-xs text-green-600 font-mono">{u.referralCode}</div>}
                        {u.referralCount > 0 && <div>{u.referralCount} filleul(s)</div>}
                        {u.kycAttempts > 0 && <div>{u.kycAttempts} tentative(s) KYC</div>}
                      </td>
                      {/* Wallet */}
                      <td className="px-4 py-4 text-xs">
                        {u.wallet ? (
                          <div>
                            <div className="font-semibold text-green-700">{(u.wallet.balance||0).toLocaleString()} FCFA</div>
                            {u.wallet.escrowBalance > 0 && <div className="text-orange-600">Escrow: {u.wallet.escrowBalance.toLocaleString()}</div>}
                            {u.wallet.totalInvested > 0 && <div className="text-gray-400">Investi: {u.wallet.totalInvested.toLocaleString()}</div>}
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          {u.kycStatus === "PENDING" && (
                            <div className="flex gap-1">
                              <button onClick={() => verifyKyc(u.id)} className="text-xs bg-green-600 text-white px-2 py-1 rounded-lg hover:bg-green-700 font-medium">✅ KYC</button>
                              <button onClick={() => rejectKyc(u.id)} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg border border-red-200 hover:bg-red-100">❌</button>
                            </div>
                          )}
                          <div className="flex gap-1">
                            <button onClick={() => banUser(u.id, u.isBanned)}
                              className={`text-xs px-2 py-1 rounded-lg font-medium ${u.isBanned ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                              {u.isBanned ? "♻️" : "🚫"}
                            </button>
                            <Link href={`/messages?to=${u.id}`} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg border border-blue-200">💬</Link>
                          </div>
                          <button onClick={async () => {
                            const newRole = prompt(`Changer rôle de ${u.firstName} (INVESTOR/ENTREPRENEUR/MENTOR/ADMIN):`);
                            if (!newRole) return;
                            const res = await authPatch(`/api/admin/users/${u.id}/role`, { role: newRole.toUpperCase() });
                            if (res.success) { flash("✅ Rôle modifié"); loadData(); }
                            else flash("❌ " + res.message);
                          }} className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded-lg border border-purple-200 hover:bg-purple-100">
                            🔄 Rôle
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <div className="text-center py-10 text-gray-400">
                  <div className="text-4xl mb-2">🔍</div>
                  <p>Aucun utilisateur trouvé</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* KYC */}
        {tab === "kyc" && <KycTab flash={flash} authPost={authPost} authPatch={authPatch} authGet={authGet} />}

        {/* FOURNISSEURS */}
        {tab === "suppliers" && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-gray-900">🏪 Fournisseurs ({suppliers.length})</h2>
            <div className="grid md:grid-cols-2 gap-5">
              {suppliers.map((s: any) => (
                <div key={s.id} className={`bg-white rounded-2xl border p-5 shadow-sm ${!s.isVerified ? "border-purple-200" : "border-gray-100"}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-bold text-gray-900">{s.companyName}</div>
                      <div className="text-sm text-gray-500">{s.sector} · {s.city}</div>
                      <div className="text-xs text-gray-400">{s.email} · {s.phone}</div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${s.isVerified ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700"}`}>
                      {s.isVerified ? "✅ Vérifié" : "⏳ En attente"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mb-3 space-y-1">
                    {s.rccmNumber && <div>📋 RCCM : {s.rccmNumber}</div>}
                    {s.nineaNumber && <div>🔢 NINEA : {s.nineaNumber}</div>}
                    <div>💳 {s.mobileMoneyProvider} : {s.mobileMoneyNumber}</div>
                  </div>
                  {s.isVerified && (
                    <div className="text-xs text-green-600 text-center py-1">
                      ✅ Vérifié le {s.verifiedAt ? new Date(s.verifiedAt).toLocaleDateString("fr-FR") : "—"}
                    </div>
                  )}
                  {!s.isVerified && (
                    <div className="space-y-2">
                      <button onClick={() => verifySupplier(s.id)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-xl text-sm transition-colors">
                        ✅ Vérifier le KYB fournisseur
                      </button>
                      <button onClick={async () => {
                        const reason = prompt("Raison du rejet KYB:");
                        if (!reason) return;
                        const res = await authPatch(`/api/suppliers/${s.id}/reject`, { reason });
                        if (res.success) { flash("Fournisseur rejeté"); loadData(); }
                        else flash("❌ " + res.message);
                      }} className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2 rounded-xl text-sm border border-red-200 transition-colors">
                        ❌ Rejeter
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* JALONS */}
        {tab === "milestones" && <MilestonesTab flash={flash} authPatch={authPatch} />}
        {tab === "milestones_unused" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">🏗️ Demandes de déblocage ({milestones.length})</h2>
              <button onClick={loadData} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-xl transition-colors">
                🔄 Actualiser
              </button>
            </div>
            {milestones.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="text-5xl mb-3">✅</div>
                <p className="text-gray-500 font-medium">Aucune demande de déblocage en attente</p>
              </div>
            ) : milestones.map((m: any) => (
              <div key={m.id} className="bg-white rounded-2xl border border-orange-200 p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded-full">⏳ En attente</span>
                      <span className="text-xs text-gray-400">{m.project?.title}</span>
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg">{m.title}</h3>
                    <div className="text-sm text-gray-500 mt-0.5">
                      Entrepreneur : {m.project?.entrepreneur?.firstName} {m.project?.entrepreneur?.lastName} · {m.project?.entrepreneur?.email}
                    </div>
                    {m.description && <p className="text-sm text-gray-600 mt-2">{m.description}</p>}
                    {m.invoiceUrl && (
                      <a href={m.invoiceUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-lg border border-blue-200 hover:bg-blue-100">
                        📎 Voir la facture / preuve →
                      </a>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-green-700 text-2xl">{m.amount?.toLocaleString()} FCFA</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Soumis le {new Date(m.updatedAt).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Note admin (obligatoire pour le rejet)</label>
                  <input value={milestoneNote} onChange={e => setMilestoneNote(e.target.value)}
                    placeholder="Ex: Facture conforme, paiement autorisé..." className="input-field text-sm" />
                </div>
                <div className="flex gap-3">
                  <button onClick={async () => {
                    const res = await authPatch(`/api/admin/milestones/${m.id}/approve`, { adminNote: milestoneNote || "Approuvé" });
                    if (res.success) { flash("✅ Jalon approuvé !"); setMilestoneNote(""); loadData(); }
                    else flash("❌ " + res.message);
                  }} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors">
                    ✅ Approuver et débloquer les fonds
                  </button>
                  <button onClick={async () => {
                    if (!milestoneNote.trim()) { flash("❌ Saisis une raison de rejet"); return; }
                    const res = await authPatch(`/api/admin/milestones/${m.id}/reject`, { adminNote: milestoneNote });
                    if (res.success) { flash("Jalon rejeté"); setMilestoneNote(""); loadData(); }
                    else flash("❌ " + res.message);
                  }} className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold py-3 rounded-xl border border-red-200 transition-colors">
                    ❌ Rejeter
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* REMBOURSEMENTS */}
        {tab === "reimburse" && <ReimburseTab allProjects={allProjects} flash={flash} authPost={authPost} authGet={authGet} loadData={loadData} />}


        {/* FINANCES BAOBAB INVEST */}
        {tab === "finances" && <FinancesTab authGet={authGet} />}
        {/* STATISTIQUES */}
        {tab === "active_projects" && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-gray-900">🚀 Projets actifs & financés ({allProjects.filter((p:any) => ["ACTIVE","FUNDED","IN_PROGRESS"].includes(p.status)).length})</h2>
            {allProjects.filter((p:any) => ["ACTIVE","FUNDED","IN_PROGRESS"].includes(p.status)).length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="text-5xl mb-3">📭</div>
                <p className="text-gray-400">Aucun projet actif</p>
              </div>
            ) : allProjects.filter((p:any) => ["ACTIVE","FUNDED","IN_PROGRESS"].includes(p.status)).map((p:any) => (
              <div key={p.id} className="bg-white rounded-2xl border border-green-200 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>{p.status}</span>
                      <span className="text-xs text-gray-400">{p.sector} · {p.city}</span>
                    </div>
                    <h3 className="font-bold text-gray-900">{p.title}</h3>
                    <div className="text-sm text-gray-500">Par {p.entrepreneur?.firstName} {p.entrepreneur?.lastName}</div>
                    <div className="mt-2 bg-gray-100 rounded-full h-2 w-full">
                      <div className="bg-green-500 h-2 rounded-full" style={{width: `${Math.min(Math.round((p.raisedAmount/p.goalAmount)*100),100)}%`}} />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{p.raisedAmount?.toLocaleString()} / {p.goalAmount?.toLocaleString()} FCFA ({Math.round((p.raisedAmount/p.goalAmount)*100)}%)</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-green-700">+{p.expectedReturn}%</div>
                    <div className="text-xs text-gray-400">{p.durationMonths} mois</div>
                    <Link href={`/projects/${p.id}`} target="_blank" className="text-xs text-blue-600 hover:underline mt-2 block">Voir →</Link>
                  {p.earlyCloseRequested && (
                    <div className="mt-2 space-y-1">
                      <div className="text-xs bg-orange-50 border border-orange-200 rounded-lg p-2 text-orange-700">
                        🔒 Clôture anticipée demandée — {p.raisedAmount?.toLocaleString()} FCFA récoltés
                        {p.earlyCloseNote && <div className="text-xs mt-0.5">Motif: {p.earlyCloseNote}</div>}
                      </div>
                      <button onClick={async () => {
                        const res = await authPost(`/api/projects/${p.id}/approve-early-close`, {});
                        if (res.success) { flash("✅ Clôture anticipée approuvée"); loadData(); }
                        else flash("❌ " + res.message);
                      }} className="w-full text-xs bg-orange-600 text-white px-2 py-1.5 rounded-lg hover:bg-orange-700 font-bold">
                        ✅ Approuver la clôture anticipée
                      </button>
                    </div>
                  )}
                  {p.extensionRequested && (
                    <div className="mt-2 space-y-1">
                      <div className="text-xs bg-blue-50 border border-blue-200 rounded-lg p-2 text-blue-700">
                        ⏰ Prolongation de {p.extensionDays} jours demandée
                        {p.extensionNote && <div className="text-xs mt-0.5">Motif: {p.extensionNote}</div>}
                      </div>
                      <button onClick={async () => {
                        const res = await authPost(`/api/projects/${p.id}/approve-extension`, {});
                        if (res.success) { flash("✅ Prolongation approuvée"); loadData(); }
                        else flash("❌ " + res.message);
                      }} className="w-full text-xs bg-blue-600 text-white px-2 py-1.5 rounded-lg hover:bg-blue-700 font-bold">
                        ✅ Approuver la prolongation
                      </button>
                    </div>
                  )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "stats" && <StatsTab authGet={authGet} />}
        {tab === "config" && <ConfigTab flash={flash} />}
        {tab === "transactions" && <TransactionsTab flash={flash} />}

      </div>
    </div>
  );
}
