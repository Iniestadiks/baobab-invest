"use client";
import { useRequireRole } from "@/hooks/useRequireRole";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authGet, authPost } from "@/lib/api";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:          { label: "Brouillon",     color: "text-gray-600",   bg: "bg-gray-100" },
  PENDING_REVIEW: { label: "En validation", color: "text-orange-700", bg: "bg-orange-100" },
  ACTIVE:         { label: "En ligne",      color: "text-green-700",  bg: "bg-green-100" },
  FUNDED:         { label: "Financé",       color: "text-blue-700",   bg: "bg-blue-100" },
  IN_PROGRESS:    { label: "En cours",      color: "text-purple-700", bg: "bg-purple-100" },
  COMPLETED:      { label: "Terminé",       color: "text-green-700",  bg: "bg-green-100" },
};

export default function MentorDashboard() {
  const router = useRouter();
  const { config: fees } = usePlatformConfig();

  const exportStats = () => {
    const token = localStorage.getItem("accessToken");
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/exports/mentor`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.blob()).then(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "stats-mentor.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    }).catch(() => alert("Erreur export"));
  };
  useRequireRole(["MENTOR"]);
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [notifCollapsed, setNotifCollapsed] = useState(false);
  const [showAllNotifs, setShowAllNotifs] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const stored = localStorage.getItem("user");
    if (!token || !stored) { router.push("/auth/login"); return; }
    const u = JSON.parse(stored);
    if (u.role !== "MENTOR") { router.push("/dashboard"); return; }

    Promise.all([
      authGet("/api/auth/me"),
      authGet("/api/projects/mentor/my-projects"),
      authGet("/api/notifications"),
    ]).then(([me, proj, notif]) => {
      if (me.success) {
        setUser(me.data);
        localStorage.setItem("user", JSON.stringify(me.data));
      }
      if (proj.success) setProjects(proj.data || []);
      if (notif.success) {
        setNotifications(notif.data.notifications?.slice(0, 10) || []);
        setUnread(notif.data.unreadCount || 0);
      }
    }).finally(() => setLoading(false));
  }, [router]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };
  const logout = () => { localStorage.clear(); router.push("/"); };

  const acceptProject = async (projectId: string) => {
    const res = await authPost(`/api/projects/${projectId}/mentor/accept`, {});
    if (res.success) {
      flash("✅ Parrainage accepté ! L'entrepreneur a été notifié.");
      const updated = await authGet("/api/projects/mentor/my-projects");
      if (updated.success) setProjects(updated.data || []);
    } else flash("❌ " + res.message);
  };

  const declineProject = async (projectId: string) => {
    const reason = prompt("Raison du refus (optionnel) :");
    const res = await authPost(`/api/projects/${projectId}/mentor/decline`, { reason });
    if (res.success) {
      flash("Parrainage refusé");
      setProjects(p => p.filter(x => x.id !== projectId));
    } else flash("❌ " + res.message);
  };

  const handleNotifClick = async (n: any) => {
    if (!n.isRead) {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/${n.id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` }
      });
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x));
      setUnread(prev => Math.max(0, prev - 1));
    }
  };

  const getNotifLink = (n: any) => {
    if (n.type === "MESSAGE") return n.data?.fromUserId ? `/messages?to=${n.data.fromUserId}` : "/messages";
    if (n.data?.projectId) return `/projects/${n.data.projectId}`;
    return "/mentor";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-5xl animate-bounce mb-4">🎓</div>
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  const totalCommission = projects.reduce((s, p) => s + (p.mentorCommission || 0), 0);
  const activeProjects = projects.filter(p => ['ACTIVE','IN_PROGRESS','FUNDED'].includes(p.status)).length;
  const pendingProjects = projects.filter(p => p.status === 'PENDING_REVIEW').length;
  const score = user?.reputationScore ?? 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🌳</span>
            <span className="font-bold text-green-600">BAOBAB INVEST</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs bg-purple-50 text-purple-600 px-3 py-1 rounded-full font-medium hidden md:block">🎓 Mentor / Garant</span>
            <Link href="/profile" className="text-sm text-gray-600 hover:text-green-600">Mon profil</Link>
            <Link href="/notifications" className="relative group inline-block">
              <span className={`text-2xl inline-block transition-all duration-200 ${unread > 0 ? "animate-bounce" : "group-hover:scale-110 group-hover:rotate-12"}`}>🔔</span>
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse shadow-lg">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <button onClick={logout} className="text-sm text-gray-400 hover:text-red-500 transition-colors">Déconnexion</button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {msg && (
          <div className={`p-3 rounded-xl text-sm font-medium text-center mb-6 ${msg.startsWith("✅") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {msg}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bonjour, {user?.firstName} 👋</h1>
            <p className="text-gray-500 text-sm mt-1">
              Mentor / Garant · {user?.kycStatus === "VERIFIED" ? "✅ KYC Vérifié" : "⏳ KYC en attente"}
              · Score réputation : <strong className="text-green-600">{score}/100</strong>
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Projets parrainés", value: projects.length, icon: "📋", bg: "bg-blue-50", color: "text-blue-700" },
            { label: "Projets actifs", value: activeProjects, icon: "🟢", bg: "bg-green-50", color: "text-green-700" },
            { label: "En attente décision", value: pendingProjects, icon: "⏳", bg: "bg-orange-50", color: "text-orange-700" },
            { label: "Commission estimée", value: `${totalCommission.toLocaleString()} FCFA`, icon: "💰", bg: "bg-yellow-50", color: "text-yellow-700" },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-5`}>
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">

            {/* Rôle du mentor */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
              <h3 className="font-bold text-blue-900 mb-3">🎓 Ton rôle de Mentor / Garant</h3>
              <div className="grid grid-cols-3 gap-3 text-center text-sm mb-4">
                {[
                  { icon: "📋", label: "Max simultanés", value: `${activeProjects}/5 projets` },
                  { icon: "💰", label: "Ta commission", value: `${fees.commission_mentor}% du montant levé (à la clôture)` },
                  { icon: "⭐", label: "Ton score", value: `${score}/100` },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl p-3">
                    <div className="text-2xl mb-1">{s.icon}</div>
                    <div className="font-bold text-blue-900 text-sm">{s.value}</div>
                    <div className="text-xs text-blue-600">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="text-sm text-blue-700 space-y-1">
                <div>⚠️ Ton identité est <strong>publiquement engagée</strong> sur chaque projet parrainé</div>
                <div>⚠️ Maximum <strong>5 projets simultanés</strong></div>
                <div>✅ Tu perçois <strong>1% des retours</strong> des projets terminés avec succès</div>
              </div>
            </div>

            {/* Projets */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 text-lg mb-5">Projets que je parraine</h3>
              {projects.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-5xl mb-3">🌱</div>
                  <p className="text-gray-500 mb-2">Aucun projet parrainé pour l'instant</p>
                  <p className="text-sm text-gray-400">Les entrepreneurs choisiront ton profil lors de la soumission</p>
                </div>
              ) : projects.map((p: any) => {
                const s = STATUS_CONFIG[p.status] || STATUS_CONFIG.DRAFT;
                const fundingPercent = Math.round((p.raisedAmount / p.goalAmount) * 100);
                const isPending = p.status === 'PENDING_REVIEW';
                return (
                  <div key={p.id} className={`border rounded-2xl p-5 mb-4 ${isPending ? "border-orange-200 bg-orange-50" : "border-gray-100 hover:border-green-200"} transition-colors`}>
                    {isPending && (
                      <div className="bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1.5 rounded-xl mb-3 flex items-center gap-2">
                        ⚡ Action requise — Cet entrepreneur t'a choisi comme mentor
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.color}`}>{s.label}</span>
                          <span className="text-xs text-gray-400">{p.sector} · {p.city}</span>
                        </div>
                        <h4 className="font-bold text-gray-900">{p.title}</h4>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Par {p.entrepreneur?.firstName} {p.entrepreneur?.lastName} · Score : {p.entrepreneur?.reputationScore}/100
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-green-700">{(p.raisedAmount || 0).toLocaleString()} FCFA</div>
                        <div className="text-xs text-gray-400">/ {p.goalAmount?.toLocaleString()} FCFA</div>
                      </div>
                    </div>
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{p._count?.investments || 0} investisseur(s)</span>
                        <span className="font-bold text-green-600">{fundingPercent}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(fundingPercent, 100)}%` }} />
                      </div>
                    </div>
                    {p.mentorCommission > 0 && (
                      <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-2 mb-3 text-center text-sm">
                        💰 Commission estimée : <strong className="text-yellow-700">{p.mentorCommission.toLocaleString()} FCFA</strong>
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {isPending ? (
                        <>
                          <button onClick={() => acceptProject(p.id)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-xl text-sm transition-colors">
                            ✅ Accepter
                          </button>
                          <button onClick={() => declineProject(p.id)}
                            className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2 px-4 rounded-xl text-sm border border-red-200 transition-colors">
                            ❌ Refuser
                          </button>
                        </>
                      ) : (
                        <>
                          <Link href={`/projects/${p.id}`} className="text-xs bg-gray-100 text-gray-700 px-3 py-2 rounded-xl font-medium hover:bg-gray-200">
                            🔍 Voir le projet
                          </Link>
                          {p.status === 'ACTIVE' && (
                            <Link href={`/feed/${p.id}`} className="text-xs bg-green-50 text-green-700 px-3 py-2 rounded-xl font-medium hover:bg-green-100 border border-green-200">
                              📸 Feed investisseurs
                            </Link>
                          )}
                          <Link href={`/messages?to=${p.entrepreneurId}`} className="text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded-xl font-medium hover:bg-blue-100 border border-blue-200">
                            💬 Contacter
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Notifications */}
            {notifications.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100">
                <div className="flex items-center justify-between p-5 cursor-pointer" onClick={() => setNotifCollapsed(!notifCollapsed)}>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">🔔 Notifications</h3>
                    {unread > 0 && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">{unread}</span>}
                  </div>
                  <span className="text-gray-400 text-lg">{notifCollapsed ? "▼" : "▲"}</span>
                </div>
                {!notifCollapsed && (
                  <div className="px-5 pb-5 space-y-2">
                    {(showAllNotifs ? notifications : notifications.slice(0, 3)).map((n: any) => (
                      <Link key={n.id} href={getNotifLink(n)}
                        onClick={() => handleNotifClick(n)}
                        className={`block p-3 rounded-xl text-sm transition-all hover:bg-purple-50 ${n.isRead ? "bg-gray-50 opacity-70" : "bg-purple-50 border border-purple-100"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className={`text-gray-900 ${!n.isRead ? "font-bold" : "font-medium"}`}>{n.title}</div>
                            <div className="text-gray-500 text-xs mt-0.5 line-clamp-2">{n.body}</div>
                          </div>
                          {!n.isRead && <span className="w-2.5 h-2.5 bg-purple-500 rounded-full flex-shrink-0 mt-1.5"></span>}
                        </div>
                      </Link>
                    ))}
                    {notifications.length > 3 && (
                      <button onClick={() => setShowAllNotifs(!showAllNotifs)}
                        className="w-full text-center text-xs text-purple-600 hover:underline py-1">
                        {showAllNotifs ? "▲ Voir moins" : `▼ Voir ${notifications.length - 3} de plus`}
                      </button>
                    )}
                    <Link href="/notifications" className="block text-center text-xs text-gray-400 hover:text-purple-600 mt-1">
                      Voir toutes les notifications →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Wallet Mentor */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-3">💳 Mon Wallet</h3>
              <div className="bg-green-50 rounded-xl p-4 text-center mb-2">
                <div className="text-2xl font-bold text-green-700">{(user?.wallet?.balance || 0).toLocaleString()} FCFA</div>
                <div className="text-xs text-green-600 mt-1">Solde disponible</div>
              </div>
              <div className="bg-yellow-50 rounded-xl p-3 text-center">
                <div className="text-sm font-bold text-yellow-700">{totalCommission.toLocaleString()} FCFA</div>
                <div className="text-xs text-gray-400">Commissions estimées (projets actifs)</div>
              </div>
              <Link href="/wallet/history" className="block text-center text-xs text-green-600 hover:underline mt-2">
                Voir l&apos;historique →
              </Link>
              <button onClick={exportStats} className="w-full mt-2 text-xs border border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600 py-1.5 rounded-lg transition-colors">
                📥 Exporter CSV
              </button>
              <button onClick={async () => {
                const token = localStorage.getItem("accessToken");
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/pdf/report/mentor`, { headers: { Authorization: `Bearer ${token}` } });
                const blob = await res.blob();
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "rapport-mentor.pdf"; a.click(); URL.revokeObjectURL(a.href);
              }} className="w-full mt-1 text-xs border border-purple-200 text-purple-600 hover:bg-purple-50 py-1.5 rounded-lg transition-colors">
                📄 Télécharger rapport PDF
              </button>
            </div>

            {/* Score réputation */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-3">⭐ Score de Réputation</h3>
              <div className="text-center mb-3">
                <div className="text-4xl font-bold text-green-600">{score}</div>
                <div className="text-xs text-gray-500">/ 100</div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2">
                <div className={`h-2.5 rounded-full ${score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${score}%` }} />
              </div>
              <p className="text-xs text-gray-400 text-center">
                {score >= 80 ? "🏆 Excellent — Les entrepreneurs te font confiance" :
                 score >= 60 ? "👍 Bon — Continue à bien accompagner" :
                 "⚠️ En baisse — Surveille tes projets"}
              </p>
            </div>

            {/* Responsabilités */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-3">⚠️ Tes responsabilités</h3>
              <div className="space-y-2 text-xs">
                {[
                  { icon: "👁️", text: "Surveiller chaque projet parrainé" },
                  { icon: "📸", text: "Encourager les rapports mensuels" },
                  { icon: "🚨", text: "Alerter en cas d'anomalie" },
                  { icon: "⚖️", text: "Profil mis à jour si fraude prouvée" },
                  { icon: "📋", text: "Max 5 projets simultanés" },
                ].map(item => (
                  <div key={item.text} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                    <span>{item.icon}</span>
                    <span className="text-gray-600">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Liens rapides */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-3">🔗 Liens rapides</h3>
              <div className="space-y-1">
                {[
                  { href: "/messages", icon: "💬", label: "Messagerie" },
                  { href: "/notifications", icon: "🔔", label: "Notifications" },
                  { href: "/projects", icon: "🔍", label: "Voir les projets" },
                  { href: "/academy", icon: "📚", label: "Académie Baobab" },
                  { href: "/referral", icon: "🌳", label: "Parrainer un ami" },
                  { href: "/profile", icon: "👤", label: "Mon profil" },
                ].map(link => (
                  <Link key={link.href} href={link.href}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-purple-50 transition-colors group">
                    <span className="text-lg">{link.icon}</span>
                    <span className="text-sm text-gray-600 group-hover:text-purple-600">{link.label}</span>
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
