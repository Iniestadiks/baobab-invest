"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authGet, authPost } from "@/lib/api";

const ROLE_DASHBOARD: Record<string, string> = {
  INVESTOR: "/dashboard", ENTREPRENEUR: "/entrepreneur",
  MENTOR: "/mentor", ADMIN: "/admin"
};

export default function ReferralPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
  const dashboard = ROLE_DASHBOARD[user.role] || "/dashboard";

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.replace("/auth/login"); return; }
    authGet("/api/referral/my").then(res => {
      if (res.success) setData(res.data);
    }).finally(() => setLoading(false));
  }, []);

  const copy = () => {
    navigator.clipboard.writeText(data?.shareLink || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const applyCode = async () => {
    if (!code.trim()) return;
    setApplying(true);
    const res = await authPost("/api/referral/apply", { code });
    setMsg(res.success ? "✅ " + res.message : "❌ " + res.message);
    setApplying(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-4xl animate-bounce">🌳</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href={dashboard} className="text-gray-400 hover:text-green-600">←</Link>
          <span className="font-bold text-gray-900">🌳 Parrainer un ami</span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Filleuls", value: String(data?.referralCount || 0), icon: "👥", color: "text-blue-700", bg: "bg-blue-50" },
            { label: "Gains totaux", value: `${(data?.referralEarned || 0).toLocaleString()} FCFA`, icon: "💰", color: "text-green-700", bg: "bg-green-50" },
            { label: "Bonus/filleul", value: `${(data?.bonusPerReferral || 2500).toLocaleString()} FCFA`, icon: "🎁", color: "text-purple-700", bg: "bg-purple-50" },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center`}>
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className={`font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Mon code */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-3">🎟️ Mon code de parrainage</h3>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center mb-3">
            <div className="text-3xl font-bold text-green-700 tracking-widest">{data?.referralCode || "—"}</div>
          </div>
          <button onClick={copy}
            className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors">
            {copied ? "✅ Lien copié !" : "📋 Copier le lien de parrainage"}
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">
            Partagez ce lien — votre ami s&apos;inscrit et vous recevez {(data?.bonusPerReferral || 2500).toLocaleString()} FCFA
          </p>
        </div>

        {/* Comment ça marche */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-3">💡 Comment ça marche ?</h3>
          <div className="space-y-3">
            {[
              { step: "1", text: "Partagez votre code ou lien unique à vos amis", icon: "📤" },
              { step: "2", text: "Votre ami s'inscrit sur BAOBAB INVEST avec votre code", icon: "👤" },
              { step: "3", text: `Vous recevez automatiquement ${(data?.bonusPerReferral || 2500).toLocaleString()} FCFA sur votre wallet`, icon: "💰" },
              { step: "4", text: "Pas de limite — parrainez autant d'amis que vous voulez !", icon: "🚀" },
            ].map(s => (
              <div key={s.step} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 text-green-700 font-bold rounded-full flex items-center justify-center text-sm flex-shrink-0">{s.step}</div>
                <div className="text-sm text-gray-600">{s.icon} {s.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Appliquer un code */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-3">🎁 Vous avez un code parrain ?</h3>
          {msg && <div className={`text-sm rounded-xl p-3 mb-3 ${msg.startsWith("✅") ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{msg}</div>}
          <div className="flex gap-2">
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="Ex: BAOBAB-AMAD-UOQ64"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400 uppercase"
            />
            <button onClick={applyCode} disabled={applying || !code}
              className="bg-blue-600 text-white font-bold px-4 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 text-sm">
              {applying ? "..." : "Appliquer"}
            </button>
          </div>
        </div>

        {/* Mes filleuls */}
        {data?.referrals?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-3">👥 Mes filleuls ({data.referrals.length})</h3>
            <div className="space-y-2">
              {data.referrals.map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="text-sm font-medium text-gray-900">{r.firstName}</div>
                  <div className="text-xs text-gray-400">
                    Inscrit le {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
