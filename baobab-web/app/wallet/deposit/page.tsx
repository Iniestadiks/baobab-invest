"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authPost, authGet } from "@/lib/api";

const OPERATORS = ["Orange Money", "Wave", "Free Money", "Expresso", "MTN MoMo"];
const OP_ICONS: Record<string, string> = {
  "Orange Money": "🟠", "Wave": "🔵", "Free Money": "🟢", "Expresso": "🔴", "MTN MoMo": "🟡"
};

export default function DepositPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [operator, setOperator] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const fmt = (n: number) => mounted ? n.toLocaleString("fr-FR") : n.toString();
  const [msg, setMsg] = useState<{text:string,ok:boolean}|null>(null);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.replace("/auth/login"); return; }
    authGet("/api/auth/me").then(r => { if (r.success) setWallet(r.data.wallet); });
  }, []);

  const submit = async () => {
    if (!amount || !phone || !operator) { setMsg({text:"Tous les champs sont requis",ok:false}); return; }
    if (Number(amount) < 1000) { setMsg({text:"Montant minimum : 1 000 FCFA",ok:false}); return; }
    setLoading(true);
    try {
      const res = await authPost("/api/wallet/deposit", { amount: Number(amount), phoneNumber: phone, operator });
      if (res.success) {
        setMsg({text:"✅ Demande enregistrée ! Votre solde sera crédité après validation (quelques minutes).",ok:true});
        setAmount(""); setPhone(""); setOperator("");
      } else setMsg({text:"❌ " + res.message, ok:false});
    } finally { setLoading(false); }
  };

  const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
  const dashboard = user.role === "ENTREPRENEUR" ? "/entrepreneur" : user.role === "MENTOR" ? "/mentor" : "/dashboard";

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-6 py-4 flex items-center gap-3">
          <Link href={dashboard} className="text-gray-400 hover:text-green-600">←</Link>
          <span className="font-bold text-gray-900">💳 Déposer des fonds</span>
        </div>
      </nav>
      <div className="max-w-lg mx-auto px-6 py-8 space-y-5">

        {/* Solde actuel */}
        <div className="bg-green-600 rounded-2xl p-5 text-white">
          <div className="text-sm opacity-80 mb-1">Solde actuel</div>
          <div className="text-3xl font-bold">{mounted ? (wallet?.balance || 0).toLocaleString("fr-FR") : String(wallet?.balance || 0)} FCFA</div>
          <div className="text-sm opacity-70 mt-1">Wallet BAOBAB INVEST</div>
        </div>

        {msg && (
          <div className={`rounded-xl p-4 text-sm ${msg.ok ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
            {msg.text}
          </div>
        )}

        {/* Montants rapides */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-3">Montant à déposer</h3>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[5000, 10000, 25000, 50000, 100000, 250000].map(v => (
              <button key={v} onClick={() => setAmount(String(v))}
                className={`py-2 rounded-xl text-sm font-medium border transition-colors ${amount === String(v) ? "bg-green-600 text-white border-green-600" : "bg-gray-50 text-gray-700 border-gray-200 hover:border-green-300"}`}>
                {fmt(v)}
              </button>
            ))}
          </div>
          <input
            type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="Ou entrez un montant personnalisé..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
          />
          {amount && <p className="text-xs text-gray-400 mt-1">{mounted ? Number(amount).toLocaleString("fr-FR") : amount} FCFA</p>}
        </div>

        {/* Opérateur */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-3">Opérateur Mobile Money</h3>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {OPERATORS.map(op => (
              <button key={op} onClick={() => setOperator(op)}
                className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-colors ${operator === op ? "bg-green-600 text-white border-green-600" : "bg-gray-50 text-gray-700 border-gray-200 hover:border-green-300"}`}>
                <span>{OP_ICONS[op]}</span><span>{op}</span>
              </button>
            ))}
          </div>
          <input
            type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="Numéro Mobile Money (ex: +221 77 000 00 00)"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
          />
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
          <p className="font-semibold mb-1">ℹ️ Comment ça marche ?</p>
          <p>1. Soumettez votre demande de dépôt</p>
          <p>2. Effectuez le virement depuis votre Mobile Money</p>
          <p>3. Votre wallet est crédité sous quelques minutes après validation</p>
          <p className="mt-1 font-medium">🔒 Avec PayDunya : tout sera automatique</p>
        </div>

        <button onClick={submit} disabled={loading || !amount || !phone || !operator}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl transition-colors disabled:opacity-50 text-lg">
          {loading ? "Envoi..." : `💳 Demander le dépôt de ${amount ? mounted ? Number(amount).toLocaleString("fr-FR") : amount : "0"} FCFA`}
        </button>

        <Link href="/wallet/history" className="block text-center text-sm text-gray-400 hover:text-green-600">
          Voir l&apos;historique de mes transactions →
        </Link>
      </div>
    </div>
  );
}
