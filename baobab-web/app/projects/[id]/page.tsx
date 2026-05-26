"use client";
const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ShareButtons from "@/components/ShareButtons";

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  LOW:    { label: "Risque Faible",  color: "text-green-700",  bg: "bg-green-100" },
  MEDIUM: { label: "Risque Modéré",  color: "text-yellow-700", bg: "bg-yellow-100" },
  HIGH:   { label: "Risque Élevé",   color: "text-red-700",    bg: "bg-red-100" },
};

export default function ProjectDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [simAmount, setSimAmount] = useState("");
  const [simResult, setSimResult] = useState<any>(null);
  const [investing, setInvesting] = useState(false);
  const [investAmount, setInvestAmount] = useState("");
  const [withInsurance, setWithInsurance] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const { config: fees } = usePlatformConfig();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) { try { setUserRole(JSON.parse(stored).role); } catch {} }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects/${id}`)
      .then(r => r.json())
      .then(d => { if (d.success) setProject(d.data); })
      .finally(() => setLoading(false));
  }, [id]);

  const simulate = async () => {
    if (!simAmount || Number(simAmount) < 500) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects/${id}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(simAmount), withInsurance }),
    });
    const data = await res.json();
    if (data.success) setSimResult(data.data);
  };

  const invest = async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/auth/login"); return; }
    const minInvest = project?.minimumInvestment || 5000;
    const remaining = project?.goalAmount - project?.raisedAmount;
    if (!investAmount || Number(investAmount) < minInvest) {
      setMessage(`❌ Investissement minimum : ${minInvest.toLocaleString()} FCFA`);
      return;
    }
    if (Number(investAmount) > remaining) {
      setMessage(`❌ Montant trop élevé. Il reste ${remaining.toLocaleString()} FCFA à lever.`);
      return;
    }
    setInvesting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/investments/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: Number(investAmount), withInsurance }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage("✅ Investissement réussi ! 🌳");
        setTimeout(() => router.push("/dashboard"), 2000);
      } else {
        setMessage(`❌ ${data.message}`);
      }
    } finally { setInvesting(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl animate-bounce mb-4">🌳</div>
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <p className="text-gray-700 font-bold">Projet introuvable</p>
          <Link href="/projects" className="text-green-600 mt-4 block">← Retour au catalogue</Link>
        </div>
      </div>
    );
  }

  const risk = RISK_CONFIG[project.riskLevel] || RISK_CONFIG.MEDIUM;
  const fundingPercent = Math.min(Math.round((project.raisedAmount / project.goalAmount) * 100), 100);
  const remaining = Math.max(project.goalAmount - project.raisedAmount, 0);
  const isCollecteClosed = ["FUNDED", "IN_PROGRESS", "COMPLETED"].includes(project.status) || remaining === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4 overflow-hidden">
          <Link href="/projects" className="text-gray-400 hover:text-green-600 transition-colors flex-shrink-0">← Catalogue</Link>
          <span className="text-gray-200 flex-shrink-0">|</span>
          <span className="text-gray-700 font-medium truncate min-w-0 flex-1">{project.title}</span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8 overflow-hidden">
        <div className="grid lg:grid-cols-3 gap-8">

          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-6">

            {/* Header projet */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${risk.bg} ${risk.color}`}>
                      {risk.label}
                    </span>
                    <span className="text-xs text-gray-400">{project.sector}</span>
                    <span className="text-xs text-gray-400">📍 {project.city}</span>
                    {isCollecteClosed && (
                      <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">
                        🎉 Collecte clôturée
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2 overflow-hidden w-full" style={{wordBreak:"break-all", overflowWrap:"anywhere"}}>{project.title}</h1>
                  <p className="text-gray-600 text-sm leading-relaxed" style={{overflowWrap:"break-word", wordBreak:"break-word", whiteSpace:"pre-wrap"}}>{project.description}</p>
                  {project.useOfFunds && (
                    <div className="mt-4 bg-blue-50 border border-blue-100 rounded-2xl p-4">
                      <div className="font-semibold text-blue-900 text-sm mb-2">💡 Utilisation des fonds</div>
                      <p className="text-blue-800 text-sm leading-relaxed" style={{whiteSpace:"pre-wrap"}}>{project.useOfFunds}</p>
                    </div>
                  )}
                </div>
              </div>

              {project.pitchVideoUrl && (
                <div className="rounded-2xl overflow-hidden bg-black mb-4 shadow-lg">
                  {project.pitchVideoUrl.includes('cloudinary') ? (
                    <div>
                      <div className="relative flex items-center justify-center bg-black"
                        style={{ maxHeight: "520px" }}>
                        <video
                          src={project.pitchVideoUrl}
                          controls
                          controlsList="nodownload"
                          playsInline
                          style={{
                            maxHeight: "520px",
                            maxWidth: "100%",
                            width: "auto",
                            height: "auto",
                            display: "block",
                            margin: "0 auto",
                            background: "#000"
                          }}
                        />
                      </div>
                      <div className="bg-gray-900 px-4 py-2.5 flex items-center justify-between">
                        <span className="text-xs text-green-400 font-medium">🎬 Pitch vidéo de l&apos;entrepreneur</span>
                        <span className="text-xs text-gray-500">Stocké définitivement par BAOBAB INVEST 🔒</span>
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                      <iframe
                        src={project.pitchVideoUrl.replace("watch?v=", "embed/")}
                        className="absolute inset-0 w-full h-full"
                        allowFullScreen
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Jauge */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-green-600">{project.raisedAmount?.toLocaleString()} FCFA levés</span>
                  <span className="text-gray-500">sur {project.goalAmount?.toLocaleString()} FCFA</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${fundingPercent}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{project.investorCount || 0} investisseur(s)</span>
                  <span className="font-bold text-green-600">{fundingPercent}%</span>
                </div>
                {!isCollecteClosed && remaining > 0 && (
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-orange-600 font-medium">
                      ⏳ Il reste <strong>{remaining.toLocaleString()} FCFA</strong> à lever
                    </span>
                    {project.campaignEndsAt && (
                      <span className="text-gray-400">
                        📅 Clôture le {new Date(project.campaignEndsAt).toLocaleDateString("fr-FR", {day:"numeric", month:"long"})}
                      </span>
                    )}
                  </div>
                )}
                {isCollecteClosed && (
                  <div className="mt-2 bg-green-100 text-green-800 text-xs font-bold text-center py-1.5 rounded-lg">
                    🎉 Objectif atteint ! Collecte clôturée.
                  </div>
                )}
              </div>
            </div>

            {/* Onglets */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex border-b border-gray-100">
                {["overview", "milestones", "funds", "entrepreneur"].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === tab ? "bg-green-50 text-green-700 border-b-2 border-green-500" : "text-gray-500 hover:text-gray-700"}`}>
                    {tab === "overview" ? "📋 Présentation" : tab === "milestones" ? "🏗️ Jalons" : tab === "funds" ? "💰 Fonds" : "👤 Entrepreneur"}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: "Retour attendu", value: `+${project.expectedReturn}%`, icon: "📈" },
                        { label: "Durée", value: `${project.durationMonths} mois`, icon: "⏱️" },
                        { label: "Investissement min.", value: `${(project.minimumInvestment || 5000).toLocaleString()} FCFA`, icon: "💰" },
                        { label: "Score bankabilité", value: `${project.bankabilityScore || 0}/100`, icon: "🏆" },
                      ].map(item => (
                        <div key={item.label} className="bg-gray-50 rounded-xl p-4">
                          <div className="text-xl mb-1">{item.icon}</div>
                          <div className="font-bold text-gray-900">{item.value}</div>
                          <div className="text-xs text-gray-400">{item.label}</div>
                        </div>
                      ))}
                    </div>
                    {project.mentor && (
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <div className="text-xs font-semibold text-blue-700 mb-2">🎓 Mentoré par</div>
                        <div className="font-medium text-blue-900">{project.mentor.firstName} {project.mentor.lastName}</div>
                        <div className="text-xs text-blue-600">Score réputation : {project.mentor.reputationScore}/100</div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "milestones" && (
                  <div className="space-y-3">
                    {(!project.milestones || project.milestones.length === 0) ? (
                      <div className="text-center py-8 text-gray-400">
                        <div className="text-4xl mb-2">🏗️</div>
                        <p>Aucun jalon défini pour l&apos;instant</p>
                      </div>
                    ) : project.milestones.map((m: any, i: number) => (
                      <div key={m.id} className={`flex items-center gap-3 p-4 rounded-xl border ${m.status === "APPROVED" ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-100"}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${m.status === "APPROVED" ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600"}`}>
                          {m.status === "APPROVED" ? "✓" : i + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 text-sm">{m.title}</div>
                          <div className="text-xs text-gray-500">{m.description}</div>
                        </div>
                        <div className="font-bold text-green-700 text-sm">{m.amount?.toLocaleString()} FCFA</div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "funds" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-green-50 rounded-xl p-3 text-center">
                        <div className="font-bold text-green-700">{(project.raisedAmount||0).toLocaleString()} FCFA</div>
                        <div className="text-xs text-gray-500">Total levé</div>
                      </div>
                      <div className="bg-orange-50 rounded-xl p-3 text-center">
                        <div className="font-bold text-orange-700">
                          {(project.milestones?.filter((m:any)=>['APPROVED','PAID'].includes(m.status)).reduce((s:number,m:any)=>s+m.amount,0)||0).toLocaleString()} FCFA
                        </div>
                        <div className="text-xs text-gray-500">Déjà utilisé</div>
                      </div>
                    </div>
                    {(!project.milestones || project.milestones.length === 0) ? (
                      <div className="text-center py-8 text-gray-400">
                        <div className="text-3xl mb-2">🏗️</div>
                        <p className="text-sm">Aucun jalon défini pour l&apos;instant</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {project.milestones.map((m:any, i:number) => (
                          <div key={m.id} className={`p-4 rounded-xl border ${
                            m.status==='PAID'||m.status==='APPROVED' ? 'bg-green-50 border-green-200' :
                            m.status==='SUBMITTED' ? 'bg-blue-50 border-blue-200' :
                            m.status==='REJECTED' ? 'bg-red-50 border-red-200' :
                            'bg-gray-50 border-gray-100'
                          }`}>
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 text-sm">{i+1}. {m.title}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{m.description}</div>
                                {m.supplier && <div className="text-xs text-blue-600 mt-1">🏪 Fournisseur : {m.supplier.companyName}</div>}
                              </div>
                              <div className="text-right ml-3">
                                <div className="font-bold text-sm">{(m.amount||0).toLocaleString()} FCFA</div>
                                <div className={`text-xs mt-1 font-medium ${
                                  m.status==='PAID'||m.status==='APPROVED' ? 'text-green-600' :
                                  m.status==='SUBMITTED' ? 'text-blue-600' :
                                  m.status==='REJECTED' ? 'text-red-600' : 'text-gray-400'
                                }`}>
                                  {m.status==='PAID'||m.status==='APPROVED' ? '✅ Validé' :
                                   m.status==='SUBMITTED' ? '⏳ En attente' :
                                   m.status==='REJECTED' ? '❌ Rejeté' : '📋 Prévu'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "entrepreneur" && project.entrepreneur && (
                  <div>
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-xl font-bold text-green-700 flex-shrink-0">
                        {project.entrepreneur.firstName[0]}{project.entrepreneur.lastName[0]}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-gray-900 text-lg">{project.entrepreneur.firstName} {project.entrepreneur.lastName}</div>
                        <div className="text-sm text-gray-500">📍 {project.entrepreneur.city}</div>
                        <div className="text-sm text-green-600 font-medium mt-1">Score réputation : {project.entrepreneur.reputationScore}/100</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/messages?to=${project.entrepreneur.id}&project=${project.id}`}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors text-center">
                        💬 Contacter l&apos;entrepreneur
                      </Link>
                      <Link href={`/auth/profile/${project.entrepreneur.id}`}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors">
                        👤 Profil
                      </Link>
                    </div>
                    <div className="mt-2 text-xs text-gray-400 text-center">
                      ⚠️ Conversations modérées par BAOBAB INVEST
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Colonne latérale */}
          <div className="space-y-5">

            {/* Bloc investissement */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              {isCollecteClosed ? (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">🎉</div>
                  <h3 className="font-bold text-gray-900 mb-2">Collecte clôturée !</h3>
                  <p className="text-gray-500 text-sm">
                    {project.status === "COMPLETED"
                      ? "Ce projet est terminé et les investisseurs ont été remboursés."
                      : "L'objectif a été atteint. Le projet est en cours de réalisation."}
                  </p>
                  <div className="mt-3 bg-green-50 rounded-xl p-3 text-sm text-green-700 font-medium">
                    ✅ {project.raisedAmount?.toLocaleString()} FCFA levés
                  </div>
                  <Link href="/projects" className="mt-3 block text-xs text-green-600 hover:underline">
                    Voir d&apos;autres projets →
                  </Link>
                </div>
              ) : userRole === "INVESTOR" || !userRole ? (
                <>
                  <h3 className="font-bold text-gray-900 mb-4">💰 Investir dans ce projet</h3>
                  {message && (
                    <div className={`text-sm p-3 rounded-xl font-medium mb-3 ${message.startsWith("✅") ? "bg-green-50 text-green-700 text-center" : "bg-red-50 text-red-700"}`}>
                      {message}
                      {message.includes("insuffisant") && (
                        <div className="mt-2 flex gap-2">
                          <a href="/wallet/deposit" className="flex-1 text-center bg-green-600 text-white text-xs font-bold py-2 rounded-xl hover:bg-green-700">
                            💳 Déposer de l&apos;argent
                          </a>
                          <a href="/wallet" className="flex-1 text-center border border-red-200 text-red-600 text-xs font-medium py-2 rounded-xl hover:bg-red-50">
                            👛 Mon wallet
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Montant (FCFA)</label>
                      <input
                        type="number"
                        value={investAmount}
                        onChange={e => {
                          const val = Number(e.target.value);
                          if (val > remaining) {
                            setInvestAmount(String(remaining));
                            setMessage(`⚠️ Ajusté au maximum : ${remaining.toLocaleString()} FCFA`);
                          } else {
                            setInvestAmount(e.target.value);
                            if (message.startsWith("⚠️")) setMessage("");
                          }
                        }}
                        placeholder={`Min. ${(project.minimumInvestment || 5000).toLocaleString()} — Max. ${remaining.toLocaleString()} FCFA`}
                        className="input-field"
                        min={project.minimumInvestment || 5000}
                        max={remaining}
                      />
                      <div className="text-xs text-orange-600 font-medium mt-1">
                        💡 Il reste {remaining.toLocaleString()} FCFA à lever
                      </div>
                    </div>

                    {investAmount && Number(investAmount) >= (project?.minimumInvestment || 5000) && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-xs">
                        <div className="font-semibold text-gray-700 mb-2">📊 Décomposition</div>
                        {project.mentor ? (
                          <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 mb-2 text-purple-700 text-xs">
                            🎓 Mentoré — commission mentor {fees.commission_mentor}% incluse
                          </div>
                        ) : (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-2 mb-2 text-green-700 text-xs">
                            ✅ Sans mentor — {fees.commission_mentor}% bonus pour vous !
                          </div>
                        )}
                        {/* Case assurance — optionnelle, décochée par défaut */}
                        <div className={`rounded-lg p-3 border-2 cursor-pointer transition-all ${withInsurance ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-gray-50'}`}
                          onClick={() => setWithInsurance(!withInsurance)}>
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${withInsurance ? 'bg-green-500 border-green-500' : 'border-gray-400'}`}>
                              {withInsurance && <span className="text-white text-xs font-bold">✓</span>}
                            </div>
                            <div>
                              <span className="font-semibold text-gray-800 text-xs">🛡️ Assurance capital +2% — Optionnelle</span>
                              <p className="text-xs text-gray-500 mt-0.5">Protège votre capital en cas de défaillance du projet</p>
                            </div>
                          </div>
                          {!withInsurance && (
                            <p className="text-xs text-orange-600 mt-1.5 ml-7">
                              ⚠️ Sans assurance — en cas d'échec du projet, votre capital n'est pas remboursé.
                            </p>
                          )}
                        </div>
                        {/* Décomposition — modèle financier correct */}
                        {(() => {
                          const amt = Number(investAmount)
                          const guarPct   = fees.commission_guarantee || 2
                          const payinRepayPct = fees.payin_repayment || 4
                          const returnRate = project.expectedReturn || 24

                          // Modèle correct :
                          // frais fixes dans la cagnotte = BAOBAB(6%) + payin(4%) + mentor(2% si actif)
                          // Assurance = addon individuel HORS cagnotte
                          const fraisFixesPct = (fees.commission_baobab_collection || 6)
                            + (fees.payin_recovery || 4)
                            + (project.mentor ? (fees.commission_mentor || 2) : 0)

                          // sharePercent = part de l'investisseur dans la cagnotte
                          const sharePercent = amt / project.goalAmount

                          // netAmount = ce que l'entrepreneur reçoit réellement
                          const netAmount = Math.round(project.goalAmount * (1 - fraisFixesPct / 100))

                          // Remboursement total → payin prélevé → distribué aux investisseurs
                          const totalReturn    = Math.round(netAmount * (1 + returnRate / 100))
                          const payinRepay     = Math.round(totalReturn * payinRepayPct / 100)
                          const netDistributed = totalReturn - payinRepay

                          // Retour investisseur (sans assurance)
                          const investorReturn = Math.round(netDistributed * sharePercent)

                          // Assurance = addon : si prise, investisseur paie amt + guarFee
                          // Le projet progresse toujours de amt (inchangé)
                          // Le retour reste identique
                          // Assurance = coût additionnel
                          // Sans assurance → même retour brut, gain net supérieur car coût total moindre
                          const guarFee  = withInsurance ? Math.round(amt * guarPct / 100) : 0
                          const totalPaid = amt + guarFee
                          const gain    = investorReturn - totalPaid
                          const gainPct = ((gain / totalPaid) * 100).toFixed(1)
                          const gainNoIns    = investorReturn - amt
                          const gainPctNoIns = ((gainNoIns / amt) * 100).toFixed(1)

                          return (
                            <div className="space-y-2">
                              {/* Ce que l'investisseur paie */}
                              <div className="flex justify-between text-gray-700 font-medium">
                                <span>💰 Vous investissez</span>
                                <span className="font-bold">{fmt(amt)} FCFA</span>
                              </div>
                              {withInsurance && (
                                <div className="flex justify-between text-orange-600 text-xs">
                                  <span>🛡️ Assurance capital ({guarPct}%) — addon</span>
                                  <span>+{fmt(guarFee)} FCFA</span>
                                </div>
                              )}
                              {withInsurance && (
                                <div className="space-y-1">
                                  <div className="flex justify-between text-gray-500 text-xs border-b border-gray-100 pb-2">
                                    <span>Total débité de votre wallet</span>
                                    <span className="font-bold">{fmt(totalPaid)} FCFA</span>
                                  </div>
                                  <div className="text-xs text-orange-600 bg-orange-50 rounded p-1.5">
                                    🛡️ En cas d'échec du projet, vous êtes remboursé de votre perte nette
                                    dans la limite de 80% et du solde du fonds de garantie.
                                  </div>
                                </div>
                              )}
                              {/* Progression cagnotte — toujours = amt */}
                              <div className="flex justify-between text-blue-600 text-xs">
                                <span>📊 Progression cagnotte</span>
                                <span className="font-bold">+{fmt(amt)} FCFA ({(sharePercent * 100).toFixed(2)}%)</span>
                              </div>
                              {/* Retour */}
                              <div className="flex justify-between text-green-600 font-bold text-sm border-t border-green-200 pt-2">
                                <span>✅ Vous récupérez ({project.durationMonths} mois)</span>
                                <span>{fmt(investorReturn)} FCFA</span>
                              </div>
                              <div className={`flex justify-between font-bold text-base pt-1 border-t-2 ${gain >= 0 ? 'text-green-700 border-green-200' : 'text-red-600 border-red-200'}`}>
                                <span>Gain net</span>
                                <span>{gain >= 0 ? '+' : ''}{fmt(gain)} FCFA ({gainPct}%)</span>
                              </div>
                              {!withInsurance && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-2 mt-1">
                                  <div className="flex justify-between text-green-700 font-bold text-sm">
                                    <span>💰 Gain sans assurance</span>
                                    <span>+{fmt(gainNoIns)} FCFA ({gainPctNoIns}%)</span>
                                  </div>
                                  <div className="text-xs text-green-600 mt-0.5">
                                    Vous économisez {fmt(guarFee === 0 ? Math.round(amt * guarPct / 100) : guarFee)} FCFA (pas d'assurance)
                                    ⚠️ Capital non protégé en cas d'échec du projet
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                        <div className="text-gray-400 mt-2 text-xs">
                          💡 Dépôt wallet crédité 100% — BAOBAB absorbe les frais opérateur.
                        </div>
                      </div>
                    )}

                    <button onClick={invest} disabled={investing || !investAmount}
                      className="btn-primary w-full disabled:opacity-50">
                      {investing ? "En cours..." : "🚀 Investir maintenant"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4 text-gray-400 text-sm">
                  Connectez-vous en tant qu&apos;investisseur pour investir
                </div>
              )}
            </div>

            {/* Simulateur */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">🧮 Simuler mon retour</h3>
              <div className="flex gap-2 mb-3">
                <input type="number" value={simAmount} onChange={e => setSimAmount(e.target.value)}
                  placeholder="Montant FCFA" className="input-field flex-1" min="5000" />
                <button onClick={simulate} className="btn-secondary px-4 text-sm">Calculer</button>
              </div>
              {simResult && (
                <div className="bg-blue-50 rounded-xl p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Investi</span>
                    <span className="font-bold">{(simResult.invested || simResult.netAmount)?.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Commission BAOBAB ({simResult.returnRate})</span>
                    <span className="text-red-500">-{(simResult.baobabOnReturn || simResult.platformFee)?.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">PayDunya (absorbé BAOBAB)</span>
                    <span className="text-red-500">-{simResult.paydunyaPayout?.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between border-t border-blue-200 pt-1">
                    <span className="font-bold text-gray-900">Vous recevez</span>
                    <span className="font-bold text-green-700">{(simResult.netReceived || simResult.totalReturn)?.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Gain net</span>
                    <span className="text-xs text-green-600 font-bold">
                      +{((simResult.netReceived || 0) - (simResult.invested || 0))?.toLocaleString()} FCFA
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Partage */}
            <ShareButtons
              title={project.title}
              returnRate={project.expectedReturn}
              amount={project.minimumInvestment || 5000}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
