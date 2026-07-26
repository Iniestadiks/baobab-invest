"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authPost, authGet } from "@/lib/api";
function fmt(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}
const PROVIDER_ICONS: Record<string, string> = {
  paydunya: "🟠",
  kiakiapay: "🟡",
  stripe: "🟣",
};
export default function DepositPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [wallet, setWallet] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [loadingProviders, setLoadingProviders] = useState(true);
  useEffect(() => {
    authGet("/api/auth/me").then((r: any) => { if (r.success) setWallet(r.data.wallet); });
    // Charger les moyens de paiement activés par l'admin
    authGet("/api/config/payment-providers/public").then((r: any) => {
      if (r.success && r.data?.length > 0) {
        setProviders(r.data);
        setSelectedProvider(r.data[0].key);
      }
      setLoadingProviders(false);
    });
    // Vérifier si retour de PayDunya
    const status = params.get("status");
    const txId = params.get("txId");
    if (status === "success" && txId) {
      setVerifying(true);
      // Polling — vérifier toutes les 3s pendant 30s max
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const res = await authPost(`/api/wallet/deposit/verify/${txId}`, {});
        if (res.success && res.data?.status === "COMPLETED") {
          clearInterval(poll);
          setVerifying(false);
          setMsg(`✅ Dépôt confirmé ! Redirection...`);
          authGet("/api/auth/me").then((r: any) => { if (r.success) setWallet(r.data.wallet); });
          setTimeout(() => router.push("/dashboard"), 2000);
        } else if (attempts >= 10) {
          clearInterval(poll);
          setVerifying(false);
          // Forcer la confirmation côté serveur
          const forceRes = await authPost(`/api/wallet/deposit/force-confirm/${txId}`, {});
          authGet("/api/auth/me").then((r: any) => { if (r.success) setWallet(r.data.wallet); });
          if (forceRes.success) {
            setMsg("✅ Paiement confirmé ! Redirection...");
            setTimeout(() => router.push("/dashboard"), 2000);
          } else {
            setMsg("⏳ Paiement en cours de traitement — votre wallet sera crédité dans quelques minutes. Vous pouvez quitter cette page.");
          }
        }
      }, 3000);
    } else if (status === "cancel") {
      setMsg("❌ Paiement annulé.");
    }
  }, []);
  const handleDeposit = async () => {
    if (!amount || Number(amount) < 1000) {
      setMsg("❌ Montant minimum 1 000 FCFA"); return;
    }
    if (!selectedProvider) {
      setMsg("❌ Aucun moyen de paiement disponible actuellement"); return;
    }
    setLoading(true);
    setMsg("");
    const res = await authPost("/api/wallet/deposit", { amount: Number(amount), provider: selectedProvider });
    if (res.success && res.data?.paymentUrl) {
      window.location.href = res.data.paymentUrl;
    } else {
      setMsg("❌ " + (res.message || "Erreur lors de l'initiation du paiement"));
      setLoading(false);
    }
  };
  const AMOUNTS = [5000, 10000, 25000, 50000, 100000, 250000];
  const currentProvider = providers.find(p => p.key === selectedProvider);
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 w-full max-w-md p-8">
        <button onClick={() => router.push("/dashboard")} className="text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-2 text-sm">
          ← Retour
        </button>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Déposer des fonds</h1>
        <p className="text-gray-500 text-sm mb-6">Rechargez votre wallet — BAOBAB prend en charge les frais opérateur</p>
        {wallet && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6">
            <div className="text-xs text-gray-500">Solde actuel</div>
            <div className="text-2xl font-bold text-green-700">{fmt(wallet.balance || 0)} FCFA</div>
          </div>
        )}
        {verifying && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
              <div>
                <div className="text-blue-800 font-bold">Vérification du paiement en cours...</div>
                <div className="text-xs text-blue-600 mt-0.5">Confirmation en cours</div>
              </div>
            </div>
            <div className="bg-blue-100 rounded-xl p-3 text-xs text-blue-700 space-y-1">
              <div className="font-bold text-blue-800">⚠️ NE QUITTEZ PAS CETTE PAGE</div>
              <div>Votre paiement est en cours de traitement. Cette opération peut prendre <strong>30 à 60 secondes</strong>.</div>
              <div>Si vous quittez maintenant, votre wallet sera crédité automatiquement dans les prochaines minutes par notre système.</div>
            </div>
          </div>
        )}
        {msg && (
          <div className={`p-4 rounded-2xl mb-6 text-sm font-medium ${msg.startsWith("✅") ? "bg-green-50 text-green-800 border border-green-200" : msg.startsWith("⏳") ? "bg-blue-50 text-blue-800 border border-blue-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {msg}
          </div>
        )}
        {/* Sélecteur de moyen de paiement — n'apparaît que si plusieurs sont activés */}
        {!loadingProviders && providers.length > 1 && (
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-600 mb-2 block">Moyen de paiement</label>
            <div className="grid grid-cols-1 gap-2">
              {providers.map(p => (
                <button key={p.key} onClick={() => setSelectedProvider(p.key)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${selectedProvider === p.key ? "bg-green-50 border-green-400" : "bg-white border-gray-200 hover:border-green-300"}`}>
                  <span className="text-xl">{PROVIDER_ICONS[p.key] || "💳"}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 text-sm">{p.label}</div>
                    <div className="text-xs text-gray-400">{p.methods}</div>
                  </div>
                  {selectedProvider === p.key && <span className="text-green-600 font-bold">✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        {!loadingProviders && providers.length === 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-sm text-red-700">
            ⚠️ Aucun moyen de paiement disponible actuellement. Contactez le support.
          </div>
        )}
        {/* Montants rapides */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-600 mb-2 block">Montant rapide</label>
          <div className="grid grid-cols-3 gap-2">
            {AMOUNTS.map(a => (
              <button key={a} onClick={() => setAmount(String(a))}
                className={`text-sm py-2 px-3 rounded-xl font-medium border transition-colors ${amount === String(a) ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-700 border-gray-200 hover:border-green-300"}`}>
                {fmt(a)}
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
            <div className="mt-2 bg-gray-50 rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Vous envoyez</span>
                <span className="font-bold text-gray-900">{fmt(Number(amount))} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">✅ Frais opérateur</span>
                <span className="font-bold text-green-600">Absorbés par BAOBAB</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1">
                <span className="font-bold text-green-800">💚 Wallet crédité</span>
                <span className="font-bold text-green-700 text-sm">{fmt(Number(amount))} FCFA — 100% ✅</span>
              </div>
            </div>
          )}
        </div>
        {/* Moyens de paiement acceptés — dynamique selon le prestataire sélectionné */}
        {currentProvider && (
          <div className="bg-gray-50 rounded-2xl p-4 mb-6">
            <div className="text-xs font-semibold text-gray-600 mb-3">Moyens de paiement acceptés</div>
            <div className="flex flex-wrap gap-2">
              {currentProvider.methods.split(",").map((m: string) => (
                <span key={m} className="text-xs bg-white border border-gray-200 px-2.5 py-1 rounded-lg text-gray-600">{m.trim()}</span>
              ))}
            </div>
            <div className="text-xs text-gray-400 mt-2">💚 BAOBAB absorbe les frais — vous recevez 100% de votre dépôt</div>
          </div>
        )}
        <button onClick={handleDeposit} disabled={loading || !amount || Number(amount) < 1000 || !selectedProvider}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl text-lg transition-colors disabled:opacity-50">
          {loading ? "Redirection vers le paiement..." : `Déposer ${amount ? fmt(Number(amount)) : "..."} FCFA`}
        </button>
        <p className="text-xs text-gray-400 text-center mt-4">
          Vous serez redirigé vers notre page de paiement sécurisée
        </p>
      </div>
    </div>
  );
}
