"use client";
import { useEffect, useState } from "react";
import { authGet } from "@/lib/api";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const MILESTONE_COLORS: Record<string, string> = {
  PENDING: "#94a3b8", SUBMITTED: "#3b82f6",
  APPROVED: "#22c55e", REJECTED: "#ef4444", PAID: "#8b5cf6"
};
const MILESTONE_LABELS: Record<string, string> = {
  PENDING: "En attente", SUBMITTED: "Soumis",
  APPROVED: "Approuvé", REJECTED: "Rejeté", PAID: "Payé"
};

export default function EntrepreneurCharts() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authGet("/api/projects/stats/entrepreneur")
      .then(d => { if (d.success) setData(d.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
      <div className="text-3xl animate-pulse mb-2">📊</div>
      <p className="text-gray-400 text-sm">Chargement des graphiques...</p>
    </div>
  );

  if (!data || data.totalProjects === 0) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
      <div className="text-4xl mb-3">📊</div>
      <p className="text-gray-500 text-sm">Les graphiques apparaîtront après ton premier projet</p>
    </div>
  );

  const milestoneChartData = Object.entries(data.milestoneStats || {})
    .filter(([_, v]) => (v as number) > 0)
    .map(([status, count]) => ({
      name: MILESTONE_LABELS[status] || status,
      value: count as number,
      color: MILESTONE_COLORS[status]
    }));

  return (
    <div className="space-y-6">
      {/* Courbe de collecte */}
      {data.collecteData?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 mb-1">📈 Progression de la collecte</h3>
          <p className="text-xs text-gray-400 mb-4">Montant levé cumulativement dans le temps</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.collecteData}>
              <defs>
                <linearGradient id="colorCollecte" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1A7A4A" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#1A7A4A" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => [`${Number(v).toLocaleString()} FCFA`]} />
              <Area type="monotone" dataKey="montant" stroke="#1A7A4A" fill="url(#colorCollecte)" strokeWidth={2} name="Collecte" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Projets par collecte */}
        {data.investorData?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-1">🏆 Mes projets — Avancement</h3>
            <p className="text-xs text-gray-400 mb-4">Pourcentage de financement atteint</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.investorData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                <Tooltip formatter={(v: any) => [`${v}%`, "Financement"]} />
                <Bar dataKey="pourcentage" fill="#1A7A4A" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Statut jalons */}
        {milestoneChartData.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-1">🏗️ État de mes jalons</h3>
            <p className="text-xs text-gray-400 mb-4">Progression du déblocage des fonds</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={milestoneChartData} cx="50%" cy="50%" outerRadius={70}
                  dataKey="value" label={({ name, value }) => `${name} (${value})`}
                  labelLine={false} fontSize={10}>
                  {milestoneChartData.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Investisseurs par projet */}
      {data.investorData?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 mb-1">👥 Investisseurs par projet</h3>
          <p className="text-xs text-gray-400 mb-4">Nombre d'investisseurs ayant fait confiance à chaque projet</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.investorData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="investisseurs" fill="#C9972A" radius={[4, 4, 0, 0]} name="Investisseurs" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
