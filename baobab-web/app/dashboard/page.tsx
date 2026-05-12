"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authGet, authPost } from "@/lib/api";
import { useRequireRole } from "@/hooks/useRequireRole";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";

const LEVELS = [
  { name: "Graine", min: 0, max: 10000, icon: "🌱", color: "text-green-600" },
  { name: "Jeune Baobab", min: 10000, max: 50000, icon: "🌿", color: "text-emerald-600" },
  { name: "Baobab", min: 50000, max: 200000, icon: "🌳", color: "text-green-700" },
  { name: "Grand Baobab", min: 200000, max: Infinity, icon: "🏅", color: "text-yellow-600" },
];
const COLORS = ["#16a34a", "#2563eb", "#d97706", "#7c3aed", "#dc2626"];
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "text-blue-600", FUNDED: "text-green-600",
  COMPLETED: "text-purple-600", IN_PROGRESS: "text-orange-600"
};

function getLevel(total: number) { return LEVELS.find(l => total >= l.min && total < l.max) || LEVELS[0]; }
function getNextLevel(total: number) {
  const idx = LEVELS.findIndex(l => total >= l.min && total < l.max);
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

export default function DashboardPage() {
  useRequireRole(["INVESTOR"]);
  const { config: fees } = usePlatformConfig();
  const [user, setUser] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [investments, setInvestments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<"all"|"3m"|"6m">("all");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.replace("/auth/login"); return; }
    Promise.all([
      authGet("/api/investments/my"),
      authGet("/api/auth/me"),
      authGet("/api/notifications?limit=10"),
    ]).then(([inv, me, notif]) => {
      if (inv.success) { setInvestments(inv.data.investments || []); setStats(inv.data); }
      if (me.success) { setWallet(me.data.wallet); setUser(me.data); }
      if (notif.success) setNotifications(notif.data.notifications || []);
    }).finally(() => setLoading(false));
  }, []);

  const markAllRead = async () => {
    await authPost("/api/notifications/read-all", {}).catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const downloadPDF = async (url: string, filename: string) => {
    const token = localStorage.getItem("accessToken");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { alert("Erreur génération PDF"); return; }
      const blob = await res.blob();
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
    } catch { alert("Erreur téléchargement"); }
  };

  const exportCSV = () => {
    const token = localStorage.getItem("accessToken");
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/exports/investor`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "mes-investissements.csv"; a.click();
      URL.revokeObjectURL(url);
    });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center"><div className="text-5xl animate-bounce mb-4">🌳</div><p className="text-gray-400">Chargement...</p></div>
    </div>
  );

  const totalInvested = stats?.totalInvested || 0;
  const totalExpected = stats?.totalExpected || 0;
  const totalReturned = stats?.totalReturned || 0;
  const guaranteeFund = stats?.guaranteeContrib || 0;
  const escrow = wallet?.escrowBalance || 0;
  const balance = wallet?.balance || 0;
  const level = getLevel(totalInvested);
  const nextLevel = getNextLevel(totalInvested);
  const levelProgress = nextLevel ? Math.min(((totalInvested - level.min) / (nextLevel.min - level.min)) * 100, 100) : 100;
  const unread = notifications.filter(n => !n.isRead).length;
  const projetsActifs = investments.filter(i => i.project?.status !== "COMPLETED").length;
  const projetsTermines = investments.filter(i => i.project?.status === "COMPLETED").length;
  const invWithReturn = investments.filter(i => i.expectedReturn && i.expectedReturn > i.amount);
  const rendementMoyen = invWithReturn.length > 0
    ? (invWithReturn.reduce((s, i) => {
        const net = Math.round((i.expectedReturn || 0) * (1 - fees.commission_baobab_return/100 - fees.paydunya_payout/100))
        return s + ((net - i.amount) / i.amount * 100)
      }, 0) / invWithReturn.length).toFixed(1)
    : "0";

  // Filtrer par période
  const now = Date.now();
  const filteredInv = investments.filter(inv => {
    if (chartPeriod === "all") return true;
    const months = chartPeriod === "3m" ? 3 : 6;
    return new Date(inv.createdAt).getTime() > now - months * 30 * 24 * 60 * 60 * 1000;
  });

  // Données graphique évolution — cumul progressif
  const sortedInv = [...filteredInv].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  let cumulInvesti = 0;
  let cumulNet = 0;
  const chartData = sortedInv.map((inv) => {
    cumulInvesti += inv.amount;
    const netReturn = Math.round((inv.expectedReturn || 0) * (1 - (fees.commission_baobab_return||5)/100 - (fees.paydunya_payout||2)/100));
    cumulNet += netReturn;
    return {
      name: new Date(inv.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
      "Cumul investi": cumulInvesti,
      "Retour net attendu": cumulNet,
    };
  });

  // Répartition secteurs
  const sectorData = Object.entries(
    investments.reduce((acc: any, inv) => {
      const s = inv.project?.sector || "Autre";
      acc[s] = (acc[s] || 0) + inv.amount;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  // Données par projet
  const projectData = investments.slice(0, 5).map(inv => ({
    name: inv.project?.title?.substring(0, 12) || "",
    montant: inv.amount,
    retour: Math.round((inv.expectedReturn || 0) * (1 - fees.commission_baobab_return/100 - fees.paydunya_payout/100)),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🌳</span>
            <span className="font-bold text-green-600 hidden sm:block">BAOBAB INVEST</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/projects" className="text-sm text-gray-500 hover:text-green-600 hidden sm:block">Catalogue</Link>
            <Link href="/notifications" className="relative text-gray-500 hover:text-green-600">
              <span className={unread > 0 ? "animate-bounce inline-block" : ""}>🔔</span>
              {unread > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center animate-pulse">{unread}</span>}
            </Link>
            <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-1 rounded-full">{level.icon} {level.name}</span>
            <Link href="/profile" className="text-sm text-gray-500 hover:text-green-600">👤</Link>
            <button onClick={() => { localStorage.clear(); document.cookie="accessToken=;path=/;max-age=0"; document.cookie="user=;path=/;max-age=0"; router.push("/auth/login"); }} className="text-sm text-red-400 hover:text-red-600">Déco</button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bonjour, {user?.firstName} 👋</h1>
            <p className="text-gray-400 text-sm">{user?.kycStatus === "VERIFIED" ? "✅ KYC Vérifié" : "⚠️ KYC requis"} · Membre depuis {new Date(user?.createdAt || Date.now()).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</p>
          </div>
          <div className="hidden sm:flex gap-2">
            <button onClick={exportCSV} className="text-xs border border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600 px-3 py-2 rounded-xl transition-colors">
              📥 CSV
            </button>
            <button onClick={() => downloadPDF('/api/pdf/statement/investor', 'releve-compte.pdf')} className="text-xs border border-green-200 text-green-600 hover:bg-green-50 px-3 py-2 rounded-xl transition-colors">
              📄 PDF Relevé
            </button>
          </div>
        </div>

        {/* 8 stats clés */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Solde disponible", value: `${balance.toLocaleString()} FCFA`, icon: "💰", color: "text-green-700", bg: "bg-green-50", sub: balance > 0 ? "💸 Retrait disponible" : "💳 Déposer pour investir" },
            { label: "Total investi", value: `${totalInvested.toLocaleString()} FCFA`, icon: "📊", color: "text-blue-700", bg: "bg-blue-50", sub: `${investments.length} investissement(s)` },
            { label: "Retour attendu", value: `${totalExpected.toLocaleString()} FCFA`, icon: "📈", color: "text-purple-700", bg: "bg-purple-50", sub: `+${rendementMoyen}% rendement moy.` },
            { label: "Déjà reçu", value: `${totalReturned.toLocaleString()} FCFA`, icon: "✅", color: "text-emerald-700", bg: "bg-emerald-50", sub: `${projetsTermines} projet(s) terminé(s)` },
            { label: "En séquestre", value: `${escrow.toLocaleString()} FCFA`, icon: "🔒", color: "text-orange-700", bg: "bg-orange-50", sub: "Fonds sécurisés" },
            { label: "Projets actifs", value: String(projetsActifs), icon: "🚀", color: "text-blue-700", bg: "bg-blue-50", sub: "En cours" },
            { label: "Fonds garantie", value: `${guaranteeFund.toLocaleString()} FCFA`, icon: "🛡️", color: "text-red-700", bg: "bg-red-50", sub: `${fees.commission_guarantee}% par investissement` },
            { label: "Niveau Baobab", value: `${level.icon} ${level.name}`, icon: "🌳", color: "text-yellow-700", bg: "bg-yellow-50", sub: nextLevel ? `→ ${nextLevel.icon} ${nextLevel.name}` : "Niveau max !" },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-4`}>
              <div className="text-xl mb-1">{s.icon}</div>
              <div className={`font-bold text-base ${s.color} leading-tight`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Liens rapides */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { href: "/projects", icon: "🔍", label: "Explorer" },
            { href: "/wallet/deposit", icon: "💳", label: "Déposer" },
            { href: "/wallet/withdraw", icon: "💸", label: "Retirer" },
            { href: "/investments", icon: "📊", label: "Retours" },
            { href: "/messages", icon: "💬", label: "Messages" },
            { href: "/referral", icon: "🌳", label: "Parrainer" },
            { href: "/profile", icon: "👤", label: "Profil" },
          ].map(l => (
            <Link key={l.href} href={l.href} className="bg-white border border-gray-100 rounded-xl p-3 text-center hover:border-green-200 hover:bg-green-50 transition-colors">
              <div className="text-xl mb-1">{l.icon}</div>
              <div className="text-xs font-medium text-gray-700">{l.label}</div>
            </Link>
          ))}
        </div>

        {/* Graphiques */}
        {investments.length > 0 && (
          <div className="space-y-4">
            {/* Graphique évolution avec filtre période */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">📈 Évolution de mes investissements</h3>
                <div className="flex gap-1">
                  {(["3m","6m","all"] as const).map(p => (
                    <button key={p} onClick={() => setChartPeriod(p)} className={`text-xs px-2 py-1 rounded-lg transition-colors ${chartPeriod === p ? "bg-green-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                      {p === "all" ? "Tout" : p}
                    </button>
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
                  <Line type="monotone" dataKey="Cumul investi" stroke="#16a34a" strokeWidth={2} dot={false} name="Cumul investi" />
                  <Line type="monotone" dataKey="Retour net attendu" stroke="#2563eb" strokeWidth={2} dot={false} name="Retour net attendu" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Répartition secteurs */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 mb-4">🥧 Répartition par secteur</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={sectorData} cx="50%" cy="50%" outerRadius={65} dataKey="value" label={false}>
                      {sectorData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => `${Number(v).toLocaleString()} FCFA`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 justify-center mt-1">
                  {sectorData.map((s, i) => (
                    <div key={s.name} className="flex items-center gap-1 text-xs text-gray-500">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span>{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comparaison investi vs retour */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 mb-4">📊 Investi vs Retour attendu</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={projectData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => `${Number(v).toLocaleString()} FCFA`} />
                    <Bar dataKey="montant" fill="#16a34a" radius={[4,4,0,0]} name="Investi" />
                    <Bar dataKey="retour" fill="#2563eb" radius={[4,4,0,0]} name="Retour net attendu" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Mes investissements */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900">💼 Mes Investissements</h3>
            <Link href="/investments" className="text-sm text-green-600 hover:underline">Voir tout →</Link>
          </div>
          {investments.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">🌱</div>
              <p className="text-gray-400 text-sm mb-4">Aucun investissement pour l&apos;instant</p>
              <Link href="/projects" className="bg-green-600 text-white text-sm px-5 py-2 rounded-xl font-bold hover:bg-green-700">Explorer les projets →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {investments.slice(0, 5).map(inv => {
                const netReturn = Math.round((inv.expectedReturn || 0) * (1 - (fees.commission_baobab_return||5)/100 - (fees.paydunya_payout||2)/100));
                const gainNet = netReturn - inv.amount;
                const rendement = inv.amount > 0 ? ((gainNet / inv.amount) * 100).toFixed(1) : "0";
                const progression = Math.min(Math.round(((inv.project?.raisedAmount||0) / (inv.project?.goalAmount||1)) * 100), 100);
                return (
                  <div key={inv.id} className="bg-gray-50 hover:bg-green-50 rounded-2xl p-4 border border-gray-100 transition-colors">
                    {/* En-tête projet */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <Link href={`/projects/${inv.projectId}`} className="flex-1">
                        <div className="font-semibold text-gray-900 text-sm hover:text-green-700">{inv.project?.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{inv.project?.sector} · Investi le {new Date(inv.createdAt).toLocaleDateString("fr-FR")}</div>
                        {inv.project?.mentor && <div className="text-xs text-purple-500 mt-0.5">🎓 Mentoré</div>}
                      </Link>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        inv.project?.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                        inv.project?.status === "FUNDED" ? "bg-blue-100 text-blue-700" :
                        "bg-orange-100 text-orange-700"}`}>
                        {inv.project?.status === "COMPLETED" ? "✅ Terminé" : inv.project?.status === "FUNDED" ? "🎯 Financé" : "⏳ En cours"}
                      </span>
                    </div>
                    {/* Chiffres clés */}
                    <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
                      <div className="bg-white rounded-xl p-2 border border-gray-100">
                        <div className="text-gray-400">Investi</div>
                        <div className="font-bold text-gray-900">{inv.amount.toLocaleString()} FCFA</div>
                      </div>
                      <div className="bg-white rounded-xl p-2 border border-green-100">
                        <div className="text-gray-400">Retour net attendu</div>
                        <div className="font-bold text-green-700">{netReturn.toLocaleString()} FCFA</div>
                        <div className="text-green-500">+{rendement}%</div>
                      </div>
                      <div className="bg-white rounded-xl p-2 border border-blue-100">
                        <div className="text-gray-400">Gain net</div>
                        <div className="font-bold text-blue-700">+{gainNet.toLocaleString()} FCFA</div>
                        <div className="text-gray-400">après frais</div>
                      </div>
                    </div>
                    {/* Progression collecte */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Progression collecte</span>
                        <span>{progression}% · {(inv.project?.raisedAmount||0).toLocaleString()} / {(inv.project?.goalAmount||0).toLocaleString()} FCFA</span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${progression >= 100 ? "bg-green-500" : "bg-orange-400"}`}
                          style={{width: `${progression}%`}} />
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-2">
                      <button onClick={() => downloadPDF(`/api/pdf/certificate/${inv.id}`, `certificat-${inv.id.substring(0,8)}.pdf`)}
                        className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-medium">
                        📄 Certificat PDF
                      </button>
                      <Link href={`/projects/${inv.projectId}`}
                        className="text-xs bg-green-50 text-green-600 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 font-medium">
                        🔍 Voir le projet
                      </Link>
                      {inv.project?.status === "FUNDED" && (
                        <span className="text-xs bg-purple-50 text-purple-600 border border-purple-200 px-3 py-1.5 rounded-lg font-medium">
                          🎯 Remboursement à venir
                        </span>
                      )}
                      {inv.project?.status === "COMPLETED" && (
                        <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg font-medium">
                          ✅ Remboursé
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-gray-900">🔔 Notifications récentes</h3>
            <div className="flex items-center gap-2">
              {unread > 0 && <button onClick={markAllRead} className="text-xs text-green-600 hover:underline">Tout lire</button>}
              <button onClick={() => setNotifOpen(!notifOpen)} className="text-xs text-gray-400">{notifOpen ? "▲" : "▼"}</button>
            </div>
          </div>
          {unread > 0 && <div className="text-xs text-red-500 font-medium mb-2">{unread} notification(s) non lue(s)</div>}
          {notifOpen && (
            <div className="space-y-2">
              {notifications.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">Aucune notification</p>
              ) : notifications.slice(0, 5).map(n => (
                <Link key={n.id} href="/notifications" className={`block p-3 rounded-xl border text-sm transition-colors hover:bg-gray-50 ${!n.isRead ? "border-green-200 bg-green-50" : "border-gray-100"}`}>
                  <div className="font-medium text-gray-900">{n.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{n.body}</div>
                  <div className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                </Link>
              ))}
              <Link href="/notifications" className="block text-center text-xs text-green-600 hover:underline pt-1">Voir toutes →</Link>
            </div>
          )}
        </div>

        {/* Niveau Baobab */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4">🌳 Niveau Baobab</h3>
          <div className="flex items-center gap-4 mb-3">
            <div className="text-4xl">{level.icon}</div>
            <div className="flex-1">
              <div className="font-bold text-gray-900">{level.icon} {level.name}</div>
              <div className="text-xs text-gray-400">Niveau {LEVELS.indexOf(level) + 1} / {LEVELS.length}</div>
              {nextLevel && (
                <>
                  <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
                    <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${levelProgress}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>{totalInvested.toLocaleString()} FCFA</span>
                    <span>→ {nextLevel.min.toLocaleString()} FCFA pour {nextLevel.icon} {nextLevel.name}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            {["Accès standard", "Projets exclusifs 72h avant", "Vote sur les projets", "Comité + frais réduits"].map((p, i) => (
              <div key={p} className={`flex items-center gap-1.5 ${LEVELS.indexOf(level) >= i ? "text-green-600" : "text-gray-300"}`}>
                <span className="text-base">{LEVELS.indexOf(level) >= i ? "✅" : "🔒"}</span><span>{p}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Autres liens */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-3">🔗 Accès rapide</h3>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { href: "/savings", icon: "🌱", label: "Épargne programmée" },
              { href: "/wallet/history", icon: "📜", label: "Historique wallet" },
              { href: "/kyc", icon: "🪪", label: "Vérification KYC" },
              { href: "/suppliers", icon: "🏪", label: "Fournisseurs" },
              { href: "/academy", icon: "📚", label: "Académie Baobab" },
              { href: "/referral", icon: "🌳", label: "Parrainer" },
            ].map(l => (
              <Link key={l.href} href={l.href} className="flex items-center gap-1.5 p-2 rounded-lg hover:bg-gray-50 text-gray-600 hover:text-green-600 transition-colors">
                <span>{l.icon}</span><span>{l.label}</span>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
