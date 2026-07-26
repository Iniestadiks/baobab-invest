"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { authGet, authPost } from "@/lib/api";

const LEVEL_COLORS: Record<string,string> = {
  "Débutant":"bg-green-50 text-green-700",
  "Intermédiaire":"bg-blue-50 text-blue-700",
};
const CATEGORY_LABELS: Record<string,string> = {
  GESTION: "Gestion", MARKETING: "Marketing", AGRICULTURE: "Agriculture",
  PLATEFORME: "Plateforme", INVESTISSEMENT: "Investissement", HYGIENE: "Hygiène",
};

export default function AcademyPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCourse, setOpenCourse] = useState<any>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [stats, setStats] = useState<{ totalCertified: number; completedCertified: number }>({ totalCertified: 0, completedCertified: 0 });

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };

  const load = () => {
    setLoading(true);
    authGet("/api/academy/courses").then((res: any) => {
      if (res.success) {
        setCourses(res.data.courses || []);
        setStats({ totalCertified: res.data.totalCertified || 0, completedCertified: res.data.completedCertified || 0 });
      }
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const markComplete = async (courseId: string) => {
    setCompleting(courseId);
    const res = await authPost(`/api/academy/complete/${courseId}`, {});
    if (res.success) {
      flash(res.message || "✅ Cours terminé !");
      setOpenCourse(null);
      load();
    } else {
      flash("❌ " + res.message);
    }
    setCompleting(null);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-4xl animate-pulse">📚</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/dashboard/redirect" className="text-gray-400 hover:text-green-600">← Dashboard</Link>
          <span className="font-bold text-green-600">Académie KORAPACT</span>
        </div>
      </nav>
      {msg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-medium">{msg}</div>
      )}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-gradient-to-r from-green-700 to-green-600 rounded-2xl p-8 text-white mb-8">
          <div className="text-4xl mb-3">📚</div>
          <h1 className="text-2xl font-bold mb-2">Académie KORAPACT</h1>
          <p className="text-green-100 mb-4">Cours courts pour renforcer tes compétences — gestion, marketing, investissement et utilisation de la plateforme.</p>
          <div className="flex gap-4 text-sm flex-wrap">
            <div className="bg-white/10 rounded-xl px-4 py-2">📹 {courses.length} cours</div>
            <div className="bg-white/10 rounded-xl px-4 py-2">🏆 {stats.completedCertified}/{stats.totalCertified} certifications obtenues</div>
            <div className="bg-white/10 rounded-xl px-4 py-2">⚡ 100% gratuit</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
          <h2 className="font-bold text-gray-900 mb-4">🏆 Pourquoi se certifier ?</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon:"📈", title:"Score bankabilité", desc:"+5 pts par certification obtenue, jusqu'à +15 pts sur votre score" },
              { icon:"💰", title:"Projets > 1M FCFA", desc:"Nécessitent au moins 2 certifications pour être soumis" },
              { icon:"⭐", title:"Points de réputation", desc:"Chaque cours terminé crédite aussi des points de réputation" },
            ].map(item => (
              <div key={item.title} className="bg-gray-50 rounded-xl p-4 text-center">
                <div className="text-3xl mb-2">{item.icon}</div>
                <div className="font-semibold text-gray-900 text-sm mb-1">{item.title}</div>
                <div className="text-xs text-gray-500">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
        <h2 className="font-bold text-gray-900 text-lg mb-4">Tous les cours</h2>
        {courses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
            Aucun cours disponible pour votre rôle actuellement.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {courses.map((course: any) => (
              <div key={course.id} className={`bg-white rounded-2xl border p-5 shadow-sm transition-colors ${course.completed ? "border-green-300 bg-green-50/30" : "border-gray-100 hover:border-green-200"}`}>
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-green-50 flex items-center justify-center text-3xl flex-shrink-0">{course.emoji}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${LEVEL_COLORS[course.level]}`}>{course.level}</span>
                      <span className="text-xs text-gray-400">⏱ {course.duration}</span>
                      <span className="text-xs text-gray-400">{CATEGORY_LABELS[course.category]}</span>
                      {course.certified && <span className="text-xs bg-yellow-50 text-yellow-700 font-bold px-2 py-0.5 rounded-full">🏆 Certifiant +{course.points}pts</span>}
                      {course.completed && <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">✅ Terminé</span>}
                    </div>
                    <h3 className="font-bold text-gray-900 text-sm mb-1">{course.title}</h3>
                    <p className="text-xs text-gray-500">{course.desc}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <button onClick={() => setOpenCourse(course)}
                    className={`w-full text-xs font-semibold py-2 rounded-xl transition-colors ${course.completed ? "bg-gray-100 text-gray-500" : "bg-green-600 hover:bg-green-700 text-white"}`}>
                    {course.completed ? "📖 Revoir le cours" : "▶️ Commencer le cours"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl">🎓</div>
            <div>
              <div className="font-bold text-blue-900">Mentorat Live — Sessions Q&A</div>
              <div className="text-sm text-blue-700">Prochaine session : à venir — cette fonctionnalité n'est pas encore active</div>
            </div>
          </div>
          <p className="text-sm text-blue-700">Des sessions en direct avec des experts sont prévues pour une prochaine version de l'Académie.</p>
        </div>
      </div>

      {/* MODAL LEÇON */}
      {openCourse && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-start justify-between sticky top-0 bg-white rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="text-3xl">{openCourse.emoji}</div>
                <div>
                  <h3 className="font-bold text-gray-900">{openCourse.title}</h3>
                  <div className="text-xs text-gray-400">{openCourse.duration} · {openCourse.level}</div>
                </div>
              </div>
              <button onClick={() => setOpenCourse(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="p-6 space-y-3">
              {openCourse.content?.map((para: string, i: number) => (
                <div key={i} className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed">
                  {para}
                </div>
              ))}
              {openCourse.certified && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
                  🏆 Ce cours est certifiant : +{openCourse.points} pts sur votre score de bankabilité (si vous soumettez un projet) et vos points de réputation.
                </div>
              )}
              {!openCourse.completed ? (
                <button onClick={() => markComplete(openCourse.id)} disabled={completing === openCourse.id}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 mt-2">
                  {completing === openCourse.id ? "..." : `✅ Marquer comme terminé (+${openCourse.points} pts)`}
                </button>
              ) : (
                <div className="text-center bg-green-50 border border-green-200 rounded-xl py-3 text-green-700 font-medium text-sm mt-2">
                  ✅ Cours déjà terminé — {openCourse.points} pts déjà crédités
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
