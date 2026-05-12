"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authGet } from "@/lib/api";

const TYPE_CONFIG: Record<string, any> = {
  DEPOSIT:    { label: "Dépôt",        icon: "💳", color: "text-green-600",  bg: "bg-green-50"  },
  WITHDRAWAL: { label: "Retrait",      icon: "💸", color: "text-orange-600", bg: "bg-orange-50" },
  INVESTMENT: { label: "Investissement", icon: "📊", color: "text-blue-600", bg: "bg-blue-50"   },
  RETURN:     { label: "Retour reçu",  icon: "✅", color: "text-purple-600", bg: "bg-purple-50" },
};
const STATUS_CONFIG: Record<string, any> = {
  PENDING:   { label: "En attente", color: "text-orange-600", bg: "bg-orange-50" },
  COMPLETED: { label: "Confirmé",   color: "text-green-600",  bg: "bg-green-50"  },
  REJECTED:  { label: "Refusé",     color: "text-red-600",    bg: "bg-red-50"    },
};

export default function WalletHistoryPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all"|"DEPOSIT"|"WITHDRAWAL">("all");

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.replace("/auth/login"); return; }
    authGet("/api/wallet/history").then(res => {
      if (res.success) setData(res.data);
    }).finally(() => setLoading(false));
  }, []);

  const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
  const dashboard = user.role === "ENTREPRENEUR" ? "/entrepreneur" : user.role === "MENTOR" ? "/mentor" : "/dashboard";

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-4xl animate-bounce">💳</div>
    </div>
  );

  const transactions = (data?.transactions || []).filter((t: any) => filter === "all" || t.type === filter);
  const wallet = data?.wallet;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href={dashboard} className="text-gray-400 hover:text-green-600">←</Link>
          <span className="font-bold text-gray-900">📜 Historique wallet</span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">

        {/* Résumé wallet */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Solde", value: wallet?.balance || 0, color: "text-green-700", bg: "bg-green-50", icon: "💰" },
            { label: "Total déposé", value: wallet?.totalDeposited || 0, color: "text-blue-700", bg: "bg-blue-50", icon: "📥" },
            { label: "Total retiré", value: wallet?.totalWithdrawn || 0, color: "text-orange-700", bg: "bg-orange-50", icon: "📤" },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-3 text-center`}>
              <div className="text-xl mb-1">{s.icon}</div>
              <div className={`font-bold text-sm ${s.color}`}>{s.value.toLocaleString()} FCFA</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Actions rapides */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/wallet/deposit" className="bg-green-600 text-white font-bold py-3 rounded-2xl text-center text-sm hover:bg-green-700">
            💳 Déposer
          </Link>
          <Link href="/wallet/withdraw" className="bg-orange-500 text-white font-bold py-3 rounded-2xl text-center text-sm hover:bg-orange-600">
            💸 Retirer
          </Link>
        </div>

        {/* Filtres */}
        <div className="flex gap-2">
          {(["all","DEPOSIT","WITHDRAWAL"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${filter === f ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-green-300"}`}>
              {f === "all" ? "Tout" : f === "DEPOSIT" ? "💳 Dépôts" : "💸 Retraits"}
            </button>
          ))}
        </div>

        {/* Liste transactions */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-sm">Aucune transaction pour l&apos;instant</p>
              <Link href="/wallet/deposit" className="text-green-600 text-sm hover:underline mt-2 block">Faire un dépôt →</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {transactions.map((tx: any) => {
                const tc = TYPE_CONFIG[tx.type] || TYPE_CONFIG.DEPOSIT;
                const sc = STATUS_CONFIG[tx.status] || STATUS_CONFIG.PENDING;
                return (
                  <div key={tx.id} className="flex items-center gap-3 p-4">
                    <div className={`w-10 h-10 rounded-full ${tc.bg} flex items-center justify-center text-lg flex-shrink-0`}>
                      {tc.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">{tc.label}</div>
                      <div className="text-xs text-gray-400">
                        {tx.operator && `${tx.operator} · `}{tx.phoneNumber && `${tx.phoneNumber} · `}
                        {new Date(tx.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`font-bold text-sm ${tc.color}`}>
                        {tx.type === "WITHDRAWAL" ? "-" : "+"}{tx.amount.toLocaleString()} FCFA
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sc.bg} ${sc.color}`}>
                        {sc.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
