"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function PublicProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL;
    fetch(`${API}/api/auth/profile/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          // La route retourne soit { user, projects } soit directement les données user
          if (d.data.user) { setUser(d.data.user); setProjects(d.data.projects || []); }
          else { setUser(d.data); setProjects(d.data.projects || []); }
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="text-4xl animate-bounce">👤</div></div>;
  if (!user) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400">Profil introuvable</p></div>;

  const levelLabel = ["🌱 Graine","🌿 Pousse","🌳 Arbre","🌲 Baobab","🏆 Grand Baobab"][user.level - 1] || "🌱 Graine";

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-green-600">←</button>
          <span className="font-bold text-gray-900">Profil</span>
        </div>
      </nav>
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">
        {/* En-tête profil */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">
            {user.profileImageUrl
              ? <img src={user.profileImageUrl} alt="" className="w-full h-full rounded-full object-cover" />
              : `${user.firstName?.[0]}${user.lastName?.[0]}`}
          </div>
          <h1 className="text-xl font-bold text-gray-900">{user.firstName} {user.lastName}</h1>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
              user.role === "MENTOR" ? "bg-purple-100 text-purple-700" :
              user.role === "ENTREPRENEUR" ? "bg-blue-100 text-blue-700" :
              "bg-green-100 text-green-700"}`}>
              {user.role}
            </span>
            <span className="text-xs text-gray-400">{levelLabel}</span>
          </div>
          {user.bio && <p className="text-sm text-gray-600 mt-3">{user.bio}</p>}
          <div className="flex items-center justify-center gap-4 mt-4 text-sm text-gray-500">
            {user.city && <span>📍 {user.city}</span>}
            {user.country && <span>{user.country}</span>}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <div className="text-2xl font-bold text-green-700">{user.reputationScore || 50}</div>
            <div className="text-xs text-gray-500">Score réputation</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <div className="text-2xl font-bold text-blue-700">{projects.length}</div>
            <div className="text-xs text-gray-500">{user.role === "MENTOR" ? "Projets mentorés" : "Projets"}</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <div className="text-2xl font-bold text-purple-700">{user.kycStatus === "VERIFIED" ? "✅" : "⏳"}</div>
            <div className="text-xs text-gray-500">KYC {user.kycStatus === "VERIFIED" ? "Vérifié" : "En attente"}</div>
          </div>
        </div>

        {/* Projets */}
        {projects.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-3">
              {user.role === "MENTOR" ? "🎓 Projets mentorés" : "🚀 Projets"}
            </h3>
            <div className="space-y-3">
              {projects.map((p: any) => (
                <Link key={p.id} href={`/projects/${p.id}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div>
                    <div className="font-medium text-sm text-gray-900">{p.title}</div>
                    <div className="text-xs text-gray-500">{p.sector} · {p.city}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-700">{p.raisedAmount?.toLocaleString()} FCFA</div>
                    <div className="text-xs text-gray-400">{p.status}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
