"use client";
import { useEffect, useState, useCallback } from "react";

interface Mentor {
  id: string;
  firstName: string;
  lastName: string;
  bio: string;
  city: string;
  country: string;
  reputationScore: number;
  activeProjects: number;
  availableSlots: number;
  isFull: boolean;
}

interface Props {
  selectedMentorId: string;
  onSelect: (mentor: Mentor | null) => void;
}

const COUNTRY_FLAGS: Record<string, string> = {
  SN: "🇸🇳", CI: "🇨🇮", CM: "🇨🇲", ML: "🇲🇱", BF: "🇧🇫", GN: "🇬🇳",
};

export default function MentorPicker({ selectedMentorId, onSelect }: Props) {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const fetchMentors = useCallback(async (s: string, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "6" });
      if (s) params.append("search", s);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/mentors?${params}`);
      const data = await res.json();
      if (data.success) {
        setMentors(data.data.mentors);
        setTotalPages(data.data.pagination.totalPages);
        setTotal(data.data.pagination.total);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showPicker) fetchMentors(search, page);
  }, [showPicker, search, page, fetchMentors]);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  const handleSelect = (mentor: Mentor) => {
    setSelectedMentor(mentor);
    onSelect(mentor);
    setShowPicker(false);
  };

  const handleRemove = () => {
    setSelectedMentor(null);
    onSelect(null);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-700 bg-green-50";
    if (score >= 70) return "text-blue-700 bg-blue-50";
    return "text-orange-700 bg-orange-50";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold text-gray-600">
          Mentor / Garant <span className="text-green-600 ml-1 text-xs font-normal">+25 pts bankabilité</span>
        </label>
        <span className="text-xs text-gray-400">Optionnel mais fortement recommandé</span>
      </div>

      {/* Mentor sélectionné */}
      {selectedMentor ? (
        <div className="border-2 border-green-300 bg-green-50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-200 flex items-center justify-center font-bold text-green-800 text-lg flex-shrink-0">
              {selectedMentor.firstName[0]}{selectedMentor.lastName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-bold text-gray-900">{selectedMentor.firstName} {selectedMentor.lastName}</span>
                <span className="text-xs">{COUNTRY_FLAGS[selectedMentor.country] || ""}</span>
              </div>
              <div className="text-xs text-gray-500">{selectedMentor.city} · {selectedMentor.activeProjects}/5 projets en cours</div>
              {selectedMentor.bio && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{selectedMentor.bio}</p>}
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getScoreColor(selectedMentor.reputationScore)}`}>
                ⭐ {selectedMentor.reputationScore}/100
              </span>
              <div className="flex gap-2">
                <button onClick={() => setShowPicker(true)} className="text-xs text-blue-600 hover:underline">Changer</button>
                <button onClick={handleRemove} className="text-xs text-red-500 hover:underline">Retirer</button>
              </div>
            </div>
          </div>
          <div className="mt-3 bg-green-100 rounded-lg px-3 py-2 text-xs text-green-700">
            ✅ Mentor sélectionné — En acceptant, il engagera publiquement sa réputation sur ton projet.
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="w-full border-2 border-dashed border-gray-200 hover:border-green-300 hover:bg-green-50 rounded-xl p-4 text-center transition-all group"
        >
          <div className="text-3xl mb-1 group-hover:scale-110 transition-transform">🎓</div>
          <div className="font-medium text-gray-600 group-hover:text-green-600 text-sm">Choisir un Mentor / Garant</div>
          <div className="text-xs text-gray-400 mt-0.5">+25 pts de bankabilité · 1% de commission sur les retours</div>
        </button>
      )}

      {/* Modal de sélection */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Choisir un Mentor</h3>
                <p className="text-xs text-gray-500 mt-0.5">{total} mentor(s) disponible(s) — Trié par score de réputation</p>
              </div>
              <button onClick={() => setShowPicker(false)} className="text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center">×</button>
            </div>

            {/* Barre de recherche */}
            <div className="p-4 border-b border-gray-100 flex-shrink-0">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                <input
                  type="text"
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Rechercher par nom, ville, expertise..."
                  className="input-field pl-9 text-sm"
                  autoFocus
                />
              </div>
              {search && (
                <div className="text-xs text-gray-400 mt-1">
                  {total} résultat(s) pour "{search}"
                </div>
              )}
            </div>

            {/* Info mentor */}
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex-shrink-0">
              <p className="text-xs text-blue-700">
                💡 Le mentor engage <strong>publiquement sa réputation</strong> sur ton projet. Il perçoit <strong>1% des retours</strong> générés.
                Il peut parrainer max <strong>5 projets simultanément</strong>.
              </p>
            </div>

            {/* Liste mentors */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="text-center py-12">
                  <div className="text-3xl animate-pulse mb-2">🎓</div>
                  <p className="text-gray-400 text-sm">Chargement des mentors...</p>
                </div>
              ) : mentors.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🔍</div>
                  <p className="text-gray-500 font-medium mb-1">Aucun mentor trouvé</p>
                  <button onClick={() => handleSearch("")} className="text-xs text-green-600 hover:underline">
                    Effacer la recherche
                  </button>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {mentors.map(mentor => (
                    <div
                      key={mentor.id}
                      onClick={() => !mentor.isFull && handleSelect(mentor)}
                      className={`border-2 rounded-xl p-4 transition-all ${
                        mentor.isFull
                          ? "border-gray-100 bg-gray-50 cursor-not-allowed opacity-60"
                          : selectedMentorId === mentor.id
                          ? "border-green-400 bg-green-50 cursor-pointer"
                          : "border-gray-100 hover:border-green-300 hover:bg-green-50 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0 ${
                          mentor.reputationScore >= 90 ? "bg-green-100 text-green-800" :
                          mentor.reputationScore >= 70 ? "bg-blue-100 text-blue-800" :
                          "bg-orange-100 text-orange-800"
                        }`}>
                          {mentor.firstName[0]}{mentor.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-gray-900 text-sm flex items-center gap-1">
                            {mentor.firstName} {mentor.lastName}
                            {COUNTRY_FLAGS[mentor.country] && <span className="text-xs">{COUNTRY_FLAGS[mentor.country]}</span>}
                          </div>
                          {mentor.city && <div className="text-xs text-gray-500">{mentor.city}</div>}
                          {mentor.bio && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{mentor.bio}</p>}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getScoreColor(mentor.reputationScore)}`}>
                            ⭐ {mentor.reputationScore}/100
                          </span>
                          {mentor.isFull ? (
                            <span className="text-xs text-red-500 font-medium">Complet</span>
                          ) : (
                            <span className="text-xs text-gray-400">{mentor.availableSlots} place(s) dispo.</span>
                          )}
                        </div>
                        {!mentor.isFull && (
                          <span className="text-xs text-green-600 font-semibold">Choisir →</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="text-sm text-gray-600 hover:text-green-600 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ← Précédent
                </button>
                <span className="text-xs text-gray-400">Page {page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="text-sm text-gray-600 hover:text-green-600 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Suivant →
                </button>
              </div>
            )}

            {/* Bouton passer sans mentor */}
            <div className="p-4 border-t border-gray-100 text-center flex-shrink-0">
              <button onClick={() => setShowPicker(false)} className="text-xs text-gray-400 hover:text-gray-600">
                Continuer sans mentor (déconseillé — -25 pts de bankabilité)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
