"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authPost, authGet } from "@/lib/api";

const OPERATORS = ["Orange Money", "Wave", "Free Money", "Expresso", "MTN MoMo"];
const OP_ICONS: Record<string, string> = {
  "Orange Money": "🟠", "Wave": "🔵", "Free Money": "🟢", "Expresso": "🔴", "MTN MoMo": "🟡"
};

export default function WithdrawPage() {
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
    if (Number(amount) < 5000) { setMsg({text:"Montant minimum : 5 000 FCFA",ok:false}); return; }
    if (Number(amount) > (wallet?.balance || 0)) { setMsg({text:"Solde insuffisant",ok:false}); return; }
    setLoading(true);
    try {
      const res = await authPost("/api/wallet/withdraw", { amount: Number(amount), phoneNumber: phone, operator });
      if (res.success) {
        setMsg({text:`✅ Demande de retrait enregistrée. Vous recevrez ${mounted ? Number(amount).toLocaleString("fr-FR") : amount} FCFA sur votre ${operator} sous 24h ouvrées.`,ok:true});
        setAmount(""); setPhone(""); setOperator("");
        authGet("/api/auth/me").then(r => { if (r.success) setWallet(r.data.wallet); });
      } else setMsg({text:"❌ " + res.message, ok:false});
    } finally { setLoading(false); }
  };

  const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
  const dashboard = user.role === "ENTREPRENEUR" ? "/entrepreneur" : user.role === "MENTOR" ? "/mentor" : "/dashboard";
  const balance = wallet?.balance || 0;
  const gainBalance = wallet?.gainBalance || 0;
  const depositBalance = wallet?.depositBalance || 0;
  
  // Calcul frais proportionnels
  const amt = Number(amount) || 0;
  const gainPart = Math.min(amt, gainBalance);
  const depositPart = Math.max(0, amt - gainPart);
  const gainFee = Math.round(gainPart * 3 / 100);
  const depositFee = Math.round(depositPart * 7 / 100);
  const totalFee = gainFee + depositFee;
  const netReceived = amt - totalFee;
  const effectiveRate = amt > 0 ? ((totalFee / amt) * 100).toFixed(1) : '0';

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-6 py-4 flex items-center gap-3">
          <Link href={dashboard} className="text-gray-400 hover:text-green-600">←</Link>
          <span className="font-bold text-gray-900">💸 Retirer des fonds</span>
        </div>
      </nav>
      <div className="max-w-lg mx-auto px-6 py-8 space-y-5">

        <div className="bg-green-600 rounded-2xl p-5 text-white">
          <div className="text-sm opacity-80 mb-1">Solde total disponible</div>
          <div className="text-3xl font-bold">{fmt(balance)} FCFA</div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-white/20 rounded-xl p-3">
              <div className="text-xs opacity-80">📈 Gains remboursements</div>
              <div className="font-bold">{fmt(gainBalance)} FCFA</div>
              <div className="text-xs opacity-70">Frais retrait : 3%</div>
            </div>
            <div className="bg-white/20 rounded-xl p-3">
              <div className="text-xs opacity-80">💵 Dépôts à investir</div>
              <div className="font-bold">{fmt(depositBalance)} FCFA</div>
              <div className="text-xs opacity-70">Frais retrait : 7%</div>
            </div>
          </div>
        </div>

        {msg && (
          <div className={`rounded-xl p-4 text-sm ${msg.ok ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
            {msg.text}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-3">Montant à retirer</h3>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[5000, 10000, 25000, 50000, 100000, balance].filter((v,i,a) => a.indexOf(v) === i && v > 0).map(v => (
              <button key={v} onClick={() => setAmount(String(v))}
                className={`py-2 rounded-xl text-sm font-medium border transition-colors ${amount === String(v) ? "bg-green-600 text-white border-green-600" : "bg-gray-50 text-gray-700 border-gray-200 hover:border-green-300"}`}>
                {v === balance ? "Tout" : fmt(v)}
              </button>
            ))}
          </div>
          <input
            type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="Montant personnalisé..."
            max={balance}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-3">Vers quel Mobile Money ?</h3>
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
            placeholder="Numéro Mobile Money"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
          />
        </div>

        {amt > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800">
            <p className="font-semibold mb-2">📊 Détail des frais</p>
            {gainPart > 0 && <p>• Gains {fmt(gainPart)} FCFA × 3% = <strong>-{fmt(gainFee)} FCFA</strong></p>}
            {depositPart > 0 && <p>• Dépôts {fmt(depositPart)} FCFA × 7% = <strong>-{fmt(depositFee)} FCFA</strong></p>}
            <p className="border-t border-blue-200 mt-2 pt-2 font-bold">
              Taux effectif : {effectiveRate}% — Vous recevez : {fmt(netReceived)} FCFA
            </p>
            {depositPart > 0 && (
              <p className="text-orange-600 mt-1">💡 Investissez d&apos;abord pour bénéficier du taux 3%</p>
            )}
          </div>
        )}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-xs text-orange-700">
          <p className="font-semibold mb-1">⚠️ Important</p>
          <p>• Le montant sera débité immédiatement de votre wallet</p>
          <p>• Le virement Mobile Money arrive sous 24h ouvrées</p>
        </div>

        <button onClick={submit} disabled={loading || !amount || !phone || !operator || Number(amount) > balance}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl transition-colors disabled:opacity-50 text-lg">
          {loading ? "Traitement..." : `💸 Retirer ${amount ? mounted ? Number(amount).toLocaleString("fr-FR") : amount : "0"} FCFA`}
        </button>

        <Link href="/wallet/history" className="block text-center text-sm text-gray-400 hover:text-green-600">
          Voir l&apos;historique →
        </Link>
      </div>
    </div>
  );
}
