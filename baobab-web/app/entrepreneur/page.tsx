"use client";
import { useRoleRedirect } from "@/hooks/useRoleRedirect";
import { ReputationWidget } from "@/components/ReputationWidget";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authGet, authPost } from "@/lib/api";
import EntrepreneurCharts from "./charts";

const LEVEL_NAMES = ["", "🌱 Graine", "🌿 Pousse", "🌳 Baobab", "🏅 Grand Baobab"];
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  DRAFT:          { label: "Brouillon",     color: "text-gray-600",   bg: "bg-gray-100",   border: "border-gray-200" },
  PENDING_REVIEW: { label: "En validation", color: "text-orange-700", bg: "bg-orange-100", border: "border-orange-200" },
  ACTIVE:         { label: "En ligne",      color: "text-green-700",  bg: "bg-green-100",  border: "border-green-300" },
  FUNDED:         { label: "Financé",       color: "text-blue-700",   bg: "bg-blue-100",   border: "border-blue-300" },
  IN_PROGRESS:    { label: "En cours",      color: "text-purple-700", bg: "bg-purple-100", border: "border-purple-300" },
  COMPLETED:      { label: "Terminé",       color: "text-emerald-700",bg: "bg-emerald-100",border: "border-emerald-300" },
  FAILED:         { label: "Échoué",        color: "text-red-700",    bg: "bg-red-100",    border: "border-red-300" },
  WAITLISTED:     { label: "Liste d'attente", color: "text-yellow-700", bg: "bg-yellow-100", border: "border-yellow-300" },
  CANCELLED:      { label: "Annulé",        color: "text-gray-600",   bg: "bg-gray-100",   border: "border-gray-200" },
};
const COUNTRY_FLAGS: Record<string, string> = { SN:"🇸🇳", CI:"🇨🇮", CM:"🇨🇲", ML:"🇲🇱", BF:"🇧🇫", GN:"🇬🇳" };

function fmt(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
}

function CountdownTimer({ endDate }: { endDate: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Terminé"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(d > 0 ? `${d}j ${h}h restants` : `${h}h ${m}min restants`);
    };
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, [endDate]);
  return <span className="text-xs text-orange-600 font-medium">⏱️ {timeLeft}</span>;
}

export default function EntrepreneurDashboard() {
  const router = useRouter();
  useRoleRedirect(["ENTREPRENEUR"]);
  const { fees } = usePlatformConfig();
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<Record<string, any>>({});
  const [wallet, setWallet] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [flashMsg, setFlashMsg] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [selectedProjectInvestors, setSelectedProjectInvestors] = useState<any>(null);
  const [loadingInvestors, setLoadingInvestors] = useState(false);
  const [publishingReport, setPublishingReport] = useState<string | null>(null);
  const [reportText, setReportText] = useState<Record<string, string>>({});
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  const flash = (msg: string) => { setFlashMsg(msg); setTimeout(() => setFlashMsg(""), 4000); };

  const loadData = useCallback(async () => {
    const [me, proj, notif] = await Promise.all([
      authGet("/api/auth/me"),
      authGet("/api/projects/my/projects"),
      authGet("/api/notifications"),
    ]);
    if (me.success) { setUser(me.data); setWallet(me.data.wallet); localStorage.setItem("user", JSON.stringify(me.data)); }
    if (proj.success) {
      const allProjects = proj.data || [];
      setProjects(allProjects);
      const eligible = allProjects.filter((p: any) => ["FUNDED","IN_PROGRESS","COMPLETED"].includes(p.status));
      const schedMap: any = {};
      for (const fp of eligible) {
        const s = await authGet("/api/repayment/my/" + fp.id);
        if (s.success && s.data) schedMap[fp.id] = s.data;
      }
      setSchedules(schedMap);
    }
    if (notif.success) {
      setNotifications(notif.data.notifications?.slice(0, 8) || []);
      setUnread(notif.data.unreadCount || 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/auth/login"); return; }
    loadData();
  }, [loadData, router]);

  const toggleProject = (id: string) => setExpandedProjects(prev => ({ ...prev, [id]: !prev[id] }));

  const viewInvestors = async (projectId: string) => {
    setLoadingInvestors(true);
    const data = await authGet(`/api/projects/${projectId}/investors`);
    if (data.success) setSelectedProjectInvestors({ ...data.data, projectId });
    setLoadingInvestors(false);
  };

  const publishReport = async (projectId: string) => {
    const text = reportText[projectId];
    if (!text || text.trim().length < 20) { flash("❌ Message trop court (min 20 caractères)"); return; }
    setPublishingReport(projectId);
    try {
      const res = await authPost(`/api/feed/project/${projectId}`, { content: text, type: "UPDATE" });
      if (res.success) { flash("✅ Rapport publié ! Compteur 21j remis à zéro."); setReportText(prev => ({ ...prev, [projectId]: "" })); }
      else flash("❌ " + res.message);
    } finally { setPublishingReport(null); }
  };

  const downloadPDF = async (url: string, filename: string) => {
    const token = localStorage.getItem("accessToken");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { flash("❌ Erreur génération PDF"); return; }
      const blob = await res.blob();
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    } catch { flash("❌ Erreur"); }
  };

  const exportCSV = () => {
    const token = localStorage.getItem("accessToken");
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/exports/entrepreneur`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob()).then(blob => {
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "mes-projets.csv"; a.click();
      });
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500 font-medium">Chargement de votre tableau de bord...</p>
      </div>
    </div>
  );

  const fraisTaux = (fees?.commission_baobab_collection || 6) + (fees?.payin_recovery || 4) + (fees?.commission_mentor || 2); // assurance exclue
  const visibleProjects = projects.filter(p => p.status !== "CANCELLED");
  const activeProjects = projects.filter(p => p.status === "ACTIVE");
  const inProgressProjects = projects.filter(p => ["FUNDED","IN_PROGRESS"].includes(p.status));
  const totalRaisedBrut = projects.reduce((s, p) => s + (p.raisedAmount || 0), 0);
  // Cagnotte nette = somme des netAmount de tous les projets actifs/approuvés
  const totalRaised = projects
    .filter((p: any) => ['ACTIVE','FUNDED','IN_PROGRESS','COMPLETED'].includes(p.status))
    .reduce((s, p: any) => s + (p.netAmount || Math.round((p.goalAmount||0) * (1 - fraisTaux/100))), 0);
  const totalInvestors = projects.reduce((s, p) => s + (p.investorCount || 0), 0);
  const totalDue = Object.values(schedules).reduce((s: number, sc: any) => s + (sc.remainingAmount || 0), 0);
  const totalPaid = Object.values(schedules).reduce((s: number, sc: any) => s + ((sc.totalAmount || 0) - (sc.remainingAmount || 0)), 0);
  const hasLatePayment = Object.values(schedules).some((sc: any) => {
    const next = sc.payments?.find((p: any) => p.status === "PENDING");
    return next && new Date(next.dueDate) < new Date();
  });
  const repaymentCount = Object.keys(schedules).length;

  const TABS = [
    { id: "overview", label: "Vue générale", icon: "📊" },
    { id: "projects", label: "Mes projets", icon: "🚀", badge: visibleProjects.length },
    { id: "repayment", label: "Remboursements", icon: "📅", badge: repaymentCount, alert: hasLatePayment },
    { id: "wallet", label: "Wallet", icon: "💳" },
    { id: "reports", label: "Rapports", icon: "📄" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Flash */}
      {flashMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-medium flex items-center gap-2">
          {flashMsg}
        </div>
      )}

      {/* Alerte retard */}
      {hasLatePayment && (
        <div className="bg-red-600 text-white px-6 py-2.5 flex items-center justify-between">
          <span className="text-sm font-medium">⚠️ Un paiement de remboursement est en retard — cliquez pour régler</span>
          <button onClick={() => setActiveTab("repayment")} className="text-xs bg-white text-red-600 px-3 py-1 rounded-lg font-bold hover:bg-red-50">
            Voir →
          </button>
        </div>
      )}

      {/* KYC Banner */}
      {user?.kycStatus !== "VERIFIED" && (
        <div className="bg-orange-50 border-b border-orange-200 px-6 py-3 flex items-center justify-between">
          <span className="text-sm text-orange-800 font-medium">
            {user?.kycStatus === "REJECTED" ? "❌ KYC rejeté — soumettez de nouveaux documents" :
             user?.kycStatus === "PENDING" ? "⏳ KYC en cours de vérification (24h ouvrées)" :
             "⚠️ Vérifiez votre identité pour publier un projet"}
          </span>
          <Link href="/kyc" className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-xl font-bold hover:bg-orange-600">
            {user?.kycStatus === "REJECTED" ? "Resoumettre" : user?.kycStatus === "PENDING" ? "En attente..." : "Vérifier →"}
          </Link>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="font-bold text-gray-900 hidden sm:block">BAOBAB INVEST</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/projects/new" className="bg-green-600 text-white text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-xl hover:bg-green-700 transition-colors">
              + Nouveau projet
            </Link>
            <div className="relative">
              <button onClick={() => setShowNotifPanel(!showNotifPanel)} className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <span className="text-xl">🔔</span>
                {unread > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{unread > 9 ? "9+" : unread}</span>}
              </button>
              {showNotifPanel && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 max-h-96 overflow-y-auto">
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">Notifications</span>
                      {unread > 0 && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{unread}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {unread > 0 && (
                        <button onClick={async () => {
                          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/read-all`, {
                            method: "PATCH",
                            headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` }
                          });
                          setNotifications(prev => prev.map(n => ({...n, isRead: true})));
                          setUnread(0);
                        }} className="text-xs text-green-600 hover:underline">Tout lire</button>
                      )}
                      <button onClick={() => setShowNotifPanel(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
                    </div>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-gray-400 text-sm">Aucune notification</div>
                  ) : notifications.map((n: any) => (
                    <div key={n.id} onClick={async () => {
                      if (!n.isRead) {
                        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/${n.id}/read`, {
                          method: "PATCH",
                          headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` }
                        });
                        setNotifications(prev => prev.map(x => x.id === n.id ? {...x, isRead: true} : x));
                        setUnread(prev => Math.max(0, prev - 1));
                      }
                    }} className={`p-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${!n.isRead ? "bg-green-50" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-gray-900 text-xs">{n.title}</div>
                        {!n.isRead && <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0 mt-1"></div>}
                      </div>
                      <div className="text-gray-500 text-xs mt-0.5 line-clamp-2">{n.body}</div>
                    </div>
                  ))}
                  <div className="p-3 text-center border-t border-gray-100">
                    <button onClick={() => { setShowNotifPanel(false); router.push("/notifications"); }}
                      className="text-xs text-green-600 hover:underline font-medium">Voir toutes les notifications →</button>
                  </div>
                </div>
              )}
            </div>
            <Link href="/profile" className="flex items-center gap-2 hover:bg-gray-100 px-2 py-1.5 rounded-xl transition-colors">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <span className="text-sm text-gray-700 hidden sm:block font-medium">{user?.firstName}</span>
            </Link>
            <button onClick={() => { localStorage.clear(); router.push("/"); }} className="text-xs text-gray-400 hover:text-red-500 transition-colors hidden sm:block">
              Déconnexion
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Hero wallet */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="col-span-2 md:col-span-1 bg-gradient-to-br from-green-600 to-green-800 rounded-2xl p-5 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8"></div>
            <div className="text-xs text-green-200 mb-1">💳 Wallet disponible</div>
            <div className="text-2xl font-bold">{fmt(wallet?.balance || 0)} FCFA</div>
            <Link href="/wallet/deposit" className="mt-3 inline-block bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">
              + Recharger
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="text-xs text-gray-400 mb-1">💰 Cagnotte nette</div>
            <div className="text-xl font-bold text-blue-700">{fmt(totalRaised)} FCFA</div>
            <div className="text-xs text-gray-400 mt-1">{visibleProjects.length} projet(s)</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="text-xs text-gray-400 mb-1">📅 À rembourser</div>
            <div className={`text-xl font-bold ${totalDue > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{fmt(totalDue)} FCFA</div>
            <div className="text-xs text-gray-400 mt-1">{fmt(totalPaid)} FCFA remboursés</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="text-xs text-gray-400 mb-1">⭐ Réputation</div>
            <div className={`text-xl font-bold ${(user?.reputationScore||0) >= 70 ? 'text-green-600' : (user?.reputationScore||0) >= 40 ? 'text-orange-500' : 'text-red-500'}`}>
              {user?.reputationScore || 0}/100
            </div>
            <div className="mt-1.5 bg-gray-100 rounded-full h-1.5">
              <div className={`h-1.5 rounded-full ${(user?.reputationScore||0) >= 70 ? 'bg-green-500' : (user?.reputationScore||0) >= 40 ? 'bg-orange-400' : 'bg-red-400'}`}
                style={{width: Math.max(0, Math.min(100, user?.reputationScore||0)) + "%"}} />
            </div>
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all relative ${
                activeTab === tab.id
                  ? "bg-green-600 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-green-300 hover:text-green-600"
              }`}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && tab.badge > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === tab.id ? 'bg-white/30 text-white' :
                  tab.alert ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.badge}
                </span>
              )}
              {tab.alert && activeTab !== tab.id && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
              )}
            </button>
          ))}
        </div>

        {/* ===================== VUE GÉNÉRALE ===================== */}
        {activeTab === "overview" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              {/* Remboursements urgents */}
              {inProgressProjects.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-4">📅 Remboursements en cours</h3>
                  {inProgressProjects.map((p: any) => {
                    const sc = schedules[p.id];
                    if (!sc) return null;
                    const pct = Math.round(((sc.totalAmount - sc.remainingAmount) / sc.totalAmount) * 100);
                    const nextPay = sc.payments?.find((pay: any) => pay.status === "PENDING");
                    const isLate = nextPay && new Date(nextPay.dueDate) < new Date();
                    return (
                      <div key={p.id} className={`border rounded-2xl p-4 mb-3 ${isLate ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-gray-900">{p.title}</div>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${isLate ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'}`}>
                            {isLate ? '⚠️ En retard' : sc.paidMonths + '/' + sc.totalMonths + ' mois'}
                          </span>
                        </div>
                        <div className="bg-gray-200 rounded-full h-2 mb-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{width: pct + "%"}}></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mb-3">
                          <span>{fmt(sc.totalAmount - sc.remainingAmount)} FCFA remboursés</span>
                          <span>{fmt(sc.remainingAmount)} FCFA restants</span>
                        </div>
                        <div className="flex gap-2">
                          <button disabled={(wallet?.balance||0) < sc.monthlyAmount}
                            onClick={async () => {
                              if (!confirm(`Confirmer le paiement de la mensualité M${sc.paidMonths + 1} — ${sc.monthlyAmount.toLocaleString()} FCFA ?`)) return;
                              const res = await authPost("/api/repayment/pay/" + sc.id, {});
                              if (res.success) { flash("✅ Mensualité " + res.data?.paidMonth + "/" + sc.totalMonths + " payée"); loadData(); }
                              else flash("❌ " + res.message);
                            }} className="flex-1 bg-orange-600 text-white text-xs font-bold py-2 rounded-xl disabled:opacity-40 hover:bg-orange-700">
                            💸 Payer M{sc.paidMonths + 1} — {fmt(sc.monthlyAmount)} FCFA
                          </button>
                          <button onClick={() => setActiveTab("repayment")} className="text-xs bg-purple-100 text-purple-700 px-3 py-2 rounded-xl hover:bg-purple-200 font-medium">
                            Détails →
                          </button>
                          <button onClick={() => setActiveTab("projects")} className="text-xs bg-blue-100 text-blue-700 px-3 py-2 rounded-xl hover:bg-blue-200 font-medium">
                            📸 Rapport
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Projets actifs */}
              {activeProjects.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-4">🚀 Campagnes en cours</h3>
                  {activeProjects.map((p: any) => {
                    const pct = Math.round(((p.raisedAmount||0) / (p.goalAmount||1)) * 100);
                    return (
                      <div key={p.id} className="border border-green-100 rounded-2xl p-4 mb-3 bg-green-50">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-semibold text-gray-900">{p.title}</div>
                            <div className="text-xs text-gray-400">{p.sector} · {p.city}</div>
                          </div>
                          {p.campaignEndsAt && <CountdownTimer endDate={p.campaignEndsAt} />}
                        </div>
                        <div className="bg-gray-200 rounded-full h-2.5 mb-1">
                          <div className="bg-green-500 h-2.5 rounded-full transition-all" style={{width: Math.min(100,pct) + "%"}}></div>
                        </div>
                        <div className="flex justify-between text-xs mb-3">
                          <span className="text-green-700 font-bold">{fmt(p.raisedAmount||0)} FCFA</span>
                          <span className="text-gray-500">{pct}% · Besoin net : {fmt(p.netAmount||0)} FCFA · {p.investorCount||0} inv.</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setActiveTab("projects")} className="flex-1 text-xs bg-green-600 text-white py-2 rounded-xl font-bold hover:bg-green-700">
                            Gérer →
                          </button>
                          {(p.investorCount||0) > 0 && (
                            <button onClick={() => viewInvestors(p.id)} className="text-xs bg-white border border-green-200 text-green-700 px-3 py-2 rounded-xl hover:bg-green-50">
                              👥 {p.investorCount}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Graphiques */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <EntrepreneurCharts />
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Quick actions */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 mb-3 text-sm">⚡ Actions rapides</h3>
                <div className="space-y-2">
                  {[
                    { href: "/projects/new", icon: "🚀", label: "Nouveau projet", color: "bg-green-50 text-green-700 border-green-200" },
                    { href: "/messages", icon: "💬", label: "Messagerie", color: "bg-blue-50 text-blue-700 border-blue-200" },
                    { href: "/suppliers", icon: "🏪", label: "Fournisseurs", color: "bg-purple-50 text-purple-700 border-purple-200" },
                    { href: "/kyc", icon: "🪪", label: "Vérification KYC", color: "bg-orange-50 text-orange-700 border-orange-200" },
                    { href: "/academy", icon: "📚", label: "Académie Baobab", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
                    { href: "/referral", icon: "🌳", label: "Parrainer un ami", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                    { href: "/profile", icon: "👤", label: "Mon profil", color: "bg-gray-50 text-gray-700 border-gray-200" },
                  ].map(link => (
                    <Link key={link.href} href={link.href} className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs font-medium hover:opacity-80 transition-opacity ${link.color}`}>
                      <span className="text-base">{link.icon}</span>
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Stats rapides */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 mb-3 text-sm">📊 Mes statistiques</h3>
                <div className="space-y-3">
                  {[
                    { label: "Total investi par mes backers", value: fmt(totalRaisedBrut) + " FCFA" },
                    { label: "Cagnotte nette reçue", value: fmt(totalRaised) + " FCFA" },
                    { label: "Nombre d'investisseurs", value: totalInvestors + " personnes" },
                    { label: "Projets actifs", value: activeProjects.length + " en ligne" },
                    { label: "Remboursé à ce jour", value: fmt(totalPaid) + " FCFA" },
                  ].map(s => (
                    <div key={s.label} className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">{s.label}</span>
                      <span className="font-bold text-gray-900">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notifications */}
              {notifications.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-900 text-sm">🔔 Notifications</h3>
                    {unread > 0 && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">{unread} nouvelles</span>}
                  </div>
                  <div className="space-y-2">
                    {notifications.slice(0, 4).map((n: any) => (
                      <div key={n.id} className={`p-2.5 rounded-xl text-xs ${!n.isRead ? 'bg-green-50 border border-green-100' : 'bg-gray-50'}`}>
                        <div className="font-medium text-gray-900 line-clamp-1">{n.title}</div>
                        <div className="text-gray-500 mt-0.5 line-clamp-2">{n.body}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== MES PROJETS ===================== */}
        {activeTab === "projects" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-lg">Mes projets ({visibleProjects.length})</h2>
              <div className="flex gap-2">
                <button onClick={exportCSV} className="text-xs border border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600 px-3 py-2 rounded-xl">📥 CSV</button>
                <Link href="/projects/new" className="bg-green-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-green-700">+ Nouveau</Link>
              </div>
            </div>

            {visibleProjects.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="text-5xl mb-3">🌱</div>
                <h3 className="font-bold text-gray-900 mb-2">Aucun projet</h3>
                <p className="text-gray-500 text-sm mb-4">Soumettez votre premier projet pour commencer.</p>
                <Link href="/projects/new" className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 inline-block">+ Soumettre</Link>
              </div>
            ) : visibleProjects.map((p: any) => {
              const s = STATUS_CONFIG[p.status] || STATUS_CONFIG.DRAFT;
              const pct = Math.round(((p.raisedAmount||0) / (p.goalAmount||1)) * 100);
              const isExpanded = expandedProjects[p.id];
              const sc = schedules[p.id];
              const nextPay = sc?.payments?.find((pay: any) => pay.status === "PENDING");
              const isLate = nextPay && new Date(nextPay.dueDate) < new Date();

              return (
                <div key={p.id} className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all ${isLate ? 'border-red-300' : s.border}`}>
                  {/* En-tête cliquable */}
                  <button onClick={() => toggleProject(p.id)} className="w-full p-5 text-left hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`flex-shrink-0 w-2 h-12 rounded-full ${p.status === 'ACTIVE' ? 'bg-green-500' : p.status === 'IN_PROGRESS' ? 'bg-purple-500' : p.status === 'FUNDED' ? 'bg-blue-500' : p.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.color}`}>{s.label}</span>
                          <span className="text-xs text-gray-400">{p.sector} · {p.city}</span>
                          {isLate && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">⚠️ Retard</span>}
                        </div>
                        <div className="font-bold text-gray-900 text-base truncate">{p.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{p.durationMonths} mois · +{p.expectedReturn}% retour · {p.investorCount||0} investisseur(s)</div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="font-bold text-green-700">{fmt(p.raisedAmount||0)} FCFA</div>
                        <div className="text-xs text-gray-400">{pct}% de {fmt(p.goalAmount||0)} levé · Besoin net : {fmt(p.netAmount||0)} FCFA</div>
                        {(p.status === 'FUNDED' || p.status === 'IN_PROGRESS') && (
                          <div className="mt-2 grid grid-cols-3 gap-1 text-xs">
                            {[
                              { n: 1, label: "40%", amount: Math.round((p.netAmount||0)*0.40), done: (p.currentPalier||0) >= 1 },
                              { n: 2, label: "35%", amount: Math.round((p.netAmount||0)*0.35), done: (p.currentPalier||0) >= 2 },
                              { n: 3, label: "25%", amount: Math.round((p.netAmount||0)*0.25), done: (p.currentPalier||0) >= 3 },
                            ].map(pl => (
                              <div key={pl.n} className={`rounded-lg p-1.5 text-center ${pl.done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                <div className="font-bold">{pl.done ? '✅' : '🔒'} P{pl.n} {pl.label}</div>
                                <div>{fmt(pl.amount)} FCFA</div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="text-lg mt-1">{isExpanded ? '▲' : '▼'}</div>
                      </div>
                    </div>
                    {/* Mini progress bar */}
                    <div className="mt-3 bg-gray-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${p.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-green-500'}`} style={{width: Math.min(100,pct) + "%"}}></div>
                    </div>
                  </button>

                  {/* Contenu déplié */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-5 space-y-4">
                      {/* Actions principales */}
                      <div className="flex flex-wrap gap-2">
                        {["ACTIVE","FUNDED","IN_PROGRESS","COMPLETED"].includes(p.status) && (
                          <>
                            <Link href={`/entrepreneur/milestones/${p.id}`} className="text-xs bg-blue-600 text-white px-3 py-2 rounded-xl font-medium hover:bg-blue-700">🏗️ Jalons</Link>
                            <Link href={`/feed/${p.id}`} className="text-xs bg-green-600 text-white px-3 py-2 rounded-xl font-medium hover:bg-green-700">📸 Update</Link>
                            <Link href={`/projects/${p.id}`} className="text-xs bg-gray-100 text-gray-700 px-3 py-2 rounded-xl font-medium hover:bg-gray-200">🔍 Voir</Link>
                            <button onClick={() => downloadPDF(`/api/pdf/report/project/${p.id}`, `rapport-${p.id.substring(0,8)}.pdf`)} className="text-xs bg-purple-100 text-purple-700 px-3 py-2 rounded-xl font-medium hover:bg-purple-200">📄 PDF</button>
                          </>
                        )}
                        {(p.investorCount||0) > 0 && (
                          <button onClick={() => viewInvestors(p.id)} disabled={loadingInvestors} className="text-xs bg-indigo-100 text-indigo-700 px-3 py-2 rounded-xl font-medium hover:bg-indigo-200">
                            👥 {p.investorCount} investisseur(s)
                          </button>
                        )}
                        {p.status === "ACTIVE" && !p.earlyCloseRequested && (
                          <button onClick={async () => {
                            const note = prompt("Motif clôture anticipée :") || "";
                            const res = await authPost(`/api/projects/${p.id}/request-early-close`, { note });
                            if (res.success) flash("✅ Demande envoyée"); else flash("❌ " + res.message);
                          }} className="text-xs bg-orange-100 text-orange-700 px-3 py-2 rounded-xl font-medium hover:bg-orange-200">🔒 Clôture anticipée</button>
                        )}
                        {p.status === "ACTIVE" && !p.extensionRequested && (
                          <button onClick={async () => {
                            const days = prompt("Jours de prolongation (7-90) :"); if (!days) return;
                            const note = prompt("Motif :") || "";
                            const res = await authPost(`/api/projects/${p.id}/request-extension`, { days: Number(days), note });
                            if (res.success) flash("✅ Prolongation demandée"); else flash("❌ " + res.message);
                          }} className="text-xs bg-blue-100 text-blue-700 px-3 py-2 rounded-xl font-medium hover:bg-blue-200">⏰ Prolonger</button>
                        )}
                        {p.earlyCloseRequested && <span className="text-xs bg-orange-50 text-orange-600 px-3 py-2 rounded-xl border border-orange-200">⏳ Clôture en attente</span>}
                        {p.extensionRequested && <span className="text-xs bg-blue-50 text-blue-600 px-3 py-2 rounded-xl border border-blue-200">⏳ Prolongation en attente</span>}
                      </div>

                      {/* Partage */}
                      {["ACTIVE","FUNDED"].includes(p.status) && (
                        <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3">
                          <span className="text-xs text-gray-500 flex-1">Partagez votre projet :</span>
                          <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/projects/${p.id}`); flash("✅ Lien copié !"); }}
                            className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 font-medium">🔗 Copier le lien</button>
                        </div>
                      )}

                      {/* Countdown si actif */}
                      {p.status === "ACTIVE" && p.campaignEndsAt && (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center justify-between">
                          <span className="text-xs text-orange-700">Fin de campagne :</span>
                          <CountdownTimer endDate={p.campaignEndsAt} />
                        </div>
                      )}

                      {/* Rapport mensuel */}
                      {["ACTIVE","FUNDED","IN_PROGRESS"].includes(p.status) && (
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                          <p className="text-xs font-semibold text-blue-800 mb-2">📸 Publier un rapport mensuel</p>
                          <textarea value={reportText[p.id] || ""} onChange={e => setReportText(prev => ({...prev, [p.id]: e.target.value}))}
                            placeholder="Ex: Bonjour investisseurs, voici les avancées de ce mois..."
                            className="w-full border border-blue-200 bg-white rounded-xl p-2.5 text-xs resize-none focus:outline-none focus:border-blue-400" rows={3} />
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-blue-400">{(reportText[p.id]||"").length}/500 caractères</span>
                            <button onClick={() => publishReport(p.id)} disabled={publishingReport === p.id || (reportText[p.id]||"").length < 20}
                              className="bg-blue-600 text-white text-xs px-4 py-2 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50">
                              {publishingReport === p.id ? "Publication..." : "📢 Publier"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Échéancier IN_PROGRESS */}
                      {sc && (
                        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-purple-900 text-sm">📅 Échéancier de remboursement</span>
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-bold">{sc.paidMonths}/{sc.totalMonths} mois</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="bg-white rounded-xl p-2.5 text-center">
                              <div className="text-gray-400">Mensualité</div>
                              <div className="font-bold text-purple-700 text-sm">{fmt(sc.monthlyAmount)} FCFA</div>
                            </div>
                            <div className="bg-white rounded-xl p-2.5 text-center">
                              <div className="text-gray-400">Remboursé</div>
                              <div className="font-bold text-green-700 text-sm">{fmt(sc.totalAmount - sc.remainingAmount)} FCFA</div>
                            </div>
                            <div className="bg-white rounded-xl p-2.5 text-center">
                              <div className="text-gray-400">Restant</div>
                              <div className="font-bold text-orange-700 text-sm">{fmt(sc.remainingAmount)} FCFA</div>
                            </div>
                          </div>
                          <div className="bg-gray-200 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full transition-all" style={{width: Math.round(((sc.totalAmount - sc.remainingAmount) / sc.totalAmount) * 100) + "%"}} />
                          </div>
                          {/* Calendrier */}
                          {sc.payments && (
                            <div className="grid grid-cols-6 gap-1.5">
                              {sc.payments.map((pay: any) => {
                                const late = pay.status === "PENDING" && new Date(pay.dueDate) < new Date();
                                return (
                                  <div key={pay.id} title={fmt(pay.amount) + " FCFA — " + new Date(pay.dueDate).toLocaleDateString("fr-FR")}
                                    className={"rounded-xl p-2 text-center cursor-help " + (pay.status === "PAID" ? "bg-green-100" : late ? "bg-red-100" : "bg-white border border-gray-200")}>
                                    <div className="text-xs font-bold text-gray-700">M{pay.monthNumber}</div>
                                    <div className="text-sm">{pay.status === "PAID" ? "✅" : late ? "⚠️" : "⏳"}</div>
                                    <div className="text-xs text-gray-400">{Math.round(pay.amount/1000)}k</div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {/* Alerte solde */}
                          {(wallet?.balance||0) < sc.monthlyAmount && (
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center justify-between text-xs">
                              <span className="text-orange-700">Solde insuffisant — manque <strong>{fmt(sc.monthlyAmount - (wallet?.balance||0))} FCFA</strong></span>
                              <Link href="/wallet/deposit" className="bg-orange-500 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-orange-600">+ Recharger</Link>
                            </div>
                          )}
                          {/* Boutons paiement */}
                          {sc.status === "ACTIVE" && (
                            <div className="grid grid-cols-3 gap-2">
                              <button disabled={(wallet?.balance||0) < sc.monthlyAmount}
                                onClick={async () => {
                                  const res = await authPost("/api/repayment/pay/" + sc.id, {});
                                  if (res.success) { flash("✅ Mensualité " + res.data?.paidMonth + "/" + sc.totalMonths + " payée"); loadData(); }
                                  else flash("❌ " + res.message);
                                }} className="bg-orange-600 text-white text-xs font-bold py-2.5 rounded-xl disabled:opacity-40 hover:bg-orange-700">
                                💸 Payer M{sc.paidMonths + 1}
                              </button>
                              <button disabled={(wallet?.balance||0) < sc.monthlyAmount * 2}
                                onClick={async () => {
                                  const months = prompt("Combien de mois en avance ?"); if (!months) return;
                                  const res = await authPost("/api/repayment/pay-advance/" + sc.id, { months: parseInt(months) });
                                  if (res.success) { flash("✅ " + res.data?.monthsPaid + " mois payés"); loadData(); }
                                  else flash("❌ " + res.message);
                                }} className="bg-blue-600 text-white text-xs font-bold py-2.5 rounded-xl disabled:opacity-40 hover:bg-blue-700">
                                ⏩ X mois avance
                              </button>
                              <button disabled={(wallet?.balance||0) < sc.remainingAmount}
                                onClick={async () => {
                                  if (!confirm("Tout rembourser (" + fmt(sc.remainingAmount) + " FCFA) ? +20 pts !")) return;
                                  const res = await authPost("/api/repayment/pay-advance/" + sc.id, { months: 0 });
                                  if (res.success) { flash("✅ Remboursement complet ! +20 pts"); loadData(); }
                                  else flash("❌ " + res.message);
                                }} className="bg-green-700 text-white text-xs font-bold py-2.5 rounded-xl disabled:opacity-40 hover:bg-green-800">
                                ✅ Tout payer
                              </button>
                            </div>
                          )}
                          {sc.status === "COMPLETED" && (
                            <div className="text-center bg-green-100 rounded-xl py-3 text-green-700 font-bold text-sm">✅ Projet entièrement remboursé !</div>
                          )}
                        </div>
                      )}

                      {/* Statut PENDING_REVIEW */}
                      {p.status === "PENDING_REVIEW" && (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                          <div className="text-2xl mb-2">⏳</div>
                          <div className="font-bold text-orange-800">En cours de validation</div>
                          <div className="text-xs text-orange-600 mt-1">Notre équipe examine votre projet sous 48h ouvrées</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ===================== REMBOURSEMENTS ===================== */}
        {activeTab === "repayment" && (
          <div className="space-y-5">
            {Object.keys(schedules).length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="text-5xl mb-3">📅</div>
                <h3 className="font-bold text-gray-900 mb-2">Aucun échéancier actif</h3>
                <p className="text-gray-500 text-sm">Les échéanciers apparaissent quand un projet est financé et validé par l'admin.</p>
              </div>
            ) : Object.entries(schedules).map(([pid, sc]: [string, any]) => {
              const project = projects.find(p => p.id === pid);
              const pct = Math.round(((sc.totalAmount - sc.remainingAmount) / sc.totalAmount) * 100);
              const nextPay = sc.payments?.find((p: any) => p.status === "PENDING");
              const isLate = nextPay && new Date(nextPay.dueDate) < new Date();
              return (
                <div key={pid} className={`bg-white rounded-2xl border-2 shadow-sm p-5 ${isLate ? 'border-red-300' : 'border-gray-100'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{project?.title}</h3>
                      <p className="text-xs text-gray-400">{project?.sector} · Échéancier de remboursement</p>
                    </div>
                    <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${isLate ? 'bg-red-100 text-red-700' : sc.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                      {isLate ? '⚠️ En retard' : sc.status === 'COMPLETED' ? '✅ Terminé' : sc.paidMonths + '/' + sc.totalMonths + ' mois'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: "Total dû", value: fmt(sc.totalAmount) + " FCFA", color: "text-gray-900" },
                      { label: "Remboursé", value: fmt(sc.totalAmount - sc.remainingAmount) + " FCFA", color: "text-green-700" },
                      { label: "Restant", value: fmt(sc.remainingAmount) + " FCFA", color: "text-orange-700" },
                      { label: "Mensualité", value: fmt(sc.monthlyAmount) + " FCFA", color: "text-blue-700" },
                    ].map(s => (
                      <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                        <div className="text-xs text-gray-400 mb-1">{s.label}</div>
                        <div className={`font-bold text-sm ${s.color}`}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Progression remboursement</span><span>{pct}%</span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-3">
                      <div className="bg-green-500 h-3 rounded-full transition-all" style={{width: pct + "%"}}></div>
                    </div>
                  </div>
                  {/* Calendrier détaillé */}
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Calendrier mensuel :</p>
                    <div className="grid grid-cols-6 gap-1.5">
                      {sc.payments?.map((pay: any) => {
                        const late = pay.status === "PENDING" && new Date(pay.dueDate) < new Date();
                        return (
                          <div key={pay.id} title={fmt(pay.amount) + " FCFA\n" + new Date(pay.dueDate).toLocaleDateString("fr-FR")}
                            className={"rounded-xl p-2.5 text-center cursor-help transition-all hover:scale-105 " + (pay.status === "PAID" ? "bg-green-100 border border-green-200" : late ? "bg-red-100 border border-red-200" : "bg-white border border-gray-200")}>
                            <div className="text-xs font-bold text-gray-700">M{pay.monthNumber}</div>
                            <div className="text-base">{pay.status === "PAID" ? "✅" : late ? "⚠️" : "⏳"}</div>
                            <div className="text-xs text-gray-400">{Math.round(pay.amount/1000)}k</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* Solde + recharger */}
                  <div className={`rounded-xl p-3 mb-4 flex items-center justify-between text-sm ${(wallet?.balance||0) >= sc.monthlyAmount ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="text-xs">
                      Solde wallet : <strong>{fmt(wallet?.balance||0)} FCFA</strong>
                      {(wallet?.balance||0) < sc.monthlyAmount && <span className="text-red-600 ml-2">— Manque {fmt(sc.monthlyAmount - (wallet?.balance||0))} FCFA</span>}
                    </div>
                    {(wallet?.balance||0) < sc.monthlyAmount && (
                      <Link href="/wallet/deposit" className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-orange-600">+ Recharger</Link>
                    )}
                  </div>
                  {/* Boutons */}
                  {sc.status === "ACTIVE" && (
                    <div className="grid grid-cols-3 gap-3">
                      <button disabled={(wallet?.balance||0) < sc.monthlyAmount}
                        onClick={async () => {
                          if (!confirm(`⚠️ Confirmer le paiement de M${sc.paidMonths + 1}/${sc.totalMonths} — ${sc.monthlyAmount.toLocaleString()} FCFA ?\nCette action est irréversible.`)) return;
                          const res = await authPost("/api/repayment/pay/" + sc.id, {});
                          if (res.success) { flash("✅ Mensualité " + res.data?.paidMonth + "/" + sc.totalMonths + " payée"); loadData(); }
                          else flash("❌ " + res.message);
                        }} className="bg-orange-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40 hover:bg-orange-700 transition-colors">
                        💸 Payer M{sc.paidMonths + 1}/{sc.totalMonths}
                      </button>
                      <button disabled={(wallet?.balance||0) < sc.monthlyAmount * 2}
                        onClick={async () => {
                          const remaining = sc.totalMonths - sc.paidMonths;
                          const months = prompt("Combien de mois en avance ? (1-" + remaining + ")"); if (!months) return;
                          const res = await authPost("/api/repayment/pay-advance/" + sc.id, { months: parseInt(months) });
                          if (res.success) { flash("✅ " + res.data?.monthsPaid + " mois payés en avance"); loadData(); }
                          else flash("❌ " + res.message);
                        }} className="bg-blue-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40 hover:bg-blue-700 transition-colors">
                        ⏩ Payer en avance
                      </button>
                      <button disabled={(wallet?.balance||0) < sc.remainingAmount}
                        onClick={async () => {
                          if (!confirm("Tout rembourser (" + fmt(sc.remainingAmount) + " FCFA) ? Vous gagnerez +20 pts !")) return;
                          const res = await authPost("/api/repayment/pay-advance/" + sc.id, { months: 0 });
                          if (res.success) { flash("✅ Remboursement complet ! +20 pts réputation !"); loadData(); }
                          else flash("❌ " + res.message);
                        }} className="bg-green-700 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40 hover:bg-green-800 transition-colors">
                        ✅ Tout rembourser
                      </button>
                    </div>
                  )}
                  {sc.status === "COMPLETED" && (
                    <div className="text-center bg-green-100 rounded-xl py-4 text-green-700 font-bold">🎉 Ce projet est entièrement remboursé !</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ===================== WALLET ===================== */}
        {activeTab === "wallet" && (
          <div className="space-y-5 max-w-2xl">
            <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-3xl p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-8 -mb-8"></div>
              <div className="text-sm text-green-200 mb-1">Solde disponible</div>
              <div className="text-4xl font-bold mb-4">{fmt(wallet?.balance || 0)} FCFA</div>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/wallet/deposit" className="bg-white text-green-700 text-sm font-bold py-2.5 rounded-xl text-center hover:bg-green-50">+ Déposer</Link>
                <Link href="/wallet/withdraw" className="bg-white/20 text-white text-sm font-bold py-2.5 rounded-xl text-center hover:bg-white/30 border border-white/30">↗ Retirer</Link>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-4">📊 Récapitulatif wallet</h3>
              <div className="space-y-3">
                {[
                  { label: "Solde disponible", value: fmt(wallet?.balance||0) + " FCFA", color: "text-green-700" },
                  { label: "Total déposé", value: fmt(wallet?.totalDeposited||0) + " FCFA", color: "text-blue-700" },
                  { label: "Total retiré", value: fmt(wallet?.totalWithdrawn||0) + " FCFA", color: "text-red-600" },
                  { label: "Cagnotte nette projets", value: fmt(totalRaised) + " FCFA", color: "text-purple-700" },
                ].map(s => (
                  <div key={s.label} className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-500">{s.label}</span>
                    <span className={`font-bold ${s.color}`}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-4">⭐ Score de réputation</h3>
              <div className="flex items-center gap-4 mb-3">
                <div className={`text-5xl font-bold ${(user?.reputationScore||0) >= 70 ? 'text-green-600' : (user?.reputationScore||0) >= 40 ? 'text-orange-500' : 'text-red-500'}`}>
                  {user?.reputationScore || 0}
                </div>
                <div className="flex-1">
                  <div className="bg-gray-200 rounded-full h-4">
                    <div className={`h-4 rounded-full transition-all ${(user?.reputationScore||0) >= 70 ? 'bg-green-500' : (user?.reputationScore||0) >= 40 ? 'bg-orange-400' : 'bg-red-400'}`}
                      style={{width: Math.max(0, Math.min(100, user?.reputationScore||0)) + "%"}} />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">/ 100 points</div>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-gray-500">
                <div>✅ Paiement à l'heure : +10 pts</div>
                <div>🚀 Remboursement anticipé : +20 pts</div>
                <div>⚠️ Retard 7 jours : -10 pts</div>
                <div>❌ Retard 30 jours : -30 pts</div>
                {(user?.reputationScore||0) >= 70 && <div className="text-green-600 font-medium mt-2">✅ Score excellent — éligible au refinancement</div>}
              </div>
            </div>
          </div>
        )}

        {/* ===================== RAPPORTS ===================== */}
        {activeTab === "reports" && (
          <div className="space-y-5 max-w-2xl">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-bold text-gray-900 mb-4">📄 Télécharger mes rapports</h2>
              <div className="space-y-3">
                {visibleProjects.filter(p => ["ACTIVE","FUNDED","IN_PROGRESS","COMPLETED"].includes(p.status)).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{p.title}</div>
                      <div className="text-xs text-gray-400">{p.sector} · {STATUS_CONFIG[p.status]?.label}</div>
                    </div>
                    <button onClick={() => downloadPDF(`/api/pdf/report/project/${p.id}`, `rapport-${p.title.substring(0,15)}.pdf`)}
                      className="bg-purple-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-purple-700">
                      📄 PDF
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-bold text-gray-900 mb-4">📥 Exports données</h2>
              <button onClick={exportCSV} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 text-sm">
                📥 Exporter tous mes projets (CSV)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal investisseurs */}
      {selectedProjectInvestors && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <div>
                <h3 className="font-bold text-gray-900">👥 Mes Investisseurs</h3>
                <p className="text-xs text-gray-500 mt-0.5">{selectedProjectInvestors.stats?.totalInvestors} investisseur(s) — {(selectedProjectInvestors.stats?.totalRaised||0).toLocaleString()} FCFA</p>
              </div>
              <button onClick={() => setSelectedProjectInvestors(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <div className="grid grid-cols-3 gap-3 p-5 border-b border-gray-100">
              {[
                { label: "Investisseurs", value: selectedProjectInvestors.stats?.totalInvestors, color: "text-blue-700", bg: "bg-blue-50" },
                { label: "Total levé", value: fmt(selectedProjectInvestors.stats?.totalRaised||0) + " FCFA", color: "text-green-700", bg: "bg-green-50" },
                { label: "Moyenne", value: fmt(selectedProjectInvestors.stats?.averageInvestment||0) + " FCFA", color: "text-purple-700", bg: "bg-purple-50" },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                  <div className={`font-bold text-sm ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
            {selectedProjectInvestors.investments?.length > 0 && (
              <div className="p-5 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-600 mb-2">📢 Message groupé</p>
                <textarea id="broadcastInput" placeholder="Message à tous vos investisseurs..."
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none" rows={2} />
                <button onClick={async () => {
                  const msg = (document.getElementById("broadcastInput") as HTMLTextAreaElement)?.value;
                  if (!msg || msg.length < 10) { flash("Message trop court"); return; }
                  const res = await authPost(`/api/messages/broadcast/${selectedProjectInvestors.projectId}`, { content: msg });
                  if (res.success) { flash("✅ Envoyé à " + res.data.sentTo + " investisseur(s) !"); }
                  else flash("❌ " + res.message);
                }} className="mt-2 w-full bg-blue-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-blue-700">
                  📢 Envoyer à {selectedProjectInvestors.stats?.totalInvestors} investisseur(s)
                </button>
              </div>
            )}
            <div className="p-5 space-y-3">
              {selectedProjectInvestors.investments?.map((inv: any) => (
                <div key={inv.id} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 text-sm flex-shrink-0">
                      {inv.user.firstName[0]}{inv.user.lastName[0]}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 text-sm">{inv.user.firstName} {inv.user.lastName} {COUNTRY_FLAGS[inv.user.country] || ""}</div>
                      <div className="text-xs text-gray-400">{LEVEL_NAMES[inv.user.level]}{inv.user.city ? " · " + inv.user.city : ""}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-700 text-sm">{inv.amount.toLocaleString()} FCFA</div>
                      <div className="text-xs text-gray-400">{new Date(inv.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/messages?to=${inv.user.id}`} className="flex-1 text-center bg-blue-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-blue-700">💬 Message</Link>
                    <Link href={`/auth/profile/${inv.user.id}`} className="flex-1 text-center bg-gray-200 text-gray-700 text-xs font-bold py-2 rounded-lg hover:bg-gray-300">👤 Profil</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
