"use client";
import Link from "next/link";

const COURSES = [
  { id:1, title:"Gestion de base d'une entreprise", duration:"8 min", level:"Débutant", emoji:"📊", certified:true, desc:"Comptabilité de base, gestion de trésorerie et obligations légales." },
  { id:2, title:"Marketing digital en Afrique", duration:"12 min", level:"Intermédiaire", emoji:"📱", certified:true, desc:"WhatsApp Business, Facebook Ads, storytelling pour vendre plus." },
  { id:3, title:"Agriculture rentable : production à la vente", duration:"15 min", level:"Débutant", emoji:"🌾", certified:true, desc:"Planification des cultures, gestion des stocks, circuits de distribution." },
  { id:4, title:"Lever des fonds sur BAOBAB INVEST", duration:"6 min", level:"Débutant", emoji:"💰", certified:false, desc:"Créer un dossier convaincant, choisir son mentor, gérer sa campagne." },
  { id:5, title:"Artisanat et e-commerce", duration:"10 min", level:"Intermédiaire", emoji:"🎨", certified:true, desc:"Vendre ses créations en ligne, fixer ses prix, gérer les commandes." },
  { id:6, title:"Hygiène et sécurité alimentaire", duration:"8 min", level:"Débutant", emoji:"🍽️", certified:true, desc:"Normes d'hygiène, gestion des stocks alimentaires, formation du personnel." },
];

const LEVEL_COLORS: Record<string,string> = {
  "Débutant":"bg-green-50 text-green-700",
  "Intermédiaire":"bg-blue-50 text-blue-700",
};

export default function AcademyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/dashboard/redirect" className="text-gray-400 hover:text-green-600">← Dashboard</Link>
          <span className="font-bold text-green-600">Académie Baobab</span>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-gradient-to-r from-green-700 to-green-600 rounded-2xl p-8 text-white mb-8">
          <div className="text-4xl mb-3">📚</div>
          <h1 className="text-2xl font-bold mb-2">Académie BAOBAB INVEST</h1>
          <p className="text-green-100 mb-4">Cours courts (5-15 min) pour renforcer tes compétences. Certifie-toi pour augmenter ton score de bankabilité.</p>
          <div className="flex gap-4 text-sm flex-wrap">
            <div className="bg-white/10 rounded-xl px-4 py-2">📹 {COURSES.length} cours</div>
            <div className="bg-white/10 rounded-xl px-4 py-2">🏆 {COURSES.filter(c=>c.certified).length} certifications</div>
            <div className="bg-white/10 rounded-xl px-4 py-2">⚡ 100% gratuit</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
          <h2 className="font-bold text-gray-900 mb-4">🏆 Pourquoi se certifier ?</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon:"📈", title:"Score bankabilité", desc:"Chaque certification +5 à +15 pts sur ton score" },
              { icon:"💰", title:"Accès gros projets", desc:"Projets > 1M FCFA nécessitent certaines certifications" },
              { icon:"⭐", title:"Confiance investisseurs", desc:"Badge certifié visible sur ta fiche projet" },
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
        <div className="grid md:grid-cols-2 gap-5">
          {COURSES.map(course => (
            <div key={course.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:border-green-200 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-green-50 flex items-center justify-center text-3xl flex-shrink-0">{course.emoji}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${LEVEL_COLORS[course.level]}`}>{course.level}</span>
                    <span className="text-xs text-gray-400">⏱ {course.duration}</span>
                    {course.certified && <span className="text-xs bg-yellow-50 text-yellow-700 font-bold px-2 py-0.5 rounded-full">🏆 Certifiant</span>}
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm mb-1">{course.title}</h3>
                  <p className="text-xs text-gray-500">{course.desc}</p>
                </div>
              </div>
              <div className="mt-4">
                <button className="w-full bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-2 rounded-xl transition-colors">
                  ▶️ Commencer le cours
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl">🎓</div>
            <div>
              <div className="font-bold text-blue-900">Mentorat Live — Sessions Q&A</div>
              <div className="text-sm text-blue-700">Prochaine session : Bientôt disponible</div>
            </div>
          </div>
          <p className="text-sm text-blue-700 mb-4">Chaque mois, des experts animent des sessions en direct. Gestion d'entreprise, financement, marketing...</p>
          <button className="bg-blue-600 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-blue-700 transition-colors">
            🔔 Me notifier pour la prochaine session
          </button>
        </div>
      </div>
    </div>
  );
}
