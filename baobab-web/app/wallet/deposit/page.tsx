"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authPost, authGet } from "@/lib/api";

export default function DepositPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [wallet, setWallet] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    authGet("/api/auth/me").then((r: any) => { if (r.success) setWallet(r.data.wallet); });

    // Vérifier si retour de PayDunya
    const status = params.get("status");
    const txId = params.get("txId");
    if (status === "success" && txId) {
      setVerifying(true);
      setTimeout(async () => {
        const res = await authPost(`/api/wallet/deposit/verify/${txId}`, {});
        if (res.success && res.data?.status === "COMPLETED") {
          setMsg(`✅ Dépôt de ${res.data.amount?.toLocaleString()} FCFA confirmé !`);
          authGet("/api/auth/me").then((r: any) => { if (r.success) setWallet(r.data.wallet); });
        } else {
          setMsg("⏳ Paiement en cours de vérification...");
        }
        setVerifying(false);
      }, 2000);
    } else if (status === "cancel") {
      setMsg("❌ Paiement annulé.");
    }
  }, []);

  const handleDeposit = async () => {
    if (!amount || Number(amount) < 1000) {
      setMsg("❌ Montant minimum 1 000 FCFA"); return;
    }
    setLoading(true);
    setMsg("");
    const res = await authPost("/api/wallet/deposit", { amount: Number(amount) });
    if (res.success && res.data?.paymentUrl) {
      window.location.href = res.data.paymentUrl;
    } else {
      setMsg("❌ " + (res.message || "Erreur lors de l'initiation du paiement"));
      setLoading(false);
    }
  };

  const AMOUNTS = [5000, 10000, 25000, 50000, 100000, 250000];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 w-full max-w-md p-8">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-2 text-sm">
          ← Retour
        </button>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Déposer des fonds</h1>
        <p className="text-gray-500 text-sm mb-6">Rechargez votre wallet via Mobile Money</p>

        {wallet && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6">
            <div className="text-xs text-gray-500">Solde actuel</div>
            <div className="text-2xl font-bold text-green-700">{(wallet.balance || 0).toLocaleString()} FCFA</div>
          </div>
        )}

        {verifying && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 text-center">
            <div className="text-blue-700 font-medium">Vérification du paiement...</div>
            <div className="text-xs text-blue-500 mt-1">Patientez quelques secondes</div>
          </div>
        )}

        {msg && (
          <div className={`p-4 rounded-2xl mb-6 text-sm font-medium ${msg.startsWith("✅") ? "bg-green-50 text-green-800 border border-green-200" : msg.startsWith("⏳") ? "bg-blue-50 text-blue-800 border border-blue-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {msg}
          </div>
        )}

        {/* Montants rapides */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-600 mb-2 block">Montant rapide</label>
          <div className="grid grid-cols-3 gap-2">
            {AMOUNTS.map(a => (
              <button key={a} onClick={() => setAmount(String(a))}
                className={`text-sm py-2 px-3 rounded-xl font-medium border transition-colors ${amount === String(a) ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-700 border-gray-200 hover:border-green-300"}`}>
                {a.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Montant personnalisé */}
        <div className="mb-6">
          <label className="text-xs font-semibold text-gray-600 mb-2 block">Ou saisissez un montant (FCFA)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="Ex: 15000" min="1000"
            className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-lg font-bold focus:outline-none focus:border-green-400 text-center" />
          {amount && Number(amount) >= 1000 && (
            <div className="text-center text-xs text-green-600 mt-1 font-medium">
              Votre wallet sera crédité de {Number(amount).toLocaleString()} FCFA
            </div>
          )}
        </div>

        {/* Moyens de paiement */}
        <div className="bg-gray-50 rounded-2xl p-4 mb-6">
          <div className="text-xs font-semibold text-gray-600 mb-3">Moyens de paiement acceptés</div>
          <div className="flex flex-wrap gap-2">
            {["Orange Money", "Wave", "Free Money", "Expresso", "Carte bancaire"].map(m => (
              <span key={m} className="text-xs bg-white border border-gray-200 px-2.5 py-1 rounded-lg text-gray-600">{m}</span>
            ))}
          </div>
          <div className="text-xs text-gray-400 mt-2">Sécurisé par PayDunya — Aucun frais pour vous</div>
        </div>

        <button onClick={handleDeposit} disabled={loading || !amount || Number(amount) < 1000}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl text-lg transition-colors disabled:opacity-50">
          {loading ? "Redirection vers PayDunya..." : `Déposer ${amount ? Number(amount).toLocaleString() : "..."} FCFA`}
        </button>

        <p className="text-xs text-gray-400 text-center mt-4">
          Vous serez redirigé vers la page de paiement PayDunya sécurisée
        </p>
      </div>
    </div>
  );
}
