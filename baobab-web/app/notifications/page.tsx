"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authGet, authPost } from "@/lib/api";

const NOTIF_ICONS: Record<string, string> = {
  INVESTMENT: "🚀", KYC_PENDING: "🪪", KYC_VERIFIED: "✅", KYC_REJECTED: "❌",
  MILESTONE_REQUEST: "📋", MILESTONE_APPROVED: "✅", MILESTONE_REJECTED: "❌",
  MILESTONE_UPDATE: "🏗️", MESSAGE: "💬", FEED_UPDATE: "📸", REIMBURSEMENT: "💰",
  INACTIVITY_ALERT: "⚠️", PROJECT_INACTIVITY: "📭", REFERRAL_BONUS: "🎁",
  MENTOR_ACCEPTED: "🎓", MENTOR_DECLINED: "❌", MENTOR_COMMISSION: "💰",
  DEPOSIT_CONFIRMED: "💳", WITHDRAWAL_CONFIRMED: "💸", TRANSACTION_REJECTED: "❌",
  DEPOSIT_REQUEST: "💰", WITHDRAWAL_REQUEST: "💸", DEFAULT: "🔔"
};

const NOTIF_LABELS: Record<string, string> = {
  INVESTMENT: "Investissement", MESSAGE: "Message", REIMBURSEMENT: "Remboursement",
  MILESTONE_APPROVED: "Jalon validé", MILESTONE_REJECTED: "Jalon rejeté",
  INACTIVITY_ALERT: "Alerte inactivité", KYC_VERIFIED: "KYC vérifié",
  DEPOSIT_CONFIRMED: "Dépôt confirmé", WITHDRAWAL_CONFIRMED: "Retrait confirmé",
  FEED_UPDATE: "Mise à jour projet", MENTOR_COMMISSION: "Commission mentor",
  DEFAULT: "Notification"
};

const ROLE_DASHBOARD: Record<string, string> = {
  INVESTOR: "/dashboard", ENTREPRENEUR: "/entrepreneur",
  MENTOR: "/mentor", ADMIN: "/admin", SUPPLIER: "/supplier/dashboard"
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [deleting, setDeleting] = useState<string | null>(null);

  const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
  const dashboard = ROLE_DASHBOARD[user.role] || "/dashboard";

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.replace("/auth/login"); return; }
    authGet("/api/notifications?limit=50").then(res => {
      if (res.success) setNotifications(res.data.notifications || []);
    }).finally(() => setLoading(false));
  }, []);

  const markAllRead = async () => {
    await authPost("/api/notifications/read-all", {});
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const markRead = async (id: string) => {
    await authPost(`/api/notifications/${id}/read`, {}).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const deleteNotif = async (id: string) => {
    setDeleting(id);
    await authPost(`/api/notifications/${id}/delete`, {}).catch(() => {});
    setNotifications(prev => prev.filter(n => n.id !== id));
    setDeleting(null);
  };

  const types = ["ALL", ...Array.from(new Set(notifications.map(n => n.type)))];
  const filtered = filter === "ALL" ? notifications : notifications.filter(n => n.type === filter);
  const unread = notifications.filter(n => !n.isRead).length;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-4xl animate-bounce">🔔</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={dashboard} className="text-gray-400 hover:text-green-600">←</Link>
            <span className="font-bold text-gray-900">🔔 Notifications</span>
            {unread > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold">{unread}</span>}
          </div>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-sm text-green-600 hover:underline font-medium">
              Tout marquer lu
            </button>
          )}
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-6 space-y-4">

        {/* Filtres */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {types.slice(0, 6).map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${filter === t ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-green-300"}`}>
              {t === "ALL" ? `Tout (${notifications.length})` : (NOTIF_LABELS[t] || t)}
            </button>
          ))}
        </div>

        {/* Liste */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-400">Aucune notification</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(n => (
              <div key={n.id} onClick={() => markRead(n.id)}
                className={`bg-white rounded-2xl border p-4 transition-all cursor-pointer hover:shadow-sm ${!n.isRead ? "border-green-200 bg-green-50/30" : "border-gray-100"}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${!n.isRead ? "bg-green-100" : "bg-gray-100"}`}>
                    {NOTIF_ICONS[n.type] || NOTIF_ICONS.DEFAULT}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-gray-900 text-sm">{n.title}</div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!n.isRead && <div className="w-2 h-2 bg-green-500 rounded-full"/>}
                        <button onClick={e => { e.stopPropagation(); deleteNotif(n.id); }}
                          disabled={deleting === n.id}
                          className="text-gray-300 hover:text-red-400 text-xs transition-colors">
                          {deleting === n.id ? "..." : "✕"}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.body}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400">
                        {new Date(n.createdAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${!n.isRead ? "bg-green-100 text-green-700 font-medium" : "bg-gray-100 text-gray-500"}`}>
                        {NOTIF_LABELS[n.type] || n.type}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {notifications.length > 0 && (
          <button onClick={() => {
            filtered.forEach(n => deleteNotif(n.id));
          }} className="w-full text-xs text-red-400 hover:text-red-600 py-2 text-center">
            🗑️ Supprimer toutes les notifications lues
          </button>
        )}
      </div>
    </div>
  );
}
