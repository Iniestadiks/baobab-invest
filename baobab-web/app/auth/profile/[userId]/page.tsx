"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { authGet } from "@/lib/api";

const LEVEL_NAMES: Record<number, string> = {
  1: "🌱 Graine", 2: "🌿 Jeune Baobab", 3: "🌳 Baobab", 4: "🏅 Grand Baobab"
};

export default function PublicProfilePage() {
  const { userId } = useParams();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authGet(`/api/auth/profile/${userId}`)
      .then(res => {
        if (res.success) setProfile(res.data);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center"><div className="text-5xl animate-bounce mb-4">👤</div><p className="text-gray-400">Chargement...</p></div>
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-5xl mb-4">❌</div>
        <p className="text-gray-500 mb-4">Profil introuvable</p>
        <button onClick={() => router.back()} className="text-green-600 hover:underline text-sm">← Retour</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">←</button>
          <span className="font-bold text-gray-900">Profil investisseur</span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">

        {/* Carte profil */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-2xl font-bold text-green-700">
              {profile.profileImageUrl ? (
                <img src={profile.profileImageUrl} className="w-16 h-16 rounded-full object-cover" alt="avatar" />
              ) : (
                `${profile.firstName?.[0]}${profile.lastName?.[0]}`
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{profile.firstName} {profile.lastName}</h1>
              <p className="text-sm text-gray-500">{LEVEL_NAMES[profile.level] || "🌱 Graine"}</p>
              {profile.city && <p className="text-xs text-gray-400 mt-0.5">📍 {profile.city}</p>}
            </div>
          </div>

          {profile.bio && (
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 italic mb-4">
              "{profile.bio}"
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <div className="font-bold text-green-700">{LEVEL_NAMES[profile.level] || "🌱 Graine"}</div>
              <div className="text-xs text-gray-500">Niveau investisseur</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <div className="font-bold text-blue-700">{profile.reputationScore || 50}/100</div>
              <div className="text-xs text-gray-500">Score réputation</div>
            </div>
          </div>

          <div className="mt-3 text-xs text-gray-400 text-center">
            Membre depuis {new Date(profile.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          </div>
        </div>

        {/* Bouton contact */}
        <Link
          href={`/messages?to=${profile.id}`}
          className="block w-full bg-green-600 hover:bg-green-700 text-white text-center font-bold py-3 rounded-2xl transition-colors"
        >
          💬 Envoyer un message
        </Link>

        <button
          onClick={() => router.back()}
          className="block w-full text-center text-gray-400 hover:text-gray-600 text-sm py-2"
        >
          ← Retour
        </button>

      </div>
    </div>
  );
}
