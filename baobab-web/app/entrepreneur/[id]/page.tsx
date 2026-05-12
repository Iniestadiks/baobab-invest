"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function EntrepreneurPublicPage() {
  const { id } = useParams();
  const [entrepreneur, setEntrepreneur] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/user/${id}`).then(r => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects?entrepreneurId=${id}`).then(r => r.json()),
    ]).then(([user, proj]) => {
      if (user.success) setEntrepreneur(user.data);
      if (proj.success) setProjects(proj.data.projects || []);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-5xl animate-bounce">🚀</div>
    </div>
  );

  if (!entrepreneur) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4">😕</div>
        <p className="text-gray-500">Entrepreneur introuvable</p>
        <Link href="/projects" className="btn-primary inline-flex mt-4">← Voir les projets</Link>
      </div>
    </div>
  );

  const totalRaised = projects.reduce((s, p) => s + (p.raisedAmount || 0), 0);
  const successRate = projects.length > 0
    ? Math.round(projects.filter(p => p.status === "COMPLETED").length / projects.length * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/projects" className="text-gray-400 hover:text-green-600">← Catalogue</Link>
          <span className="font-bold text-green-600">Profil Entrepreneur</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header profil */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
          <div className="flex items-start gap-5">
            <div className="w-20 h-20 rounded-2xl bg-green-100 flex items-center justify-center text-3xl font-bold text-green-700 flex-shrink-0">
              {entrepreneur.firstName[0]}{entrepreneur.lastName[0]}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">
                  {entrepreneur.firstName} {entrepreneur.lastName}
                </h1>
                {entrepreneur.kycStatus === "VERIFIED" && (
                  <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">✅ KYC Vérifié</span>
                )}
              </div>
              <div className="text-gray-500 text-sm mb-2">
                🚀 Entrepreneur · 📍 {entrepreneur.city || "Non renseigné"}
              </div>
              {entrepreneur.bio && (
                <p className="text-gray-600 text-sm leading-relaxed">{entrepreneur.bio}</p>
              )}
            </div>
            <div className="flex-shrink-0 text-center">
              <div className="text-3xl font-bold text-green-600">{entrepreneur.reputationScore}/100</div>
              <div className="text-xs text-gray-400">Score réputation</div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${entrepreneur.reputationScore}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Projets", value: projects.length, icon: "📋", color: "text-blue-700", bg: "bg-blue-50" },
            { label: "Total levé", value: `${totalRaised.toLocaleString()} FCFA`, icon: "💰", color: "text-green-700", bg: "bg-green-50" },
            { label: "Taux succès", value: `${successRate}%`, icon: "✅", color: "text-purple-700", bg: "bg-purple-50" },
            { label: "Membre depuis", value: new Date(entrepreneur.createdAt).toLocaleDateString("fr-FR", { month: "short", year: "numeric" }), icon: "📅", color: "text-gray-700", bg: "bg-gray-50" },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center`}>
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className={`font-bold text-sm ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Projets */}
        <h2 className="font-bold text-gray-900 text-lg mb-4">Projets de {entrepreneur.firstName}</h2>
        {projects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <div className="text-4xl mb-3">🌱</div>
            <p className="text-gray-500">Aucun projet actif pour l'instant</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {projects.map((p: any) => {
              const fundingPercent = Math.round((p.raisedAmount / p.goalAmount) * 100);
              return (
                <Link key={p.id} href={`/projects/${p.id}`}
                  className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-green-200 shadow-sm transition-all">
                  <div className="font-bold text-gray-900 mb-1">{p.title}</div>
                  <div className="text-xs text-gray-500 mb-3">{p.sector} · {p.city}</div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(fundingPercent, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{p.raisedAmount?.toLocaleString()} FCFA levés</span>
                    <span className="text-green-600 font-bold">{fundingPercent}%</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Bouton contacter */}
        <div className="mt-6 text-center">
          <Link href={`/messages?to=${entrepreneur.id}`}
            className="btn-primary inline-flex items-center gap-2">
            💬 Contacter {entrepreneur.firstName}
          </Link>
        </div>
      </div>
    </div>
  );
}
