"use client";
import { useEffect, useState } from "react";
import { authGet } from "@/lib/api";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const COLORS = ["#1A7A4A", "#C9972A", "#1A5276", "#C0392B", "#8E44AD"];

export default function AdminCharts() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authGet("/api/admin/stats/charts")
      .then(d => { if (d.success) setData(d.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
      <div className="text-3xl animate-pulse mb-2">📊</div>
      <p className="text-gray-400 text-sm">Chargement des statistiques...</p>
    </div>
  );
  if (!data) return null;

  const k = data.kpis;

  return (
    <div className="space-y-6 mb-6">
      {/* KPIs financiers — ligne 1 */}
      <div>
        <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">💰 Finances</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total levé (brut)", value: `${(k.totalRaised/1000).toFixed(0)}k FCFA`, icon: "💰", color: "text-green-700", bg: "bg-green-50", note: "Capital investi total" },
            { label: "Cagnotte nette projets", value: `${(k.totalCagnotteNette/1000).toFixed(0)}k FCFA`, icon: "🏗️", color: "text-blue-700", bg: "bg-blue-50", note: "Après frais clôture (9%)" },
            { label: "Retours nets investisseurs", value: `${(k.totalNetInvestors/1000).toFixed(0)}k FCFA`, icon: "📈", color: "text-orange-700", bg: "bg-orange-50", note: "Projetés après frais retour (7%)" },
            { label: "Revenu net BAOBAB", value: `${(k.revenuNetBAOBAB||0).toLocaleString()} FCFA`, icon: "🏦", color: "text-purple-700", bg: "bg-purple-50", note: "Encaissé à ce jour" },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-4`}>
              <div className="text-xl mb-1">{s.icon}</div>
              <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs font-medium text-gray-700">{s.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{s.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* KPIs projets + users — ligne 2 */}
      <div>
        <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">📊 Activité</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Utilisateurs", value: k.totalUsers, icon: "👥", color: "text-blue-700", bg: "bg-blue-50", note: `${k.totalInvestors} inv. · ${k.totalEntrepreneurs} entr. · ${k.totalMentors} ment.` },
            { label: "Projets actifs", value: k.activeProjects, icon: "🚀", color: "text-green-700", bg: "bg-green-50", note: `${k.fundedProjects} financé(s) · ${k.completedProjects} terminé(s)` },
            { label: "Investissements", value: k.totalInvestments, icon: "💳", color: "text-orange-700", bg: "bg-orange-50", note: `Moy. ${(k.avgInvestment/1000).toFixed(0)}k FCFA` },
            { label: "KYC vérifiés", value: k.kycVerified, icon: "✅", color: "text-purple-700", bg: "bg-purple-50", note: `${k.kycPending || 0} en attente` },
            { label: "Taux KYC", value: `${k.kycRate}%`, icon: "📊", color: "text-yellow-700", bg: "bg-yellow-50", note: "Sur total utilisateurs" },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-4`}>
              <div className="text-xl mb-1">{s.icon}</div>
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs font-medium text-gray-700">{s.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{s.note}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Inscriptions */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-1">👥 Nouvelles inscriptions</h3>
          <p className="text-xs text-gray-400 mb-4">Évolution mensuelle</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data.usersTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#1A7A4A" strokeWidth={2} dot={false} name="Inscriptions" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Volume investissements brut vs net */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-1">💰 Volume investissements</h3>
          <p className="text-xs text-gray-400 mb-4">Brut vs Net cagnotte (FCFA)</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.investTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => `${v.toLocaleString()} FCFA`} />
              <Legend />
              <Bar dataKey="montant" fill="#1A7A4A" name="Brut levé" radius={[4,4,0,0]} />
              <Bar dataKey="net" fill="#C9972A" name="Net cagnotte" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Répartition rôles */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-1">👤 Répartition des rôles</h3>
          <p className="text-xs text-gray-400 mb-4">Composition de la communauté</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={data.roleData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {data.roleData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Projets par secteur */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-1">🏭 Projets par secteur</h3>
          <p className="text-xs text-gray-400 mb-4">Distribution sectorielle</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.sectorChart} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
              <Tooltip />
              <Bar dataKey="value" fill="#1A5276" name="Projets" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tableau récapitulatif financier */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-4">📋 Récapitulatif financier détaillé</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 rounded-xl">
                <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Indicateur</th>
                <th className="text-right px-4 py-2 text-xs text-gray-500 font-semibold">Montant (FCFA)</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { label: "Capital levé brut", value: k.totalRaised, note: "Total investi par les investisseurs", color: "text-gray-900" },
                { label: "↳ Cagnotte nette entrepreneurs", value: k.totalCagnotteNette, note: "Après BAOBAB 5% + mentor 2% + garantie 2%", color: "text-green-700" },
                { label: "↳ Commission BAOBAB collecte", value: Math.round(k.totalRaised - k.totalCagnotteNette - Math.round(k.totalRaised*0.02) - Math.round(k.totalRaised*0.02)), note: "5% à la clôture", color: "text-purple-700" },
                { label: "↳ Commission mentors versée", value: Math.round(k.totalRaised * 0.02), note: "2% crédité sur wallet mentor", color: "text-blue-700" },
                { label: "↳ Fonds de garantie", value: Math.round(k.totalRaised * 0.02), note: "2% réservé — libéré au remboursement", color: "text-orange-700" },
                { label: "Retour total brut (projeté)", value: k.totalExpectedReturn, note: "Capital + intérêts promis", color: "text-gray-900" },
                { label: "↳ Net versé aux investisseurs", value: k.totalNetInvestors, note: "Après BAOBAB 5% + PayDunya 2% sur retours", color: "text-green-700" },
                { label: "↳ Commission BAOBAB sur retours", value: k.totalExpectedReturn - k.totalNetInvestors - Math.round(k.totalExpectedReturn * 0.02), note: "5% prélevé au remboursement", color: "text-purple-700" },
                { label: "Revenu net BAOBAB (encaissé)", value: k.revenuNetBAOBAB, note: "Collecte - PayDunya absorbé", color: "text-purple-800 font-bold" },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-700">{row.label}</td>
                  <td className={`px-4 py-2 text-right font-mono ${row.color}`}>{row.value?.toLocaleString()}</td>
                  <td className="px-4 py-2 text-xs text-gray-400">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
