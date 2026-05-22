"use client";
import { useRoleRedirect } from "@/hooks/useRoleRedirect";
import { ReputationWidget } from "@/components/ReputationWidget";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authGet, authPost } from "@/lib/api";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  DRAFT:          { label: "Brouillon",     color: "text-gray-600",   bg: "bg-gray-100",   border: "border-gray-200" },
  PENDING_REVIEW: { label: "En validation", color: "text-orange-700", bg: "bg-orange-100", border: "border-orange-300" },
  ACTIVE:         { label: "En ligne",      color: "text-green-700",  bg: "bg-green-100",  border: "border-green-300" },
  FUNDED:         { label: "Finance",       color: "text-blue-700",   bg: "bg-blue-100",   border: "border-blue-300" },
  IN_PROGRESS:    { label: "En cours",      color: "text-green-700", bg: "bg-green-100", border: "border-green-300" },
  COMPLETED:      { label: "Termine",       color: "text-emerald-700",bg: "bg-emerald-100",border: "border-emerald-300" },
};

function fmt(n: number) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0"); }

export default function MentorDashboard() {
  const router = useRouter();
  useRoleRedirect(["MENTOR"]);
  const { config: fees } = usePlatformConfig();
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [flashMsg, setFlashMsg] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  const flash = (m: string) => { setFlashMsg(m); setTimeout(() => setFlashMsg(""), 4000); };

  const loadData = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/auth/login"); return; }
    const [me, proj, notif] = await Promise.all([
      authGet("/api/auth/me"),
      authGet("/api/projects/mentor/my-projects"),
      authGet("/api/notifications"),
    ]);
    if (me.success) { setUser(me.data); localStorage.setItem("user", JSON.stringify(me.data)); }
    if (proj.success) setProjects(proj.data || []);
    if (notif.success) { setNotifications(notif.data.notifications?.slice(0, 8) || []); setUnread(notif.data.unreadCount || 0); }
    setLoading(false);
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const acceptProject = async (projectId: string) => {
    const res = await authPost(`/api/projects/${projectId}/mentor/accept`, {});
    if (res.success) { flash("Parrainage accepte !"); loadData(); }
    else flash("Erreur: " + res.message);
  };

  const declineProject = async (projectId: string) => {
    const reason = prompt("Raison du refus (optionnel) :");
    const res = await authPost(`/api/projects/${projectId}/mentor/decline`, { reason });
    if (res.success) { flash("Parrainage refuse"); loadData(); }
    else flash("Erreur: " + res.message);
  };

  const downloadPDF = async () => {
    const token = localStorage.getItem("accessToken");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/pdf/report/mentor`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { flash("Erreur PDF"); return; }
    const blob = await res.blob();
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "rapport-mentor.pdf"; a.click();
  };

  const exportCSV = () => {
    const token = localStorage.getItem("accessToken");
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/exports/mentor`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob()).then(blob => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "stats-mentor.csv"; a.click(); });
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500 font-medium">Chargement...</p>
      </div>
    </div>
  );

  const totalCommission = projects.reduce((s, p) => s + (p.mentorCommission || 0), 0);
  const totalCommissionEstimated = projects.reduce((s, p) => s + (p.mentorCommissionEstimated || p.mentorCommission || 0), 0);
  const commissionRate = fees?.commission_mentor || 2;
  const activeProjects = projects.filter(p => ["ACTIVE","IN_PROGRESS","FUNDED"].includes(p.status));
  const pendingProjects = projects.filter(p => p.status === "PENDING_REVIEW");
  const completedProjects = projects.filter(p => p.status === "COMPLETED");
  const score = user?.reputationScore ?? 100;
  const wallet = user?.wallet;

  const TABS = [
    { id: "overview",  label: "Vue generale",  icon: "📊" },
    { id: "projects",  label: "Mes projets",   icon: "🚀", badge: projects.length, alert: pendingProjects.length > 0 },
    { id: "wallet",    label: "Wallet",         icon: "💳" },
    { id: "reports",   label: "Rapports",       icon: "📄" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {flashMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-medium">{flashMsg}</div>
      )}

      {pendingProjects.length > 0 && (
        <div className="bg-orange-500 text-white px-6 py-2.5 flex items-center justify-between">
          <span className="text-sm font-medium">{pendingProjects.length} projet(s) en attente de votre decision</span>
          <button onClick={() => setActiveTab("projects")} className="text-xs bg-white text-orange-600 px-3 py-1 rounded-lg font-bold">Voir</button>
        </div>
      )}

      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-xl flex items-center justify-center"><span className="text-white font-bold text-sm">B</span></div>
            <span className="font-bold text-gray-900 hidden sm:block">BAOBAB INVEST</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-green-50 text-green-600 px-2.5 py-1 rounded-full font-medium hidden sm:block">Mentor</span>
            <div className="relative">
              <button onClick={() => setShowNotifPanel(!showNotifPanel)} className="relative p-2 hover:bg-gray-100 rounded-xl">
                <span className="text-xl">🔔</span>
                {unread > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{unread > 9 ? "9+" : unread}</span>}
              </button>
              {showNotifPanel && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 max-h-96 overflow-y-auto">
                  <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">Notifications</span>
                      {unread > 0 && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{unread}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {unread > 0 && (
                        <button onClick={async () => {
                          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/read-all`, {
                            method: "PATCH", headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` }
                          });
                          setNotifications((prev: any[]) => prev.map(n => ({...n, isRead: true})));
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
                          method: "PATCH", headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` }
                        });
                        setNotifications((prev: any[]) => prev.map(x => x.id === n.id ? {...x, isRead: true} : x));
                        setUnread((prev: number) => Math.max(0, prev - 1));
                      }
                    }} className={`p-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors text-xs ${!n.isRead ? "bg-green-50" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-gray-900">{n.title}</div>
                        {!n.isRead && <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0 mt-1"></div>}
                      </div>
                      <div className="text-gray-500 mt-0.5 line-clamp-2">{n.body}</div>
                    </div>
                  ))}
                  <div className="p-3 text-center border-t border-gray-100">
                    <button onClick={() => { setShowNotifPanel(false); router.push("/notifications"); }}
                      className="text-xs text-green-600 hover:underline font-medium">Voir toutes →</button>
                  </div>
                </div>
              )}
            </div>
            <Link href="/profile" className="flex items-center gap-1.5 hover:bg-gray-100 px-2 py-1.5 rounded-xl">
              <div className="w-7 h-7 bg-gradient-to-br from-green-500 to-green-700 rounded-lg flex items-center justify-center text-white font-bold text-xs">{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
              <span className="text-sm text-gray-700 hidden sm:block font-medium">{user?.firstName}</span>
            </Link>
            <button onClick={() => { localStorage.clear(); router.push("/"); }} className="text-xs text-gray-400 hover:text-red-500 hidden sm:block">Deconnexion</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-gradient-to-br from-green-700 to-green-900 rounded-3xl p-6 mb-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-green-200 text-sm">Bonjour, {user?.firstName}</p>
                <h1 className="text-2xl font-bold">Espace Mentor</h1>
              </div>
              <div className="text-right">
                <div className="text-xs text-green-200">Score reputation</div>
                <div className={`text-3xl font-bold ${score >= 80 ? "text-green-300" : score >= 60 ? "text-yellow-300" : "text-red-300"}`}>{score}/100</div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-green-200 text-xs mb-1">Solde wallet</div>
                <div className="text-2xl font-bold">{fmt(wallet?.balance || 0)} FCFA</div>
                <Link href="/wallet/withdraw" className="mt-2 inline-block bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg">Retirer</Link>
              </div>
              <div>
                <div className="text-green-200 text-xs mb-1">Projets parraine</div>
                <div className="text-2xl font-bold">{projects.length}</div>
                <div className="text-xs text-green-300">{activeProjects.length}/5 actifs</div>
              </div>
              <div>
                <div className="text-green-200 text-xs mb-1">Commissions estimees</div>
                <div className="text-2xl font-bold">{fmt(totalCommission)} FCFA</div>
              </div>
              <div>
                <div className="text-green-200 text-xs mb-1">Projets termines</div>
                <div className="text-2xl font-bold">{completedProjects.length}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { icon: "⚡", label: "Decisions en attente", value: pendingProjects.length + " projet(s)", color: pendingProjects.length > 0 ? "text-orange-700 bg-orange-50" : "text-gray-600 bg-gray-50" },
            { icon: "🟢", label: "Projets actifs", value: activeProjects.length + "/5", color: "text-green-700 bg-green-50" },
            { icon: "💰", label: "Ma commission", value: commissionRate + "% à la clôture (" + fmt(totalCommission) + " FCFA)", color: "text-green-700 bg-green-50" },
            { icon: "🏆", label: "Taux succes", value: projects.length > 0 ? Math.round((completedProjects.length/projects.length)*100) + "%" : "N/A", color: "text-blue-700 bg-blue-50" },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl p-4 ${s.color}`}>
              <div className="text-lg mb-1">{s.icon}</div>
              <div className="font-bold">{s.value}</div>
              <div className="text-xs opacity-70 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all relative ${activeTab === tab.id ? "bg-green-600 text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:border-green-300 hover:text-green-600"}`}>
              <span>{tab.icon}</span><span>{tab.label}</span>
              {tab.badge && tab.badge > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.id ? "bg-white/30 text-white" : "bg-gray-100 text-gray-600"}`}>{tab.badge}</span>}
              {tab.alert && activeTab !== tab.id && <span className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full"></span>}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              {pendingProjects.length > 0 && (
                <div className="bg-orange-50 border-2 border-orange-300 rounded-2xl p-5">
                  <h3 className="font-bold text-orange-900 mb-4">Decisions en attente ({pendingProjects.length})</h3>
                  {pendingProjects.map(p => (
                    <div key={p.id} className="bg-white rounded-xl p-4 mb-3 border border-orange-200">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-bold text-gray-900">{p.title}</div>
                          <div className="text-xs text-gray-500">{p.sector} par {p.entrepreneur?.firstName} {p.entrepreneur?.lastName}</div>
                          <div className="text-xs text-orange-600">Score entrepreneur: {p.entrepreneur?.reputationScore || 0}/100</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-700">{fmt(p.goalAmount || 0)} FCFA</div>
                          {p.mentorCommission > 0 && <div className="text-xs text-yellow-600">+{fmt(p.mentorCommission)} FCFA commission</div>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => acceptProject(p.id)} className="flex-1 bg-green-600 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-green-700">Accepter</button>
                        <button onClick={() => declineProject(p.id)} className="flex-1 bg-red-50 text-red-600 font-bold py-2.5 rounded-xl text-sm border border-red-200 hover:bg-red-100">Refuser</button>
                        <Link href={`/projects/${p.id}`} className="text-xs bg-gray-100 text-gray-700 px-3 py-2 rounded-xl hover:bg-gray-200 flex items-center">Voir</Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {activeProjects.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-4">Projets actifs ({activeProjects.length})</h3>
                  {activeProjects.map(p => {
                    const pct = Math.round(((p.raisedAmount||0)/(p.goalAmount||1))*100);
                    return (
                      <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-2 hover:bg-green-50 transition-colors">
                        <div className={`w-2 h-10 rounded-full flex-shrink-0 ${p.status === "IN_PROGRESS" ? "bg-green-500" : p.status === "FUNDED" ? "bg-blue-500" : "bg-green-500"}`}></div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 text-sm truncate">{p.title}</div>
                          <div className="bg-gray-200 rounded-full h-1.5 mt-1"><div className="bg-green-500 h-1.5 rounded-full" style={{width: Math.min(100,pct)+"%"}}></div></div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs font-bold">{pct}%</div>
                          {p.mentorCommission > 0 && <div className="text-xs text-yellow-600">+{fmt(p.mentorCommission)}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                <h3 className="font-bold text-green-900 mb-4">Votre role de Mentor / Garant</h3>
                <div className="space-y-2 text-xs text-green-700">
                  <div className="flex items-center gap-2 bg-white rounded-xl p-3"><span>Votre identite est publiquement engagee sur chaque projet parraine</span></div>
                  <div className="flex items-center gap-2 bg-white rounded-xl p-3"><span>Vous percevez {fees?.commission_mentor || 2}% du montant leve a la cloture</span></div>
                  <div className="flex items-center gap-2 bg-white rounded-xl p-3"><span>Maximum 5 projets simultanes autorise</span></div>
                  <div className="flex items-center gap-2 bg-white rounded-xl p-3"><span>Encouragez les rapports mensuels des entrepreneurs</span></div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 mb-3 text-sm">Mon Wallet</h3>
                <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-2xl p-4 text-white mb-3">
                  <div className="text-xs text-green-200 mb-1">Solde disponible</div>
                  <div className="text-2xl font-bold">{fmt(wallet?.balance || 0)} FCFA</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center mb-3">
                  <div className="text-xs text-gray-500">Commissions estimees</div>
                  <div className="font-bold text-yellow-700 text-lg">{fmt(totalCommission)} FCFA</div>
                </div>
                <Link href="/wallet/withdraw" className="block text-center bg-green-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-green-700 mb-2">Retirer mes gains</Link>
                <Link href="/wallet/deposit" className="block text-center border border-green-200 text-green-600 text-sm font-bold py-2.5 rounded-xl hover:bg-green-50">Deposer des fonds</Link>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 mb-3 text-sm">Score de reputation</h3>
                <div className="text-center mb-3">
                  <div className={`text-4xl font-bold ${score >= 80 ? "text-green-600" : score >= 60 ? "text-orange-500" : "text-red-500"}`}>{score}</div>
                  <div className="text-xs text-gray-400">/ 100 points</div>
                </div>
                <div className="bg-gray-200 rounded-full h-3 mb-2"><div className={`h-3 rounded-full ${score >= 80 ? "bg-green-500" : score >= 60 ? "bg-orange-400" : "bg-red-400"}`} style={{width: score+"%"}} /></div>
                <p className="text-xs text-gray-500 text-center">{score >= 80 ? "Excellent — Les entrepreneurs vous font confiance" : score >= 60 ? "Bon — Continuez a bien accompagner" : "En baisse — Surveillez vos projets"}</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 mb-3 text-sm">Actions rapides</h3>
                <div className="space-y-2">
                  {[
                    { href: "/messages",      icon: "💬", label: "Messagerie",      color: "bg-blue-50 text-blue-700 border-blue-200" },
                    { href: "/projects",      icon: "🔍", label: "Voir les projets",color: "bg-green-50 text-green-700 border-green-200" },
                    { href: "/wallet/history",icon: "📜", label: "Historique wallet",color: "bg-gray-50 text-gray-700 border-gray-200" },
                    { href: "/academy",       icon: "📚", label: "Academie Baobab", color: "bg-green-50 text-green-700 border-green-200" },
                    { href: "/referral",      icon: "🌳", label: "Parrainer un ami",color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                    { href: "/leaderboard",   icon: "🏆", label: "Classement",    color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
                    { href: "/profile",       icon: "👤", label: "Mon profil",      color: "bg-gray-50 text-gray-700 border-gray-200" },
                  ].map(l => (
                    <Link key={l.href} href={l.href} className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs font-medium hover:opacity-80 ${l.color}`}>
                      <span className="text-base">{l.icon}</span>{l.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "projects" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-lg">Projets parraine ({projects.length})</h2>
              <span className="text-xs text-gray-500">{activeProjects.length}/5 actifs</span>
            </div>
            {projects.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="text-5xl mb-3">🎓</div>
                <h3 className="font-bold text-gray-900 mb-2">Aucun projet parraine</h3>
                <p className="text-gray-500 text-sm">Les entrepreneurs vous choisiront lors de la soumission.</p>
              </div>
            ) : projects.map(p => {
              const s = STATUS_CONFIG[p.status] || STATUS_CONFIG.DRAFT;
              const pct = Math.round(((p.raisedAmount||0)/(p.goalAmount||1))*100);
              const isPending = p.status === "PENDING_REVIEW";
              const isExpanded = expandedProjects[p.id];
              return (
                <div key={p.id} className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden ${isPending ? "border-orange-300" : s.border}`}>
                  <button onClick={() => setExpandedProjects(prev => ({...prev, [p.id]: !prev[p.id]}))} className="w-full p-5 text-left hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-12 rounded-full flex-shrink-0 ${isPending ? "bg-orange-400" : p.status === "IN_PROGRESS" ? "bg-green-500" : p.status === "COMPLETED" ? "bg-emerald-500" : "bg-green-500"}`}></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {isPending && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">Action requise</span>}
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.color}`}>{s.label}</span>
                          <span className="text-xs text-gray-400">{p.sector}</span>
                        </div>
                        <div className="font-bold text-gray-900 truncate">{p.title}</div>
                        <div className="text-xs text-gray-400">Par {p.entrepreneur?.firstName} {p.entrepreneur?.lastName} · Score: {p.entrepreneur?.reputationScore || 0}/100</div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="font-bold text-gray-900">{fmt(p.raisedAmount||0)} FCFA</div>
                        <div className="text-xs text-gray-400">{pct}%</div>
                        {p.mentorCommission > 0 && <div className="text-xs text-yellow-600 font-bold">+{fmt(p.mentorCommission)} FCFA</div>}
                        <div className="text-lg">{isExpanded ? "▲" : "▼"}</div>
                      </div>
                    </div>
                    <div className="mt-3 bg-gray-100 rounded-full h-1.5"><div className="bg-green-500 h-1.5 rounded-full" style={{width: Math.min(100,pct)+"%"}} /></div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-5 space-y-4">
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div className="bg-gray-50 rounded-xl p-3 text-center"><div className="text-gray-400">Leve</div><div className="font-bold text-green-700">{fmt(p.raisedAmount||0)} FCFA</div></div>
                        <div className="bg-gray-50 rounded-xl p-3 text-center"><div className="text-gray-400">Investisseurs</div><div className="font-bold text-blue-700">{p._count?.investments || 0}</div></div>
                        <div className="bg-yellow-50 rounded-xl p-3 text-center"><div className="text-gray-400">Votre commission</div><div className="font-bold text-yellow-700">{fmt(p.mentorCommission||0)} FCFA</div></div>
                      </div>
                      {isPending ? (
                        <div className="flex gap-2">
                          <button onClick={() => acceptProject(p.id)} className="flex-1 bg-green-600 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-green-700">Accepter</button>
                          <button onClick={() => declineProject(p.id)} className="flex-1 bg-red-50 text-red-600 font-bold py-2.5 rounded-xl text-sm border border-red-200">Refuser</button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/projects/${p.id}`} className="text-xs bg-gray-100 text-gray-700 px-3 py-2 rounded-xl hover:bg-gray-200 font-medium">Voir le projet</Link>
                          <Link href={`/messages?to=${p.entrepreneurId}`} className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-3 py-2 rounded-xl hover:bg-blue-100 font-medium">Contacter entrepreneur</Link>
                          {p.status === "ACTIVE" && <Link href={`/feed/${p.id}`} className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-xl hover:bg-green-100 font-medium">Feed investisseurs</Link>}
                          {p.status === "COMPLETED" && <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2 rounded-xl">Projet termine avec succes</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "wallet" && (
          <div className="space-y-5 max-w-2xl">
            <div className="bg-gradient-to-br from-green-600 to-green-900 rounded-3xl p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="text-sm text-green-200 mb-1">Solde disponible</div>
              <div className="text-4xl font-bold mb-4">{fmt(wallet?.balance || 0)} FCFA</div>
              <div className="flex gap-3">
                <Link href="/wallet/withdraw" className="flex-1 bg-white text-green-700 text-sm font-bold py-2.5 rounded-xl text-center hover:bg-green-50">Retirer</Link>
                <Link href="/wallet/deposit" className="flex-1 bg-white/20 text-white text-sm font-bold py-2.5 rounded-xl text-center hover:bg-white/30 border border-white/30">Deposer</Link>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-4">Recapitulatif wallet</h3>
              <div className="space-y-3">
                {[
                  { label: "Solde disponible",    value: fmt(wallet?.balance||0) + " FCFA",          color: "text-green-700" },
                  { label: "Total gagne",          value: fmt(wallet?.totalEarned||0) + " FCFA",      color: "text-green-700" },
                  { label: "Total retire",          value: fmt(wallet?.totalWithdrawn||0) + " FCFA",  color: "text-red-600" },
                  { label: "Commissions reçues (2%)",value: fmt(totalCommission) + " FCFA",            color: "text-yellow-700" },
                  { label: "Commission estimée totale", value: fmt(totalCommissionEstimated) + " FCFA",    color: "text-green-700" },
                ].map(s => (
                  <div key={s.label} className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-500">{s.label}</span>
                    <span className={`font-bold ${s.color}`}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "reports" && (
          <div className="space-y-5 max-w-2xl">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-bold text-gray-900 mb-4">Mes rapports</h2>
              <div className="space-y-3">
                <button onClick={downloadPDF} className="w-full border-2 border-green-200 rounded-2xl p-4 text-left hover:bg-green-50 transition-colors">
                  <div className="font-bold text-gray-900 text-sm mb-1">Rapport mentor complet (PDF)</div>
                  <div className="text-xs text-gray-400">Tous vos projets, commissions et statistiques</div>
                </button>
                <button onClick={exportCSV} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 text-sm">Exporter statistiques (CSV)</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}