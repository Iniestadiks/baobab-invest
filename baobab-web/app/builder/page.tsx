"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authGet, authPost, authPatch } from "@/lib/api";
import { useRoleRedirect } from "@/hooks/useRoleRedirect";

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");

const BADGE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  SEMEUR:          { label: "Semeur",          icon: "🌱", color: "bg-green-100 text-green-700" },
  JARDINIER:       { label: "Jardinier",       icon: "🌿", color: "bg-emerald-100 text-emerald-700" },
  BAOBAB:          { label: "Baobab",          icon: "🌳", color: "bg-teal-100 text-teal-700" },
  GRAND_BATISSEUR: { label: "Grand Bâtisseur", icon: "🏆", color: "bg-yellow-100 text-yellow-700" },
};

const SECTORS = [
  "BANQUE_FINANCE","TECH","AGRICULTURE","SANTE","EDUCATION",
  "COMMERCE","ENERGIE","IMMOBILIER","TELECOMS","INSTITUTION","AUTRE"
];

export default function BuilderDashboard() {
  const router = useRouter();
  useRoleRedirect(["BUILDER"]);

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [contributions, setContributions] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [fundStats, setFundStats] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [flashMsg, setFlashMsg] = useState("");
  const [showContribForm, setShowContribForm] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ companyName: "", sector: "", description: "", website: "", country: "SN", isPublic: true });
  const [contribForm, setContribForm] = useState({ amount: "", projectId: "", message: "", anonymous: false, operator: "WAVE", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  const flash = (m: string) => { setFlashMsg(m); setTimeout(() => setFlashMsg(""), 4000); };

  const load = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/auth/login"); return; }
    const [me, myContribs, stats, projs, notif] = await Promise.all([
      authGet("/api/auth/me"),
      authGet("/api/fund/my-contributions"),
      authGet("/api/fund/stats"),
      authGet("/api/projects?status=ACTIVE&limit=10"),
      authGet("/api/notifications"),
    ]);
    if (me.success) { setUser(me.data); setProfile(me.data.builderProfile); }
    if (myContribs.success) {
      setContributions(myContribs.data.contributions || []);
      setBadges(myContribs.data.badges || []);
    }
    if (stats.success) setFundStats(stats.data?.fund || {});
    if (projs.success) setProjects(projs.data?.projects || projs.data || []);
    if (notif.success) { setNotifications(notif.data.notifications?.slice(0, 8) || []); setUnread(notif.data.unreadCount || 0); }
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const saveProfile = async () => {
    setSubmitting(true);
    // Upsert builder profile via auth me update
    const res = await authPatch("/api/builder/profile", profileForm);
    if (res.success) { flash("✅ Profil mis à jour"); setEditProfile(false); load(); }
    else flash("❌ " + res.message);
    setSubmitting(false);
  };

  const contribute = async () => {
    if (!contribForm.amount || Number(contribForm.amount) < 500) { flash("❌ Montant minimum 500 FCFA"); return; }
    setSubmitting(true);
    const token = localStorage.getItem("accessToken");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/fund/contribute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        amount: Number(contribForm.amount),
        projectId: contribForm.projectId || null,
        message: contribForm.message,
        anonymous: contribForm.anonymous,
        paymentMethod: contribForm.operator,
        operator: contribForm.operator,
        guestPhone: contribForm.phone,
      })
    });
    const data = await res.json();
    if (data.success) {
      // Confirmer immédiatement (mode test)
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/fund/confirm/${data.data.contributionId}`, { method: "POST" });
      flash(`✅ Contribution de ${fmt(Number(contribForm.amount))} FCFA confirmée !`);
      setShowContribForm(false);
      setContribForm({ amount: "", projectId: "", message: "", anonymous: false, operator: "WAVE", phone: "" });
      load();
    } else flash("❌ " + data.message);
    setSubmitting(false);
  };

  const downloadPDF = async () => {
    const token = localStorage.getItem("accessToken");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/fund/admin/export?format=csv`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rapport-batisseur-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">Chargement...</p>
      </div>
    </div>
  );

  const totalDonated = contributions.reduce((s, c) => s + (c.amount || 0), 0);
  const projectsSupported = [...new Set(contributions.filter(c => c.projectId).map(c => c.projectId))].length;
  const wallet = user?.wallet;

  const TABS = [
    { id: "overview",      label: "Vue générale",    icon: "📊" },
    { id: "contributions", label: "Mes contributions", icon: "💝", badge: contributions.length },
    { id: "projects",      label: "Projets à soutenir", icon: "🚀" },
    { id: "profile",       label: "Mon profil",       icon: "🏗️" },
    { id: "impact",        label: "Mon impact",       icon: "🌍" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Flash */}
      {flashMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-medium">{flashMsg}</div>
      )}

      {/* NAV */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">🏗️</span>
            </div>
            <span className="font-bold text-gray-900 hidden sm:block">BAOBAB INVEST</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2.5 py-1 rounded-full font-bold hidden sm:block">
              🏗️ Bâtisseur{profile?.verified ? " ✅" : ""}
            </span>
            {/* Notifications */}
            <div className="relative">
              <button onClick={() => setShowNotifPanel(!showNotifPanel)} className="relative p-2 hover:bg-gray-100 rounded-xl">
                <span className="text-xl">🔔</span>
                {unread > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{unread > 9 ? "9+" : unread}</span>}
              </button>
              {showNotifPanel && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 max-h-96 overflow-y-auto">
                  <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white">
                    <span className="font-bold text-gray-900">Notifications</span>
                    <button onClick={() => setShowNotifPanel(false)} className="text-gray-400 text-lg">✕</button>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-gray-400 text-sm">Aucune notification</div>
                  ) : notifications.map((n: any) => (
                    <div key={n.id} className={`p-3 border-b border-gray-50 text-xs ${!n.isRead ? "bg-yellow-50" : ""}`}>
                      <div className="font-medium text-gray-900">{n.title}</div>
                      <div className="text-gray-500 mt-0.5">{n.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Link href="/profile" className="flex items-center gap-1.5 hover:bg-gray-100 px-2 py-1.5 rounded-xl">
              <div className="w-7 h-7 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
              <span className="text-sm text-gray-700 hidden sm:block font-medium">{user?.firstName}</span>
            </Link>
            <button onClick={() => { localStorage.clear(); router.push("/"); }} className="text-xs text-gray-400 hover:text-red-500 hidden sm:block">Déconnexion</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* HERO BUILDER */}
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 rounded-3xl p-6 mb-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/10 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-yellow-400/5 rounded-full -ml-24 -mb-24"></div>
          <div className="relative">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
              <div>
                <p className="text-gray-400 text-sm">Bonjour, {user?.firstName}</p>
                <h1 className="text-2xl font-bold">Espace Bâtisseur 🏗️</h1>
                {profile?.companyName && <p className="text-yellow-400 text-sm mt-1">{profile.companyName}</p>}
                {!profile?.verified && (
                  <div className="mt-2 bg-yellow-400/20 border border-yellow-400/30 rounded-xl px-3 py-1.5 text-xs text-yellow-300 inline-block">
                    ⏳ Vérification en attente — Notre équipe examine votre profil
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowContribForm(true)}
                  className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-4 py-2 rounded-xl text-sm">
                  💝 Contribuer
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-gray-400 text-xs mb-1">Total donné</div>
                <div className="text-2xl font-bold text-yellow-400">{fmt(totalDonated)} FCFA</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs mb-1">Projets soutenus</div>
                <div className="text-2xl font-bold">{projectsSupported}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs mb-1">Contributions</div>
                <div className="text-2xl font-bold">{contributions.length}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs mb-1">Wallet</div>
                <div className="text-2xl font-bold">{fmt(wallet?.balance || 0)} FCFA</div>
              </div>
            </div>
            {/* Badges */}
            {badges.length > 0 && (
              <div className="flex gap-2 mt-4 flex-wrap">
                {badges.map((b: any) => (
                  <span key={b.badge} className={`text-xs px-3 py-1 rounded-full font-bold ${BADGE_CONFIG[b.badge]?.color || "bg-gray-100 text-gray-700"}`}>
                    {BADGE_CONFIG[b.badge]?.icon} {BADGE_CONFIG[b.badge]?.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all relative ${activeTab === tab.id ? "bg-yellow-500 text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:border-yellow-300 hover:text-yellow-600"}`}>
              <span>{tab.icon}</span><span>{tab.label}</span>
              {tab.badge && tab.badge > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.id ? "bg-white/30 text-white" : "bg-gray-100 text-gray-600"}`}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* VUE GÉNÉRALE */}
        {activeTab === "overview" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              {/* Stats fonds solidaire */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4">🌱 Fonds Solidaire BAOBAB</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total collecté", value: fmt(fundStats?.totalReceived || 0) + " F", color: "text-green-700", bg: "bg-green-50" },
                    { label: "Disponible", value: fmt(fundStats?.available || 0) + " F", color: "text-blue-700", bg: "bg-blue-50" },
                    { label: "Projets aidés", value: String(fundStats?.totalProjects || 0), color: "text-purple-700", bg: "bg-purple-50" },
                  ].map(s => (
                    <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                      <div className={`font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
                <Link href="/fund" className="block mt-3 text-center text-sm text-yellow-600 hover:underline font-medium">
                  Voir le fonds solidaire →
                </Link>
              </div>

              {/* Dernières contributions */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4">💝 Mes dernières contributions</h3>
                {contributions.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">💝</div>
                    <p className="text-gray-400 text-sm mb-3">Aucune contribution pour l'instant</p>
                    <button onClick={() => setShowContribForm(true)} className="bg-yellow-500 text-white text-sm px-4 py-2 rounded-xl font-bold hover:bg-yellow-600">
                      Faire ma première contribution
                    </button>
                  </div>
                ) : contributions.slice(0, 3).map((c: any) => (
                  <div key={c.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-2">
                    <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center text-yellow-700 font-bold text-sm">💝</div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm">{c.project?.title || "Fonds général"}</div>
                      <div className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString("fr-FR")}</div>
                      {c.message && <div className="text-xs text-gray-500 italic">"{c.message}"</div>}
                    </div>
                    <div className="font-bold text-yellow-700">{fmt(c.amount)} FCFA</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Badges */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 mb-3 text-sm">🏆 Mes badges</h3>
                {badges.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-400 text-xs">Contribuez pour gagner des badges !</p>
                    <div className="flex justify-center gap-2 mt-3">
                      {Object.entries(BADGE_CONFIG).map(([k, v]) => (
                        <div key={k} className="opacity-30 text-center">
                          <div className="text-xl">{v.icon}</div>
                          <div className="text-xs text-gray-400">{v.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {badges.map((b: any) => (
                      <div key={b.badge} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${BADGE_CONFIG[b.badge]?.color || ""}`}>
                        <span className="text-lg">{BADGE_CONFIG[b.badge]?.icon}</span>
                        <div>
                          <div className="font-bold text-xs">{BADGE_CONFIG[b.badge]?.label}</div>
                          <div className="text-xs opacity-70">{new Date(b.awardedAt).toLocaleDateString("fr-FR")}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions rapides */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 mb-3 text-sm">Actions rapides</h3>
                <div className="space-y-2">
                  {[
                    { label: "Contribuer au fonds", icon: "💝", action: () => setShowContribForm(true), color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
                    { label: "Voir le fonds solidaire", icon: "🌱", href: "/fund", color: "bg-green-50 text-green-700 border-green-200" },
                    { label: "Explorer les projets", icon: "🚀", href: "/projects", color: "bg-blue-50 text-blue-700 border-blue-200" },
                    { label: "Mon profil public", icon: "👁️", action: () => setActiveTab("profile"), color: "bg-gray-50 text-gray-700 border-gray-200" },
                    { label: "Historique wallet", icon: "💳", href: "/wallet/history", color: "bg-purple-50 text-purple-700 border-purple-200" },
                  ].map(l => (
                    l.href ? (
                      <Link key={l.label} href={l.href} className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs font-medium hover:opacity-80 ${l.color}`}>
                        <span className="text-base">{l.icon}</span>{l.label}
                      </Link>
                    ) : (
                      <button key={l.label} onClick={l.action} className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-xs font-medium hover:opacity-80 ${l.color}`}>
                        <span className="text-base">{l.icon}</span>{l.label}
                      </button>
                    )
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MES CONTRIBUTIONS */}
        {activeTab === "contributions" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-bold text-gray-900 text-lg">Mes contributions ({contributions.length})</h2>
              <div className="flex gap-2">
                <button onClick={downloadPDF} className="bg-gray-100 text-gray-700 text-sm px-4 py-2 rounded-xl font-medium hover:bg-gray-200">
                  📥 Exporter CSV
                </button>
                <button onClick={() => setShowContribForm(true)} className="bg-yellow-500 text-white text-sm px-4 py-2 rounded-xl font-bold hover:bg-yellow-600">
                  + Contribuer
                </button>
              </div>
            </div>

            {/* Total */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total donné", value: fmt(totalDonated) + " FCFA", color: "text-yellow-700", bg: "bg-yellow-50" },
                { label: "Projets soutenus", value: String(projectsSupported), color: "text-green-700", bg: "bg-green-50" },
                { label: "Contributions", value: String(contributions.length), color: "text-blue-700", bg: "bg-blue-50" },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center`}>
                  <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {contributions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="text-5xl mb-3">💝</div>
                <h3 className="font-bold text-gray-900 mb-2">Aucune contribution</h3>
                <button onClick={() => setShowContribForm(true)} className="bg-yellow-500 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-yellow-600 text-sm">
                  Faire ma première contribution
                </button>
              </div>
            ) : contributions.map((c: any) => (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-2xl flex items-center justify-center text-2xl">💝</div>
                <div className="flex-1">
                  <div className="font-bold text-gray-900">{c.project?.title || "Fonds général BAOBAB"}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{c.anonymous ? "Contribution anonyme" : "Contribution publique"}</div>
                  {c.message && <div className="text-xs text-gray-400 italic mt-1">"{c.message}"</div>}
                  <div className="text-xs text-gray-400 mt-1">{new Date(c.createdAt).toLocaleDateString("fr-FR", { day:"numeric", month:"long", year:"numeric" })}</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-yellow-700">{fmt(c.amount)} FCFA</div>
                  <div className="text-xs text-gray-400">Net fonds : {fmt(c.netAmount)} F</div>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-lg">✅ Confirmé</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PROJETS À SOUTENIR */}
        {activeTab === "projects" && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-900 text-lg">🚀 Projets à soutenir</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p: any) => {
                const pct = Math.round(((p.raisedAmount || 0) / (p.goalAmount || 1)) * 100);
                return (
                  <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-medium">{p.sector}</span>
                      <span className="text-xs text-gray-400">📍 {p.city}</span>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2 line-clamp-1">{p.title}</h3>
                    <p className="text-gray-500 text-xs mb-3 line-clamp-2">{p.description}</p>
                    <div className="bg-gray-100 rounded-full h-2 mb-1">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(100, pct)}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mb-4">
                      <span>{fmt(p.raisedAmount || 0)} FCFA levés</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/projects/${p.id}`} className="flex-1 text-center border border-gray-200 text-gray-600 text-xs py-2 rounded-xl hover:bg-gray-50">
                        Voir le projet
                      </Link>
                      <button onClick={() => { setContribForm(f => ({ ...f, projectId: p.id })); setShowContribForm(true); }}
                        className="flex-1 bg-yellow-500 text-white text-xs py-2 rounded-xl font-bold hover:bg-yellow-600">
                        💝 Soutenir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PROFIL */}
        {activeTab === "profile" && (
          <div className="max-w-2xl space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-bold text-gray-900">🏗️ Mon profil Bâtisseur</h3>
                <button onClick={() => { setEditProfile(!editProfile); setProfileForm({ companyName: profile?.companyName || "", sector: profile?.sector || "", description: profile?.description || "", website: profile?.website || "", country: profile?.country || "SN", isPublic: profile?.isPublic ?? true }); }}
                  className="text-sm text-yellow-600 hover:underline font-medium">
                  {editProfile ? "Annuler" : "✏️ Modifier"}
                </button>
              </div>

              {!editProfile ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-lg">{user?.firstName} {user?.lastName}</div>
                      <div className="text-yellow-600 font-medium">{profile?.companyName || "Sans organisation"}</div>
                      <div className="text-xs text-gray-400">{profile?.sector || "Secteur non renseigné"}</div>
                    </div>
                  </div>
                  {profile?.description && <p className="text-gray-600 text-sm bg-gray-50 rounded-xl p-3">{profile.description}</p>}
                  {profile?.website && (
                    <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm hover:underline flex items-center gap-1">
                      🌐 {profile.website}
                    </a>
                  )}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-lg font-medium ${profile?.verified ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                      {profile?.verified ? "✅ Profil vérifié" : "⏳ En attente de vérification"}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-lg font-medium ${profile?.isPublic ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                      {profile?.isPublic ? "👁️ Profil public" : "🔒 Profil privé"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Entreprise / Organisation</label>
                    <input value={profileForm.companyName} onChange={e => setProfileForm(f => ({ ...f, companyName: e.target.value }))}
                      placeholder="Ex: Groupe Bolloré, Orange CI..."
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-yellow-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Secteur</label>
                    <select value={profileForm.sector} onChange={e => setProfileForm(f => ({ ...f, sector: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-yellow-400">
                      <option value="">Sélectionner...</option>
                      {SECTORS.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
                    <textarea value={profileForm.description} onChange={e => setProfileForm(f => ({ ...f, description: e.target.value }))}
                      rows={3} placeholder="Présentez votre organisation et vos objectifs..."
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-yellow-400 resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Site web</label>
                    <input value={profileForm.website} onChange={e => setProfileForm(f => ({ ...f, website: e.target.value }))}
                      placeholder="https://..."
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-yellow-400" />
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={profileForm.isPublic} onChange={e => setProfileForm(f => ({ ...f, isPublic: e.target.checked }))}
                      className="w-4 h-4 accent-yellow-500" />
                    <span className="text-sm text-gray-700">Profil visible publiquement (Hall of Fame)</span>
                  </label>
                  <button onClick={saveProfile} disabled={submitting}
                    className="w-full bg-yellow-500 text-white font-bold py-3 rounded-xl hover:bg-yellow-600 disabled:opacity-50">
                    {submitting ? "Sauvegarde..." : "💾 Sauvegarder le profil"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* IMPACT */}
        {activeTab === "impact" && (
          <div className="space-y-5">
            <h2 className="font-bold text-gray-900 text-lg">🌍 Mon impact social</h2>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl p-6">
                <h3 className="font-bold text-gray-900 mb-4">📊 Statistiques d'impact</h3>
                <div className="space-y-3">
                  {[
                    { label: "Total donné au fonds", value: fmt(totalDonated) + " FCFA", icon: "💝" },
                    { label: "Net reversé aux projets", value: fmt(Math.round(totalDonated * 0.9)) + " FCFA", icon: "🚀" },
                    { label: "Projets soutenus", value: String(projectsSupported), icon: "🏗️" },
                    { label: "Contributions totales", value: String(contributions.length), icon: "📋" },
                  ].map(s => (
                    <div key={s.label} className="flex justify-between items-center py-2 border-b border-yellow-100">
                      <span className="text-sm text-gray-600 flex items-center gap-2"><span>{s.icon}</span>{s.label}</span>
                      <span className="font-bold text-gray-900">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-6">
                <h3 className="font-bold text-gray-900 mb-4">🏆 Mes badges</h3>
                <div className="space-y-3">
                  {Object.entries(BADGE_CONFIG).map(([key, badge]) => {
                    const earned = badges.find((b: any) => b.badge === key);
                    const thresholds: Record<string, string> = { SEMEUR: "500 FCFA", JARDINIER: "5 000 FCFA", BAOBAB: "25 000 FCFA", GRAND_BATISSEUR: "100 000 FCFA" };
                    return (
                      <div key={key} className={`flex items-center gap-3 p-3 rounded-xl ${earned ? badge.color : "bg-gray-50 opacity-40"}`}>
                        <span className="text-2xl">{badge.icon}</span>
                        <div className="flex-1">
                          <div className="font-bold text-sm">{badge.label}</div>
                          <div className="text-xs opacity-70">Dès {thresholds[key]}</div>
                        </div>
                        {earned ? <span className="text-xs font-bold">✅ Obtenu</span> : <span className="text-xs">🔒</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Rapport */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <h3 className="font-bold text-gray-900 mb-3">📄 Rapport d'impact</h3>
              <p className="text-gray-500 text-sm mb-4">Téléchargez votre rapport d'impact pour partager votre contribution avec vos partenaires.</p>
              <button onClick={downloadPDF} className="bg-yellow-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-yellow-600 text-sm">
                📥 Télécharger mon rapport (CSV)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL CONTRIBUTION */}
      {showContribForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-gray-900">💝 Contribuer au fonds</h3>
              <button onClick={() => setShowContribForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Montant (FCFA)</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000].map(v => (
                    <button key={v} onClick={() => setContribForm(f => ({ ...f, amount: String(v) }))}
                      className={`py-2 rounded-xl text-xs font-medium border transition-colors ${contribForm.amount === String(v) ? "bg-yellow-500 text-white border-yellow-500" : "bg-gray-50 text-gray-700 border-gray-200 hover:border-yellow-300"}`}>
                      {v >= 1000000 ? `${v/1000000}M` : v >= 1000 ? `${v/1000}k` : v}
                    </button>
                  ))}
                </div>
                <input type="number" value={contribForm.amount} onChange={e => setContribForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="Montant personnalisé..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yellow-400" />
                {contribForm.amount && Number(contribForm.amount) >= 500 && (
                  <div className="text-xs text-gray-500 mt-1">Net au fonds : <strong className="text-green-600">{fmt(Math.round(Number(contribForm.amount) * 0.9))} FCFA</strong></div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Projet spécifique (optionnel)</label>
                <select value={contribForm.projectId} onChange={e => setContribForm(f => ({ ...f, projectId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yellow-400">
                  <option value="">Fonds général</option>
                  {projects.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Opérateur</label>
                <div className="grid grid-cols-3 gap-2">
                  {["WAVE", "ORANGE_MONEY", "FREE_MONEY"].map(op => (
                    <button key={op} onClick={() => setContribForm(f => ({ ...f, operator: op }))}
                      className={`py-2 rounded-xl text-xs font-medium border ${contribForm.operator === op ? "bg-yellow-500 text-white border-yellow-500" : "bg-gray-50 text-gray-700 border-gray-200"}`}>
                      {op === "WAVE" ? "🔵 Wave" : op === "ORANGE_MONEY" ? "🟠 Orange" : "🟢 Free"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Téléphone Mobile Money</label>
                <input type="tel" value={contribForm.phone} onChange={e => setContribForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="77 XXX XX XX"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yellow-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Message (optionnel)</label>
                <textarea value={contribForm.message} onChange={e => setContribForm(f => ({ ...f, message: e.target.value }))}
                  rows={2} placeholder="Un mot d'encouragement..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yellow-400 resize-none" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={contribForm.anonymous} onChange={e => setContribForm(f => ({ ...f, anonymous: e.target.checked }))}
                  className="w-4 h-4 accent-yellow-500" />
                <span className="text-sm text-gray-700">Contribution anonyme</span>
              </label>
              <button onClick={contribute} disabled={submitting || !contribForm.amount || Number(contribForm.amount) < 500}
                className="w-full bg-yellow-500 text-white font-bold py-4 rounded-2xl hover:bg-yellow-600 disabled:opacity-50 text-lg">
                {submitting ? "Traitement..." : `💝 Contribuer ${contribForm.amount ? fmt(Number(contribForm.amount)) : "0"} FCFA`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
