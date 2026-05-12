"use client";
import { useEffect, useState } from "react";
import { authGet } from "@/lib/api";
import {
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from "recharts";

const COLORS = ["#1A7A4A", "#C9972A", "#1A5276", "#C0392B", "#8E44AD", "#2E86C1"];
const SECTOR_LABELS: Record<string, string> = {
  AGRICULTURE:"🌾 Agri", COMMERCE:"🛒 Commerce", TECH:"💻 Tech",
  ARTISANAT:"🎨 Artisanat", EDUCATION:"📚 Éducation", SANTE:"🏥 Santé",
  SERVICES:"🔧 Services", ENERGIE:"⚡ Énergie", TRANSPORT:"🚌 Transport", AUTRE:"📦 Autre"
};

export default function InvestorCharts() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authGet("/api/investments/stats/charts")
      .then(d => { if (d.success) setData(d.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
      <div className="text-3xl animate-pulse mb-2">📊</div>
      <p className="text-gray-400 text-sm">Chargement des graphiques...</p>
    </div>
  );

  if (!data || data.totalInvestments === 0) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
      <div className="text-4xl mb-3">📊</div>
      <p className="text-gray-500 text-sm">Les graphiques apparaîtront après ton premier investissement</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Courbe évolution portefeuille */}
      {data.timelineData?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 mb-1">📈 Évolution de mon portefeuille</h3>
          <p className="text-xs text-gray-400 mb-4">Montant investi cumulé dans le temps</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.timelineData}>
              <defs>
                <linearGradient id="colorInvesti" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1A7A4A" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#1A7A4A" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorRetour" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C9972A" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#C9972A" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => [`${Number(v).toLocaleString()} FCFA`]} />
              <Legend />
              <Area type="monotone" dataKey="investi" stroke="#1A7A4A" fill="url(#colorInvesti)" strokeWidth={2} name="Investi" />
              <Area type="monotone" dataKey="retourAttendu" stroke="#C9972A" fill="url(#colorRetour)" strokeWidth={2} name="Retour attendu" strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Répartition par secteur */}
        {data.sectorData?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-1">🥧 Répartition par secteur</h3>
            <p className="text-xs text-gray-400 mb-4">Diversification de ton portefeuille</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data.sectorData.map((d: any) => ({ ...d, name: SECTOR_LABELS[d.name] || d.name }))}
                  cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false} fontSize={10}>
                  {data.sectorData.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => [`${Number(v).toLocaleString()} FCFA`]} />
              </PieChart>
            </ResponsiveContainer>
            {data.sectorData.length === 1 && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-xs text-yellow-700 text-center mt-2">
                💡 Diversifie tes investissements sur plusieurs secteurs pour réduire le risque
              </div>
            )}
          </div>
        )}

        {/* Statut des projets */}
        {data.byStatus && Object.keys(data.byStatus).length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-1">📋 Statut de mes projets</h3>
            <p className="text-xs text-gray-400 mb-4">État actuel de tes investissements</p>
            <div className="space-y-3">
              {Object.entries(data.byStatus).map(([status, count]: any) => {
                const labels: Record<string, { label: string; color: string; bg: string }> = {
                  ACTIVE: { label: "En ligne", color: "text-green-700", bg: "bg-green-500" },
                  COMPLETED: { label: "Terminé", color: "text-blue-700", bg: "bg-blue-500" },
                  IN_PROGRESS: { label: "En cours", color: "text-purple-700", bg: "bg-purple-500" },
                  FUNDED: { label: "Financé", color: "text-yellow-700", bg: "bg-yellow-500" },
                  FAILED: { label: "Échoué", color: "text-red-700", bg: "bg-red-500" },
                };
                const cfg = labels[status] || { label: status, color: "text-gray-700", bg: "bg-gray-500" };
                const total = Object.values(data.byStatus).reduce((a: any, b: any) => a + b, 0) as number;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={status}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={cfg.color + " font-medium"}>{cfg.label}</span>
                      <span className="text-gray-500">{count} projet(s) · {pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`${cfg.bg} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
