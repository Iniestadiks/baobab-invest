"use client";
import { ReputationWidget } from "@/components/ReputationWidget";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authGet, authPost } from "@/lib/api";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";

const LEVELS = [
  { name: "Graine",      min: 0,      max: 10000,   icon: "🌱", color: "text-green-600",  bg: "bg-green-50" },
  { name: "Jeune Baobab",min: 10000,  max: 50000,   icon: "🌿", color: "text-emerald-600",bg: "bg-emerald-50" },
  { name: "Baobab",      min: 50000,  max: 200000,  icon: "🌳", color: "text-green-700",  bg: "bg-green-100" },
  { name: "Grand Baobab",min: 200000, max: Infinity, icon: "🏅", color: "text-yellow-600", bg: "bg-yellow-50" },
];
const COLORS = ["#16a34a","#2563eb","#d97706","#7c3aed","#dc2626","#0891b2"];

function fmt(n: number) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0"); }
function getLevel(t: number) { return LEVELS.find(l => t >= l.min && t < l.max) || LEVELS[0]; }
function getNextLevel(t: number) { const i = LEVELS.findIndex(l => t >= l.min && t < l.max); return i < LEVELS.length-1 ? LEVELS[i+1] : null; }

export default function DashboardPage() {
  const { config: fees } = usePlatformConfig();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [investments, setInvestments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [repayments, setRepayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedInv, setExpandedInv] = useState<Record<string, boolean>>({});
  const [chartPeriod, setChartPeriod] = useState<"all"|"3m"|"6m">("all");
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [flashMsg, setFlashMsg] = useState("");
  const [savingsAmount, setSavingsAmount] = useState("");
  const [searchInv, setSearchInv] = useState("");
  const [savingsDay, setSavingsDay] = useState("");

  const flash = (msg: string) => { setFlashMsg(msg); setTimeout(() => setFlashMsg(""), 4000); };

  const loadData = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.replace("/auth/login"); return; }
    const [inv, me, notif, rep] = await Promise.all([
      authGet("/api/investments/my"),
      authGet("/api/auth/me"),
      authGet("/api/notifications?limit=10"),
      authGet("/api/repayment/investor/received"),
    ]);
    if (inv.success) { setInvestments(inv.data.investments || []); setStats(inv.data); }
    if (me.success) { setWallet(me.data.wallet); setUser(me.data); }
    if (notif.success) setNotifications(notif.data.notifications || []);
    if (rep.success) setRepayments(rep.data || []);
    setLoading(false);
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const downloadPDF = async (url: string, filename: string) => {
    const token = localStorage.getItem("accessToken");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { flash("❌ Erreur PDF"); return; }
      const blob = await res.blob();
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    } catch { flash("❌ Erreur téléchargement"); }
  };

  const exportCSV = () => {
    const token = localStorage.getItem("accessToken");
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/exports/investor`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob()).then(blob => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "mes-investissements.csv"; a.click(); });
  };

  const markAllRead = async () => {
    await authPost("/api/notifications/read-all", {}).catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500 font-medium">Chargement de votre portfolio...</p>
      </div>
    </div>
  );

  const totalInvested = stats?.totalInvested || 0;
  const totalExpected = stats?.totalExpected || 0;
  const totalReturned = stats?.totalReturned || 0;
  const balance = wallet?.balance || 0;
  const escrow = wallet?.escrowBalance || 0;
  const level = getLevel(totalInvested);
  const nextLevel = getNextLevel(totalInvested);
  const levelProgress = nextLevel ? Math.min(((totalInvested - level.min) / (nextLevel.min - level.min)) * 100, 100) : 100;
  const unread = notifications.filter(n => !n.isRead).length;
  const projetsActifs = investments.filter(i => i.project?.status !== "COMPLETED").length;
  const projetsTermines = investments.filter(i => i.project?.status === "COMPLETED").length;
  const baobabRate = fees?.commission_baobab_return || 5;
  const paydunyaRate = fees?.paydunya_payout || 2;
  // totalExpected vient du backend qui a deja applique les frais
  const totalNetReturn = totalExpected;
  const gainNet = Math.max(0, totalNetReturn - totalInvested);
  const rendementMoyen = totalInvested > 0 ? ((gainNet / totalInvested) * 100).toFixed(1) : "0";

  const now = Date.now();
  const filteredInv = investments.filter(inv => {
    if (chartPeriod === "all") return true;
    const months = chartPeriod === "3m" ? 3 : 6;
    return new Date(inv.createdAt).getTime() > now - months * 30 * 24 * 60 * 60 * 1000;
  });
  const sortedInv = [...filteredInv].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  let cumInv = 0, cumNet = 0;
  const chartData = sortedInv.map(inv => {
    cumInv += inv.amount;
    const nr = inv.expectedReturn || 0;
    cumNet += nr;
    return { name: new Date(inv.createdAt).toLocaleDateString("fr-FR", { day:"numeric", month:"short" }), "Investi": cumInv, "Retour net": cumNet };
  });
  const sectorData = Object.entries(investments.reduce((acc: any, inv) => { const s = inv.project?.sector || "Autre"; acc[s] = (acc[s]||0) + inv.amount; return acc; }, {})).map(([name, value]) => ({ name, value }));
  const projectData = investments.slice(0,5).map(inv => ({ name: (inv.project?.title||"").substring(0,12), investi: inv.amount, retour: Math.round((inv.expectedReturn||0) * (1 - baobabRate/100 - paydunyaRate/100)) }));

  const TABS = [
    { id: "overview",     label: "Vue générale",    icon: "📊" },
    { id: "investments",  label: "Investissements", icon: "💼", badge: investments.length },
    { id: "repayments",   label: "Remboursements",  icon: "💸", badge: repayments.length },
    { id: "wallet",       label: "Wallet",          icon: "💳" },
    { id: "reports",      label: "Rapports",        icon: "📄" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {flashMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-medium">{flashMsg}</div>
      )}

      {/* KYC banner */}
      {user?.kycStatus !== "VERIFIED" && (
        <div className="bg-orange-50 border-b border-orange-200 px-6 py-2.5 flex items-center justify-between">
          <span className="text-sm text-orange-800 font-medium">⚠️ {user?.kycStatus === "PENDING" ? "KYC en cours de vérification (24h)" : "Vérifiez votre identité pour investir"}</span>
          <Link href="/kyc" className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-xl font-bold">Vérifier →</Link>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-xl flex items-center justify-center"><span className="text-white font-bold text-sm">B</span></div>
            <span className="font-bold text-gray-900 hidden sm:block">BAOBAB INVEST</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/projects" className="text-sm text-gray-500 hover:text-green-600 hidden sm:block font-medium">🔍 Explorer</Link>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${level.bg} ${level.color}`}>{level.icon} {level.name}</span>
            <div className="relative">
              <button onClick={() => setShowNotifPanel(!showNotifPanel)} className="relative p-2 hover:bg-gray-100 rounded-xl">
                <span className="text-xl">🔔</span>
                {unread > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">{unread > 9 ? "9+" : unread}</span>}
              </button>
              {showNotifPanel && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 max-h-96 overflow-y-auto">
                  <div className="p-4 border-b flex justify-between items-center">
                    <span className="font-bold text-gray-900">Notifications</span>
                    <div className="flex gap-2">
                      {unread > 0 && <button onClick={markAllRead} className="text-xs text-green-600 hover:underline">Tout lire</button>}
                      <button onClick={() => setShowNotifPanel(false)} className="text-gray-400">✕</button>
                    </div>
                  </div>
                  {notifications.slice(0,6).map(n => (
                    <div key={n.id} className={`p-3 border-b border-gray-50 ${!n.isRead ? 'bg-green-50' : ''}`}>
                      <div className="font-medium text-xs text-gray-900">{n.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</div>
                    </div>
                  ))}
                  <Link href="/notifications" className="block text-center text-xs text-green-600 p-3 hover:underline">Toutes les notifications →</Link>
                </div>
              )}
            </div>
            <Link href="/profile" className="flex items-center gap-1.5 hover:bg-gray-100 px-2 py-1.5 rounded-xl">
              <div className="w-7 h-7 bg-gradient-to-br from-green-500 to-green-700 rounded-lg flex items-center justify-center text-white font-bold text-xs">{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
              <span className="text-sm text-gray-700 hidden sm:block font-medium">{user?.firstName}</span>
            </Link>
            <button onClick={() => { localStorage.clear(); router.push("/auth/login"); }} className="text-xs text-gray-400 hover:text-red-500 hidden sm:block">Déco</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* HERO PORTFOLIO */}
        <div className="bg-gradient-to-br from-green-700 to-green-900 rounded-3xl p-6 mb-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full -ml-16 -mb-16"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-green-200 text-sm">Bonjour, {user?.firstName} 👋</p>
                <h1 className="text-2xl font-bold mt-0.5">Mon Portfolio</h1>
              </div>
              <div className={`px-3 py-1.5 rounded-full text-sm font-bold ${level.bg} ${level.color}`}>{level.icon} {level.name}</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-green-200 text-xs mb-1">Solde wallet</div>
                <div className="text-2xl font-bold">{fmt(balance)} FCFA</div>
                <Link href="/wallet/deposit" className="mt-2 inline-block text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg font-medium">+ Déposer</Link>
              </div>
              <div>
                <div className="text-green-200 text-xs mb-1">Total investi</div>
                <div className="text-2xl font-bold">{fmt(totalInvested)} FCFA</div>
                <div className="text-xs text-green-300 mt-1">{investments.length} investissement(s)</div>
              </div>
              <div>
                <div className="text-green-200 text-xs mb-1">Retour net attendu</div>
                <div className="text-2xl font-bold">{fmt(totalNetReturn)} FCFA</div>
                <div className="text-xs text-green-300 mt-1">+{rendementMoyen}% rendement moy.</div>
              </div>
              <div>
                <div className="text-green-200 text-xs mb-1">Déjà reçu</div>
                <div className="text-2xl font-bold">{fmt(totalReturned)} FCFA</div>
                <div className="text-xs text-green-300 mt-1">{projetsTermines} projet(s) terminé(s)</div>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs secondaires */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { icon: "🔒", label: "En séquestre", value: fmt(escrow) + " FCFA", color: "text-orange-700", bg: "bg-orange-50" },
            { icon: "🚀", label: "Projets actifs", value: projetsActifs + " projets", color: "text-blue-700", bg: "bg-blue-50" },
            { icon: "🛡️", label: "Fonds garantie", value: fmt(stats?.guaranteeContrib||0) + " FCFA", color: "text-red-700", bg: "bg-red-50" },
            { icon: "💰", label: "Gain net projeté", value: "+" + fmt(Math.max(0, gainNet)) + " FCFA", color: "text-purple-700", bg: "bg-purple-50" },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-4`}>
              <div className="text-lg mb-1">{s.icon}</div>
              <div className={`font-bold text-base ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id ? "bg-green-600 text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:border-green-300 hover:text-green-600"}`}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && tab.badge > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.id ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-600'}`}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ===== VUE GÉNÉRALE ===== */}
        {activeTab === "overview" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              {/* Graphiques */}
              {investments.length > 0 && (
                <>
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-900">📈 Évolution du portfolio</h3>
                      <div className="flex gap-1">
                        {(["3m","6m","all"] as const).map(p => (
                          <button key={p} onClick={() => setChartPeriod(p)} className={`text-xs px-2.5 py-1 rounded-lg ${chartPeriod===p ? "bg-green-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>{p==="all"?"Tout":p}</button>
                        ))}
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: any) => `${Number(v).toLocaleString()} FCFA`} />
                        <Legend />
                        <Line type="monotone" dataKey="Investi" stroke="#16a34a" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="Retour net" stroke="#2563eb" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                      <h3 className="font-bold text-gray-900 mb-3">🥧 Par secteur</h3>
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart><Pie data={sectorData} cx="50%" cy="50%" outerRadius={60} dataKey="value">
                          {sectorData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                        </Pie><Tooltip formatter={(v: any) => `${Number(v).toLocaleString()} FCFA`} /></PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-1.5 mt-2">{sectorData.map((s,i) => (
                        <div key={s.name} className="flex items-center gap-1 text-xs text-gray-500">
                          <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i%COLORS.length]}} />{s.name}
                        </div>
                      ))}</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                      <h3 className="font-bold text-gray-900 mb-3">📊 Investi vs Retour</h3>
                      <ResponsiveContainer width="100%" height={140}>
                        <BarChart data={projectData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                          <Tooltip formatter={(v: any) => `${Number(v).toLocaleString()} FCFA`} />
                          <Bar dataKey="investi" fill="#16a34a" radius={[3,3,0,0]} name="Investi" />
                          <Bar dataKey="retour" fill="#2563eb" radius={[3,3,0,0]} name="Retour net" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
              {/* Derniers investissements */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900">💼 Derniers investissements</h3>
                  <button onClick={() => setActiveTab("investments")} className="text-sm text-green-600 hover:underline">Voir tout →</button>
                </div>
                {investments.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">🌱</div>
                    <p className="text-gray-400 text-sm mb-4">Aucun investissement</p>
                    <Link href="/projects" className="bg-green-600 text-white text-sm px-5 py-2.5 rounded-xl font-bold hover:bg-green-700">Explorer les projets →</Link>
                  </div>
                ) : investments.slice(0,3).map(inv => {
                  const nr = Math.round((inv.expectedReturn||0) * (1 - baobabRate/100 - paydunyaRate/100));
                  return (
                    <div key={inv.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-2 hover:bg-green-50 transition-colors">
                      <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-700 font-bold text-sm flex-shrink-0">
                        {inv.project?.sector?.[0] || "P"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 text-sm truncate">{inv.project?.title}</div>
                        <div className="text-xs text-gray-400">{new Date(inv.createdAt).toLocaleDateString("fr-FR")}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-gray-900 text-sm">{fmt(inv.amount)} FCFA</div>
                        <div className="text-xs text-green-600">→ {fmt(nr)} FCFA</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Niveau Baobab */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 mb-3 text-sm">🌳 Niveau Baobab</h3>
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-3xl">{level.icon}</div>
                  <div className="flex-1">
                    <div className="font-bold text-gray-900">{level.name}</div>
                    <div className="text-xs text-gray-400">Niveau {LEVELS.indexOf(level)+1}/{LEVELS.length}</div>
                  </div>
                </div>
                {nextLevel && (
                  <>
                    <div className="bg-gray-100 rounded-full h-2 mb-1">
                      <div className="bg-green-500 h-2 rounded-full" style={{width: levelProgress+"%"}} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{fmt(totalInvested)} FCFA</span>
                      <span>→ {nextLevel.icon} {fmt(nextLevel.min)} FCFA</span>
                    </div>
                  </>
                )}
                <div className="mt-3 space-y-1">
                  {["Accès standard","Projets exclusifs 72h avant","Vote sur les projets","Comité + frais réduits"].map((p,i) => (
                    <div key={p} className={`flex items-center gap-1.5 text-xs ${LEVELS.indexOf(level) >= i ? "text-green-600" : "text-gray-300"}`}>
                      <span>{LEVELS.indexOf(level) >= i ? "✅" : "🔒"}</span><span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions rapides */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 mb-3 text-sm">⚡ Actions rapides</h3>
                <div className="space-y-2">
                  {[
                    { href: "/projects",       icon: "🔍", label: "Explorer les projets",    color: "bg-green-50 text-green-700 border-green-200" },
                    { href: "/wallet/deposit", icon: "💳", label: "Déposer des fonds",        color: "bg-blue-50 text-blue-700 border-blue-200" },
                    { href: "/wallet/withdraw",icon: "💸", label: "Retirer mes gains",        color: "bg-purple-50 text-purple-700 border-purple-200" },
                    { href: "/messages",       icon: "💬", label: "Messagerie",               color: "bg-orange-50 text-orange-700 border-orange-200" },
                    { href: "/referral",       icon: "🌳", label: "Parrainer un ami",         color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                    { href: "/profile",        icon: "👤", label: "Mon profil",               color: "bg-gray-50 text-gray-700 border-gray-200" },
                    { href: "/kyc",            icon: "🪪", label: "Vérification KYC",         color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
                  ].map(l => (
                    <Link key={l.href} href={l.href} className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs font-medium hover:opacity-80 transition-opacity ${l.color}`}>
                      <span className="text-base">{l.icon}</span>{l.label}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Remboursements récents */}
              {repayments.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                  <h3 className="font-bold text-green-900 mb-3 text-sm">💸 Derniers remboursements</h3>
                  {repayments.slice(0,3).map((r: any, i: number) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-green-100 last:border-0">
                      <div className="text-xs text-gray-600 line-clamp-1 flex-1">{r.projectTitle} M{r.monthNumber}</div>
                      <div className="text-xs font-bold text-green-700 ml-2 flex-shrink-0">+{fmt(r.amount)} FCFA</div>
                    </div>
                  ))}
                  <button onClick={() => setActiveTab("repayments")} className="mt-2 text-xs text-green-600 hover:underline">Voir tout →</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== INVESTISSEMENTS ===== */}
        {activeTab === "investments" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-lg">Mes investissements ({investments.length})</h2>
              <button onClick={exportCSV} className="text-xs border border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600 px-3 py-2 rounded-xl">📥 CSV</button>
            </div>
            <div className="flex gap-2">
              <input value={searchInv} onChange={e => setSearchInv(e.target.value)} placeholder="🔍 Rechercher un projet..."
                className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm flex-1 focus:outline-none focus:border-green-400" />
              <select onChange={e => setSearchInv(e.target.value === "ALL" ? "" : e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white text-gray-600 focus:outline-none focus:border-green-400">
                <option value="ALL">Tous les statuts</option>
                <option value="ACTIVE">En ligne</option>
                <option value="FUNDED">Financé</option>
                <option value="IN_PROGRESS">En remboursement</option>
                <option value="COMPLETED">Terminé</option>
              </select>
            </div>
            {investments.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="text-5xl mb-3">🌱</div>
                <h3 className="font-bold text-gray-900 mb-2">Aucun investissement</h3>
                <Link href="/projects" className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 inline-block mt-2">Explorer les projets →</Link>
              </div>
            ) : investments.filter(inv =>
              !searchInv ||
              inv.project?.title?.toLowerCase().includes(searchInv.toLowerCase()) ||
              inv.project?.sector?.toLowerCase().includes(searchInv.toLowerCase()) ||
              inv.project?.status === searchInv
            ).map(inv => {
              const nr = Math.round((inv.expectedReturn||0) * (1 - baobabRate/100 - paydunyaRate/100));
              const gainNet = nr - inv.amount;
              const rendement = inv.amount > 0 ? ((gainNet/inv.amount)*100).toFixed(1) : "0";
              const pct = Math.min(100, Math.round(((inv.project?.raisedAmount||0)/(inv.project?.goalAmount||1))*100));
              const isExpanded = expandedInv[inv.id];
              const statusColor = inv.project?.status === "COMPLETED" ? "border-emerald-300 bg-emerald-50" : inv.project?.status === "IN_PROGRESS" ? "border-purple-200" : inv.project?.status === "FUNDED" ? "border-blue-200" : "border-gray-100";
              return (
                <div key={inv.id} className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden ${statusColor}`}>
                  <button onClick={() => setExpandedInv(prev => ({...prev, [inv.id]: !prev[inv.id]}))} className="w-full p-5 text-left hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-12 rounded-full flex-shrink-0 ${inv.project?.status === "COMPLETED" ? "bg-emerald-500" : inv.project?.status === "IN_PROGRESS" ? "bg-purple-500" : inv.project?.status === "FUNDED" ? "bg-blue-500" : "bg-green-500"}`}></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-gray-900 text-base truncate">{inv.project?.title}</span>
                          {inv.project?.mentor && <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">🎓 Mentoré</span>}
                        </div>
                        <div className="text-xs text-gray-400">{inv.project?.sector} · {new Date(inv.createdAt).toLocaleDateString("fr-FR")}</div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="font-bold text-gray-900">{fmt(inv.amount)} FCFA</div>
                        <div className="text-xs text-green-600">→ {fmt(nr)} FCFA</div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${inv.project?.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : inv.project?.status === "FUNDED" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                          {inv.project?.status === "COMPLETED" ? "✅ Terminé" : inv.project?.status === "FUNDED" ? "🎯 Financé" : inv.project?.status === "IN_PROGRESS" ? "📅 Remboursement" : "⏳ En cours"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 bg-gray-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${pct >= 100 ? "bg-green-500" : "bg-orange-400"}`} style={{width: pct+"%"}} />
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-5 space-y-4">
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                          <div className="text-gray-400">Montant investi</div>
                          <div className="font-bold text-gray-900 text-sm">{fmt(inv.amount)} FCFA</div>
                        </div>
                        <div className="bg-green-50 rounded-xl p-3 text-center">
                          <div className="text-gray-400">Retour net attendu</div>
                          <div className="font-bold text-green-700 text-sm">{fmt(nr)} FCFA</div>
                          <div className="text-green-500">+{rendement}%</div>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-3 text-center">
                          <div className="text-gray-400">Gain net</div>
                          <div className="font-bold text-blue-700 text-sm">+{fmt(gainNet)} FCFA</div>
                          <div className="text-gray-400">après frais</div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Progression collecte</span>
                          <span className={inv.project?.status === "FUNDED" || inv.project?.status === "IN_PROGRESS" || inv.project?.status === "COMPLETED" ? "text-green-600 font-bold" : ""}>
                            {inv.project?.status === "FUNDED" || inv.project?.status === "IN_PROGRESS" || inv.project?.status === "COMPLETED" ? "100% · Financé ✅" : pct + "% · " + fmt(inv.project?.raisedAmount||0) + " / " + fmt(inv.project?.goalAmount||0) + " FCFA"}
                          </span>
                        </div>
                        <div className="bg-gray-200 rounded-full h-2">
                          <div className="h-2 rounded-full bg-green-500" style={{width: (inv.project?.status === "FUNDED" || inv.project?.status === "IN_PROGRESS" || inv.project?.status === "COMPLETED" ? 100 : pct)+"%"}} />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => downloadPDF(`/api/pdf/certificate/${inv.id}`, `certificat-${inv.id.substring(0,8)}.pdf`)} className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-3 py-2 rounded-xl hover:bg-blue-100 font-medium">📄 Certificat PDF</button>
                        <Link href={`/projects/${inv.projectId}`} className="text-xs bg-green-50 text-green-600 border border-green-200 px-3 py-2 rounded-xl hover:bg-green-100 font-medium">🔍 Voir le projet</Link>
                        {inv.project?.entrepreneurId && (
                          <Link href={`/messages?to=${inv.project.entrepreneurId}`} className="text-xs bg-purple-50 text-purple-600 border border-purple-200 px-3 py-2 rounded-xl hover:bg-purple-100 font-medium">💬 Contacter</Link>
                        )}
                        {inv.project?.entrepreneurId && (
                          <Link href={`/auth/profile/${inv.project.entrepreneurId}`} className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 px-3 py-2 rounded-xl hover:bg-indigo-100 font-medium">👤 Profil porteur</Link>
                        )}
                        {inv.project?.status === "FUNDED" && <span className="text-xs bg-purple-50 text-purple-600 border border-purple-200 px-3 py-2 rounded-xl">🎯 Remboursement à venir</span>}
                        {inv.project?.status === "COMPLETED" && <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2 rounded-xl">✅ Remboursé</span>}
                      </div>
                      {/* Détail remboursements reçus vs attendus */}
                      <div className={`rounded-xl p-3 text-xs border ${inv.returnedAmount > 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-gray-600 font-medium">💸 Remboursements reçus</span>
                          <span className="font-bold text-green-700">{fmt(inv.returnedAmount || 0)} FCFA</span>
                        </div>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-gray-600">🎯 Total net attendu</span>
                          <span className="font-bold text-blue-700">{fmt(nr)} FCFA</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-600">⏳ Reste à recevoir</span>
                          <span className="font-bold text-orange-600">{fmt(Math.max(0, nr - (inv.returnedAmount||0)))} FCFA</span>
                        </div>
                        {(inv.returnedAmount||0) > 0 && (
                          <div className="bg-white rounded-lg h-2">
                            <div className="bg-green-500 h-2 rounded-lg" style={{width: Math.min(100, Math.round(((inv.returnedAmount||0)/nr)*100)) + "%"}} />
                          </div>
                        )}
                        <div className="text-gray-400 mt-1 text-center">
                          {(inv.returnedAmount||0) === 0 ? "Aucun versement reçu pour l instant" :
                           Math.round(((inv.returnedAmount||0)/nr)*100) + "% du retour total reçu"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ===== REMBOURSEMENTS ===== */}
        {activeTab === "repayments" && (
          <div className="space-y-5">
            {/* Projets IN_PROGRESS avec calendrier */}
            {investments.filter(i => i.project?.status === "IN_PROGRESS").length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 mb-4">📅 Remboursements progressifs en cours</h3>
                {investments.filter(i => i.project?.status === "IN_PROGRESS").map(inv => {
                  const nr = Math.round((inv.expectedReturn||0) * (1 - baobabRate/100 - paydunyaRate/100));
                  return (
                    <div key={inv.id} className="border border-purple-100 rounded-2xl p-4 mb-3 bg-purple-50">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-bold text-gray-900">{inv.project?.title}</div>
                          <div className="text-xs text-gray-400">{inv.project?.sector}</div>
                        </div>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-bold">📅 En remboursement</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                        <div className="bg-white rounded-xl p-2 text-center">
                          <div className="text-gray-400">Votre investissement</div>
                          <div className="font-bold">{fmt(inv.amount)} FCFA</div>
                        </div>
                        <div className="bg-white rounded-xl p-2 text-center">
                          <div className="text-gray-400">Retour net attendu</div>
                          <div className="font-bold text-green-700">{fmt(nr)} FCFA</div>
                        </div>
                        <div className="bg-white rounded-xl p-2 text-center">
                          <div className="text-gray-400">Gain net</div>
                          <div className="font-bold text-blue-700">+{fmt(nr - inv.amount)} FCFA</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Historique remboursements reçus */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-4">💸 Historique des remboursements reçus</h3>
              {repayments.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">💸</div>
                  <p className="text-gray-400 text-sm">Aucun remboursement reçu pour l'instant</p>
                  <p className="text-gray-400 text-xs mt-1">Les remboursements apparaissent quand l'entrepreneur paie ses mensualités</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {repayments.map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-green-50 border border-green-100 rounded-2xl hover:bg-green-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-200 rounded-xl flex items-center justify-center text-green-700 font-bold text-sm flex-shrink-0">
                          M{r.monthNumber}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{r.projectTitle} — mois {r.monthNumber}/{r.totalMonths}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{r.paidAt ? new Date(r.paidAt).toLocaleDateString("fr-FR", { day:"numeric", month:"long", year:"numeric" }) : "—"}</div>
                        </div>
                      </div>
                      <div className="text-green-700 font-bold text-sm flex-shrink-0">+{fmt(r.amount)} FCFA</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== WALLET ===== */}
        {activeTab === "wallet" && (
          <div className="space-y-5 max-w-2xl">
            <div className="bg-gradient-to-br from-green-600 to-green-900 rounded-3xl p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="text-sm text-green-200 mb-1">Solde disponible</div>
              <div className="text-4xl font-bold mb-4">{fmt(balance)} FCFA</div>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/wallet/deposit" className="bg-white text-green-700 text-sm font-bold py-2.5 rounded-xl text-center hover:bg-green-50">+ Déposer</Link>
                <Link href="/wallet/withdraw" className="bg-white/20 text-white text-sm font-bold py-2.5 rounded-xl text-center hover:bg-white/30 border border-white/30">↗ Retirer</Link>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-4">📊 Récapitulatif wallet</h3>
              <div className="space-y-3">
                {[
                  { label: "Solde disponible",    value: fmt(balance) + " FCFA",                     color: "text-green-700" },
                  { label: "En séquestre",         value: fmt(escrow) + " FCFA",                      color: "text-orange-600" },
                  { label: "Total déposé",          value: fmt(wallet?.totalDeposited||0) + " FCFA",   color: "text-blue-700" },
                  { label: "Total retiré",           value: fmt(wallet?.totalWithdrawn||0) + " FCFA",  color: "text-red-600" },
                  { label: "Total investi",          value: fmt(totalInvested) + " FCFA",              color: "text-purple-700" },
                  { label: "Total gains reçus",      value: fmt(wallet?.totalEarned||0) + " FCFA",     color: "text-emerald-700" },
                ].map(s => (
                  <div key={s.label} className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-500">{s.label}</span>
                    <span className={`font-bold ${s.color}`}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Épargne programmée */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-3">🌱 Épargne programmée</h3>
              {wallet?.scheduledAmount > 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
                  Dépôt automatique de <strong>{fmt(wallet.scheduledAmount)} FCFA</strong> le <strong>{wallet.scheduledDay}</strong> de chaque mois.
                  <button onClick={async () => {
                    const res = await authPost("/api/investments/savings-config", { amount: 0, day: 0 });
                    if (res.success) { flash("✅ Épargne désactivée"); loadData(); }
                  }} className="ml-2 text-xs text-red-600 underline">Désactiver</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">Configurez un dépôt automatique mensuel.</p>
                  <div className="flex gap-2">
                    <input value={savingsAmount} onChange={e => setSavingsAmount(e.target.value)} type="number" placeholder="Montant (FCFA)" min="1000"
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm flex-1 focus:outline-none focus:border-green-400" />
                    <input value={savingsDay} onChange={e => setSavingsDay(e.target.value)} type="number" placeholder="Jour" min="1" max="28"
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-20 focus:outline-none focus:border-green-400" />
                    <button onClick={async () => {
                      if (!savingsAmount || !savingsDay) { flash("❌ Remplissez le montant et le jour"); return; }
                      const res = await authPost("/api/investments/savings-config", { amount: parseInt(savingsAmount), day: parseInt(savingsDay) });
                      if (res.success) { flash("✅ Épargne configurée !"); loadData(); setSavingsAmount(""); setSavingsDay(""); }
                      else flash("❌ " + res.message);
                    }} className="bg-green-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-green-700 font-medium">OK</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== RAPPORTS ===== */}
        {activeTab === "reports" && (
          <div className="space-y-5 max-w-2xl">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-bold text-gray-900 mb-4">📄 Relevés de compte</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "📄 Relevé mensuel",      period: "month",   desc: "Ce mois en cours" },
                  { label: "📊 Relevé trimestriel",  period: "quarter", desc: "90 derniers jours" },
                  { label: "📈 Relevé annuel",        period: "year",    desc: "Depuis janvier" },
                  { label: "📋 Relevé complet",       period: "",        desc: "Depuis le début" },
                ].map(r => (
                  <button key={r.period} onClick={() => downloadPDF(`/api/pdf/statement/investor${r.period ? "?period=" + r.period : ""}`, `releve-${r.period||"complet"}.pdf`)}
                    className="border border-gray-200 rounded-2xl p-4 text-left hover:border-green-300 hover:bg-green-50 transition-colors">
                    <div className="font-bold text-gray-900 text-sm mb-1">{r.label}</div>
                    <div className="text-xs text-gray-400">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-bold text-gray-900 mb-4">📥 Export données</h2>
              <button onClick={exportCSV} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 text-sm">
                📥 Exporter mes investissements (CSV)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
