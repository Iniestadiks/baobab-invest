"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authGet, authPost } from "@/lib/api";

const STATUS_CONFIG: Record<string, any> = {
  DRAFT:         { label: "Brouillon",    color: "text-gray-600",   bg: "bg-gray-100" },
  PENDING_REVIEW:{ label: "En validation",color: "text-yellow-700", bg: "bg-yellow-100" },
  ACTIVE:        { label: "En ligne",     color: "text-green-700",  bg: "bg-green-100" },
  FUNDED:        { label: "Financé",      color: "text-blue-700",   bg: "bg-blue-100" },
  IN_PROGRESS:   { label: "En cours",     color: "text-purple-700", bg: "bg-purple-100" },
  COMPLETED:     { label: "Terminé",      color: "text-emerald-700",bg: "bg-emerald-100" },
  FAILED:        { label: "Échoué",       color: "text-red-700",    bg: "bg-red-100" },
  CANCELLED:     { label: "Annulé",       color: "text-gray-600",   bg: "bg-gray-100" },
};

function fmt(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
}

export default function EntrepreneurDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<Record<string, any>>({});
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [showNotifs, setShowNotifs] = useState(false);
  const [reportText, setReportText] = useState<Record<string, string>>({});

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 4000);
  };

  const loadData = async () => {
    const u = await authGet("/api/auth/me");
    if (!u.success) { router.push("/auth/login"); return; }
    if (u.data.role !== "ENTREPRENEUR") { router.push("/dashboard"); return; }
    setUser(u.data);
    setWallet(u.data.wallet);

    const [proj, notif] = await Promise.all([
      authGet("/api/projects/my/projects"),
      authGet("/api/notifications"),
    ]);

    if (proj.success) {
      const allProjects = proj.data || [];
      setProjects(allProjects);
      // Charger échéanciers
      const eligible = allProjects.filter((p: any) => ['FUNDED','IN_PROGRESS','COMPLETED'].includes(p.status));
      const schedMap: any = {};
      for (const p of eligible) {
        const s = await authGet("/api/repayment/my/" + p.id);
        if (s.success && s.data) schedMap[p.id] = s.data;
      }
      setSchedules(schedMap);
    }
    if (notif.success) {
      setNotifications(notif.data.notifications?.slice(0, 8) || []);
      setUnread(notif.data.unreadCount || 0);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-gray-500">Chargement...</p>
      </div>
    </div>
  );

  const visibleProjects = projects.filter(p => p.status !== "CANCELLED");
  const activeProjects = projects.filter(p => p.status === "ACTIVE").length;
  const inProgressProjects = projects.filter(p => ["FUNDED","IN_PROGRESS"].includes(p.status));
  const totalRaised = projects.reduce((s, p) => s + (p.raisedAmount || 0), 0);
  const totalInvestors = projects.reduce((s, p) => s + (p.investorCount || 0), 0);
  const totalDue = Object.values(schedules).reduce((s: number, sc: any) => s + (sc.remainingAmount || 0), 0);
  const totalPaid = Object.values(schedules).reduce((s: number, sc: any) => s + ((sc.totalAmount - sc.remainingAmount) || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Flash */}
      {flash && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-xl text-sm font-medium">
          {flash}
        </div>
      )}

      {/* NAVBAR */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="font-bold text-gray-900 hidden sm:block">BAOBAB INVEST</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Entrepreneur</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowNotifs(!showNotifs)} className="relative p-2 hover:bg-gray-100 rounded-xl">
              <span className="text-lg">🔔</span>
              {unread > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">{unread}</span>}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                {user?.firstName?.[0]}
              </div>
              <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.firstName}</span>
            </div>
            <button onClick={() => { localStorage.clear(); router.push("/"); }} className="text-xs text-gray-400 hover:text-gray-600">Déconnexion</button>
          </div>
        </div>
      </nav>

      {/* Notifications panel */}
      {showNotifs && (
        <div className="fixed top-16 right-4 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 w-80 max-h-96 overflow-y-auto">
          <div className="p-4 border-b border-gray-100 font-bold text-gray-900">Notifications</div>
          {notifications.map((n: any) => (
            <div key={n.id} className={`p-3 border-b border-gray-50 text-xs ${!n.isRead ? 'bg-blue-50' : ''}`}>
              <div className="font-medium text-gray-900">{n.title}</div>
              <div className="text-gray-500 mt-0.5">{n.body?.substring(0, 80)}...</div>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* En-tête */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Bonjour, {user?.firstName} 👋</h1>
          <p className="text-gray-500 text-sm mt-1">
            Entrepreneur · {user?.kycStatus === "VERIFIED" ? "✅ KYC Vérifié" : "⚠️ KYC non vérifié"} · Score: {user?.reputationScore || 0}/100
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { icon: "💳", label: "Wallet disponible", value: fmt(wallet?.balance || 0) + " FCFA", color: "bg-green-50 border-green-200", vcolor: "text-green-700" },
            { icon: "💰", label: "Total levé", value: fmt(totalRaised) + " FCFA", color: "bg-blue-50 border-blue-200", vcolor: "text-blue-700" },
            { icon: "📅", label: "Restant à rembourser", value: fmt(totalDue) + " FCFA", color: "bg-orange-50 border-orange-200", vcolor: "text-orange-700" },
            { icon: "✅", label: "Déjà remboursé", value: fmt(totalPaid) + " FCFA", color: "bg-emerald-50 border-emerald-200", vcolor: "text-emerald-700" },
          ].map(k => (
            <div key={k.label} className={`border rounded-2xl p-4 ${k.color}`}>
              <div className="text-xl mb-1">{k.icon}</div>
              <div className={`text-lg font-bold ${k.vcolor}`}>{k.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {[
            { id: "overview", label: "Vue générale" },
            { id: "repayment", label: "Remboursements" },
            { id: "projects", label: "Mes projets" },
            { id: "wallet", label: "Wallet" },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${activeTab === t.id ? "bg-green-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* VUE GÉNÉRALE */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            {/* Projets en cours de remboursement */}
            {inProgressProjects.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-4">📅 Mes remboursements en cours</h2>
                {inProgressProjects.map((p: any) => {
                  const sc = schedules[p.id];
                  if (!sc) return null;
                  const pct = Math.round(((sc.totalAmount - sc.remainingAmount) / sc.totalAmount) * 100);
                  const nextPayment = sc.payments?.find((pay: any) => pay.status === 'PENDING');
                  const isLate = nextPayment && new Date(nextPayment.dueDate) < new Date();
                  return (
                    <div key={p.id} className="border border-gray-100 rounded-2xl p-4 mb-3">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-bold text-gray-900">{p.title}</div>
                          <div className="text-xs text-gray-400">{p.sector} · {p.city}</div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${isLate ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'}`}>
                          {isLate ? '⚠️ En retard' : sc.paidMonths + '/' + sc.totalMonths + ' mois'}
                        </span>
                      </div>
                      {/* Barre de progression */}
                      <div className="bg-gray-100 rounded-full h-3 mb-3">
                        <div className="bg-green-500 h-3 rounded-full transition-all" style={{width: pct + "%"}}></div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs mb-4">
                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                          <div className="text-gray-400">Mensualité</div>
                          <div className="font-bold text-gray-900 text-sm">{fmt(sc.monthlyAmount)} FCFA</div>
                        </div>
                        <div className="bg-green-50 rounded-xl p-3 text-center">
                          <div className="text-gray-400">Payé</div>
                          <div className="font-bold text-green-700 text-sm">{fmt(sc.totalAmount - sc.remainingAmount)} FCFA</div>
                        </div>
                        <div className="bg-orange-50 rounded-xl p-3 text-center">
                          <div className="text-gray-400">Restant</div>
                          <div className="font-bold text-orange-700 text-sm">{fmt(sc.remainingAmount)} FCFA</div>
                        </div>
                      </div>
                      {/* Prochain paiement */}
                      {nextPayment && (
                        <div className={`rounded-xl p-3 mb-3 ${isLate ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-100'}`}>
                          <div className="text-xs font-semibold mb-1">{isLate ? '⚠️ Paiement en retard' : '📅 Prochain paiement'}</div>
                          <div className="flex justify-between items-center">
                            <div className="text-xs text-gray-600">
                              Mois {nextPayment.monthNumber}/{sc.totalMonths} — dû le {new Date(nextPayment.dueDate).toLocaleDateString('fr-FR')}
                            </div>
                            <div className="font-bold text-gray-900">{fmt(nextPayment.amount)} FCFA</div>
                          </div>
                        </div>
                      )}
                      {/* Boutons paiement */}
                      <div className="space-y-2">
                        {(wallet?.balance || 0) < sc.monthlyAmount && (
                          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-700">
                            ⚠️ Solde insuffisant ({fmt(wallet?.balance || 0)} FCFA) — il vous faut {fmt(sc.monthlyAmount - (wallet?.balance || 0))} FCFA de plus.
                            <Link href="/wallet/deposit" className="ml-2 font-bold underline">Recharger →</Link>
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            disabled={!wallet || wallet.balance < sc.monthlyAmount}
                            onClick={async () => {
                              const res = await authPost("/api/repayment/pay/" + sc.id, {});
                              if (res.success) { showFlash("✅ Mensualité " + res.data?.paidMonth + "/" + sc.totalMonths + " payée — " + fmt(res.data?.amount) + " FCFA"); loadData(); }
                              else showFlash("❌ " + res.message);
                            }}
                            className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold py-2.5 rounded-xl disabled:opacity-40">
                            💸 Payer mois {sc.paidMonths + 1}
                          </button>
                          <button
                            disabled={!wallet || wallet.balance < sc.monthlyAmount * 2}
                            onClick={async () => {
                              const months = prompt("Combien de mois en avance ? (2-" + (sc.totalMonths - sc.paidMonths) + ")");
                              if (!months) return;
                              const res = await authPost("/api/repayment/pay-advance/" + sc.id, { months: parseInt(months) });
                              if (res.success) { showFlash("✅ " + res.data?.monthsPaid + " mois payés — " + fmt(res.data?.totalPaid) + " FCFA"); loadData(); }
                              else showFlash("❌ " + res.message);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-xl disabled:opacity-40">
                            ⏩ X mois avance
                          </button>
                          <button
                            disabled={!wallet || wallet.balance < sc.remainingAmount}
                            onClick={async () => {
                              if (!confirm("Tout rembourser (" + fmt(sc.remainingAmount) + " FCFA) ? +20 pts réputation !")) return;
                              const res = await authPost("/api/repayment/pay-advance/" + sc.id, { months: 0 });
                              if (res.success) { showFlash("✅ Remboursement complet ! +20 pts réputation"); loadData(); }
                              else showFlash("❌ " + res.message);
                            }}
                            className="bg-green-700 hover:bg-green-800 text-white text-xs font-bold py-2.5 rounded-xl disabled:opacity-40">
                            ✅ Tout payer
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Projets actifs */}
            {activeProjects > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-4">🚀 Projets en collecte</h2>
                {projects.filter(p => p.status === "ACTIVE").map((p: any) => (
                  <div key={p.id} className="border border-gray-100 rounded-2xl p-4 mb-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-gray-900">{p.title}</div>
                        <div className="text-xs text-gray-400">{p.sector} · {p.city}</div>
                      </div>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">En ligne</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2 mb-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{width: Math.min(100, Math.round(((p.raisedAmount||0)/(p.goalAmount||1))*100)) + "%"}}></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{fmt(p.raisedAmount||0)} FCFA levés</span>
                      <span>{Math.round(((p.raisedAmount||0)/(p.goalAmount||1))*100)}% de {fmt(p.goalAmount||0)} FCFA</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Link href={"/entrepreneur/milestones/" + p.id} className="text-xs bg-purple-50 text-purple-600 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100">🏗️ Jalons</Link>
                      <Link href={"/feed/" + p.id} className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100">📸 Update</Link>
                      <Link href={"/projects/" + p.id} className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100">🔍 Voir</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {visibleProjects.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="text-5xl mb-3">🚀</div>
                <h3 className="font-bold text-gray-900 mb-2">Aucun projet</h3>
                <p className="text-gray-500 text-sm mb-4">Soumettez votre premier projet pour commencer à lever des fonds.</p>
                <Link href="/projects/submit" className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700">
                  + Soumettre un projet
                </Link>
              </div>
            )}
          </div>
        )}

        {/* REMBOURSEMENTS */}
        {activeTab === "repayment" && (
          <div className="space-y-5">
            {Object.entries(schedules).length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="text-5xl mb-3">📅</div>
                <h3 className="font-bold text-gray-900 mb-2">Aucun échéancier actif</h3>
                <p className="text-gray-500 text-sm">Les échéanciers apparaissent quand un projet est financé.</p>
              </div>
            ) : Object.entries(schedules).map(([projectId, sc]: [string, any]) => {
              const project = projects.find(p => p.id === projectId);
              const paid = sc.payments?.filter((p: any) => p.status === 'PAID') || [];
              const pending = sc.payments?.filter((p: any) => p.status === 'PENDING') || [];
              return (
                <div key={projectId} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="font-bold text-gray-900 text-lg">{project?.title}</h2>
                      <p className="text-xs text-gray-400">{project?.sector} · Échéancier de remboursement</p>
                    </div>
                    <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${sc.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                      {sc.status === 'COMPLETED' ? '✅ Terminé' : sc.paidMonths + '/' + sc.totalMonths + ' mois'}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <div className="text-xs text-gray-400">Total à rembourser</div>
                      <div className="font-bold text-gray-900">{fmt(sc.totalAmount)} FCFA</div>
                    </div>
                    <div className="bg-green-50 rounded-xl p-3 text-center">
                      <div className="text-xs text-gray-400">Déjà remboursé</div>
                      <div className="font-bold text-green-700">{fmt(sc.totalAmount - sc.remainingAmount)} FCFA</div>
                    </div>
                    <div className="bg-orange-50 rounded-xl p-3 text-center">
                      <div className="text-gray-400 text-xs">Reste à payer</div>
                      <div className="font-bold text-orange-700">{fmt(sc.remainingAmount)} FCFA</div>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3 text-center">
                      <div className="text-xs text-gray-400">Mensualité</div>
                      <div className="font-bold text-blue-700">{fmt(sc.monthlyAmount)} FCFA</div>
                    </div>
                  </div>

                  {/* Barre progression */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Progression</span>
                      <span>{Math.round(((sc.totalAmount - sc.remainingAmount) / sc.totalAmount) * 100)}%</span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-3">
                      <div className="bg-green-500 h-3 rounded-full transition-all" style={{width: Math.round(((sc.totalAmount - sc.remainingAmount) / sc.totalAmount) * 100) + "%"}}></div>
                    </div>
                  </div>

                  {/* Calendrier visuel */}
                  <div className="mb-4">
                    <div className="text-xs font-semibold text-gray-600 mb-2">Calendrier des mensualités</div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {sc.payments?.map((pay: any) => {
                        const isLate = pay.status === 'PENDING' && new Date(pay.dueDate) < new Date();
                        return (
                          <div key={pay.id} className={`rounded-xl p-2 text-center ${pay.status === 'PAID' ? 'bg-green-100' : isLate ? 'bg-red-100' : 'bg-gray-100'}`}>
                            <div className="text-xs font-bold text-gray-700">M{pay.monthNumber}</div>
                            <div className="text-sm">{pay.status === 'PAID' ? '✅' : isLate ? '⚠️' : '⏳'}</div>
                            <div className="text-xs text-gray-500">{fmt(pay.amount)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Solde wallet */}
                  <div className={`rounded-xl p-3 mb-4 flex items-center justify-between ${(wallet?.balance||0) >= sc.monthlyAmount ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="text-xs">
                      <span className="font-semibold">Votre solde wallet :</span> {fmt(wallet?.balance||0)} FCFA
                      {(wallet?.balance||0) < sc.monthlyAmount && (
                        <span className="text-red-600 ml-2">— Manque {fmt(sc.monthlyAmount - (wallet?.balance||0))} FCFA</span>
                      )}
                    </div>
                    {(wallet?.balance||0) < sc.monthlyAmount && (
                      <Link href="/wallet/deposit" className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-orange-600">
                        + Recharger
                      </Link>
                    )}
                  </div>

                  {/* Boutons paiement */}
                  {sc.status === 'ACTIVE' && (
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        disabled={(wallet?.balance||0) < sc.monthlyAmount}
                        onClick={async () => {
                          const res = await authPost("/api/repayment/pay/" + sc.id, {});
                          if (res.success) { showFlash("✅ Mensualité " + res.data?.paidMonth + "/" + sc.totalMonths + " payée"); loadData(); }
                          else showFlash("❌ " + res.message);
                        }}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40 transition-colors">
                        💸 Payer mois {sc.paidMonths + 1}/{sc.totalMonths}
                      </button>
                      <button
                        disabled={(wallet?.balance||0) < sc.monthlyAmount * 2}
                        onClick={async () => {
                          const remaining = sc.totalMonths - sc.paidMonths;
                          const months = prompt("Payer combien de mois en avance ? (max " + remaining + ")");
                          if (!months || isNaN(parseInt(months))) return;
                          const res = await authPost("/api/repayment/pay-advance/" + sc.id, { months: parseInt(months) });
                          if (res.success) { showFlash("✅ " + res.data?.monthsPaid + " mois payés en avance"); loadData(); }
                          else showFlash("❌ " + res.message);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40 transition-colors">
                        ⏩ Payer en avance
                      </button>
                      <button
                        disabled={(wallet?.balance||0) < sc.remainingAmount}
                        onClick={async () => {
                          if (!confirm("Tout rembourser (" + fmt(sc.remainingAmount) + " FCFA) ? Vous gagnerez +20 pts de réputation !")) return;
                          const res = await authPost("/api/repayment/pay-advance/" + sc.id, { months: 0 });
                          if (res.success) { showFlash("✅ Remboursement complet ! +20 pts réputation"); loadData(); }
                          else showFlash("❌ " + res.message);
                        }}
                        className="bg-green-700 hover:bg-green-800 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40 transition-colors">
                        ✅ Tout rembourser
                      </button>
                    </div>
                  )}

                  {sc.status === 'COMPLETED' && (
                    <div className="text-center bg-green-50 rounded-xl py-4 text-green-700 font-bold">
                      ✅ Ce projet est entièrement remboursé !
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* PROJETS */}
        {activeTab === "projects" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-gray-900">Mes projets ({visibleProjects.length})</h2>
              <Link href="/projects/submit" className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-700">
                + Nouveau
              </Link>
            </div>
            {visibleProjects.map((p: any) => {
              const s = STATUS_CONFIG[p.status] || STATUS_CONFIG.DRAFT;
              const pct = Math.round(((p.raisedAmount||0)/(p.goalAmount||1))*100);
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-bold text-gray-900 text-lg">{p.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{p.sector} · {p.city} · {p.durationMonths} mois · +{p.expectedReturn}% retour</div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${s.bg} ${s.color}`}>{s.label}</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2 mb-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{width: Math.min(100, pct) + "%"}}></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mb-4">
                    <span>{fmt(p.raisedAmount||0)} FCFA levés</span>
                    <span>{pct}% de {fmt(p.goalAmount||0)} FCFA · {p.investorCount||0} investisseur(s)</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={"/entrepreneur/milestones/" + p.id} className="text-xs bg-purple-50 text-purple-600 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100">🏗️ Jalons</Link>
                    <Link href={"/feed/" + p.id} className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100">📸 Update</Link>
                    <Link href={"/projects/" + p.id} className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100">🔍 Voir</Link>
                    {p.status === "ACTIVE" && !p.earlyCloseRequested && (
                      <button onClick={async () => {
                        const note = prompt("Motif de clôture anticipée :") || "";
                        const res = await authPost("/api/projects/" + p.id + "/request-early-close", { note });
                        if (res.success) showFlash("✅ Demande envoyée");
                        else showFlash("❌ " + res.message);
                      }} className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-100">🔒 Clôture anticipée</button>
                    )}
                    {p.status === "ACTIVE" && !p.extensionRequested && (
                      <button onClick={async () => {
                        const days = prompt("Nombre de jours de prolongation (7-90) :");
                        if (!days) return;
                        const note = prompt("Motif :") || "";
                        const res = await authPost("/api/projects/" + p.id + "/request-extension", { days: Number(days), note });
                        if (res.success) showFlash("✅ Demande de prolongation envoyée");
                        else showFlash("❌ " + res.message);
                      }} className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100">⏰ Prolonger</button>
                    )}
                  </div>
                  {/* Rapport mensuel */}
                  {["ACTIVE","IN_PROGRESS","FUNDED"].includes(p.status) && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <textarea
                        placeholder="Publier un rapport mensuel..."
                        value={reportText[p.id] || ""}
                        onChange={e => setReportText({...reportText, [p.id]: e.target.value})}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-green-400"
                        rows={2}
                      />
                      <button onClick={async () => {
                        if (!reportText[p.id]?.trim()) return;
                        const res = await authPost("/api/feed/" + p.id + "/post", { content: reportText[p.id], type: "UPDATE" });
                        if (res.success) { showFlash("✅ Rapport publié"); setReportText({...reportText, [p.id]: ""}); }
                        else showFlash("❌ " + res.message);
                      }} className="mt-2 bg-green-600 text-white text-xs px-4 py-2 rounded-xl hover:bg-green-700 font-medium">
                        📢 Publier rapport
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* WALLET */}
        {activeTab === "wallet" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-4">💳 Mon Wallet</h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                  <div className="text-xs text-gray-500 mb-1">Solde disponible</div>
                  <div className="text-2xl font-bold text-green-700">{fmt(wallet?.balance||0)} FCFA</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
                  <div className="text-xs text-gray-500 mb-1">Total levé (tous projets)</div>
                  <div className="text-2xl font-bold text-blue-700">{fmt(totalRaised)} FCFA</div>
                </div>
              </div>
              <div className="flex gap-3">
                <Link href="/wallet/deposit" className="flex-1 bg-green-600 text-white text-center font-bold py-3 rounded-xl hover:bg-green-700 text-sm">
                  + Déposer des fonds
                </Link>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-3">Score de réputation</h3>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-gray-900">{user?.reputationScore || 0}</div>
                <div className="flex-1">
                  <div className="bg-gray-200 rounded-full h-3">
                    <div className="bg-green-500 h-3 rounded-full" style={{width: Math.max(0, Math.min(100, user?.reputationScore || 0)) + "%"}}></div>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">/ 100 — Améliorez votre score en remboursant à temps</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
