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
  { id: "waitlist", label: "⏳ Liste d'attente" },
  { id: "milestones", label: "🏗️ Jalons" },
  { id: "reimburse", label: "💰 Remboursements" },
  { id: "finances", label: "💵 Finances BAOBAB" },
  { id: "transactions", label: "💳 Transactions" },
  { id: "fund", label: "🌱 Fonds Solidaire" },
  { id: "builders", label: "🏗️ Bâtisseurs" },
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
  const [filter, setFilter] = React.useState<"ALL"|"PENDING"|"COMPLETED"|"REJECTED">("ALL");

  const load = () => {
    authGet("/api/wallet/admin/transactions").then(res => {
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
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                    tx.type === "DEPOSIT" ? "bg-green-100" :
                    tx.type === "INVESTMENT" ? "bg-blue-100" :
                    tx.type === "INSURANCE" ? "bg-orange-100" : "bg-red-100"}`}>
                    {tx.type === "DEPOSIT" ? "💳" : tx.type === "INVESTMENT" ? "💼" : tx.type === "INSURANCE" ? "🛡️" : "💸"}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">
                      {tx.type === "DEPOSIT" ? "Dépôt" :
                       tx.type === "INVESTMENT" ? "Investissement" :
                       tx.type === "INSURANCE" ? "Assurance capital" : "Retrait"} — {tx.user?.firstName} {tx.user?.lastName}
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
                <div className="mt-3 pt-3 border-t border-gray-100">
                  {tx.type === "DEPOSIT" ? (
                    <div className="text-xs text-orange-600 bg-orange-50 rounded-xl p-3 flex items-center justify-between">
                      <span>En attente confirmation PayDunya — webhook automatique</span>
                      <button onClick={() => approve(tx.id)} disabled={processing === tx.id} className="bg-orange-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-orange-600 disabled:opacity-50 ml-2 flex-shrink-0">{processing === tx.id ? "..." : "Forcer"}</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => approve(tx.id)} disabled={processing === tx.id} className="flex-1 bg-green-600 text-white text-sm font-bold py-2 rounded-xl hover:bg-green-700 disabled:opacity-50">{processing === tx.id ? "..." : "Valider retrait"}</button>
                      <button onClick={() => reject(tx.id)} disabled={processing === tx.id} className="flex-1 bg-red-100 text-red-700 text-sm font-bold py-2 rounded-xl hover:bg-red-200 disabled:opacity-50">Rejeter</button>
                    </div>
                  )}
                </div>
              )}
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

  const loadConfigs = () => {
    setLoading(true);
    authGet("/api/config").then(res => {
      if (res.success) {
        setConfigs(res.data);
        const v: Record<string, string> = {};
        res.data.forEach((c: any) => { v[c.key] = String(c.draftValue ?? c.value); });
        setValues(v);
      }
    }).finally(() => setLoading(false));
  };
  React.useEffect(() => { loadConfigs(); }, []);

  const save = async (key: string) => {
    setSaving(key);
    try {
      const res = await authPatch(`/api/config/${key}`, { value: Number(values[key]) });
      if (res.success) { flash(`📝 ${res.message}`); loadConfigs(); }
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
  const confirmDraft = async () => {
    if (!confirm("Confirmer l'application de tous les brouillons sur les futurs projets ?")) return;
    const res = await authPost("/api/config/confirm", {});
    if (res.success) { flash("✅ " + res.message); loadConfigs(); }
    else flash("❌ " + res.message);
  };
  const cancelDraft = async () => {
    const res = await authPost("/api/config/cancel-draft", {});
    if (res.success) { flash("🔄 Brouillons annulés"); loadConfigs(); }
    else flash("❌ " + res.message);
  };

  if (loading) return <div className="text-center py-10 text-gray-400">Chargement...</div>;

  const groups = [
    { title: "💰 Commissions BAOBAB", keys: ["commission_baobab_collection"] },
    { title: "🎓 Mentor & Garantie", keys: ["commission_mentor", "commission_guarantee"] },
    { title: "📱 Payin/Payout opérateur", keys: ["payin_recovery", "payin_repayment"] },
    { title: "📈 Taux de retour minimum", keys: ["return_min"] },
    { title: "⏳ Délais de grâce (mois)", keys: ["grace_period_agriculture", "grace_period_other"] },
    { title: "💵 Montants minimum", keys: ["investment_min", "withdrawal_min"] },
    { title: "🔒 Frais de retrait", keys: ["withdrawal_fee_standard", "withdrawal_fee_no_invest"] },
    { title: "📱 Taux réels opérateur (référence marge)", keys: ["payin_operator_real", "payout_operator_real"] },
    { title: "🌱 Fonds Solidaire BAOBAB", keys: ["fund_baobab_fee"] },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">⚙️ Configuration des taux</h2>
          <p className="text-sm text-gray-500 mt-1">Modifiez les taux, sauvegardez en brouillon, puis confirmez pour appliquer.</p>
        </div>
      </div>
      {configs.some((c: any) => c.draftValue !== null && c.draftValue !== undefined) && (
        <div className="bg-yellow-100 border border-yellow-400 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="font-bold text-yellow-800">⚠️ Brouillons en attente</span>
            <p className="text-sm text-yellow-700 mt-0.5">Des modifications ont été sauvegardées mais pas encore appliquées aux futurs projets.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={confirmDraft} className="bg-green-600 text-white text-sm px-3 py-2 rounded-xl font-medium">✅ Appliquer</button>
            <button onClick={cancelDraft} className="bg-red-100 text-red-700 text-sm px-3 py-2 rounded-xl font-medium">❌ Annuler</button>
          </div>
        </div>
      )}
      {groups.map(g => (
        <div key={g.title} className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4">{g.title}</h3>
          <div className="space-y-3">
            {g.keys.map(key => {
              const c = configs.find(x => x.key === key);
              if (!c) return null;
              const isAmountMin = key === "investment_min" || key === "withdrawal_min";
              const isPercent = !isAmountMin && !key.includes("grace_period");
              const isMois = key.includes("grace_period");
              const hasDraft = c.draftValue !== null && c.draftValue !== undefined;
              return (
                <div key={key} className={`flex items-center gap-3 ${hasDraft ? 'bg-yellow-50 rounded-xl p-2 border border-yellow-200' : ''}`}>
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
                        step={isAmountMin ? "1000" : isPercent ? "0.5" : "1"}
                        min="0"
                        max={isAmountMin ? "1000000" : isPercent ? "50" : "100"}
                      />
                      <span className="absolute right-2 top-2 text-xs text-gray-400">{isMois ? "mois" : isAmountMin ? "F" : "%"}</span>
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
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="font-bold text-blue-800 mb-2">🚀 Appliquer aux projets futurs</div>
        <p className="text-sm text-blue-700 mb-3">
          Les taux sauvegardés s&apos;appliquent automatiquement à tous les nouveaux projets et investissements.
          Les projets en cours ne sont pas affectés.
        </p>
        <div className="flex gap-3">
          <button
            onClick={confirmDraft}
            className="bg-green-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-green-700 font-medium"
          >
            ✅ Confirmer et appliquer sur les futurs projets
          </button>
          <button
            onClick={cancelDraft}
            className="bg-orange-100 text-orange-700 text-sm px-4 py-2 rounded-xl hover:bg-orange-200 font-medium"
          >
            ❌ Annuler les brouillons
          </button>
          <button
            onClick={reset}
            className="border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-xl hover:bg-gray-50 font-medium"
          >
            🔄 Réinitialiser les défauts
          </button>
        </div>
      </div>

      {/* SIMULATEUR EN TEMPS RÉEL */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-4">🧮 Simulateur d&apos;impact en temps réel</h3>
        <p className="text-xs text-gray-500 mb-4">Modifiez les taux ci-dessus pour voir l&apos;impact immédiat sur la rentabilité.</p>

        {(() => {
          const v = values;
          const besoin = 100000;
          // NOUVELLE STRATÉGIE FINANCIÈRE
          const baobabClot = parseFloat(v.commission_baobab_collection || "6");
          const mentor = parseFloat(v.commission_mentor || "2");
          const garantie = parseFloat(v.commission_guarantee || "2");
          const payinRecovery = parseFloat(v.payin_recovery || "4");
          const payinRepayment = parseFloat(v.payin_repayment || "4");
          const returnMin = parseFloat(v.return_min || "23");
          // GoalAmount = besoin / (1 - baobab% - mentor% - garantie%)
          // MODÈLE VALIDÉ : goalAmount = besoin / (1 - BAOBAB% - payin% - mentor%)
          // Assurance EXCLUE de la cagnotte — addon individuel
          const totalFraisFixesPct = baobabClot + payinRecovery + mentor; // sans garantie
          const goalAmount = Math.round(besoin / (1 - totalFraisFixesPct / 100));
          const baobabGainClot = Math.round(goalAmount * baobabClot / 100);
          const mentorGain = Math.round(goalAmount * mentor / 100);
          const payinRecovered = Math.round(goalAmount * payinRecovery / 100);
          // Assurance = addon individuel (optionnel) — pas dans goalAmount
          const garantieFond = Math.round(besoin * garantie / 100); // si investisseur prend assurance
          // Remboursement sur besoin net (ce que l'entrepreneur reçoit)
          const netAmount = besoin; // = goalAmount * (1 - frais%)
          const retourBrut = Math.round(netAmount * (1 + returnMin / 100));
          // Payin 4% sur mensualités → BAOBAB
          const payinMensualites = Math.round(retourBrut * payinRepayment / 100);
          const investNetReturn = retourBrut - payinMensualites;
          const rendement = ((investNetReturn - besoin) / besoin * 100).toFixed(1);
          // Bilan BAOBAB = BAOBAB% + payin collecte + payin mensualités
          const payinPerInvestor = payinRecovered;
          const baobabNet = baobabGainClot + payinRecovered + payinMensualites;
          const rentable = baobabNet > 0 && investNetReturn > besoin;

          return (
            <div className="space-y-4">
              <div className={`rounded-xl p-3 text-sm font-bold text-center ${rentable ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {rentable ? "✅ Configuration rentable pour BAOBAB et les investisseurs" : "❌ Configuration non rentable — ajustez les taux"}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <div className="font-bold text-gray-700 text-sm mb-3">📊 Pour un besoin de 100 000 FCFA</div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Montant à lever</span>
                    <span className="font-bold">{goalAmount.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Entrepreneur reçoit</span>
                    <span className="font-bold text-green-700">100 000 FCFA</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">BAOBAB clôture {baobabClot}%</span>
                    <span className="font-bold text-blue-700">+{baobabGainClot.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Mentor {mentor}%</span>
                    <span className="font-bold text-purple-700">+{mentorGain.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Garantie {garantie}%</span>
                    <span className="font-bold text-orange-700">+{garantieFond.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between text-xs border-t pt-2">
                    <span className="text-gray-500">Payin récupéré à l'invest {payinRecovery}%</span>
                    <span className="font-bold text-blue-700">+{payinPerInvestor.toLocaleString()} FCFA → admin</span>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <div className="font-bold text-gray-700 text-sm mb-3">💰 Remboursement entrepreneur</div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Retour brut dû (+{returnMin}%)</span>
                    <span className="font-bold">{retourBrut.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">BAOBAB Payin mensualités {payinRepayment}%</span>
                    <span className="font-bold text-blue-700">+{payinMensualites.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">0% commission retour BAOBAB</span>
                    <span className="font-bold text-green-600">0 FCFA</span>
                  </div>
                  <div className="flex justify-between text-xs border-t pt-2">
                    <span className="text-gray-500">Investisseurs reçoivent net</span>
                    <span className="font-bold text-green-700">{investNetReturn.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Rendement investisseur</span>
                    <span className={`font-bold ${parseFloat(rendement) > 0 ? "text-green-700" : "text-red-600"}`}>+{rendement}%</span>
                  </div>
                </div>
              </div>
              <div className={`rounded-xl p-4 ${baobabNet > 0 ? "bg-blue-50 border border-blue-200" : "bg-red-50 border border-red-200"}`}>
                <div className="font-bold text-gray-900 mb-2 text-sm">🏦 Bilan net BAOBAB</div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="text-center">
                    <div className="text-gray-500">Revenus</div>
                    <div className="font-bold text-green-700">+{(baobabGainClot + payinPerInvestor + payinMensualites).toLocaleString()} FCFA</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500">Dont fonds garantie</div>
                    <div className="font-bold text-orange-600">-{garantieFond.toLocaleString()} FCFA réservés</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500">Bilan NET</div>
                    <div className={`font-bold text-lg ${baobabNet > 0 ? "text-green-700" : "text-red-600"}`}>{baobabNet > 0 ? "+" : ""}{baobabNet.toLocaleString()} FCFA</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
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



function RescheduleButton({ scheduleId, authPost, flash, loadData }: any) {
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const submit = async () => {
    if (!date) return;
    setLoading(true);
    const res = await authPost(`/api/repayment/admin/reschedule/${scheduleId}`, { newDueDate: date, note });
    if (res.success) { flash("✅ Échéance reportée"); setOpen(false); loadData(); }
    else flash("❌ " + res.message);
    setLoading(false);
  };

  return open ? (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 space-y-2">
      <div className="text-xs font-semibold text-yellow-800">📅 Reporter la prochaine échéance</div>
      <input type="date" value={date} onChange={e => setDate(e.target.value)}
        className="w-full border border-yellow-300 rounded-lg px-3 py-1.5 text-sm" />
      <input value={note} onChange={e => setNote(e.target.value)}
        placeholder="Motif du report (optionnel)"
        className="w-full border border-yellow-300 rounded-lg px-3 py-1.5 text-sm" />
      <div className="flex gap-2">
        <button onClick={submit} disabled={loading || !date}
          className="flex-1 bg-yellow-600 text-white text-xs font-bold py-2 rounded-xl disabled:opacity-50">
          {loading ? "⏳..." : "✅ Confirmer le report"}
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-gray-500 px-3 py-2 rounded-xl border border-gray-200">
          Annuler
        </button>
      </div>
    </div>
  ) : (
    <button onClick={() => setOpen(true)}
      className="text-xs text-yellow-700 border border-yellow-200 bg-yellow-50 px-3 py-2 rounded-xl hover:bg-yellow-100 font-medium">
      📅 Reporter une échéance
    </button>
  );
}

function ReimburseTab({ allProjects, flash, authPost, authGet, loadData }: any) {
  const [details, setDetails] = React.useState<Record<string, any>>({});
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const [processing, setProcessing] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  const [fees, setFees] = React.useState<any>({
    commission_baobab_collection: 6, payin_recovery: 4, payin_repayment: 4,
    commission_guarantee: 2, commission_mentor: 2,
    withdrawal_fee_standard: 0, withdrawal_fee_no_invest: 7, return_min: 23
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

  const fundedProjects = allProjects.filter((p: any) => p.status === "FUNDED");
  const activeNotFunded = allProjects.filter((p: any) => p.status === "ACTIVE");
  const completedProjects = allProjects.filter((p: any) => p.status === "COMPLETED");
  const inProgressProjects = allProjects.filter((p: any) => p.status === "IN_PROGRESS");
  const [schedules, setSchedules] = React.useState<any[]>([]);
  const [escrowData, setEscrowData] = React.useState<any>(null);

  React.useEffect(() => {
    // Charger les échéanciers en cours
    authGet("/api/repayment/admin/all").then((res: any) => {
      if (res.success) setSchedules(res.data || []);
    });
  }, []);

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
            // MODÈLE VALIDÉ — utiliser netAmount de la DB directement
            const netAmount = p.netAmount || Math.round((p.goalAmount || 0) * 0.90);
            const payinRepayment = fees.payin_repayment || 4;
            const returnRate = p.expectedReturn || 24;
            // Retour calculé sur netAmount (besoin net entrepreneur)
            const grossReturn = Math.round(netAmount * (1 + returnRate / 100));
            const payinOnReturn = Math.round(grossReturn * payinRepayment / 100);
            const netInvestors = grossReturn - payinOnReturn;
            const baobabOnReturn = payinOnReturn;
            const paydunyaPayout = 0;
            // Revenu BAOBAB = commission collecte déjà encaissée + payin mensualités
            const revenueBAOBAB = Math.round((p.raisedAmount || 0) * (fees.commission_baobab_collection || 6) / 100) + payinOnReturn;
            // Assurance = hors cagnotte — montant réel des guaranteeContribution
            const garantie = p.investments?.reduce((s: number, i: any) => s + (i.guaranteeContribution || 0), 0) || 0;

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
                        <span>— BAOBAB Payin mensualités ({fees.payin_repayment || 4}%)</span>
                        <span>-{baobabOnReturn.toLocaleString()} FCFA</span>
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
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                        <div className="font-bold mb-2">📅 Ce que fait ce bouton :</div>
                        <div className="space-y-1 text-xs">
                          <div>✅ Crée un échéancier de {p.durationMonths || 12} mensualités pour l'entrepreneur</div>
                          <div>✅ Délai de grâce : {p.gracePeriodMonths || 0} mois avant la 1ère mensualité</div>
                          <div>✅ Le projet passe en statut <strong>IN_PROGRESS</strong></div>
                          <div>⚠️ Les investisseurs sont payés <strong>au fur et à mesure</strong> des remboursements effectués</div>
                          <div>⚠️ Aucun fonds n'est transféré maintenant — action irréversible</div>
                        </div>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800 mb-2">
                        ✅ Échéancier + Palier 1 (40%) créés <strong>automatiquement</strong> dès FUNDED.
                        <div className="text-xs text-green-600 mt-1">P1 (40%) immédiat · P2 (35%) après M2 · P3 (25%) après M4</div>
                      </div>
                      <button onClick={() => reimburse(p.id)} disabled={processing === p.id}
                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-xl disabled:opacity-50 text-sm">
                        {processing === p.id ? "⏳ En cours..." : "🔧 Forcer création manuelle (si non créé automatiquement)"}
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

      {/* Échéanciers en cours */}
      {schedules.length > 0 && (
        <div className="space-y-3">
          <div className="font-semibold text-gray-700">📅 Échéanciers de remboursement progressif</div>
          {schedules.map((s: any) => (
            <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-bold text-gray-900">{s.project?.title}</div>
                  <div className="text-xs text-gray-500">Entrepreneur : {s.project?.entrepreneur?.firstName} {s.project?.entrepreneur?.lastName}</div>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${s.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                  {s.status === 'COMPLETED' ? '✅ Terminé' : `${s.paidMonths}/${s.totalMonths} mois`}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-3 text-xs mb-3">
                <div className="bg-gray-50 rounded-xl p-2">
                  <div className="text-gray-400">Total dû</div>
                  <div className="font-bold">{s.totalAmount?.toLocaleString()} FCFA</div>
                </div>
                <div className="bg-green-50 rounded-xl p-2">
                  <div className="text-gray-400">Déjà payé</div>
                  <div className="font-bold text-green-700">{(s.totalAmount - s.remainingAmount)?.toLocaleString()} FCFA</div>
                </div>
                <div className="bg-orange-50 rounded-xl p-2">
                  <div className="text-gray-400">Restant</div>
                  <div className="font-bold text-orange-700">{s.remainingAmount?.toLocaleString()} FCFA</div>
                </div>
                <div className="bg-blue-50 rounded-xl p-2">
                  <div className="text-gray-400">Mensualité</div>
                  <div className="font-bold text-blue-700">{s.monthlyAmount?.toLocaleString()} FCFA</div>
                </div>
              </div>
              <div className="bg-gray-200 rounded-full h-2 mb-2">
                <div className="bg-green-500 h-2 rounded-full transition-all"
                  style={{width: `${Math.round((s.paidMonths / s.totalMonths) * 100)}%`}} />
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>{Math.round((s.paidMonths / s.totalMonths) * 100)}% remboursé</span>
                {s.nextDueDate && <span>Prochain : {new Date(s.nextDueDate).toLocaleDateString("fr-FR")}</span>}
                  {/* Vérification retard */}
                  {s.nextDueDate && new Date(s.nextDueDate) < new Date() && s.status === 'ACTIVE' && (
                    <span className="text-red-600 font-bold">⚠️ EN RETARD</span>
                  )}
              </div>
              {/* Détail paiements */}
              {s.payments && (
                <div className="mt-3 space-y-1">
                  {s.payments.map((pay: any) => (
                    <div key={pay.id} className={`flex justify-between text-xs px-2 py-1 rounded-lg ${pay.status === 'PAID' ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
                      <span>Mois {pay.monthNumber} — {pay.amount?.toLocaleString()} FCFA</span>
                      <span>{pay.status === 'PAID' ? `✅ ${new Date(pay.paidAt).toLocaleDateString("fr-FR")}` : `⏳ Prévu ${new Date(pay.dueDate).toLocaleDateString("fr-FR")}`}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Bouton reporter échéance */}
              {s.status === 'ACTIVE' && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <RescheduleButton scheduleId={s.id} authPost={authPost} flash={flash} loadData={loadData} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {fundedProjects.length === 0 && activeNotFunded.length === 0 && completedProjects.length === 0 && schedules.length === 0 && (
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
  const [stats, setStats] = React.useState<any>(null);
  const [loadingStats, setLoadingStats] = React.useState(true);
  const API = process.env.NEXT_PUBLIC_API_URL || "http://46.202.132.161:3001";
  React.useEffect(() => {
    authGet("/api/admin/stats").then((res: any) => {
      if (res.success) setStats(res.data);
    }).finally(() => setLoadingStats(false));
  }, []);

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
      {/* KPIs temps réel */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
          {[
            { label: "Total utilisateurs", value: stats.totalUsers, icon: "👥", color: "text-blue-700", bg: "bg-blue-50" },
            { label: "Investisseurs actifs", value: stats.activeInvestors, icon: "💼", color: "text-green-700", bg: "bg-green-50" },
            { label: "KYC en attente", value: stats.pendingKyc, icon: "🪪", color: "text-orange-700", bg: "bg-orange-50" },
            { label: "Bâtisseurs", value: stats.builders, icon: "🏗️", color: "text-yellow-700", bg: "bg-yellow-50" },
          ].map(k => (
            <div key={k.label} className={`${k.bg} rounded-2xl p-4`}>
              <div className="text-2xl mb-1">{k.icon}</div>
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>
      )}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
          {[
            { label: "Total levé", value: (stats.totalLeve||0).toLocaleString()+" FCFA", icon: "💰", color: "text-green-700", bg: "bg-green-50" },
            { label: "Revenus BAOBAB", value: (stats.totalRevenuBAOBAB||0).toLocaleString()+" FCFA", icon: "🏦", color: "text-purple-700", bg: "bg-purple-50" },
            { label: "Fonds garantie", value: (stats.guaranteeBalance||0).toLocaleString()+" FCFA", icon: "🛡️", color: "text-orange-700", bg: "bg-orange-50" },
            { label: "Transactions en attente", value: stats.txPending, icon: "⏳", color: "text-red-700", bg: "bg-red-50" },
          ].map(k => (
            <div key={k.label} className={`${k.bg} rounded-2xl p-4`}>
              <div className="text-2xl mb-1">{k.icon}</div>
              <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>
      )}
      {stats?.projectsByStatus && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4">📊 Projets par statut</h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {stats.projectsByStatus.map((p: any) => (
              <div key={p.status} className="text-center bg-gray-50 rounded-xl p-3">
                <div className="text-xl font-bold text-gray-900">{p._count}</div>
                <div className="text-xs text-gray-500 mt-0.5">{p.status}</div>
                <div className="text-xs text-gray-400">{((p._sum?.raisedAmount||0)/1000).toFixed(0)}k FCFA</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {stats && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4">💵 Détail revenus BAOBAB</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: `Commission collecte (${stats.baobabRate||6}%)`, value: stats.commissionBalance||0, color: "text-green-700", bg: "bg-green-50" },
              { label: "Payin remboursements (4%)", value: stats.totalPayinRepayment||0, color: "text-blue-700", bg: "bg-blue-50" },
              { label: "Mentor commissions (2%)", value: stats.totalMentorCommission||0, color: "text-purple-700", bg: "bg-purple-50" },
              { label: "Fonds garantie collecté", value: stats.totalGuaranteeFund||0, color: "text-orange-700", bg: "bg-orange-50" },
            ].map(k => (
              <div key={k.label} className={`${k.bg} rounded-xl p-3`}>
                <div className={`font-bold text-lg ${k.color}`}>{k.value.toLocaleString()} FCFA</div>
                <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 bg-gray-50 rounded-xl p-3 flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">💰 Total encaissé BAOBAB</span>
            <span className="font-bold text-green-700 text-lg">{((stats.revenueTotal||0)+(stats.totalMentorCommission||0)).toLocaleString()} FCFA</span>
          </div>
        </div>
      )}
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


function ProjectsList({ projects, flash, authPost, loadData }: any) {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [sectorFilter, setSectorFilter] = React.useState("");
  const [expanded, setExpanded] = React.useState<string|null>(null);

  const filtered = projects.filter((p: any) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.title?.toLowerCase().includes(q) ||
      (p.entrepreneur?.firstName + " " + p.entrepreneur?.lastName).toLowerCase().includes(q);
    const matchStatus = !statusFilter || p.status === statusFilter;
    const matchSector = !sectorFilter || p.sector === sectorFilter;
    return matchSearch && matchStatus && matchSector;
  });

  const sectors = [...new Set(projects.map((p: any) => p.sector))].filter(Boolean);

  return (
    <div className="space-y-3">
      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Rechercher titre, entrepreneur..."
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:border-green-400" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="">Tous statuts</option>
          {["ACTIVE","FUNDED","IN_PROGRESS","COMPLETED","CANCELLED"].map(s =>
            <option key={s} value={s}>{s} ({projects.filter((p:any)=>p.status===s).length})</option>
          )}
        </select>
        <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="">Tous secteurs</option>
          {sectors.map((s: any) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-gray-400 self-center">{filtered.length} projet(s)</span>
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-gray-400">Aucun projet trouvé</p>
        </div>
      )}

      {filtered.map((p: any) => {
        const pct = p.goalAmount > 0 ? Math.min(Math.round((p.raisedAmount/p.goalAmount)*100), 100) : 0;
        const isExpanded = expanded === p.id;
        const statusColors: any = {
          ACTIVE: "bg-blue-100 text-blue-700",
          FUNDED: "bg-purple-100 text-purple-700",
          IN_PROGRESS: "bg-orange-100 text-orange-700",
          COMPLETED: "bg-green-100 text-green-700",
          CANCELLED: "bg-red-100 text-red-700",
        };
        return (
          <div key={p.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* En-tête projet */}
            <div className="p-4 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : p.id)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColors[p.status]||"bg-gray-100 text-gray-600"}`}>{p.status}</span>
                    <span className="text-xs text-gray-400">{p.sector} · {p.city}</span>
                    {p.currentPalier > 0 && <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">P{p.currentPalier} débloqué</span>}
                  </div>
                  <div className="font-bold text-gray-900">{p.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Par {p.entrepreneur?.firstName} {p.entrepreneur?.lastName}
                    {p.mentor && <span className="ml-2 text-purple-600">· Mentor: {p.mentor?.firstName}</span>}
                  </div>
                  <div className="mt-2 bg-gray-100 rounded-full h-1.5 w-full">
                    <div className="bg-green-500 h-1.5 rounded-full" style={{width: pct+"%"}} />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {p.raisedAmount?.toLocaleString()} / {p.goalAmount?.toLocaleString()} FCFA ({pct}%)
                    {p.netAmount && <span className="ml-2">· Net: {p.netAmount?.toLocaleString()} FCFA</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-green-700">+{p.expectedReturn}%</div>
                  <div className="text-xs text-gray-400">{p.durationMonths} mois</div>
                  <div className="text-xs text-gray-400 mt-1">{p.investments?.length || p._count?.investments || 0} inv.</div>
                  <div className="text-xs mt-1">{isExpanded ? "▲" : "▼"}</div>
                </div>
              </div>
            </div>

            {/* Détail expandé */}
            {isExpanded && (
              <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50">
                {/* Paliers */}
                {p.netAmount > 0 && (
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      { n: 1, label: "40%", amount: Math.round(p.netAmount*0.40), done: p.currentPalier >= 1 },
                      { n: 2, label: "35%", amount: Math.round(p.netAmount*0.35), done: p.currentPalier >= 2 },
                      { n: 3, label: "25%", amount: Math.round(p.netAmount*0.25), done: p.currentPalier >= 3 },
                    ].map(pl => (
                      <div key={pl.n} className={`rounded-xl p-2 text-center ${pl.done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                        <div className="font-bold">{pl.done ? "✅" : "🔒"} P{pl.n} {pl.label}</div>
                        <div>{pl.amount?.toLocaleString()} FCFA</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Investisseurs */}
                {p.investments?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-1">👥 Investisseurs</div>
                    {p.investments.map((inv: any) => (
                      <div key={inv.id} className="flex justify-between text-xs py-1 border-b border-gray-100">
                        <span>{inv.user?.firstName} {inv.user?.lastName}</span>
                        <span className="font-medium text-blue-700">{inv.amount?.toLocaleString()} FCFA</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  <Link href={`/projects/${p.id}`} target="_blank"
                    className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-xl hover:bg-blue-100">
                    🔍 Voir projet
                  </Link>
                  {p.earlyCloseRequested && (
                    <button onClick={async () => {
                      const res = await authPost(`/api/projects/${p.id}/approve-early-close`, {});
                      if (res.success) { flash("✅ Clôture approuvée"); loadData(); }
                      else flash("❌ " + res.message);
                    }} className="text-xs bg-orange-600 text-white px-3 py-1.5 rounded-xl hover:bg-orange-700 font-bold">
                      ✅ Approuver clôture anticipée
                    </button>
                  )}
                  {p.extensionRequested && (
                    <button onClick={async () => {
                      const res = await authPost(`/api/projects/${p.id}/approve-extension`, {});
                      if (res.success) { flash("✅ Prolongation approuvée"); loadData(); }
                      else flash("❌ " + res.message);
                    }} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-xl hover:bg-blue-700 font-bold">
                      ✅ Approuver prolongation
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TxUserList({ txs }: { txs: any[] }) {
  const [showAll, setShowAll] = React.useState(false);
  const displayed = showAll ? txs : txs.slice(0, 5);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold text-gray-900">💳 Transactions ({txs.length})</div>
        {txs.length > 5 && (
          <button onClick={() => setShowAll(!showAll)}
            className="text-xs text-blue-600 hover:underline">
            {showAll ? "▲ Réduire" : `▼ Voir tout (${txs.length})`}
          </button>
        )}
      </div>
      <div className="space-y-1">
        {displayed.map((tx: any) => (
          <div key={tx.id} className="flex justify-between text-xs p-2 bg-gray-50 rounded-lg">
            <div>
              <span className={`px-1.5 py-0.5 rounded font-medium ${tx.type==="DEPOSIT"?"bg-green-100 text-green-700":tx.type==="WITHDRAWAL"?"bg-red-100 text-red-700":"bg-blue-100 text-blue-700"}`}>{tx.type}</span>
              <span className="text-gray-400 ml-2">{new Date(tx.createdAt).toLocaleDateString("fr-FR")}</span>
              {tx.operator && <span className="text-gray-400 ml-1">· {tx.operator}</span>}
              {tx.description && <div className="text-gray-400 mt-0.5 truncate max-w-48">{tx.description}</div>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`font-bold ${tx.type==="DEPOSIT"?"text-green-700":"text-red-600"}`}>
                {tx.type==="DEPOSIT"?"+":"-"}{tx.amount.toLocaleString()} FCFA
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${tx.status==="COMPLETED"?"bg-green-100 text-green-600":tx.status==="PENDING"?"bg-orange-100 text-orange-600":"bg-red-100 text-red-600"}`}>
                {tx.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TxList({ revenues }: { revenues: any[] }) {
  const [showAll, setShowAll] = React.useState(false);
  // Filtrer les lignes à 0 FCFA (Commission retour 0%)
  const filtered = revenues.filter((r: any) => r.amount !== 0 && r.type !== 'COMMISSION_RETURN');
  const displayed = showAll ? filtered : filtered.slice(0, 8);
  return (
    <div className="space-y-2">
      {displayed.map((r: any) => (
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
      {filtered.length > 8 && (
        <button onClick={() => setShowAll(!showAll)}
          className="w-full text-xs text-gray-500 hover:text-gray-700 py-2 border border-gray-100 rounded-xl mt-1">
          {showAll ? "▲ Réduire" : `▼ Voir ${filtered.length - 8} transactions de plus`}
        </button>
      )}
    </div>
  );
}

function FinancesTab({ authGet }: any) {
  const [data, setData] = React.useState<any>(null);
  const [revenues, setRevenues] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [openProject, setOpenProject] = React.useState<string | null>(null);
  const API = process.env.NEXT_PUBLIC_API_URL || "http://46.202.132.161:3001";

  const [adminWallet, setAdminWallet] = React.useState<any>(null);
  const [schedules, setSchedules] = React.useState<any[]>([]);
  const [escrowData, setEscrowData] = React.useState<any>(null);

  React.useEffect(() => {
    Promise.all([
      authGet("/api/admin/finances/details"),
      authGet("/api/admin/platform-revenues"),
      authGet("/api/auth/me"),
      authGet("/api/repayment/admin/all"),
    ]).then(([det, rev, me, sched]) => {
      if (det.success) {
        setData(det.data);
        // Stocker les données escrow investisseurs
        if (det.data?.escrow) setEscrowData(det.data.escrow);
      }
      if (rev.success) setRevenues(rev.data);
      if (me.success) setAdminWallet(me.data?.wallet);
      if (sched.success) setSchedules(sched.data || []);
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
  const totalCagnotteNette = projects.filter((p: any) => p.totalInvested > 0).reduce((s: number, p: any) => s + p.cagnotteNette, 0);
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

      {/* Poches Wallet BAOBAB */}
      {adminWallet && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4">🏦 Wallet BAOBAB INVEST — Répartition des fonds</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
              <div className="text-xs text-gray-500 mb-1">💰 Commissions nettes</div>
              <div className="text-xl font-bold text-green-700">{(adminWallet.commissionBalance || 0).toLocaleString()} FCFA</div>
              <div className="text-xs text-gray-400 mt-1">Ce que BAOBAB gagne réellement</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <div className="text-xs text-gray-500 mb-1">🔒 Séquestre investisseurs</div>
              <div className="text-xl font-bold text-blue-700">{(escrowData?.totalEscrowInvestors || 0).toLocaleString()} FCFA</div>
              <div className="text-xs text-gray-400 mt-1">Capital investi en cours de projet</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
              <div className="text-xs text-gray-500 mb-1">🛡️ Fonds de garantie</div>
              <div className="text-xl font-bold text-orange-700">{(adminWallet.guaranteeBalance || 0).toLocaleString()} FCFA</div>
              <div className="text-xs text-gray-400 mt-1">Réservé — projets en difficulté</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
              <div className="text-xs text-gray-500 mb-1">💳 Solde total wallet</div>
              <div className="text-xl font-bold text-purple-700">{(adminWallet.balance || 0).toLocaleString()} FCFA</div>
              <div className="text-xs text-gray-400 mt-1">Disponible immédiatement</div>
            </div>
          </div>
          {escrowData && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-500">💰 Soldes disponibles investisseurs</div>
                <div className="font-bold text-gray-700">{(escrowData.totalInvestorBalances || 0).toLocaleString()} FCFA</div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3">
                <div className="text-xs text-gray-500">📈 Gains cumulés investisseurs</div>
                <div className="font-bold text-emerald-700">{(escrowData.totalGainBalances || 0).toLocaleString()} FCFA</div>
              </div>
            </div>
          )}
          <div className="mt-3 bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
            <strong>Logique :</strong> Commissions = revenus BAOBAB encaissés | Séquestre = capital investi bloqué jusqu'au remboursement | Garantie = fonds assurance (2% par investisseur assuré)
          </div>
        </div>
      )}

      {/* Échéanciers remboursement en cours */}
      {schedules.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4">📅 Remboursements progressifs en cours</h3>
          <div className="space-y-3">
            {schedules.map((s: any) => {
              const pct = Math.round((s.paidMonths / s.totalMonths) * 100);
              const paidAmount = s.totalAmount - s.remainingAmount;
              return (
                <div key={s.id} className="border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-semibold text-gray-900">{s.project?.title}</div>
                      <div className="text-xs text-gray-500">{s.project?.entrepreneur?.firstName} {s.project?.entrepreneur?.lastName}</div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${s.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {s.paidMonths}/{s.totalMonths} mois
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-gray-400">Total dû</div>
                      <div className="font-bold">{s.totalAmount?.toLocaleString()} FCFA</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2">
                      <div className="text-gray-400">Déjà payé</div>
                      <div className="font-bold text-green-700">{paidAmount.toLocaleString()} FCFA</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-2">
                      <div className="text-gray-400">Restant</div>
                      <div className="font-bold text-orange-700">{s.remainingAmount?.toLocaleString()} FCFA</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2">
                      <div className="text-gray-400">Mensualité</div>
                      <div className="font-bold text-blue-700">{s.monthlyAmount?.toLocaleString()} FCFA</div>
                    </div>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2 mb-1">
                    <div className="bg-green-500 h-2 rounded-full" style={{width: `${pct}%`}} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{pct}% remboursé</span>
                    {s.nextDueDate && <span>Prochain : {new Date(s.nextDueDate).toLocaleDateString("fr-FR")}</span>}
                  {/* Vérification retard */}
                  {s.nextDueDate && new Date(s.nextDueDate) < new Date() && s.status === 'ACTIVE' && (
                    <span className="text-red-600 font-bold">⚠️ EN RETARD</span>
                  )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPIs globaux */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Total levé", value: totalInvested, icon: "💰", color: "text-green-700", bg: "bg-green-50", note: "Brut investisseurs" },
          { label: "Cagnotte nette projets", value: totalCagnotteNette, icon: "🏗️", color: "text-blue-700", bg: "bg-blue-50", note: "Après frais clôture" },
          { label: "🎯 Net réel BAOBAB", value: revenues?.revenueNetBAOBAB || totalRevenuBAOBAB, icon: "🏦", color: "text-purple-700", bg: "bg-purple-50", note: "Gains + marges encaissés" },
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

      {/* BLOC REVENUS BAOBAB DÉTAILLÉ */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-1">💰 Ce que BAOBAB gagne réellement</h3>
        <p className="text-xs text-gray-400 mb-4">Séparation claire entre revenus purs, marges opérateur et fonds séparés</p>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Colonne 1 — Revenus purs */}
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <div className="font-bold text-green-800 mb-3">✅ Revenus purs BAOBAB</div>
            <div className="text-xs text-gray-500 mb-3">Ce que BAOBAB garde directement</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">📊 Commission collecte 6%</span>
                <span className="font-bold text-green-700">+{(revenues?.commissionCollecte||0).toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">🌱 Commission Fonds Solidaire 16%</span>
                <span className="font-bold text-green-700">+{(revenues?.commissionFonds||0).toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">💸 Frais retrait</span>
                <span className="font-bold text-green-700">+{(revenues?.commissionRetrait||0).toLocaleString()} FCFA</span>
              </div>
              <div className="border-t border-green-200 pt-2 flex justify-between font-bold">
                <span>Sous-total</span>
                <span className="text-green-700">+{(revenues?.revenusBrutsPurs||0).toLocaleString()} FCFA</span>
              </div>
            </div>
          </div>

          {/* Colonne 2 — Marges opérateur */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="font-bold text-blue-800 mb-3">📱 Marges opérateur</div>
            <div className="text-xs text-gray-500 mb-3">Différence taux facturé - taux réel PayDunya</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">⬆️ Payin collecte ({revenues?.payinFacure||4}% - {revenues?.payinReel||3.5}%)</span>
                <span className="font-bold text-blue-700">+{(revenues?.margePayin||0).toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">⬇️ Payout mensualités ({revenues?.payoutFacure||4}% - {revenues?.payoutReel||2}%)</span>
                <span className="font-bold text-blue-700">+{(revenues?.margePayout||0).toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between text-gray-400 text-xs">
                <span>Coût réel PayDunya estimé ({revenues?.payinReel||3.5}%)</span>
                <span>-{(revenues?.coutPaydunyaReel||0).toLocaleString()} FCFA</span>
              </div>
              <div className="border-t border-blue-200 pt-2 flex justify-between font-bold">
                <span>Sous-total</span>
                <span className="text-blue-700">+{(revenues?.totalOperatorMargin||0).toLocaleString()} FCFA</span>
              </div>
            </div>
          </div>

          {/* Colonne 3 — Fonds séparés */}
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
            <div className="font-bold text-orange-800 mb-3">🔒 Fonds séparés</div>
            <div className="text-xs text-gray-500 mb-3">Pas des gains BAOBAB — réservés ou reversés</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">🛡️ Garantie 2% (réservé)</span>
                <span className="font-medium text-orange-700">{(revenues?.totalGuaranteeFee||0).toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">🎓 Commissions mentors (reversées)</span>
                <span className="font-medium text-orange-700">{(revenues?.totalMentorCommission||0).toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">💳 Payin collecte (coût PayDunya)</span>
                <span className="font-medium text-orange-700">{(revenues?.totalPayinRecovery||0).toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">💳 Payin mensualités (coût PayDunya)</span>
                <span className="font-medium text-orange-700">{(revenues?.totalPayinRepayment||0).toLocaleString()} FCFA</span>
              </div>
            </div>
          </div>
        </div>

        {/* Total net BAOBAB */}
        <div className="mt-4 bg-purple-50 border border-purple-200 rounded-2xl p-4 flex justify-between items-center">
          <div>
            <div className="font-bold text-purple-900 text-lg">🎯 Net réel BAOBAB</div>
            <div className="text-xs text-gray-500">Revenus purs + marges opérateur</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-purple-700 text-2xl">{(revenues?.revenueNetBAOBAB||totalRevenuBAOBAB).toLocaleString()} FCFA</div>
            <div className="text-xs text-gray-400">Projection annuelle : {((revenues?.projectionAnnuelle||0)).toLocaleString()} FCFA</div>
          </div>
        </div>
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
            <div className="bg-emerald-50 rounded-xl p-3">
              <div className="text-xs text-gray-500">💰 Marges opérateur encaissées</div>
              <div className="font-bold text-emerald-700">+{(revenues.totalOperatorMargin || 0).toLocaleString()} FCFA</div>
            </div>
          </div>
        </div>
      )}

      {/* Bilan opérateur — marges sécurité */}
      {revenues && data && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-2">📱 Bilan opérateur de paiement</h3>
          <p className="text-xs text-gray-400 mb-4">Vous sécurisez une marge sur les frais opérateur en appliquant des taux supérieurs aux coûts réels.</p>
          {(() => {
            const totalLeve = data.projects.reduce((s: number, p: any) => s + p.totalInvested, 0)
            const totalRemb = data.projects.reduce((s: number, p: any) => s + p.netInvestors, 0)
            // Payin collecte
            const payinCollecteSecurise = Math.round(totalLeve * (adminWallet?.payinRate || 4) / 100)
            const payinCollecteReel     = Math.round(totalLeve * 3.5 / 100)
            const margePayinCollecte    = payinCollecteSecurise - payinCollecteReel
            // Payout remboursements
            const payoutSecurise = Math.round(totalRemb * (adminWallet?.payinRepayRate || 4) / 100)
            const payoutReel     = Math.round(totalRemb * 2.0 / 100)
            const margePayout    = payoutSecurise - payoutReel
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-xs font-bold text-gray-500 px-2">
                  <span>Opération</span><span className="text-center">Taux sécurisé</span><span className="text-right">Marge potentielle</span>
                </div>
                {[
                  { label: "Payin collecte (investissement)", securise: payinCollecteSecurise, reel: payinCollecteReel, marge: margePayinCollecte, tauxS: adminWallet?.payinRate||4, tauxR: 3.5 },
                  { label: "Payout remboursements", securise: payoutSecurise, reel: payoutReel, marge: margePayout, tauxS: adminWallet?.payinRepayRate||4, tauxR: 2.0 },
                ].map(op => (
                  <div key={op.label} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{op.label}</div>
                        <div className="text-xs text-gray-400">Taux sécurisé {op.tauxS}% — Taux réel max ~{op.tauxR}%</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">Prélevé : {op.securise.toLocaleString()} FCFA</div>
                        <div className="text-xs text-green-600 font-bold">Marge : +{op.marge.toLocaleString()} FCFA</div>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-sm font-medium text-green-800">💰 Marge opérateur totale potentielle</span>
                  <span className="font-bold text-green-700">+{(margePayinCollecte + margePayout).toLocaleString()} FCFA</span>
                </div>
              </div>
            )
          })()}
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
                        <div className="text-gray-400 mt-1">Après -BAOBAB {p.baobabOnCollection.toLocaleString()} -payin {p.paydunyaPayin.toLocaleString()}{p.mentorFee > 0 ? ` -mentor ${p.mentorFee.toLocaleString()}` : ""} | Assurance {p.guaranteeFee.toLocaleString()} FCFA hors cagnotte</div>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-orange-100">
                        <div className="text-gray-400">Retour projeté investisseurs (net)</div>
                        <div className="font-bold text-orange-700">{p.netInvestors.toLocaleString()} FCFA</div>
                        <div className="text-gray-400 mt-1">Brut {p.totalExpectedReturn.toLocaleString()} - Payin {p.baobabOnReturn.toLocaleString()} - 0% retour BAOBAB</div>
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
          <TxList revenues={revenues.revenues} />
        </div>
      )}
    </div>
  );
}

function AdminGeoFilter({ value, onChange }: { value: {country: string, city: string}, onChange: (v: any) => void }) {
  const API = process.env.NEXT_PUBLIC_API_URL;
  const [countries, setCountries] = React.useState<any[]>([]);
  const [states, setStates] = React.useState<any[]>([]);
  const [cities, setCities] = React.useState<string[]>([]);
  const [selState, setSelState] = React.useState('');
  React.useEffect(() => { fetch('/countries.json').then(r=>r.json()).then(setCountries); }, []);
  React.useEffect(() => {
    if (!value.country) { setStates([]); setCities([]); setSelState(''); return; }
    fetch(`${API}/api/geo/states/${value.country}`).then(r=>r.json()).then(d=>setStates(d.data||[]));
    setCities([]); setSelState('');
  }, [value.country]);
  React.useEffect(() => {
    if (!value.country || !selState) { setCities([]); return; }
    fetch(`${API}/api/geo/cities/${value.country}/${selState}`).then(r=>r.json()).then(d=>setCities(d.data||[]));
  }, [selState]);
  const cls = 'w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-green-400 bg-white';
  return (
    <div className='grid grid-cols-3 gap-2'>
      <div><div className='text-xs font-semibold text-gray-500 mb-1'>Pays</div>
        <select value={value.country} onChange={e => { onChange({country: e.target.value, city: ''}); setSelState(''); }} className={cls}>
          <option value=''>Tous les pays</option>
          {countries.map((c:any) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
        </select></div>
      <div><div className='text-xs font-semibold text-gray-500 mb-1'>Région</div>
        <select value={selState} onChange={e => { setSelState(e.target.value); onChange({...value, city: ''}); }} className={cls} disabled={!states.length}>
          <option value=''>Toutes les régions</option>
          {states.map((s:any) => <option key={s.code} value={s.code}>{s.name}</option>)}
        </select></div>
      <div><div className='text-xs font-semibold text-gray-500 mb-1'>Ville</div>
        <select value={value.city} onChange={e => onChange({...value, city: e.target.value})} className={cls} disabled={!cities.length}>
          <option value=''>Toutes les villes</option>
          {cities.map((c:string) => <option key={c} value={c}>{c}</option>)}
        </select></div>
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
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDetail, setUserDetail] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [milestoneNote, setMilestoneNote] = useState("");
  const [kycUsers, setKycUsers] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [sectorFilter, setSectorFilter] = React.useState("Tous");
  const [geoFilter, setGeoFilter] = React.useState({country: "", city: ""});
  const [urgencyFilter, setUrgencyFilter] = React.useState("all");
  const [waitlistedProjects, setWaitlistedProjects] = React.useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter2, setRoleFilter2] = useState("ALL");
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

  const loadUserDetail = async (userId: string) => {
    const [wallet, investments, projects, txs, notifs, schedules] = await Promise.all([
      authGet("/api/admin/users/" + userId + "/wallet"),
      authGet("/api/admin/users/" + userId + "/investments"),
      authGet("/api/admin/users/" + userId + "/projects"),
      authGet("/api/admin/users/" + userId + "/transactions"),
      authGet("/api/admin/users/" + userId + "/notifications"),
      authGet("/api/admin/users/" + userId + "/schedules"),
    ]);
    setUserDetail({ wallet: wallet.data, investments: investments.data || [], projects: projects.data || [], txs: txs.data || [], notifs: notifs.data || [], schedules: schedules.data || [] });
  };

  const loadData = async () => {
    setLoading(true);
    // Vérification automatique des projets inactifs
    // Vérification inactive — uniquement via bouton manuel dans Vue générale
    try {
      const [pendingProj, waitlistProj, allProj, usrs, suppl, notif, mils, rev, txs] = await Promise.all([
        authGet("/api/projects?status=PENDING_REVIEW&limit=50"),
        authGet("/api/projects?status=WAITLISTED&limit=50"),
        authGet("/api/admin/projects/all"),
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
      setWaitlistedProjects(waitlistProj.data?.projects || []);
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

  const filteredUsers = users.filter((u: any) =>
    (roleFilter2 === "ALL" || u.role === roleFilter2) &&
    (!search || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase()))
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
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-xl font-bold text-gray-900">📋 Projets à valider ({projects.length})</h2>
              <div className="text-sm text-gray-500">Ordre d&apos;arrivée · Délai : 48h ouvrées</div>
            </div>
            {/* Filtres secteur + géographie */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-2">Secteur</div>
                <div className="flex flex-wrap gap-1.5">
                  {["Tous","AGRICULTURE","COMMERCE","TRANSPORT","TECH","RESTAURATION","ARTISANAT","SANTE","EDUCATION","ENERGIE","SERVICES","AUTRE"].map(s => (
                    <button key={s} onClick={() => setSectorFilter(s)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${sectorFilter === s ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                      {s === "Tous" ? "Tous" : s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <AdminGeoFilter value={geoFilter} onChange={v => setGeoFilter(v)} />
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-1">Urgence</div>
                  <select value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-green-400">
                    <option value="all">Tous</option>
                    <option value="urgent">🔴 Urgent — +7j sans réponse</option>
                    <option value="warning">🟡 Attention — 4 à 7j</option>
                    <option value="normal">🟢 Normal — moins de 3j</option>
                  </select>
                </div>
              </div>
              <div className="text-xs text-gray-400">
                {(() => {
                  const filtered = projects.filter((p: any) => {
                    const days = Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86400000);
                    const sectorOk = sectorFilter === "Tous" || p.sector === sectorFilter;
                    const countryOk = !geoFilter.country || p.country === geoFilter.country || p.country?.toLowerCase().includes(geoFilter.country.toLowerCase());
                    const cityOk = !geoFilter.city || p.city?.toLowerCase().includes(geoFilter.city.toLowerCase());
                    const urgOk = urgencyFilter === "all" || (urgencyFilter === "urgent" && days > 7) || (urgencyFilter === "warning" && days >= 4 && days <= 7) || (urgencyFilter === "normal" && days < 4);
                    return sectorOk && countryOk && cityOk && urgOk;
                  });
                  return `${filtered.length} projet(s) correspondent aux filtres`;
                })()}
              </div>
            </div>
            {projects.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="text-5xl mb-3">✅</div>
                <p className="text-gray-500 font-medium">Aucun projet en attente de validation</p>
              </div>
            ) : projects.filter((p: any) => {
                const days = Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86400000);
                const sectorOk = sectorFilter === 'Tous' || p.sector === sectorFilter;
                const countryOk = !geoFilter.country || p.country === geoFilter.country || p.country?.toLowerCase().includes(geoFilter.country.toLowerCase());
                const cityOk = !geoFilter.city || p.city?.toLowerCase().includes(geoFilter.city.toLowerCase());
                const urgOk = urgencyFilter === 'all' || (urgencyFilter === 'urgent' && days > 7) || (urgencyFilter === 'warning' && days >= 4 && days <= 7) || (urgencyFilter === 'normal' && days < 4);
                return sectorOk && countryOk && cityOk && urgOk;
              }).map((p: any) => (
              <div key={p.id} className="bg-white rounded-2xl border border-orange-200 p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {(() => {
                        const days = Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86400000);
                        return days > 7
                          ? <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">🔴 Urgent — {days}j sans réponse</span>
                          : days >= 4
                          ? <span className="text-xs bg-yellow-100 text-yellow-700 font-bold px-2 py-0.5 rounded-full">🟡 Attention — {days}j</span>
                          : <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">🟢 Normal — {days}j</span>
                      })()}
                      <span className="text-xs text-gray-400">{RISK_LABELS[p.riskLevel]} · {p.sector}{p.subSector ? ' → ' + p.subSector : ''}</span>
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
                {/* Pitch vidéo admin */}
                {p.pitchVideoUrl && (
                  <div className="mb-4 rounded-2xl overflow-hidden border border-gray-200 bg-black shadow-sm">
                    {p.pitchVideoUrl.includes('cloudinary') ? (
                      <div>
                        <div className="flex items-center justify-center bg-black" style={{ maxHeight: "300px" }}>
                          <video
                            src={p.pitchVideoUrl}
                            controls
                            controlsList="nodownload"
                            playsInline
                            style={{ maxHeight: "300px", maxWidth: "100%", width: "auto", height: "auto", display: "block", margin: "0 auto" }}
                          />
                        </div>
                        <div className="bg-gray-800 px-3 py-2 flex justify-between items-center">
                          <span className="text-xs text-green-400 font-medium">🎬 Pitch vidéo entrepreneur</span>
                          <div className="flex gap-3">
                            <a href={p.pitchVideoUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:underline">Plein écran ↗</a>
                            <span className="text-xs text-gray-500">🔒 Stocké définitivement</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                        <iframe src={p.pitchVideoUrl.replace("watch?v=", "embed/")}
                          className="absolute inset-0 w-full h-full" allowFullScreen />
                      </div>
                    )}
                  </div>
                )}
                {!p.pitchVideoUrl && (
                  <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-700">
                    ⚠️ Aucune vidéo de pitch — L'entrepreneur n'en a pas fourni
                  </div>
                )}
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
              <select onChange={e => setRoleFilter2(e.target.value)}
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
                    <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${u.isBanned ? "opacity-50 bg-red-50" : ""} ${u.id === 'baobab-fund-system-001' ? "bg-green-50 border-l-4 border-l-green-500" : ""}`}>
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
                            setSelectedUser(u);
                            await loadUserDetail(u.id);
                          }} className="text-xs bg-gray-800 text-white px-2 py-1 rounded-lg hover:bg-gray-900">
                            🔍 Détail
                          </button>
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
              {selectedUser && userDetail && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-end p-4 overflow-auto">
                  <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-screen overflow-y-auto">
                    <div className="sticky top-0 bg-white p-5 border-b border-gray-100 flex items-center justify-between rounded-t-3xl">
                      <div>
                        <div className="font-bold text-gray-900 text-lg">{selectedUser.firstName} {selectedUser.lastName}</div>
                        <div className="text-xs text-gray-500">{selectedUser.email} · {selectedUser.role}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={async () => {
                          const token = localStorage.getItem("accessToken");
                          const API = process.env.NEXT_PUBLIC_API_URL || "http://46.202.132.161:3001";
                          const role = selectedUser.role.toLowerCase();
                          const type = role === "investor" ? "investor" : role === "entrepreneur" ? "entrepreneur" : "mentor";
                          const res = await fetch(`${API}/api/pdf/admin/user/${selectedUser.id}?type=${type}`, { headers: { Authorization: `Bearer ${token}` } });
                          if (!res.ok) { alert("Erreur PDF"); return; }
                          const blob = await res.blob();
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = `rapport-${selectedUser.firstName}-${selectedUser.lastName}.pdf`;
                          a.click();
                        }} className="bg-red-600 text-white text-xs px-3 py-1.5 rounded-xl hover:bg-red-700 font-medium">
                          📄 PDF
                        </button>
                        <button onClick={() => { setSelectedUser(null); setUserDetail(null); }} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
                      </div>
                    </div>
                    <div className="p-5 space-y-5">
                      {/* Wallet complet */}
                      <div className="bg-green-50 rounded-2xl p-4">
                        <div className="font-bold text-gray-900 mb-3">💳 Wallet complet</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-white rounded-xl p-3 col-span-2">
                            <div className="text-gray-400">💰 Solde disponible total</div>
                            <div className="font-bold text-green-700 text-xl">{(userDetail.wallet?.balance||0).toLocaleString()} FCFA</div>
                          </div>
                          <div className="bg-white rounded-xl p-3"><div className="text-gray-400">📈 Gains remboursements</div><div className="font-bold text-purple-700">{(userDetail.wallet?.gainBalance||0).toLocaleString()} FCFA</div></div>
                          <div className="bg-white rounded-xl p-3"><div className="text-gray-400">💵 Dépôts non investis</div><div className="font-bold text-blue-600">{(userDetail.wallet?.depositBalance||0).toLocaleString()} FCFA</div></div>
                          <div className="bg-white rounded-xl p-3"><div className="text-gray-400">📥 Total déposé</div><div className="font-bold">{(userDetail.wallet?.totalDeposited||0).toLocaleString()} FCFA</div></div>
                          <div className="bg-white rounded-xl p-3"><div className="text-gray-400">📤 Total retiré</div><div className="font-bold text-red-600">{(userDetail.wallet?.totalWithdrawn||0).toLocaleString()} FCFA</div></div>
                          <div className="bg-white rounded-xl p-3"><div className="text-gray-400">🔒 En séquestre</div><div className="font-bold text-orange-600">{(userDetail.wallet?.escrowBalance||0).toLocaleString()} FCFA</div></div>
                          <div className="bg-white rounded-xl p-3"><div className="text-gray-400">🏆 Total gagné</div><div className="font-bold text-green-600">{(userDetail.wallet?.totalEarned||0).toLocaleString()} FCFA</div></div>
                        </div>
                      </div>
                      {/* Calendrier remboursements investisseur */}
                      {userDetail.schedules?.length > 0 && (
                        <div className="bg-blue-50 rounded-2xl p-4">
                          <div className="font-bold text-gray-900 mb-3">📅 Calendrier remboursements à recevoir</div>
                          {userDetail.schedules.map((s: any) => (
                            <div key={s.id} className="bg-white rounded-xl p-3 mb-2 text-xs">
                              <div className="font-semibold mb-1">{s.project?.title}</div>
                              <div className="text-gray-400 mb-2">{s.paidMonths}/{s.totalMonths} mois · Restant : {s.remainingAmount?.toLocaleString()} FCFA</div>
                              <div className="grid grid-cols-6 gap-1">
                                {s.payments?.map((pay: any) => {
                                  const net = Math.round(pay.amount * 0.96 * (s.sharePercent || 1))
                                  const isLate = pay.status === 'PENDING' && new Date(pay.dueDate) < new Date()
                                  return (
                                    <div key={pay.id} className={`rounded-lg p-1 text-center ${pay.status==='PAID'?'bg-green-100 text-green-700':isLate?'bg-red-100 text-red-700':'bg-gray-100 text-gray-500'}`}>
                                      <div className="font-bold">M{pay.monthNumber}</div>
                                      <div>{pay.status==='PAID'?'✅':isLate?'⚠️':'⏳'}</div>
                                      <div>+{(net/1000).toFixed(1)}k</div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Investissements */}
                      {userDetail.investments.length > 0 && (
                        <div>
                          <div className="font-bold text-gray-900 mb-3">📊 Investissements ({userDetail.investments.length})</div>
                          <div className="space-y-2">
                            {userDetail.investments.map((inv: any) => (
                              <div key={inv.id} className="bg-gray-50 rounded-xl p-3 text-xs flex justify-between items-center">
                                <div>
                                  <div className="font-semibold">{inv.project?.title}</div>
                                  <div className="text-gray-400">{new Date(inv.createdAt).toLocaleDateString("fr-FR")}</div>
                                  <div className="text-gray-500">Retour net attendu: {(inv.expectedReturn||0).toLocaleString()} FCFA</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-blue-700">{inv.amount.toLocaleString()} FCFA</div>
                                  <div className={`text-xs px-2 py-0.5 rounded-full ${inv.status==="COMPLETED"?"bg-green-100 text-green-700":"bg-orange-100 text-orange-700"}`}>{inv.status}</div>
                                  {inv.returnedAmount > 0 && <div className="text-green-600">Reçu: {inv.returnedAmount.toLocaleString()} FCFA</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Projets entrepreneur */}
                      {userDetail.projects?.length > 0 && (
                        <div>
                          <div className="font-bold text-gray-900 mb-3">🚀 Projets ({userDetail.projects.length})</div>
                          <div className="space-y-3">
                            {userDetail.projects.map((p: any) => {
                              const sc = p.repaymentSchedules?.[0];
                              return (
                                <div key={p.id} className="bg-blue-50 rounded-xl p-3 text-xs">
                                  <div className="flex justify-between mb-2">
                                    <div>
                                      <div className="font-semibold text-gray-900">{p.title}</div>
                                      <div className="text-gray-400">{p.sector} · {p.status}</div>
                                      {p.mentor && <div className="text-purple-600">Mentor: {p.mentor.firstName} {p.mentor.lastName}</div>}
                                    </div>
                                    <div className="text-right">
                                      <div className="font-bold">{(p.raisedAmount||0).toLocaleString()} FCFA</div>
                                      <div className="text-gray-400">/ {(p.goalAmount||0).toLocaleString()}</div>
                                      <div className="text-green-700">Net: {(p.netAmount||0).toLocaleString()}</div>
                                    </div>
                                  </div>
                                  {p.netAmount > 0 && (
                                    <div className="grid grid-cols-3 gap-1 mb-2">
                                      {[{n:1,pct:40,done:p.currentPalier>=1},{n:2,pct:35,done:p.currentPalier>=2},{n:3,pct:25,done:p.currentPalier>=3}].map(pl => (
                                        <div key={pl.n} className={`rounded-lg p-1 text-center ${pl.done?'bg-green-100 text-green-700':'bg-gray-100 text-gray-400'}`}>
                                          {pl.done?'✅':'🔒'} P{pl.n} {pl.pct}% — {Math.round((p.netAmount||0)*pl.pct/100).toLocaleString()}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {sc && (
                                    <div className="mb-2">
                                      <div className="text-gray-500 mb-1">{sc.paidMonths}/{sc.totalMonths} mois · Restant: {sc.remainingAmount?.toLocaleString()} FCFA</div>
                                      <div className="grid grid-cols-6 gap-1">
                                        {sc.payments?.map((pay: any) => (
                                          <div key={pay.id} className={`rounded p-1 text-center ${pay.status==='PAID'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-400'}`}>
                                            M{pay.monthNumber} {pay.status==='PAID'?'✅':'⏳'}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {p.investments?.length > 0 && (
                                    <div className="border-t border-blue-100 pt-2">
                                      {p.investments.map((inv: any, i: number) => (
                                        <div key={i} className="flex justify-between py-0.5">
                                          <span>{inv.user?.firstName} {inv.user?.lastName}</span>
                                          <span className="font-medium">{inv.amount?.toLocaleString()} FCFA{inv.returnedAmount>0?` · Reçu: ${inv.returnedAmount?.toLocaleString()}`:''}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {/* Transactions avec pli/dépli */}
                      {userDetail.txs.length > 0 && (
                        <TxUserList txs={userDetail.txs} />
                      )}
                    </div>
                  </div>
                </div>
              )}
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
                  {/* Bouton définir mot de passe */}
                  <button onClick={async () => {
                    const pwd = prompt("Définir le mot de passe pour " + s.companyName + " (min 6 caractères) :");
                    if (!pwd || pwd.length < 6) { flash("❌ Mot de passe trop court"); return; }
                    const res = await authPost(`/api/suppliers/${s.id}/set-password`, { password: pwd });
                    if (res.success) flash("✅ Mot de passe défini pour " + s.companyName);
                    else flash("❌ " + res.message);
                  }} className="w-full mt-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-2 rounded-xl text-sm border border-blue-200 transition-colors">
                    🔑 Définir mot de passe
                  </button>
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

        {/* LISTE D'ATTENTE */}
        {tab === "waitlist" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">⏳ Liste d&apos;attente ({waitlistedProjects.length})</h2>
              <p className="text-sm text-gray-500">Promotion automatique dès qu&apos;un slot se libère</p>
            </div>
            {waitlistedProjects.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="text-5xl mb-3">✅</div>
                <p className="text-gray-500 font-medium">Aucun projet en liste d&apos;attente</p>
              </div>
            ) : waitlistedProjects.map((p: any, idx: number) => {
              const days = Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86400000);
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-orange-100 text-orange-700 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0">
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded-full">⏳ En attente</span>
                          <span className="text-xs text-gray-400">{p.sector}{p.subSector ? " → " + p.subSector : ""} · {p.city}</span>
                          <span className="text-xs text-gray-400">{days}j en attente</span>
                        </div>
                        <h3 className="font-bold text-gray-900">{p.title}</h3>
                        <div className="text-sm text-gray-500">Par {p.entrepreneur?.firstName} {p.entrepreneur?.lastName}</div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-green-700">{p.goalAmount?.toLocaleString()} FCFA</div>
                      <div className="text-xs text-gray-400">{p.durationMonths} mois · +{p.expectedReturn}%</div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                    <a href={"/projects/" + p.id} target="_blank" rel="noreferrer"
                      className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 font-medium">
                      🔍 Voir le projet
                    </a>
                    <button onClick={async () => {
                      if (!confirm("Promouvoir ce projet en PENDING_REVIEW ?")) return;
                      const res = await authPatch("/api/projects/" + p.id + "/status", { status: "PENDING_REVIEW" });
                      if (res.success) { flash("✅ Projet promu !"); loadData(); }
                      else flash("❌ " + res.message);
                    }} className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 font-medium">
                      ⬆️ Promouvoir manuellement
                    </button>
                    <button onClick={async () => {
                      if (!confirm("Supprimer ce projet de la liste d'attente ?")) return;
                      const res = await authPatch("/api/projects/" + p.id + "/status", { status: "CANCELLED" });
                      if (res.success) { flash("Projet retiré"); loadData(); }
                      else flash("❌ " + res.message);
                    }} className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 font-medium">
                      🗑️ Retirer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
                      {(() => {
                        const days = Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86400000);
                        return days > 7
                          ? <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">🔴 Urgent — {days}j sans réponse</span>
                          : days >= 4
                          ? <span className="text-xs bg-yellow-100 text-yellow-700 font-bold px-2 py-0.5 rounded-full">🟡 Attention — {days}j</span>
                          : <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">🟢 Normal — {days}j</span>
                      })()}
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
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-xl font-bold text-gray-900">🚀 Tous les projets ({allProjects.length})</h2>
              <div className="flex gap-2 text-xs flex-wrap">
                {["ACTIVE","FUNDED","IN_PROGRESS","COMPLETED","CANCELLED"].map(s => (
                  <span key={s} className={`px-2 py-1 rounded-lg font-medium cursor-pointer ${STATUS_COLORS[s]||"bg-gray-100 text-gray-600"}`}>
                    {s}: {allProjects.filter((p:any)=>p.status===s).length}
                  </span>
                ))}
              </div>
            </div>
            {/* Filtres */}
            <div className="flex gap-2 flex-wrap">
              <input id="proj-search" placeholder="🔍 Rechercher titre, entrepreneur..."
                className="input-field text-sm flex-1 min-w-48"
                onChange={e => { const el = document.getElementById('proj-search') as HTMLInputElement; el.dataset.val = e.target.value; }}
              />
              <select id="proj-status" className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white">
                <option value="">Tous statuts</option>
                {["ACTIVE","FUNDED","IN_PROGRESS","COMPLETED","CANCELLED"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select id="proj-sector" className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white">
                <option value="">Tous secteurs</option>
                {[...new Set(allProjects.map((p:any)=>p.sector))].map((s:any) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <ProjectsList projects={allProjects} flash={flash} authPost={authPost} loadData={loadData} />
          </div>
        )}
        {false && (
          <div>
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
        {tab === "fund" && <FundTab flash={flash} />}
        {tab === "builders" && <BuildersAdminTab flash={flash} />}

      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// FUND TAB — Gestion Fonds Solidaire BAOBAB
// ═══════════════════════════════════════════════════════════
function FundMonthlyEvolution({ months, fmt }: { months: any[], fmt: (n: number) => string }) {
  const [showAll, setShowAll] = React.useState(false);
  const [sortDir, setSortDir] = React.useState<"desc"|"asc">("desc");
  const [search, setSearch] = React.useState("");
  const sorted = [...months]
    .filter(m => !search || m.month?.includes(search))
    .sort((a, b) => sortDir === "desc"
      ? b.month?.localeCompare(a.month)
      : a.month?.localeCompare(b.month));
  const displayed = showAll ? sorted : sorted.slice(0, 6);
  const totalRecu = months.reduce((s, m) => s + Number(m.total || 0), 0);
  const totalNet  = months.reduce((s, m) => s + Number(m.net || 0), 0);
  const totalFees = months.reduce((s, m) => s + Number(m.fees || 0), 0);
  const totalCount = months.reduce((s, m) => s + Number(m.count || 0), 0);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-bold text-gray-900">📅 Évolution mensuelle</h3>
        <div className="flex gap-2 items-center">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filtrer mois..."
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-green-400 w-32" />
          <button onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
            className="text-xs bg-gray-100 px-3 py-1.5 rounded-xl hover:bg-gray-200">
            {sortDir === "desc" ? "↓ Plus récent" : "↑ Plus ancien"}
          </button>
          {months.length > 6 && (
            <button onClick={() => setShowAll(s => !s)}
              className="text-xs text-green-600 hover:underline">
              {showAll ? "▲ Réduire" : `▼ Voir tout (${months.length} mois)`}
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2 text-xs text-gray-500">Mois</th>
              <th className="text-right px-3 py-2 text-xs text-gray-500">Total reçu</th>
              <th className="text-right px-3 py-2 text-xs text-gray-500">Net fonds (84%)</th>
              <th className="text-right px-3 py-2 text-xs text-gray-500">Frais BAOBAB (16%)</th>
              <th className="text-right px-3 py-2 text-xs text-gray-500">Contributions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {displayed.map((m: any) => (
              <tr key={m.month} className="hover:bg-green-50 transition-colors">
                <td className="px-3 py-2 text-gray-700 font-medium">{m.month}</td>
                <td className="px-3 py-2 text-right font-mono text-green-700">{fmt(Number(m.total))} F</td>
                <td className="px-3 py-2 text-right font-mono text-blue-700">{fmt(Number(m.net))} F</td>
                <td className="px-3 py-2 text-right font-mono text-purple-700">{fmt(Number(m.fees))} F</td>
                <td className="px-3 py-2 text-right text-gray-500">{m.count}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-green-50 font-bold border-t-2 border-green-200">
              <td className="px-3 py-2 text-gray-700">📊 Total</td>
              <td className="px-3 py-2 text-right text-green-700">{fmt(totalRecu)} F</td>
              <td className="px-3 py-2 text-right text-blue-700">{fmt(totalNet)} F</td>
              <td className="px-3 py-2 text-right text-purple-700">{fmt(totalFees)} F</td>
              <td className="px-3 py-2 text-right text-gray-600">{totalCount}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function FundTab({ flash }: { flash: (m: string) => void }) {
  const [stats, setStats] = React.useState<any>(null);
  const [contributions, setContributions] = React.useState<any[]>([]);
  const [projects, setProjects] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<"overview"|"contributions"|"allocate"|"campaigns">("overview");
  const [filter, setFilter] = React.useState({ status: "", startDate: "", endDate: "", page: 1 });
  const [allocForm, setAllocForm] = React.useState({ projectId: "", amount: "", note: "" });
  const [campForm, setCampForm] = React.useState({ title: "", description: "", goalAmount: "", startDate: "", endDate: "", projectId: "" });
  const [processing, setProcessing] = React.useState(false);

  const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");

  const BADGE_CONFIG: Record<string, { label: string; icon: string }> = {
    SEMEUR: { label: "Semeur", icon: "🌱" },
    JARDINIER: { label: "Jardinier", icon: "🌿" },
    BAOBAB: { label: "Baobab", icon: "🌳" },
    GRAND_BATISSEUR: { label: "Grand Bâtisseur", icon: "🏆" },
  };

  const load = React.useCallback(async () => {
    const params = new URLSearchParams();
    if (filter.status) params.set("status", filter.status);
    if (filter.startDate) params.set("startDate", filter.startDate);
    if (filter.endDate) params.set("endDate", filter.endDate);
    params.set("page", String(filter.page));

    const [s, c, p] = await Promise.all([
      authGet("/api/fund/admin/stats?" + params),
      authGet("/api/fund/admin/contributions?" + params),
      authGet("/api/projects?status=ACTIVE,FUNDED,IN_PROGRESS"),
    ]);
    if (s.success) setStats(s.data);
    if (c.success) setContributions(c.data.contributions || []);
    if (p.success) setProjects(p.data?.projects || p.data || []);
    setLoading(false);
  }, [filter]);

  React.useEffect(() => { load(); }, [load]);

  const confirmContrib = async (id: string) => {
    setProcessing(true);
    const res = await authPost(`/api/fund/admin/confirm/${id}`, {});
    if (res.success) { flash("✅ Contribution confirmée"); load(); }
    else flash("❌ " + res.message);
    setProcessing(false);
  };

  const allocate = async () => {
    if (!allocForm.projectId || !allocForm.amount) { flash("❌ Projet et montant requis"); return; }
    setProcessing(true);
    const res = await authPost("/api/fund/admin/allocate", {
      projectId: allocForm.projectId,
      amount: Number(allocForm.amount),
      note: allocForm.note
    });
    if (res.success) { flash("✅ " + res.message); setAllocForm({ projectId: "", amount: "", note: "" }); load(); }
    else flash("❌ " + res.message);
    setProcessing(false);
  };

  const createCampaign = async () => {
    if (!campForm.title || !campForm.goalAmount || !campForm.startDate || !campForm.endDate) {
      flash("❌ Remplissez tous les champs obligatoires"); return;
    }
    setProcessing(true);
    const res = await authPost("/api/fund/admin/campaigns", {
      ...campForm, goalAmount: Number(campForm.goalAmount)
    });
    if (res.success) { flash("✅ Campagne créée"); setCampForm({ title: "", description: "", goalAmount: "", startDate: "", endDate: "", projectId: "" }); load(); }
    else flash("❌ " + res.message);
    setProcessing(false);
  };

  const exportCSV = () => {
    const params = new URLSearchParams({ format: "csv" });
    if (filter.startDate) params.set("startDate", filter.startDate);
    if (filter.endDate) params.set("endDate", filter.endDate);
    const token = localStorage.getItem("accessToken");
    const url = `${process.env.NEXT_PUBLIC_API_URL}/api/fund/admin/export?${params}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `fonds-solidaire-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
      });
  };

  if (loading) return <div className="text-center py-10 text-gray-400">Chargement...</div>;

  const g = stats?.global || {};
  const totalAllocated = stats?.allocations?.reduce((s: number, a: any) => s + a.amount, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">🌱 Fonds Solidaire BAOBAB</h2>
          <p className="text-sm text-gray-500">Gestion des contributions et allocations</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="bg-green-600 text-white text-sm px-4 py-2 rounded-xl font-medium hover:bg-green-700">
            📥 Exporter CSV
          </button>
          <button onClick={load} className="text-sm text-green-600 hover:underline">🔄 Actualiser</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total reçu", value: fmt(g.totalReceived || 0) + " F", color: "text-green-700", bg: "bg-green-50" },
          { label: "Net fonds", value: fmt(g.totalNet || 0) + " F", color: "text-blue-700", bg: "bg-blue-50" },
          { label: "Alloué projets", value: fmt(totalAllocated) + " F", color: "text-purple-700", bg: "bg-purple-50" },
          { label: "Disponible", value: fmt(g.available || 0) + " F", color: "text-orange-700", bg: "bg-orange-50" },
          { label: "Frais BAOBAB", value: fmt(g.totalBaobabFee || 0) + " F", color: "text-gray-700", bg: "bg-gray-50" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4`}>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtres période */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Du</label>
          <input type="date" value={filter.startDate}
            onChange={e => setFilter(f => ({ ...f, startDate: e.target.value }))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Au</label>
          <input type="date" value={filter.endDate}
            onChange={e => setFilter(f => ({ ...f, endDate: e.target.value }))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Statut</label>
          <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400">
            <option value="">Tous</option>
            <option value="PENDING">En attente</option>
            <option value="COMPLETED">Confirmés</option>
            <option value="REJECTED">Rejetés</option>
          </select>
        </div>
        <button onClick={load} className="bg-green-600 text-white text-sm px-4 py-2 rounded-xl font-medium">Filtrer</button>
        <button onClick={exportCSV} className="bg-gray-100 text-gray-700 text-sm px-4 py-2 rounded-xl font-medium">📥 CSV période</button>
      </div>

      {/* Sous-onglets */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { id: "overview", label: "📊 Stats" },
          { id: "contributions", label: `💝 Contributions (${contributions.length})` },
          { id: "allocate", label: "🚀 Allouer" },
          { id: "campaigns", label: `🎯 Campagnes (${stats?.campaigns?.length || 0})` },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeTab === t.id ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-green-300"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* STATS */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          {/* Par méthode paiement */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-4">Par méthode de paiement</h3>
            <div className="space-y-2">
              {stats?.byMethod?.map((m: any) => (
                <div key={m.paymentMethod} className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-700">{m.paymentMethod}</span>
                  <div className="text-right">
                    <span className="font-bold text-green-700">{fmt(m._sum.amount)} FCFA</span>
                    <span className="text-xs text-gray-400 ml-2">({m._count} contributions)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Évolution mensuelle — pli/dépli */}
          <FundMonthlyEvolution months={stats?.byMonth || []} fmt={fmt} />

          {/* Badges distribués */}
          {stats?.badges?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-4">Badges distribués</h3>
              <div className="flex flex-wrap gap-3">
                {stats.badges.map((b: any) => (
                  <div key={b.badge} className="bg-green-50 rounded-xl px-4 py-2 text-center">
                    <div className="text-xl">{BADGE_CONFIG[b.badge]?.icon}</div>
                    <div className="text-xs font-medium text-green-700">{BADGE_CONFIG[b.badge]?.label}</div>
                    <div className="text-xs text-gray-500">{b._count} fois</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONTRIBUTIONS */}
      {activeTab === "contributions" && (
        <div className="space-y-3">
          {contributions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <div className="text-4xl mb-3">💝</div>
              <p className="text-gray-400">Aucune contribution</p>
            </div>
          ) : contributions.map((c: any) => (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-700 font-bold">
                    {c.anonymous ? "🙈" : (c.user?.firstName?.[0] || c.guestName?.[0] || "?")}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 text-sm">
                      {c.anonymous ? "Anonyme" : c.user ? `${c.user.firstName} ${c.user.lastName}` : c.guestName || "Visiteur"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {c.user?.email || c.guestEmail || ""} · {c.paymentMethod}
                    </div>
                    {c.project && <div className="text-xs text-green-600">→ {c.project.title}</div>}
                    {c.message && <div className="text-xs text-gray-400 italic">"{c.message}"</div>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-700">{fmt(c.amount)} FCFA</div>
                  <div className="text-xs text-gray-400">Net: {fmt(c.netAmount)} FCFA</div>
                  <div className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString("fr-FR")}</div>
                  {c.status === "PENDING" ? (
                    <button onClick={() => confirmContrib(c.id)} disabled={processing}
                      className="mt-1 text-xs bg-green-600 text-white px-2 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50">
                      ✅ Confirmer
                    </button>
                  ) : (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-lg">✅ Confirmé</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ALLOUER */}
      {activeTab === "allocate" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-4">🚀 Allouer des fonds à un projet</h3>
            <div className="bg-blue-50 rounded-xl p-3 mb-4 text-sm text-blue-700 flex justify-between items-center">
              <span>💰 Disponible : <strong>{fmt(g.available || 0)} FCFA</strong></span>
              <span className="text-xs text-blue-500">Fonds nets après commission BAOBAB 16%</span>
            </div>
            <div className="space-y-3">
              {/* Filtre secteur — dynamique depuis les projets */}
              <div className="flex gap-2 flex-wrap">
                {["Tous", ...Array.from(new Set(projects.filter((p: any) => ['ACTIVE','FUNDED'].includes(p.status)).map((p: any) => p.sector).filter(Boolean)))].map((sec: any) => (
                  <button key={sec}
                    onClick={() => setAllocForm(f => ({ ...f, sectorFilter: sec } as any))}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${(allocForm as any).sectorFilter === sec || (!((allocForm as any).sectorFilter) && sec === "Tous") ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-200 hover:border-green-300"}`}>
                    {sec}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Projet bénéficiaire <span className="text-xs text-gray-400">(projets en collecte uniquement)</span></label>
                <select value={allocForm.projectId} onChange={e => setAllocForm(f => ({ ...f, projectId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400">
                  <option value="">Sélectionner un projet...</option>
                  {projects
                    .filter((p: any) => ['ACTIVE', 'FUNDED'].includes(p.status))
                    .filter((p: any) => !(allocForm as any).sectorFilter || (allocForm as any).sectorFilter === "Tous" || p.sector === (allocForm as any).sectorFilter)
                    .map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.title} — {p.sector} · {p.status} · {fmt(p.raisedAmount||0)}/{fmt(p.goalAmount||0)} FCFA
                      </option>
                    ))}
                </select>
              </div>
              {/* Aperçu projet sélectionné */}
              {allocForm.projectId && (() => {
                const p = projects.find((x: any) => x.id === allocForm.projectId);
                if (!p) return null;
                const pct = Math.round(((p.raisedAmount||0)/(p.goalAmount||1))*100);
                return (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-gray-900">{p.title}</div>
                        <div className="text-gray-500">{p.sector} · {p.city} · {p.status}</div>
                      </div>
                      <div className="flex gap-2">
                        <a href={`http://46.202.132.161:3000/projects/${p.id}`} target="_blank"
                          className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-xl hover:bg-green-200 font-medium">
                          👁️ Voir projet
                        </a>
                      </div>
                    </div>
                    <div className="bg-gray-200 rounded-full h-1.5 mb-1">
                      <div className="bg-green-500 h-1.5 rounded-full" style={{width:`${Math.min(100,pct)}%`}} />
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Levé : {fmt(p.raisedAmount||0)} FCFA ({pct}%)</span>
                      <span>Objectif : {fmt(p.goalAmount||0)} FCFA</span>
                    </div>
                    <div className="mt-1 text-gray-500">
                      Retour +{p.interestRate||p.expectedReturn||24}% · {p.durationMonths||6} mois · {p.investorCount||0} investisseur(s)
                    </div>
                  </div>
                );
              })()}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Montant à allouer (FCFA)</label>
                <input type="number" value={allocForm.amount}
                  onChange={e => setAllocForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="Ex: 50000"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Justification * <span className="text-red-500">(obligatoire)</span></label>
                <input type="text" value={(allocForm as any).justification || ""}
                  onChange={e => setAllocForm(f => ({ ...f, justification: e.target.value } as any))}
                  placeholder="Ex: Projet à fort impact social, soutien jeune entrepreneur 1ère génération..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Note complémentaire (optionnel)</label>
                <input type="text" value={allocForm.note}
                  onChange={e => setAllocForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Informations supplémentaires..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400" />
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800">
                ⚠️ <strong>Rappel :</strong> Ces fonds proviennent des Bâtisseurs BAOBAB et sont destinés aux jeunes entrepreneurs. Toute allocation est publique et visible par la communauté.
              </div>
              <button onClick={() => {
                if (!(allocForm as any).justification) { alert("La justification est obligatoire"); return; }
                if (!confirm(`Confirmer l'allocation de ${Number(allocForm.amount).toLocaleString()} FCFA au projet sélectionné ?

Justification : ${(allocForm as any).justification}`)) return;
                allocate();
              }} disabled={processing || !allocForm.projectId || !allocForm.amount}
                className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 disabled:opacity-50">
                {processing ? "Traitement..." : "🌱 Allouer les fonds du Fonds Solidaire"}
              </button>
            </div>
          </div>

          {/* Historique allocations */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900">📋 Historique des allocations</h3>
              <span className="text-xs text-gray-400">{stats?.allocations?.length || 0} allocation(s)</span>
            </div>
            {!stats?.allocations?.length ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">🌱</div>
                <p className="text-gray-400 text-sm">Aucune allocation pour l'instant</p>
                <p className="text-xs text-gray-300 mt-1">Les allocations apparaîtront ici avec leur justification</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.allocations.map((a: any) => (
                  <div key={a.id} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm">{a.project?.title || "Projet supprimé"}</div>
                        <div className="text-xs text-green-600 mt-0.5">{a.project?.sector}</div>
                        <div className="text-xs text-gray-500 mt-1 italic">"{a.note}"</div>
                      </div>
                      <div className="text-right ml-3">
                        <div className="font-bold text-green-700">{fmt(a.amount)} FCFA</div>
                        <div className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleDateString("fr-FR")}</div>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="bg-green-50 rounded-xl p-3 flex justify-between text-sm font-bold">
                  <span>Total alloué</span>
                  <span className="text-green-700">{fmt(stats.allocations.reduce((s: number, a: any) => s + a.amount, 0))} FCFA</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CAMPAGNES */}
      {activeTab === "campaigns" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-4">🎯 Créer une campagne solidaire</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Titre *</label>
                <input type="text" value={campForm.title}
                  onChange={e => setCampForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ex: Ramadan Solidaire 2025"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Objectif (FCFA) *</label>
                <input type="number" value={campForm.goalAmount}
                  onChange={e => setCampForm(f => ({ ...f, goalAmount: e.target.value }))}
                  placeholder="500000"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Date début *</label>
                <input type="datetime-local" value={campForm.startDate}
                  onChange={e => setCampForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Date fin *</label>
                <input type="datetime-local" value={campForm.endDate}
                  onChange={e => setCampForm(f => ({ ...f, endDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Description</label>
                <textarea value={campForm.description}
                  onChange={e => setCampForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Décrivez l'objectif de cette campagne..."
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 resize-none" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Projet lié (optionnel)</label>
                <select value={campForm.projectId}
                  onChange={e => setCampForm(f => ({ ...f, projectId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400">
                  <option value="">Fonds général</option>
                  {projects.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
            </div>
            <button onClick={createCampaign} disabled={processing}
              className="mt-4 w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 disabled:opacity-50">
              {processing ? "Création..." : "🎯 Créer la campagne"}
            </button>
          </div>

          {/* Liste campagnes */}
          <div className="space-y-3">
            {stats?.campaigns?.map((c: any) => {
              const pct = Math.round((c.raised / c.goalAmount) * 100);
              const active = c.active && new Date(c.endDate) > new Date();
              return (
                <div key={c.id} className={`bg-white rounded-2xl border-2 p-4 ${active ? "border-green-200" : "border-gray-100"}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-gray-900">{c.title}</div>
                      <div className="text-xs text-gray-500">{c.description}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-lg font-medium ${active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {active ? "🟢 Active" : "⚫ Terminée"}
                    </span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2 mb-1">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(100, pct)}%` }}></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{fmt(c.raised)} FCFA / {fmt(c.goalAmount)} FCFA ({pct}%)</span>
                    <span>Fin: {new Date(c.endDate).toLocaleDateString("fr-FR")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// BUILDERS ADMIN TAB — Gestion Bâtisseurs
// ═══════════════════════════════════════════════════════════
function BuildersAdminTab({ flash }: { flash: (m: string) => void }) {
  const [builders, setBuilders] = React.useState<any[]>([]);
  const [fundStats, setFundStats] = React.useState<any>(null);
  const [allocations, setAllocations] = React.useState<any[]>([]);
  const [projects, setProjects] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [processing, setProcessing] = React.useState(false);
  const [allocForm, setAllocForm] = React.useState({ projectId: "", amount: "", note: "" });
  const [verifyId, setVerifyId] = React.useState<string | null>(null);

  const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");

  const LEVEL_CONFIG: Record<string, { label: string; icon: string; color: string; min: number }> = {
    GRAND_MECENE: { label: "Grand Mécène",     icon: "💎", color: "text-purple-700", min: 10000000 },
    OR:           { label: "Bâtisseur Or",     icon: "🥇", color: "text-yellow-700", min: 2000000 },
    ARGENT:       { label: "Bâtisseur Argent", icon: "🥈", color: "text-gray-600",   min: 500000 },
    BATISSEUR:    { label: "Bâtisseur",        icon: "🏗️", color: "text-orange-700", min: 100000 },
  };

  const getLevel = (total: number) => {
    if (total >= 10000000) return "GRAND_MECENE";
    if (total >= 2000000)  return "OR";
    if (total >= 500000)   return "ARGENT";
    if (total >= 100000)   return "BATISSEUR";
    return "CONTRIBUTEUR";
  };

  const load = React.useCallback(async () => {
    const [b, s, p] = await Promise.all([
      authGet("/api/fund/builders/public"),
      authGet("/api/fund/admin/stats"),
      authGet("/api/projects?status=ACTIVE,FUNDED,IN_PROGRESS"),
    ]);
    if (b.success) {
      setBuilders(b.data.builders || []);
      setFundStats(b.data.stats || {});
    }
    if (s.success) setAllocations(s.data.allocations || []);
    if (p.success) setProjects(p.data?.projects || p.data || []);
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const verifyBuilder = async (userId: string, verified: boolean) => {
    setProcessing(true);
    const res = await authPatch(`/api/fund/admin/builder/${userId}/verify`, { verified });
    if (res.success) { flash(verified ? "✅ Bâtisseur vérifié" : "❌ Vérification retirée"); load(); }
    else flash("❌ " + res.message);
    setProcessing(false);
    setVerifyId(null);
  };

  const allocate = async () => {
    if (!allocForm.projectId || !allocForm.amount) { flash("❌ Projet et montant requis"); return; }
    setProcessing(true);
    const res = await authPost("/api/fund/admin/allocate", {
      projectId: allocForm.projectId,
      amount: Number(allocForm.amount),
      note: allocForm.note || "Allocation depuis tableau de bord admin"
    });
    if (res.success) { flash("✅ " + res.message); setAllocForm({ projectId: "", amount: "", note: "" }); load(); }
    else flash("❌ " + res.message);
    setProcessing(false);
  };

  if (loading) return <div className="text-center py-10 text-gray-400">Chargement...</div>;

  const totalDonated = builders.reduce((s: number, b: any) => s + (b.totalDonated || 0), 0);
  const available = (fundStats?.totalRaised || 0) * 0.9 - allocations.reduce((s: number, a: any) => s + a.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">🏗️ Gestion des Bâtisseurs</h2>
          <p className="text-sm text-gray-500">Vérification KYC, allocations et suivi en temps réel</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="text-sm text-green-600 hover:underline">🔄 Actualiser</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Bâtisseurs", value: String(builders.length), color: "text-yellow-700", bg: "bg-yellow-50", icon: "🏗️" },
          { label: "Total collecté", value: fmt(fundStats?.totalRaised || 0) + " F", color: "text-green-700", bg: "bg-green-50", icon: "💰" },
          { label: "Disponible fonds", value: fmt(Math.max(0, available)) + " F", color: "text-blue-700", bg: "bg-blue-50", icon: "🏦" },
          { label: "Projets financés", value: String(allocations.length), color: "text-purple-700", bg: "bg-purple-50", icon: "🚀" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4`}>
            <div className="text-xl mb-1">{s.icon}</div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Liste Bâtisseurs */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-900">Liste des Bâtisseurs ({builders.length})</h3>
          {builders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <div className="text-3xl mb-2">🏗️</div>
              <p className="text-gray-400 text-sm">Aucun Bâtisseur public pour l'instant</p>
            </div>
          ) : builders.map((b: any, i: number) => {
            const level = getLevel(b.totalDonated);
            const lvl = LEVEL_CONFIG[level] || LEVEL_CONFIG.BATISSEUR;
            return (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center text-xl">
                      {lvl.icon}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-sm">
                        {b.companyName || `${b.firstName} ${b.lastName}`}
                      </div>
                      <div className="text-xs text-gray-500">{b.sector?.replace(/_/g, " ")}</div>
                      <div className={`text-xs font-bold ${lvl.color}`}>{lvl.label}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-yellow-700 text-sm">{fmt(b.totalDonated)} FCFA</div>
                    <div className="text-xs text-gray-400">{b.contributions} contribution(s)</div>
                    <div className="flex gap-1 justify-end mt-1">
                      {b.badges?.map((badge: string) => (
                        <span key={badge} className="text-xs">
                          {badge === "SEMEUR" ? "🌱" : badge === "JARDINIER" ? "🌿" : badge === "BAOBAB" ? "🌳" : "🏆"}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {b.description && (
                  <p className="text-xs text-gray-500 mt-2 italic line-clamp-2">{b.description}</p>
                )}
                {b.website && (
                  <a href={b.website} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 block">
                    🌐 {b.website}
                  </a>
                )}
                {b.userId && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => verifyBuilder(b.userId, true)} disabled={processing}
                      className="flex-1 text-xs bg-green-600 text-white py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50">
                      ✅ Vérifier KYC
                    </button>
                    <button onClick={() => verifyBuilder(b.userId, false)} disabled={processing}
                      className="flex-1 text-xs bg-red-50 text-red-600 border border-red-200 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-50">
                      ❌ Retirer
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Panneau droit */}
        <div className="space-y-5">
          {/* Allouer fonds */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">🚀 Allouer fonds à un projet</h3>
            <div className="bg-blue-50 rounded-xl p-3 mb-4">
              <div className="text-xs text-blue-700 font-medium">💰 Disponible dans le fonds</div>
              <div className="text-xl font-bold text-blue-700">{fmt(Math.max(0, available))} FCFA</div>
              <div className="text-xs text-blue-500 mt-0.5">
                Total collecté : {fmt(fundStats?.totalRaised || 0)} F · 
                Déjà alloué : {fmt(allocations.reduce((s: number, a: any) => s + a.amount, 0))} F
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Projet bénéficiaire *</label>
                <select value={allocForm.projectId}
                  onChange={e => setAllocForm(f => ({ ...f, projectId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400">
                  <option value="">Sélectionner un projet...</option>
                  {projects.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.title} — {p.sector} — {p.city}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Montant (FCFA) *</label>
                <input type="number" value={allocForm.amount}
                  onChange={e => setAllocForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="Ex: 100000"
                  max={Math.max(0, available)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400" />
                {allocForm.amount && Number(allocForm.amount) > available && (
                  <p className="text-xs text-red-500 mt-1">⚠️ Montant supérieur au disponible</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Note (visible par les Bâtisseurs)</label>
                <input type="text" value={allocForm.note}
                  onChange={e => setAllocForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Ex: Soutien agriculture Dakar — Phase 1"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400" />
              </div>
              <button onClick={allocate}
                disabled={processing || !allocForm.projectId || !allocForm.amount || Number(allocForm.amount) > available || Number(allocForm.amount) <= 0}
                className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 disabled:opacity-50 text-sm">
                {processing ? "Allocation en cours..." : "🚀 Allouer au projet — visible par les Bâtisseurs immédiatement"}
              </button>
              <p className="text-xs text-gray-400 text-center">
                ⚡ Les Bâtisseurs verront cette allocation en temps réel dans leur dashboard
              </p>
            </div>
          </div>

          {/* Historique allocations */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">📋 Historique allocations ({allocations.length})</h3>
            {allocations.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Aucune allocation</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {allocations.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{a.project?.title}</div>
                      <div className="text-xs text-gray-500">{a.project?.sector}</div>
                      {a.note && <div className="text-xs text-gray-400 italic">{a.note}</div>}
                      <div className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleDateString("fr-FR", { day:"numeric", month:"long", year:"numeric" })}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-700 text-sm">{fmt(a.amount)} FCFA</div>
                      <div className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-lg">✅ Alloué</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats par niveau */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">📊 Bâtisseurs par niveau</h3>
            {Object.entries(LEVEL_CONFIG).map(([key, lvl]) => {
              const count = builders.filter((b: any) => getLevel(b.totalDonated) === key).length;
              const total = builders.filter((b: any) => getLevel(b.totalDonated) === key).reduce((s: number, b: any) => s + b.totalDonated, 0);
              return (
                <div key={key} className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm flex items-center gap-2">
                    <span>{lvl.icon}</span>
                    <span className={lvl.color}>{lvl.label}</span>
                  </span>
                  <div className="text-right">
                    <span className="font-bold text-gray-900 text-sm">{count} Bâtisseur(s)</span>
                    {count > 0 && <div className="text-xs text-gray-400">{fmt(total)} FCFA</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
