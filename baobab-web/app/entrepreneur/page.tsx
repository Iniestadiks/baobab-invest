"use client";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import React from "react";
import { useRequireRole } from "@/hooks/useRequireRole";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authGet, authPost } from "@/lib/api";
import EntrepreneurCharts from "./charts";

const LEVEL_NAMES = ["", "🌱 Graine", "🌿 Pousse", "🌳 Baobab", "🏅 Grand Baobab"];
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:          { label: "Brouillon",     color: "text-gray-600",   bg: "bg-gray-100" },
  PENDING_REVIEW: { label: "En validation", color: "text-orange-700", bg: "bg-orange-100" },
  ACTIVE:         { label: "En ligne",      color: "text-green-700",  bg: "bg-green-100" },
  FUNDED:         { label: "Financé",       color: "text-blue-700",   bg: "bg-blue-100" },
  IN_PROGRESS:    { label: "En cours",      color: "text-purple-700", bg: "bg-purple-100" },
  COMPLETED:      { label: "Terminé",       color: "text-green-700",  bg: "bg-green-100" },
  FAILED:         { label: "Échoué",        color: "text-red-700",    bg: "bg-red-100" },
  CANCELLED:      { label: "Annulé",        color: "text-gray-600",   bg: "bg-gray-100" },
};
const COUNTRY_FLAGS: Record<string, string> = { SN:"🇸🇳", CI:"🇨🇮", CM:"🇨🇲", ML:"🇲🇱", BF:"🇧🇫", GN:"🇬🇳" };

export default function EntrepreneurDashboard() {
  const router = useRouter();
  useRequireRole(["ENTREPRENEUR"]);
  const [user, setUser] = useState<any>(null);
  const { fees } = usePlatformConfig();
  const [projects, setProjects] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<Record<string, any>>({});
  const [wallet, setWallet] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [selectedProjectInvestors, setSelectedProjectInvestors] = useState<any>(null);
  const [loadingInvestors, setLoadingInvestors] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const [notifCollapsed, setNotifCollapsed] = useState(false);
  const [showAllNotifs, setShowAllNotifs] = useState(false);
  const [flashMsg, setFlashMsg] = useState("");
  const flash = (msg: string) => { setFlashMsg(msg); setTimeout(() => setFlashMsg(""), 4000); };
  const loadData = async () => {
    const [me, proj, notif] = await Promise.all([
      authGet("/api/auth/me"),
      authGet("/api/projects/my/projects"),
      authGet("/api/notifications"),
    ]);
    if (me.success) { setUser(me.data); setWallet(me.data.wallet); }
    if (proj.success) {
      setProjects(proj.data || []);
      const funded = (proj.data || []).filter((p: any) => ["FUNDED","IN_PROGRESS","COMPLETED"].includes(p.status));
      const schedMap: any = {};
      for (const fp of funded) {
        const s = await authGet("/api/repayment/my/" + fp.id);
        if (s.success && s.data) schedMap[fp.id] = s.data;
      }
      setSchedules(schedMap);
    }
    if (notif.success) { setNotifications(notif.data.notifications?.slice(0, 5) || []); setUnread(notif.data.unreadCount || 0); }
  };

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const stored = localStorage.getItem("user");
    if (!token || !stored) { router.push("/auth/login"); return; }
    const u = JSON.parse(stored);
    if (u.role !== "ENTREPRENEUR") { router.push("/dashboard"); return; }
    Promise.all([
      authGet("/api/auth/me"),
      authGet("/api/projects/my/projects"),
      authGet("/api/notifications"),
    ]).then(async ([me, proj, notif]) => {
      if (me.success) {
        setUser(me.data);
        setWallet(me.data.wallet);
        localStorage.setItem("user", JSON.stringify(me.data));
      }
      if (proj.success) {
        setProjects(proj.data || []);
        // Charger échéanciers pour projets FUNDED/IN_PROGRESS
        const funded = (proj.data || []).filter((p: any) => ['FUNDED','IN_PROGRESS','COMPLETED'].includes(p.status));
        const schedMap: any = {};
        for (const fp of funded) {
          const s = await authGet("/api/repayment/my/" + fp.id);
          if (s.success && s.data) schedMap[fp.id] = s.data;
        }
        setSchedules(schedMap);
      }
      if (notif.success) {
        setNotifications(notif.data.notifications?.slice(0, 5) || []);
        setUnread(notif.data.unreadCount || 0);
      }
    }).finally(() => setLoading(false));
  }, [router]);

  const logout = () => { localStorage.clear(); router.push("/"); };

  const viewInvestors = async (projectId: string) => {
    setLoadingInvestors(true);
    const data = await authGet(`/api/projects/${projectId}/investors`);
    if (data.success) setSelectedProjectInvestors(data.data);
    setLoadingInvestors(false);
  };

  const [publishingReport, setPublishingReport] = React.useState<string | null>(null);
  const [reportText, setReportText] = React.useState<Record<string, string>>({});

  const publishReport = async (projectId: string) => {
    const text = reportText[projectId];
    if (!text || text.trim().length < 20) { flash("Message trop court (min 20 car.)"); return; }
    setPublishingReport(projectId);
    try {
      const res = await authPost(`/api/feed/project/${projectId}`, { content: text, type: "UPDATE" });
      if (res.success) { flash("Rapport publie ! Compteur 21j remis a zero."); setReportText(prev => ({ ...prev, [projectId]: "" })); }
      else flash("Erreur: " + res.message);
    } finally { setPublishingReport(null); }
  };

  const exportCSV = () => {
    const token = localStorage.getItem("accessToken");
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/exports/entrepreneur`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob()).then(blob => {
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "mes-projets.csv"; a.click(); URL.revokeObjectURL(a.href);
      });
  };

  const downloadPDF = async (url: string, filename: string) => {
    const token = localStorage.getItem("accessToken");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { alert("Erreur PDF"); return; }
      const blob = await res.blob();
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
    } catch { alert("Erreur"); }
  };


  const getNotifLink = (n: any) => {
    if (n.type === "MILESTONE_APPROVED" || n.type === "MILESTONE_REJECTED")
      return n.data?.projectId ? `/entrepreneur/milestones/${n.data.projectId}` : "/entrepreneur";
    if (n.type === "FEED_UPDATE")
      return n.data?.projectId ? `/feed/${n.data.projectId}` : "/entrepreneur";
    if (n.type === "MESSAGE")
      return n.data?.fromUserId ? `/messages?to=${n.data.fromUserId}` : "/messages";
    if (n.type === "INVESTMENT")
      return `/entrepreneur`;
    if (n.type === "MENTOR_ACCEPTED" || n.type === "MENTOR_DECLINED")
      return n.data?.projectId ? `/entrepreneur/milestones/${n.data.projectId}` : "/entrepreneur";
    return "/entrepreneur";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-5xl animate-bounce mb-4">🚀</div>
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  const totalRaisedBrut = projects.reduce((s, p) => s + (p.raisedAmount || 0), 0);
  // Cagnotte nette = levé brut - frais BAOBAB 5% - frais mentor 2% - frais garantie 2%
  const fraisTaux = (fees?.commission_baobab_collection || 5) + (fees?.commission_mentor || 2) + (fees?.commission_guarantee || 2); // 9% par défaut
  const totalRaised = Math.round(totalRaisedBrut * (1 - fraisTaux / 100));
  const totalDepense = projects.reduce((s, p) =>
    s + (p.milestones?.filter((m:any) => ['APPROVED','PAID'].includes(m.status)).reduce((ms:number, m:any) => ms + m.amount, 0) || 0), 0);
  const totalDisponible = totalRaised - projects.reduce((s, p) =>
    s + (p.milestones?.filter((m:any) => !['REJECTED'].includes(m.status)).reduce((ms:number, m:any) => ms + m.amount, 0) || 0), 0);
  const totalInvestors = projects.reduce((s, p) => s + (p.investorCount || 0), 0);
  const activeProjects = projects.filter(p => p.status === "ACTIVE").length;
  const visibleProjects = projects.filter(p => p.status !== "CANCELLED");

  return (
    <div className="min-h-screen bg-gray-50">
      {flashMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-xl text-sm font-medium animate-bounce">
          {flashMsg}
        </div>
      )}
      {user?.kycStatus !== "VERIFIED" && (
        <div className="bg-orange-50 border border-orange-300 rounded-2xl p-4 mx-6 mt-4 flex items-center justify-between">
          <div>
            <div className="font-bold text-orange-800 text-sm">⚠️ KYC non vérifié</div>
            <div className="text-xs text-orange-700 mt-0.5">
              {user?.kycStatus === "REJECTED"
                ? "Votre KYC a été rejeté. Soumettez de nouveaux documents."
                : user?.kycStatus === "PENDING" ? "Vos documents sont en cours de vérification (24h ouvrées)." : user?.kycStatus === "PENDING" ? "Vos documents sont en cours de vérification (24h ouvrées)." : "Soumettez vos documents d'identité pour pouvoir publier un projet."}
            </div>
          </div>
          <a href="/kyc" className="bg-orange-500 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-orange-600 whitespace-nowrap ml-4">
            {user?.kycStatus === "REJECTED" ? "🔄 Resoumettre" : user?.kycStatus === "PENDING" ? "⏳ KYC en cours..." : user?.kycStatus === "PENDING" ? "⏳ KYC en cours..." : "📄 Vérifier mon identité"}
          </a>
        </div>
      )}
      {selectedProjectInvestors && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <div>
                <h3 className="font-bold text-gray-900">👥 Mes Investisseurs</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedProjectInvestors.stats.totalInvestors} investisseur(s) —{" "}
                  {selectedProjectInvestors.stats.totalRaised.toLocaleString()} FCFA
                </p>
              </div>
              <button
                onClick={() => setSelectedProjectInvestors(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 p-5 border-b border-gray-100">
              {[
                { label: "Investisseurs", value: selectedProjectInvestors.stats.totalInvestors, color: "text-blue-700", bg: "bg-blue-50" },
                { label: "Total levé", value: `${selectedProjectInvestors.stats.totalRaised.toLocaleString()} FCFA`, color: "text-green-700", bg: "bg-green-50" },
                { label: "Moy./invest.", value: `${selectedProjectInvestors.stats.averageInvestment.toLocaleString()} FCFA`, color: "text-purple-700", bg: "bg-purple-50" },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                  <div className={`font-bold text-sm ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
            {/* Message groupé */}
            {selectedProjectInvestors.investments.length > 0 && (
              <div className="p-5 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-600 mb-2">📢 Message groupé à tous les investisseurs</p>
                <textarea
                  id="broadcastInput"
                  placeholder="Ex: Bonjour, voici une mise à jour de mon projet..."
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none"
                  rows={2}
                />
                <button
                  onClick={async () => {
                    const msg = (document.getElementById('broadcastInput') as HTMLTextAreaElement)?.value;
                    if (!msg || msg.length < 10) { alert('Message trop court'); return; }
                    const { authPost } = await import('@/lib/api');
                    const res = await authPost(`/api/messages/broadcast/${selectedProjectInvestors.projectId}`, { content: msg });
                    if (res.success) { alert(`✅ Envoyé à ${res.data.sentTo} investisseur(s) !`); }
                    else { alert('❌ ' + res.message); }
                  }}
                  className="mt-2 w-full bg-blue-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-blue-700"
                >
                  📢 Envoyer à {selectedProjectInvestors.stats.totalInvestors} investisseur(s)
                </button>
                <p className="text-xs text-gray-400 mt-1 text-center">Limite : 1 message par semaine par projet</p>
              </div>
            )}
            <div className="p-5 space-y-3">
              {selectedProjectInvestors.investments.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-2">🌱</div>
                  <p>Aucun investisseur</p>
                </div>
              ) : (
                selectedProjectInvestors.investments.map((inv: any) => (
                  <div key={inv.id} className="bg-gray-50 rounded-xl p-4 space-y-3">
                    {/* Ligne principale */}
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 flex-shrink-0 text-sm">
                        {inv.user.firstName[0]}{inv.user.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 text-sm">
                          {inv.user.firstName} {inv.user.lastName}
                          <span className="ml-1 text-xs">{COUNTRY_FLAGS[inv.user.country] || ""}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {LEVEL_NAMES[inv.user.level]}{inv.user.city ? ` · ${inv.user.city}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-700 text-sm">{inv.amount.toLocaleString()} FCFA</div>
                        <div className="text-xs text-gray-400">
                          {new Date(inv.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        </div>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-2">
                      <Link
                        href={`/messages?to=${inv.user.id}`}
                        className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-lg transition-colors"
                      >
                        💬 Envoyer un message
                      </Link>
                      <Link
                        href={`/auth/profile/${inv.user.id}`}
                        className="flex-1 text-center bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold py-2 rounded-lg transition-colors"
                      >
                        👤 Voir le profil
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🌳</span>
            <span className="font-bold text-green-600">BAOBAB INVEST</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-medium hidden md:block">
              🚀 Entrepreneur
            </span>
            <Link href="/profile" className="text-sm text-gray-600 hover:text-green-600">Mon profil</Link>
            <Link href="/notifications" className="relative group inline-block">
              <span className={`text-2xl inline-block transition-all duration-200 ${unread > 0 ? "animate-bounce" : "group-hover:scale-110 group-hover:rotate-12"}`}>🔔</span>
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse shadow-lg">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <button onClick={logout} className="text-sm text-gray-400 hover:text-red-500 transition-colors">
              Déconnexion
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bonjour, {user?.firstName} 👋</h1>
            <p className="text-gray-500 text-sm mt-1">
              Entrepreneur · {user?.kycStatus === "VERIFIED" ? "✅ KYC Vérifié" : "⏳ KYC en attente"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="text-xs border border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600 px-3 py-2 rounded-xl hidden sm:block">
              📥 CSV
            </button>
            <Link href="/projects/submit" className="btn-primary">+ Soumettre un projet</Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Projets soumis", value: visibleProjects.length, icon: "📋", bg: "bg-blue-50", color: "text-blue-700" },
            { label: "Fonds dépensés", value: `${totalDepense.toLocaleString()} FCFA`, icon: "🏗️", bg: "bg-orange-50", color: "text-orange-700" },
            { label: "Disponible", value: `${Math.max(totalDisponible,0).toLocaleString()} FCFA`, icon: "💳", bg: "bg-purple-50", color: "text-purple-700" },
            { label: "Projets actifs", value: activeProjects, icon: "🟢", bg: "bg-green-50", color: "text-green-700" },
            { label: "Total levé", value: `${totalRaised.toLocaleString()} FCFA`, icon: "💰", bg: "bg-yellow-50", color: "text-yellow-700" },
            { label: "Investisseurs", value: totalInvestors, icon: "👥", bg: "bg-purple-50", color: "text-purple-700" },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-5`}>
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* WALLET HERO + REMBOURSEMENTS EN COURS */}
        {(Object.keys(schedules).length > 0 || true) && (
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {/* Wallet card */}
            <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-2xl p-5 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10"></div>
              <div className="text-xs font-medium text-green-200 mb-1">Mon Wallet</div>
              <div className="text-3xl font-bold mb-1">{(wallet?.balance || 0).toLocaleString()} FCFA</div>
              <div className="text-xs text-green-200">Solde disponible</div>
              <Link href="/wallet/deposit" className="mt-3 inline-block bg-white text-green-700 text-xs font-bold px-4 py-2 rounded-xl hover:bg-green-50">
                + Recharger
              </Link>
            </div>
            {/* Score réputation */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-xs text-gray-500 mb-2">⭐ Score Réputation</div>
              <div className="flex items-end gap-2 mb-2">
                <div className={`text-4xl font-bold ${(user?.reputationScore||0) >= 70 ? 'text-green-600' : (user?.reputationScore||0) >= 40 ? 'text-orange-500' : 'text-red-500'}`}>
                  {user?.reputationScore || 0}
                </div>
                <div className="text-gray-400 text-sm mb-1">/ 100</div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                <div className={`h-2 rounded-full ${(user?.reputationScore||0) >= 70 ? 'bg-green-500' : (user?.reputationScore||0) >= 40 ? 'bg-orange-400' : 'bg-red-400'}`}
                  style={{width: Math.max(0, Math.min(100, user?.reputationScore||0)) + "%"}} />
              </div>
              <div className="text-xs text-gray-400">
                {(user?.reputationScore||0) >= 70 ? '✅ Excellent — accès au refinancement' :
                 (user?.reputationScore||0) >= 40 ? '⚠️ Moyen — remboursez à temps' :
                 '❌ Faible — risque de blocage de compte'}
              </div>
            </div>
            {/* Résumé remboursements */}
            {Object.keys(schedules).length > 0 ? (
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
                <div className="text-xs text-purple-600 font-semibold mb-2">📅 Remboursements en cours</div>
                {Object.entries(schedules).map(([pid, sc]: [string, any]) => {
                  const proj = projects.find(p => p.id === pid);
                  const pct = Math.round(((sc.totalAmount - sc.remainingAmount) / sc.totalAmount) * 100);
                  const nextPay = sc.payments?.find((pay: any) => pay.status === "PENDING");
                  const isLate = nextPay && new Date(nextPay.dueDate) < new Date();
                  return (
                    <div key={pid} className="mb-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700 truncate">{proj?.title}</span>
                        <span className={isLate ? "text-red-600 font-bold" : "text-purple-600"}>{sc.paidMonths}/{sc.totalMonths} mois</span>
                      </div>
                      <div className="bg-purple-200 rounded-full h-1.5">
                        <div className="bg-purple-600 h-1.5 rounded-full" style={{width: pct + "%"}} />
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {isLate ? '⚠️ Paiement en retard !' : 'Prochain : ' + (nextPay ? new Date(nextPay.dueDate).toLocaleDateString('fr-FR') : 'Terminé')}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex flex-col justify-center items-center text-center">
                <div className="text-3xl mb-2">🚀</div>
                <div className="text-sm font-bold text-blue-700">Aucun remboursement</div>
                <div className="text-xs text-blue-500 mt-1">Soumettez un projet pour commencer</div>
              </div>
            )}
          </div>
        )}
        <div className="mb-8">
          <EntrepreneurCharts />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-gray-900 text-lg">Mes Projets</h3>
                <Link href="/projects/submit" className="text-sm text-green-600 hover:underline">+ Nouveau</Link>
              </div>
              {visibleProjects.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-5xl mb-3">🌱</div>
                  <p className="text-gray-500 mb-4">Aucun projet soumis</p>
                  <Link href="/projects/submit" className="btn-primary text-sm py-2 px-5 inline-flex">
                    Soumettre →
                  </Link>
                </div>
              ) : (
                visibleProjects.map((p: any) => {
                  const s = STATUS_CONFIG[p.status] || STATUS_CONFIG.DRAFT;
                  const fundingPercent = Math.round((p.raisedAmount / p.goalAmount) * 100);
                  return (
                    <div key={p.id} className="border border-gray-100 rounded-2xl p-5 mb-4 hover:border-green-200 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.color}`}>
                              {s.label}
                            </span>
                            <span className="text-xs text-gray-400">{p.sector} · {p.city}</span>
                          </div>
                          <h4 className="font-bold text-gray-900">{p.title}</h4>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-green-700">{p.raisedAmount?.toLocaleString()} FCFA</div>
                          <div className="text-xs text-gray-400">/ {p.goalAmount?.toLocaleString()} FCFA</div>
                        </div>
                      </div>
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{p.investorCount || 0} investisseur(s)</span>
                          <span className="font-bold text-green-600">{fundingPercent}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${Math.min(fundingPercent, 100)}%` }}
                          />
                        </div>
                      </div>
                      {(p.investorCount || 0) > 0 && (
                        <button
                          onClick={() => viewInvestors(p.id)}
                          disabled={loadingInvestors}
                          className="w-full mb-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-semibold py-2 px-4 rounded-xl text-sm transition-colors"
                        >
                          👥 Voir mes {p.investorCount} investisseur(s) →
                        </button>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        {["ACTIVE","FUNDED","IN_PROGRESS","COMPLETED"].includes(p.status) && (
                          <>
                            <Link href={`/entrepreneur/milestones/${p.id}`} className="text-xs bg-blue-600 text-white px-3 py-2 rounded-xl font-medium hover:bg-blue-700">
                              🏗️ Jalons
                            </Link>
                            <Link href={`/feed/${p.id}`} className="text-xs bg-green-600 text-white px-3 py-2 rounded-xl font-medium hover:bg-green-700">
                              📸 Update
                            </Link>
                            <Link href={`/projects/${p.id}`} className="text-xs bg-gray-100 text-gray-700 px-3 py-2 rounded-xl font-medium hover:bg-gray-200">
                              🔍 Voir
                            </Link>
                            <button onClick={() => downloadPDF(`/api/pdf/report/project/${p.id}`, `rapport-${p.title.substring(0,10)}.pdf`)} className="text-xs bg-purple-100 text-purple-700 px-3 py-2 rounded-xl font-medium hover:bg-purple-200">
                              📄 PDF
                            </button>
                          </>
                        )}
                          {/* Rapport mensuel rapide */}
                          {["ACTIVE","FUNDED","IN_PROGRESS"].includes(p.status) && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <p className="text-xs text-gray-500 mb-2">📸 Publier un rapport mensuel rapide</p>
                              <textarea
                                value={reportText[p.id] || ""}
                                onChange={e => setReportText(prev => ({...prev, [p.id]: e.target.value}))}
                                placeholder="Ex: Bonjour investisseurs, voici les avancées de ce mois..."
                                className="w-full border border-gray-200 rounded-xl p-2 text-xs resize-none"
                                rows={2}
                              />
                              <button
                                onClick={() => publishReport(p.id)}
                                disabled={publishingReport === p.id || (reportText[p.id]||"").length < 20}
                                className="mt-1 w-full bg-blue-600 text-white text-xs py-2 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
                              >
                                {publishingReport === p.id ? "Publication..." : "📢 Publier rapport (remet à zéro le compteur 21j)"}
                              </button>
                            </div>
                          )}
                          {/* Calendrier remboursement */}
                          {p.status === "FUNDED" && p.raisedAmount > 0 && (
                            <div className="mt-2 bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs">
                              <div className="font-semibold text-orange-800 mb-1">📅 Remboursement prévu</div>
                              <div className="text-orange-700">
                                Remboursement brut : <strong>{Math.round(p.raisedAmount * (1 + (p.expectedReturn||15)/100)).toLocaleString()} FCFA</strong>
                                <div className="text-orange-500 text-xs">= capital + {p.expectedReturn||15}% retours promis aux investisseurs</div>
                              </div>
                              <div className="text-orange-600 mt-0.5">
                                À {p.investorCount || 0} investisseur(s) — contactez l&apos;admin pour planifier
                              </div>
                            </div>
                          )}
                          
                        )}
                        {p.status === "PENDING_REVIEW" && (
                          <div className="text-xs bg-orange-50 text-orange-700 px-3 py-2 rounded-xl border border-orange-200">
                            ⏳ En attente (48h)
                          </div>
                        )}
                      </div>
                      {["ACTIVE","FUNDED","IN_PROGRESS"].includes(p.status) && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs text-gray-500 mb-2">📸 Publier un rapport mensuel</p>
                          <textarea
                            value={reportText[p.id] || ""}
                            onChange={e => setReportText(prev => ({...prev, [p.id]: e.target.value}))}
                            placeholder="Bonjour investisseurs, voici les avancées de ce mois..."
                            className="w-full border border-gray-200 rounded-xl p-2 text-xs resize-none"
                            rows={2}
                          />
                          <button
                            onClick={() => publishReport(p.id)}
                            disabled={publishingReport === p.id || (reportText[p.id]||"").length < 20}
                            className="mt-1 w-full bg-blue-600 text-white text-xs py-2 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
                          >
                            {publishingReport === p.id ? "Publication..." : "📢 Publier rapport"}
                          </button>
                        </div>
                      )}
                      {p.status === "FUNDED" && p.raisedAmount > 0 && (
                        <div className="mt-2 bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs">
                          <div className="font-semibold text-orange-800 mb-1">📅 Remboursement prévu</div>
                          <div className="text-orange-700">
                            Total à rembourser : <strong>{Math.round(p.raisedAmount * (1 + (p.expectedReturn||15)/100)).toLocaleString()} FCFA</strong>
                              <div className="text-orange-500 text-xs">Les frais BAOBAB sont prélevés automatiquement au remboursement</div>
                          </div>
                        </div>
                      )}
                      {/* Échéancier IN_PROGRESS */}
                      {p.status === "IN_PROGRESS" && schedules[p.id] && (
                        <div className="mt-2 bg-purple-50 border border-purple-200 rounded-2xl p-4 text-xs space-y-3">
                          <div className="font-bold text-purple-900 text-sm">📅 Échéancier de remboursement</div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white rounded-xl p-2 text-center">
                              <div className="text-gray-400">Mensualité</div>
                              <div className="font-bold text-purple-700">{(schedules[p.id].monthlyAmount||0).toLocaleString()} FCFA</div>
                            </div>
                            <div className="bg-white rounded-xl p-2 text-center">
                              <div className="text-gray-400">Progression</div>
                              <div className="font-bold text-green-700">{schedules[p.id].paidMonths}/{schedules[p.id].totalMonths} mois</div>
                            </div>
                            <div className="bg-white rounded-xl p-2 text-center">
                              <div className="text-gray-400">Restant</div>
                              <div className="font-bold text-orange-700">{(schedules[p.id].remainingAmount||0).toLocaleString()} FCFA</div>
                            </div>
                          </div>
                          <div className="bg-gray-200 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full" style={{width: Math.round(((schedules[p.id].totalAmount - schedules[p.id].remainingAmount) / schedules[p.id].totalAmount) * 100) + "%"}} />
                          </div>
                          {/* Calendrier visuel */}
                          {schedules[p.id].payments && (
                            <div className="grid grid-cols-6 gap-1">
                              {schedules[p.id].payments.map((pay: any) => {
                                const late = pay.status === "PENDING" && new Date(pay.dueDate) < new Date();
                                return (
                                  <div key={pay.id} className={"rounded-lg p-1 text-center " + (pay.status === "PAID" ? "bg-green-100" : late ? "bg-red-100" : "bg-gray-100")}>
                                    <div className="font-bold text-gray-700">M{pay.monthNumber}</div>
                                    <div>{pay.status === "PAID" ? "✅" : late ? "⚠️" : "⏳"}</div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {/* Solde et boutons */}
                          <div className={"rounded-xl p-2 flex justify-between items-center " + ((wallet?.balance||0) >= schedules[p.id].monthlyAmount ? "bg-green-50" : "bg-red-50")}>
                            <span>Solde : <strong>{(wallet?.balance||0).toLocaleString()} FCFA</strong></span>
                            {(wallet?.balance||0) < schedules[p.id].monthlyAmount && (
                              <a href="/wallet/deposit" className="text-xs bg-orange-500 text-white px-2 py-1 rounded-lg font-bold">+ Recharger</a>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <button disabled={!wallet || wallet.balance < schedules[p.id].monthlyAmount}
                              onClick={async () => {
                                const res = await authPost("/api/repayment/pay/" + schedules[p.id].id, {});
                                if (res.success) { flash("✅ Mensualité " + res.data?.paidMonth + "/" + schedules[p.id].totalMonths + " payée"); loadData(); }
                                else flash("❌ " + res.message);
                              }} className="bg-orange-600 text-white font-bold py-2 rounded-xl text-xs disabled:opacity-40 hover:bg-orange-700">
                              💸 Payer M{schedules[p.id].paidMonths + 1}
                            </button>
                            <button disabled={!wallet || wallet.balance < schedules[p.id].monthlyAmount * 2}
                              onClick={async () => {
                                const months = prompt("Combien de mois en avance ?");
                                if (!months) return;
                                const res = await authPost("/api/repayment/pay-advance/" + schedules[p.id].id, { months: parseInt(months) });
                                if (res.success) { flash("✅ " + res.data?.monthsPaid + " mois payés"); loadData(); }
                                else flash("❌ " + res.message);
                              }} className="bg-blue-600 text-white font-bold py-2 rounded-xl text-xs disabled:opacity-40 hover:bg-blue-700">
                              ⏩ X mois avance
                            </button>
                            <button disabled={!wallet || wallet.balance < schedules[p.id].remainingAmount}
                              onClick={async () => {
                                if (!confirm("Tout rembourser (" + (schedules[p.id].remainingAmount||0).toLocaleString() + " FCFA) ? +20 pts !")) return;
                                const res = await authPost("/api/repayment/pay-advance/" + schedules[p.id].id, { months: 0 });
                                if (res.success) { flash("✅ Remboursement complet ! +20 pts"); loadData(); }
                                else flash("❌ " + res.message);
                              }} className="bg-green-700 text-white font-bold py-2 rounded-xl text-xs disabled:opacity-40 hover:bg-green-800">
                              ✅ Tout payer
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {notifications.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">🔔 Notifications</h3>
                  {unread > 0 && (
                    <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                      {unread} non lues
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {notifications.map((n: any) => (
                    <Link
                      key={n.id}
                      href={getNotifLink(n)}
                      className={`block p-3 rounded-xl text-sm transition-colors hover:bg-green-50 ${n.isRead ? "bg-gray-50" : "bg-green-50 border border-green-100"}`}
                    >
                      <div className="font-medium text-gray-900">{n.title}</div>
                      <div className="text-gray-500 text-xs mt-0.5">{n.body}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-3">💳 Mon Wallet</h3>
              <div className="bg-green-50 rounded-xl p-4 text-center mb-3">
                <div className="text-2xl font-bold text-green-700">
                  {(wallet?.balance || 0).toLocaleString()} FCFA
                </div>
                <div className="text-xs text-green-600 mt-1">Solde disponible</div>
              </div>
              <Link href="/wallet/deposit" className="btn-secondary w-full text-sm text-center block py-2">
                + Alimenter
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-3">⭐ Score Réputation</h3>
              <div className="text-center mb-2">
                <div className="text-4xl font-bold text-green-600">{user?.reputationScore || 100}</div>
                <div className="text-xs text-gray-500">/ 100</div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${user?.reputationScore || 100}%` }}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-3">🔗 Liens rapides</h3>
              <div className="space-y-1">
                {[
                  { href: "/messages", icon: "💬", label: "Messagerie" },
                  { href: "/suppliers", icon: "🏪", label: "Fournisseurs" },
                  { href: "/academy", icon: "📚", label: "Académie Baobab" },
                  { href: "/kyc", icon: "🪪", label: "Vérification KYC" },
                  { href: "/referral", icon: "🌳", label: "Parrainer un ami" },
                  { href: "/profile", icon: "👤", label: "Mon profil" },
                ].map(link => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-green-50 transition-colors group"
                  >
                    <span className="text-lg">{link.icon}</span>
                    <span className="text-sm text-gray-600 group-hover:text-green-600">{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
