"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authGet, authFetch } from "@/lib/api";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { GeoSelector } from "@/hooks/useGeo";

const API = process.env.NEXT_PUBLIC_API_URL;
const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");

const SECTORS: Record<string, { label: string; icon: string; desc: string }> = {
  AGRICULTURE:  { label: "Agriculture",   icon: "🌾", desc: "Cultures, maraîchage, céréales" },
  ELEVAGE:      { label: "Élevage",       icon: "🐄", desc: "Bovins, volailles, pisciculture" },
  COMMERCE:     { label: "Commerce",      icon: "🛒", desc: "Vente, distribution, import/export" },
  TRANSPORT:    { label: "Transport",     icon: "🚗", desc: "Taxi, livraison, logistique" },
  TECH:         { label: "Technologie",   icon: "💻", desc: "Apps, web, informatique" },
  RESTAURATION: { label: "Restauration",  icon: "🍽️", desc: "Restaurant, traiteur, street food" },
  ARTISANAT:    { label: "Artisanat",     icon: "🎨", desc: "Couture, bijoux, bois, poterie" },
  SANTE:        { label: "Santé",         icon: "🏥", desc: "Pharmacie, clinique, bien-être" },
  EDUCATION:    { label: "Éducation",     icon: "📚", desc: "École, formation, coaching" },
  ENERGIE:      { label: "Énergie",       icon: "⚡", desc: "Solaire, biogaz, électricité" },
  SERVICES:     { label: "Services",      icon: "🤝", desc: "Nettoyage, sécurité, conseil" },
  IMMOBILIER:   { label: "Immobilier",    icon: "🏘️", desc: "Location, construction, rénovation" },
  AUTRE:        { label: "Autre",         icon: "📦", desc: "Tout autre secteur d'activité" },
};

const SUB_SECTORS: Record<string, string[]> = {
  AGRICULTURE:  ["Maraîchage", "Céréales", "Arboriculture fruitière", "Transformation agricole", "Apiculture", "Autre"],
  ELEVAGE:      ["Volailles", "Bovins/Ovins", "Pisciculture", "Porcs", "Lapins", "Autre"],
  COMMERCE:     ["Épicerie/Alimentation", "Textile/Mode", "Électronique", "Import-Export", "Marché/Bazar", "Autre"],
  TRANSPORT:    ["Taxi/VTC", "Transport marchandises", "Livraison", "Location véhicule", "Autre"],
  TECH:         ["Application mobile", "Site web/E-commerce", "Logiciel", "Services IT", "Autre"],
  RESTAURATION: ["Restaurant", "Street food/Gargote", "Traiteur/événements", "Boulangerie/Pâtisserie", "Autre"],
  ARTISANAT:    ["Couture/Mode", "Bijoux/Accessoires", "Menuiserie/Bois", "Poterie/Céramique", "Autre"],
  SANTE:        ["Pharmacie", "Cabinet médical", "Bien-être/Beauté", "Optique", "Autre"],
  EDUCATION:    ["École privée", "Centre de formation", "Coaching/Tutorat", "Crèche/Garderie", "Autre"],
  ENERGIE:      ["Solaire/Panneaux", "Biogaz", "Distribution carburant", "Autre"],
  SERVICES:     ["Nettoyage", "Sécurité/Gardiennage", "Conseil/Consulting", "Événementiel", "Autre"],
  IMMOBILIER:   ["Location résidentielle", "Location commerciale", "Construction", "Rénovation", "Autre"],
  AUTRE:        ["Autre activité"],
};

const COUNTRIES = [
  { code: "SN", flag: "🇸🇳", name: "Sénégal" },
  { code: "CI", flag: "🇨🇮", name: "Côte d'Ivoire" },
  { code: "CM", flag: "🇨🇲", name: "Cameroun" },
  { code: "ML", flag: "🇲🇱", name: "Mali" },
  { code: "BF", flag: "🇧🇫", name: "Burkina Faso" },
  { code: "GN", flag: "🇬🇳", name: "Guinée" },
  { code: "TG", flag: "🇹🇬", name: "Togo" },
  { code: "BJ", flag: "🇧🇯", name: "Bénin" },
  { code: "NE", flag: "🇳🇪", name: "Niger" },
  { code: "TD", flag: "🇹🇩", name: "Tchad" },
];

// Villes gérées par GeoSelector (API géo)

const STEPS = [
  { num: 1, label: "Secteur",      icon: "🏭" },
  { num: 2, label: "Projet",       icon: "📝" },
  { num: 3, label: "Financement",  icon: "💰" },
  { num: 4, label: "Confirmation", icon: "✅" },
];

// Calcul score bankabilité
function calcBankability(form: any): { score: number; details: { label: string; pts: number; max: number; ok: boolean }[] } {
  const details = [
    { label: "Titre du projet",          pts: form.title?.length >= 10 ? 10 : 0,                         max: 10,  ok: form.title?.length >= 10 },
    { label: "Description complète",     pts: Math.min(20, Math.floor((form.description?.length || 0) / 10)), max: 20, ok: form.description?.length >= 100 },
    { label: "Utilisation des fonds",    pts: form.useOfFunds?.length >= 30 ? 15 : 0,                    max: 15,  ok: form.useOfFunds?.length >= 30 },
    { label: "Pitch vidéo fourni",       pts: form.pitchVideoUrl ? 20 : 0,                               max: 20,  ok: !!form.pitchVideoUrl },
    { label: "Mentor garant choisi",     pts: form.mentorId ? 15 : 0,                                    max: 15,  ok: !!form.mentorId },
    { label: "Niveau de risque défini",  pts: form.riskLevel ? 5 : 0,                                    max: 5,   ok: !!form.riskLevel },
    { label: "Durée réaliste (3-24m)",   pts: Number(form.durationMonths) >= 3 && Number(form.durationMonths) <= 24 ? 10 : 5, max: 10, ok: Number(form.durationMonths) >= 3 },
    { label: "Date de campagne définie", pts: form.campaignEndsAt ? 5 : 0,                               max: 5,   ok: !!form.campaignEndsAt },
  ];
  return { score: Math.min(100, details.reduce((s, d) => s + d.pts, 0)), details };
}

export default function NewProjectPage() {
  const { fees } = usePlatformConfig();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [mentors, setMentors] = useState<any[]>([]);
  const [selectedMentor, setSelectedMentor] = useState<any>(null);
  const [showMentorModal, setShowMentorModal] = useState(false);
  const [mentorSearch, setMentorSearch] = useState("");
  const [slotCheck, setSlotCheck] = useState<any>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoPreview, setVideoPreview] = useState("");
  const [form, setForm] = useState({
    title: "", description: "", sector: "", subSector: "",
    city: "", country: "SN", goalAmount: "", minimumInvestment: "5000",
    expectedReturn: "", durationMonths: "12", riskLevel: "MEDIUM",
    pitchVideoUrl: "", pitchVideoPublicId: "", mentorId: "",
    campaignEndsAt: "", useOfFunds: "",
  });

  const [geo, setGeo] = useState({ country: "Senegal", countryCode: "SN", indicatif: "+221", state: "", stateCode: "", city: "" });
  const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-100 bg-white";
  const labelClass = "text-sm font-semibold text-gray-700 mb-1.5 block";

  // Charger mentors
  useEffect(() => {
    authGet("/api/admin/mentors").then((r: any) => { if (r.success) setMentors(r.data || []); });
  }, []);

  // Init taux depuis config
  useEffect(() => {
    if (fees?.return_min && !form.expectedReturn) {
      setForm(f => ({ ...f, expectedReturn: String(fees.return_min || 24) }));
    }
  }, [fees]);

  // Check slot disponible
  useEffect(() => {
    if (!form.sector || !form.subSector || !form.city) return;
    const timer = setTimeout(async () => {
      const res = await fetch(`${API}/api/geo/check-subsector/${form.sector}/${encodeURIComponent(form.subSector)}/${encodeURIComponent(form.city)}`);
      const data = await res.json();
      if (data.success) setSlotCheck(data.data);
    }, 500);
    return () => clearTimeout(timer);
  }, [form.sector, form.subSector, form.city]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleVideoUpload = async (file: File) => {
    const allowed = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (!allowed.includes(file.type)) { setError("Format non supporté. Utilisez MP4, MOV, AVI ou WebM."); return; }
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = async () => {
      URL.revokeObjectURL(video.src);
      if (video.duration > 105) { setError(`Vidéo trop longue (${Math.round(video.duration)}s). Maximum : 1 min 45 sec.`); return; }
      setVideoDuration(Math.round(video.duration));
      setVideoUploading(true); setVideoProgress(0); setError("");
      const formData = new FormData();
      formData.append('video', file);
      const token = localStorage.getItem('accessToken');
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) setVideoProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => {
        const res = JSON.parse(xhr.responseText);
        if (res.success) { setForm(f => ({ ...f, pitchVideoUrl: res.data.videoUrl, pitchVideoPublicId: res.data.publicId })); setVideoPreview(res.data.videoUrl); setVideoProgress(100); }
        else setError(res.message || "Erreur upload");
        setVideoUploading(false);
      };
      xhr.onerror = () => { setError("Erreur réseau"); setVideoUploading(false); };
      xhr.open('POST', `${API}/api/upload/pitch-video`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    };
    video.src = URL.createObjectURL(file);
  };

  const submit = async () => {
    const minReturn = fees?.return_min || 23;
    if (!form.expectedReturn || Number(form.expectedReturn) < minReturn) { setError(`Taux minimum : ${minReturn}%`); return; }
    if (!form.goalAmount || Number(form.goalAmount) < 100000) { setError("Montant minimum : 100 000 FCFA"); return; }
    setLoading(true); setError("");
    const res = await authFetch(`/api/projects`, {
      method: "POST",
      body: JSON.stringify({
        title: form.title, description: form.description,
        sector: form.sector, subSector: form.subSector,
        city: form.city, country: form.country,
        goalAmount: Number(form.goalAmount),
        minimumInvestment: Number(form.minimumInvestment),
        expectedReturn: Number(form.expectedReturn),
        durationMonths: Number(form.durationMonths),
        riskLevel: form.riskLevel,
        pitchVideoUrl: form.pitchVideoUrl || undefined,
        mentorId: form.mentorId || undefined,
        campaignEndsAt: form.campaignEndsAt || undefined,
        useOfFunds: form.useOfFunds,
      })
    });
    const data = await res.json();
    if (data.success) setSuccess(true);
    else if (res.status === 401) { setError("Session expirée — vous allez être redirigé..."); setTimeout(() => window.location.href = '/auth/login', 2000); }
    else setError(data.message || "Erreur soumission");
    setLoading(false);
  };

  // Calculs simulation
  const netAmount = Number(form.goalAmount) || 0;
  const hasMentor = !!form.mentorId;
  const baobabPct   = fees?.commission_baobab_collection || 6;
  const payinPct    = fees?.payin_recovery || 4;
  const mentorPct   = hasMentor ? (fees?.commission_mentor || 2) : 0;
  const assurancePct = fees?.commission_guarantee || 2; // addon individuel — hors cagnotte
  // MODÈLE VALIDÉ : goalAmount = netBesoin / (1 - BAOBAB% - payin% - mentor%)
  // Assurance exclue du diviseur — c'est un addon individuel payé par l'investisseur
  const diviseur = 1 - (baobabPct + payinPct + mentorPct) / 100;
  const goalAmount = netAmount > 0 ? Math.ceil(netAmount / diviseur) : 0;
  const retour = Number(form.expectedReturn) || (fees?.return_min || 23);
  const totalRemb = Math.round(netAmount * (1 + retour / 100));
  const duree = Number(form.durationMonths) || 12;
  const mensualite = Math.round(totalRemb / duree);
  const agriSectors = ['AGRICULTURE', 'ELEVAGE'];
  const grace = agriSectors.includes(form.sector) ? (fees?.grace_period_agriculture || 2) : (fees?.grace_period_other || 1);
  const { score: bankScore, details: bankDetails } = calcBankability(form);

  const filteredMentors = mentors.filter(m =>
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(mentorSearch.toLowerCase()) ||
    m.city?.toLowerCase().includes(mentorSearch.toLowerCase())
  );

  if (success) return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-xl">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Projet soumis !</h2>
        <p className="text-gray-500 mb-2">Votre projet est en cours d'examen par notre équipe.</p>
        <p className="text-sm text-green-600 font-medium mb-6">Vous recevrez une notification dès la validation.</p>
        <div className="bg-green-50 rounded-2xl p-4 mb-6 text-left space-y-2">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Score bankabilité</span><span className="font-bold text-green-700">{bankScore}/100</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Objectif</span><span className="font-bold">{fmt(goalAmount)} FCFA</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Vous recevrez</span><span className="font-bold text-green-700">{fmt(netAmount)} FCFA</span></div>
        </div>
        <Link href="/entrepreneur" className="block bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700">
          → Mon tableau de bord
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* NAV */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/entrepreneur" className="text-gray-400 hover:text-gray-600 text-sm">← Retour</Link>
          <div className="flex-1 text-center font-bold text-gray-900">Nouveau projet</div>
          <div className="text-xs text-gray-400">Étape {step}/4</div>
        </div>
        {/* Barre progression */}
        <div className="flex">
          {STEPS.map(s => (
            <div key={s.num} className={`flex-1 h-1 transition-all ${s.num <= step ? "bg-green-500" : "bg-gray-100"}`} />
          ))}
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Étapes visuelles */}
        <div className="flex justify-center gap-2 mb-6">
          {STEPS.map(s => (
            <div key={s.num} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${s.num === step ? "bg-green-600 text-white shadow-sm" : s.num < step ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
              <span>{s.icon}</span><span className="hidden sm:block">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Score bankabilité en temps réel */}
        {step >= 2 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-gray-900">🏦 Score de bankabilité</span>
              <span className={`text-lg font-bold ${bankScore >= 70 ? "text-green-600" : bankScore >= 50 ? "text-orange-500" : "text-red-500"}`}>{bankScore}/100</span>
            </div>
            <div className="bg-gray-100 rounded-full h-2 mb-2">
              <div className={`h-2 rounded-full transition-all ${bankScore >= 70 ? "bg-green-500" : bankScore >= 50 ? "bg-orange-400" : "bg-red-400"}`} style={{ width: `${bankScore}%` }} />
            </div>
            <div className="text-xs text-gray-500">
              {bankScore >= 80 ? "✅ Excellent — Très bonne chance d'approbation" : bankScore >= 60 ? "🟡 Bon — Complétez les éléments manquants" : "🔴 Insuffisant — Ajoutez plus de détails"}
            </div>
            <div className="grid grid-cols-2 gap-1 mt-2">
              {bankDetails.map(d => (
                <div key={d.label} className={`text-xs flex items-center gap-1 ${d.ok ? "text-green-600" : "text-gray-400"}`}>
                  <span>{d.ok ? "✅" : "○"}</span><span>{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message erreur */}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-3 text-sm mb-4">⚠️ {error}</div>}

        {/* ═══ ÉTAPE 1 — Secteur & Localisation ═══ */}
        {step === 1 && (
          <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-5 shadow-sm">
            <div>
              <h2 className="font-bold text-gray-900 text-lg mb-1">🏭 Secteur & Localisation</h2>
              <p className="text-xs text-gray-400">Choisissez votre secteur et précisez où se trouve votre activité.</p>
            </div>

            {/* Secteur — grille de cards */}
            <div>
              <label className={labelClass}>Secteur d'activité *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(SECTORS).map(([key, s]) => (
                  <button key={key} type="button" onClick={() => { setForm(f => ({ ...f, sector: key, subSector: "" })); setSlotCheck(null); }}
                    className={`p-3 rounded-2xl border-2 text-left transition-all ${form.sector === key ? "border-green-500 bg-green-50 shadow-sm" : "border-gray-100 hover:border-green-200 hover:bg-gray-50"}`}>
                    <div className="text-2xl mb-1">{s.icon}</div>
                    <div className="font-semibold text-xs text-gray-800">{s.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Sous-secteur */}
            {form.sector && (
              <div>
                <label className={labelClass}>Sous-secteur *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(SUB_SECTORS[form.sector] || []).map(sub => (
                    <button key={sub} type="button" onClick={() => setForm(f => ({ ...f, subSector: sub }))}
                      className={`p-2.5 rounded-xl border-2 text-left text-xs transition-all ${form.subSector === sub ? "border-green-500 bg-green-50 font-semibold" : "border-gray-100 hover:border-green-200"}`}>
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Slot check */}
            {slotCheck && (
              <div className={`rounded-xl p-3 text-xs font-medium ${slotCheck.available ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {slotCheck.available ? `✅ ${slotCheck.available} slot(s) disponible(s) pour "${form.subSector}" dans votre zone` : `❌ Slots complets pour "${form.subSector}" dans cette zone — essayez une autre ville`}
              </div>
            )}

            {/* Pays + Région + Ville via GeoSelector */}
            <div>
              <label className={labelClass}>Localisation du projet *</label>
              <GeoSelector value={geo} onChange={v => {
                setGeo(v);
                setForm(f => ({ ...f, country: v.countryCode, city: v.city }));
              }} />
              {geo.city && (
                <div className="text-xs text-green-600 mt-1 font-medium">
                  📍 {geo.city}{geo.state ? `, ${geo.state}` : ""}, {geo.country}
                </div>
              )}
            </div>

            <button onClick={() => {
              if (!form.sector || !form.subSector || !form.city) { setError("Remplissez tous les champs"); return; }
              if (slotCheck && !slotCheck.available) { setError("Slots complets pour ce sous-secteur dans votre zone"); return; }
              setError(""); setStep(2);
            }} className="w-full bg-green-600 text-white font-bold py-3.5 rounded-2xl hover:bg-green-700 transition-colors">
              Continuer → Informations du projet
            </button>
          </div>
        )}

        {/* ═══ ÉTAPE 2 — Informations projet ═══ */}
        {step === 2 && (
          <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-5 shadow-sm">
            <div>
              <h2 className="font-bold text-gray-900 text-lg mb-1">📝 Votre projet</h2>
              <p className="text-xs text-gray-400">Plus votre dossier est complet, plus votre score est élevé et vos chances d'approbation augmentent.</p>
            </div>

            <div>
              <label className={labelClass}>Titre du projet *</label>
              <input name="title" value={form.title} onChange={handleChange} placeholder="Ex: Élevage de poulets de chair à Dakar" className={inputClass} />
              <div className="text-xs text-gray-400 mt-1">{form.title.length}/10 caractères minimum</div>
            </div>

            <div>
              <label className={labelClass}>Description détaillée *</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows={5}
                placeholder="Décrivez votre projet : votre expérience, votre marché cible, vos avantages concurrentiels, vos objectifs..."
                className={inputClass + " resize-none"} />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{form.description.length < 100 ? `${100 - form.description.length} caractères manquants` : "✅ Longueur suffisante"}</span>
                <span>{form.description.length} car.</span>
              </div>
            </div>

            <div>
              <label className={labelClass}>Utilisation des fonds *</label>
              <textarea name="useOfFunds" value={form.useOfFunds} onChange={handleChange} rows={3}
                placeholder="Ex: 60% matériel, 20% local, 10% stock initial, 10% fonds de roulement..."
                className={inputClass + " resize-none"} />
              <div className="text-xs text-gray-400 mt-1">Détaillez l'utilisation — les investisseurs y font très attention.</div>
            </div>

            {/* Pitch vidéo */}
            <div>
              <label className={labelClass}>🎥 Pitch vidéo * <span className="text-green-600 font-normal">(+20 pts bankabilité)</span></label>
              <p className="text-xs text-gray-400 mb-3">Présentez-vous et votre projet en vidéo. Max 1 min 45 sec. Formats : MP4, MOV, WebM.</p>
              {!videoPreview ? (
                <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-colors ${videoUploading ? "border-green-300 bg-green-50" : "border-gray-200 hover:border-green-400 hover:bg-green-50"}`}>
                  <input type="file" accept="video/mp4,video/quicktime,video/x-msvideo,video/webm" className="hidden"
                    onChange={e => e.target.files?.[0] && handleVideoUpload(e.target.files[0])} />
                  {videoUploading ? (
                    <div className="text-center w-full">
                      <div className="text-3xl mb-3 animate-pulse">{videoProgress < 100 ? "📤" : "⚙️"}</div>
                      <div className="font-medium text-green-700 mb-2 text-sm">
                        {videoProgress < 100 ? `Envoi : ${videoProgress}%` : "Traitement Cloudinary..."}
                      </div>
                      <div className="bg-gray-200 rounded-full h-2 w-full mb-3">
                        <div className={`h-2 rounded-full transition-all ${videoProgress < 100 ? "bg-green-500" : "bg-blue-500 animate-pulse"}`} style={{ width: `${videoProgress}%` }} />
                      </div>
                      {videoProgress >= 100 && (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 text-xs text-orange-700 font-medium">
                          ⚠️ Ne quittez pas cette page — Traitement en cours (30-60 sec)...
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="text-5xl mb-3">🎬</div>
                      <div className="font-medium text-gray-700">Cliquez ou glissez votre vidéo</div>
                      <div className="text-xs text-gray-400 mt-1">Maximum 1 minute 45 secondes</div>
                      <div className="text-xs text-green-600 mt-2 font-medium">MP4 · MOV · AVI · WebM</div>
                    </div>
                  )}
                </label>
              ) : (
                <div className="rounded-2xl overflow-hidden border border-green-200 bg-black">
                  <video src={videoPreview} controls controlsList="nodownload"
                    style={{ maxHeight: "400px", width: "100%", objectFit: "contain", background: "#000" }} />
                  <div className="bg-gray-800 px-4 py-2 flex justify-between items-center">
                    <span className="text-xs text-green-400">✅ Vidéo uploadée ({videoDuration}s) — Stockée en permanence</span>
                    <button onClick={() => { setVideoPreview(""); setForm(f => ({ ...f, pitchVideoUrl: "", pitchVideoPublicId: "" })); setVideoProgress(0); setVideoDuration(0); }}
                      className="text-xs text-red-400 hover:text-red-300 ml-4">🔄 Changer</button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setError(""); setStep(1); }} className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-2xl hover:bg-gray-50">← Retour</button>
              <button disabled={videoUploading} onClick={() => {
                if (!form.title || form.title.length < 5) { setError("Titre trop court (min 5 car.)"); return; }
                if (form.description.length < 50) { setError("Description trop courte (min 50 car.)"); return; }
                if (!form.useOfFunds) { setError("Précisez l'utilisation des fonds"); return; }
                if (!form.pitchVideoUrl) { setError("La vidéo de pitch est obligatoire"); return; }
                setError(""); setStep(3);
              }} className="flex-1 bg-green-600 text-white font-bold py-3 rounded-2xl hover:bg-green-700 disabled:opacity-50">
                Continuer → Financement
              </button>
            </div>
          </div>
        )}

        {/* ═══ ÉTAPE 3 — Financement ═══ */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-5 shadow-sm">
              <div>
                <h2 className="font-bold text-gray-900 text-lg mb-1">💰 Paramètres de financement</h2>
                <p className="text-xs text-gray-400">Ces paramètres définissent ce que vous recevrez et ce que vous rembourserez.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelClass}>Montant dont vous avez besoin (FCFA) *</label>
                  <input name="goalAmount" type="number" value={form.goalAmount} onChange={handleChange}
                    placeholder="500 000" min="100000" className={inputClass} />
                  <div className="text-xs text-gray-400 mt-1">💡 C'est exactement ce que vous recevrez sur votre wallet. Min : 100 000 FCFA.</div>
                </div>
                <div>
                  <label className={labelClass}>Durée de remboursement *</label>
                  <div className="flex gap-2">
                    {[6, 12, 18, 24].map(d => (
                      <button key={d} type="button" onClick={() => setForm(f => ({ ...f, durationMonths: String(d) }))}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${form.durationMonths === String(d) ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-500 hover:border-green-200"}`}>
                        {d}m
                      </button>
                    ))}
                  </div>
                  <input name="durationMonths" type="number" value={form.durationMonths} onChange={handleChange}
                    placeholder="Autre durée" min="3" max="60" className={inputClass + " mt-2"} />
                  <div className="text-xs text-gray-400 mt-1">Agriculture/Élevage : délai de grâce {fees?.grace_period_agriculture || 2} mois. Autres : {fees?.grace_period_other || 1} mois.</div>
                </div>
                <div>
                  <label className={labelClass}>Investissement minimum (FCFA)</label>
                  <div className="flex gap-2 mb-2">
                    {[5000, 10000, 25000, 50000].map(v => (
                      <button key={v} type="button" onClick={() => setForm(f => ({ ...f, minimumInvestment: String(v) }))}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${form.minimumInvestment === String(v) ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-500 hover:border-green-200"}`}>
                        {v >= 1000 ? `${v / 1000}k` : v}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Taux de retour promis (%) *</label>
                  <input name="expectedReturn" type="number" value={form.expectedReturn} onChange={handleChange}
                    min={fees?.return_min || 24} max="100" placeholder={String(fees?.return_min || 24)} className={inputClass}
                    onBlur={e => { if (Number(e.target.value) < (fees?.return_min || 24)) setForm(f => ({ ...f, expectedReturn: String(fees?.return_min || 24) })); }} />
                  <div className="text-xs text-gray-400 mt-1">Minimum {fees?.return_min || 24}%. Taux promis sur le montant net reçu. Un taux élevé attire plus d'investisseurs.</div>
                </div>
                <div>
                  <label className={labelClass}>Niveau de risque</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { v: "LOW",    l: "Faible",  icon: "🟢", desc: "Projet éprouvé" },
                      { v: "MEDIUM", l: "Moyen",   icon: "🟡", desc: "Quelques risques" },
                      { v: "HIGH",   l: "Élevé",   icon: "🔴", desc: "Projet innovant" },
                    ].map(r => (
                      <button key={r.v} type="button" onClick={() => setForm(f => ({ ...f, riskLevel: r.v }))}
                        className={`p-2 rounded-xl border-2 text-center text-xs transition-all ${form.riskLevel === r.v ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-green-200"}`}>
                        <div className="text-lg">{r.icon}</div>
                        <div className="font-bold">{r.l}</div>
                        <div className="text-gray-400">{r.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Fin de campagne</label>
                  <input name="campaignEndsAt" type="date" value={form.campaignEndsAt} onChange={handleChange} className={inputClass}
                    min={new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]} />
                  <div className="text-xs text-gray-400 mt-1">Recommandé : 30 à 60 jours pour maximiser les investissements.</div>
                </div>
              </div>

              {/* MENTOR */}
              <div>
                <label className={labelClass}>🎓 Mentor / Garant <span className="text-green-600 font-normal">(+15 pts bankabilité)</span></label>
                <p className="text-xs text-gray-400 mb-3">Un mentor certifié BAOBAB supervise votre projet, engage sa réputation et rassure les investisseurs.</p>
                {mentors.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 border border-gray-200">
                    Aucun mentor disponible actuellement. Votre projet sera soumis sans mentor.
                  </div>
                ) : selectedMentor ? (
                  <div className="flex items-center gap-3 p-3 bg-green-50 border-2 border-green-300 rounded-2xl">
                    <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                      {selectedMentor.firstName?.[0]}{selectedMentor.lastName?.[0]}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-gray-900 text-sm">{selectedMentor.firstName} {selectedMentor.lastName}</div>
                      <div className="text-xs text-gray-500">📍 {selectedMentor.city} · Score : {selectedMentor.reputationScore}/100</div>
                      <div className="text-xs text-green-600">Commission {fees?.commission_mentor || 2}% prélevée à la clôture</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => setShowMentorModal(true)}
                        className="text-xs text-blue-500 hover:underline">👁️ Voir profil</button>
                      <button onClick={() => { setSelectedMentor(null); setForm(f => ({ ...f, mentorId: "" })); }}
                        className="text-xs text-red-500 hover:underline">Changer</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowMentorModal(true)}
                    className="w-full border-2 border-dashed border-gray-200 rounded-2xl p-4 text-center hover:border-green-300 hover:bg-green-50 transition-colors">
                    <div className="text-2xl mb-1">🎓</div>
                    <div className="text-sm font-medium text-gray-700">Choisir un mentor</div>
                    <div className="text-xs text-gray-400">{mentors.length} mentor(s) disponible(s)</div>
                  </button>
                )}
              </div>
            </div>

            {/* Simulation financière */}
            {netAmount > 0 && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-3xl p-5 space-y-3">
                <div className="font-bold text-green-900 text-base">📊 Simulation financière</div>
                <div className="bg-white rounded-2xl p-4 space-y-2">
                  <div className="text-xs font-bold text-gray-400 uppercase mb-2">À la clôture de la collecte</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Votre besoin net <span className="text-xs text-gray-400">(ce que vous recevez)</span></span>
                    <span className="font-bold text-gray-900">{fmt(netAmount)} FCFA</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>BAOBAB {baobabPct}% + Payin {payinPct}%{hasMentor ? ` + Mentor ${mentorPct}%` : ""} — prélevés sur collecte</span>
                    <span className="text-xs text-gray-400">Assurance +{assurancePct}% optionnelle (à la charge de l'investisseur)</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-green-700 border-t border-gray-100 pt-2">
                    <span>Objectif affiché aux investisseurs</span>
                    <span>{fmt(goalAmount)} FCFA</span>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-4 space-y-2">
                  <div className="text-xs font-bold text-gray-400 uppercase mb-2">Remboursement sur {duree} mois à {retour}%</div>
                  <div className="flex justify-between text-sm">
                    <div>
                      <span className="text-gray-600">Total à rembourser</span>
                      <div className="text-xs text-gray-400">{fmt(netAmount)} FCFA × (1 + {retour}%) = capital + intérêts</div>
                    </div>
                    <span className="font-bold text-orange-600">{fmt(totalRemb)} FCFA</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <div>
                      <span>Mensualité</span>
                      <div className="text-xs text-gray-400">{duree} mensualités de {fmt(mensualite)} FCFA</div>
                    </div>
                    <span className="font-bold">{fmt(mensualite)} FCFA/mois × {duree}</span>
                  </div>
                  {grace > 0 && (
                    <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-1">
                      <div className="font-bold">🕐 Délai de grâce : {grace} mois</div>
                      <div className="text-blue-600">
                        Après la <strong>clôture du projet</strong> (objectif atteint + fonds débloqués) :<br/>
                        → Mois 1 à {grace} : aucun remboursement exigé<br/>
                        → Mois {grace + 1} : 1ère mensualité de {fmt(mensualite)} FCFA<br/>
                        → Mois {grace + duree} : dernière mensualité
                      </div>
                      <div className="text-blue-400 text-xs">
                        ℹ️ Délai configuré par l'admin BAOBAB ({agriSectors.includes(form.sector) ? "Agriculture/Élevage" : "Secteur standard"})
                      </div>
                    </div>
                  )}
                </div>
                <div className="bg-green-700 rounded-2xl p-4 text-white text-sm flex justify-between items-center">
                  <span className="font-medium">✅ Vous recevrez exactement</span>
                  <span className="text-xl font-bold">{fmt(netAmount)} FCFA</span>
                </div>
                {/* Score bankabilité */}
                <div className={`rounded-2xl p-3 text-sm ${bankScore >= 70 ? "bg-green-100 text-green-800" : "bg-orange-50 text-orange-800"}`}>
                  🏦 Score bankabilité : <strong>{bankScore}/100</strong>
                  {bankScore < 70 && " — Ajoutez un mentor et complétez votre dossier pour améliorer vos chances"}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setError(""); setStep(2); }} className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-2xl hover:bg-gray-50">← Retour</button>
              <button onClick={() => {
                const minReturn = fees?.return_min || 24;
                if (!form.goalAmount || Number(form.goalAmount) < 100000) { setError("Montant minimum : 100 000 FCFA"); return; }
                if (!form.expectedReturn || Number(form.expectedReturn) < minReturn) { setError(`Taux minimum : ${minReturn}%`); return; }
                setError(""); setStep(4);
              }} className="flex-1 bg-green-600 text-white font-bold py-3 rounded-2xl hover:bg-green-700">
                Continuer → Confirmation
              </button>
            </div>
          </div>
        )}

        {/* ═══ ÉTAPE 4 — Confirmation ═══ */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
              <h2 className="font-bold text-gray-900 text-lg mb-4">✅ Récapitulatif final</h2>
              <div className="space-y-3">
                {[
                  { label: "Secteur", value: `${SECTORS[form.sector]?.icon} ${SECTORS[form.sector]?.label} — ${form.subSector}` },
                  { label: "Localisation", value: `${geo.city}${geo.state ? `, ${geo.state}` : ""}, ${geo.country}` },
                  { label: "Titre", value: form.title },
                  { label: "Pitch vidéo", value: form.pitchVideoUrl ? `✅ Uploadée (${videoDuration}s)` : "❌ Non fournie" },
                  { label: "Mentor", value: selectedMentor ? `${selectedMentor.firstName} ${selectedMentor.lastName}` : "Sans mentor" },
                  { label: "Besoin net", value: `${fmt(netAmount)} FCFA` },
                  { label: "Objectif collecte", value: `${fmt(goalAmount)} FCFA` },
                  { label: "Taux retour", value: `${retour}%` },
                  { label: "Durée", value: `${duree} mois` },
                  { label: "Mensualité", value: `${fmt(mensualite)} FCFA × ${duree} mois` },
                  { label: "1ère mensualité", value: `Mois ${grace + 1} après clôture (délai grâce : ${grace} mois)` },
                  { label: "Score bankabilité", value: `${bankScore}/100` },
                ].map(r => (
                  <div key={r.label} className="flex justify-between items-start py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-500">{r.label}</span>
                    <span className="text-sm font-medium text-gray-900 text-right max-w-xs">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-sm text-orange-800">
              ⚠️ En soumettant, vous confirmez que toutes les informations sont exactes et vous engagez à rembourser selon l'échéancier défini.
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setError(""); setStep(3); }} className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-2xl hover:bg-gray-50">← Retour</button>
              <button onClick={submit} disabled={loading}
                className="flex-1 bg-green-600 text-white font-bold py-3 rounded-2xl hover:bg-green-700 disabled:opacity-50">
                {loading ? "Soumission..." : "🚀 Soumettre le projet"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL CHOIX MENTOR */}
      {showMentorModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-900">🎓 Choisir un mentor</h3>
              <button onClick={() => setShowMentorModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-4 border-b border-gray-100">
              <input value={mentorSearch} onChange={e => setMentorSearch(e.target.value)}
                placeholder="Rechercher par nom ou ville..." className={inputClass} />
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {filteredMentors.length === 0 ? (
                <div className="text-center py-8 text-gray-400">Aucun mentor trouvé</div>
              ) : filteredMentors.map((m: any) => (
                <div key={m.id} className="border border-gray-100 rounded-2xl p-4 hover:border-green-300 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-700 rounded-2xl flex items-center justify-center text-white font-bold flex-shrink-0">
                      {m.firstName?.[0]}{m.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-gray-900">{m.firstName} {m.lastName}</div>
                          <div className="text-xs text-gray-500">📍 {m.city || "Non renseigné"}{m.country ? ` · ${m.country}` : ""}</div>
                        </div>
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-lg">{fees?.commission_mentor || 2}%</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="bg-gray-100 rounded-full h-1.5 flex-1">
                          <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${m.reputationScore}%` }} />
                        </div>
                        <span className="text-xs font-bold text-green-700">{m.reputationScore}/100</span>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => { setSelectedMentor(m); setForm(f => ({ ...f, mentorId: m.id })); setShowMentorModal(false); }}
                          className="flex-1 bg-green-600 text-white text-xs font-bold py-2 rounded-xl hover:bg-green-700">
                          ✅ Choisir ce mentor
                        </button>
                        <a href={`/profile/${m.id}`} target="_blank" rel="noopener noreferrer"
                          className="border border-gray-200 text-gray-600 text-xs font-medium px-3 py-2 rounded-xl hover:bg-gray-50">
                          👁️ Profil
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100">
              <button onClick={() => { setSelectedMentor(null); setForm(f => ({ ...f, mentorId: "" })); setShowMentorModal(false); }}
                className="w-full border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl hover:bg-gray-50 text-sm">
                Continuer sans mentor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
