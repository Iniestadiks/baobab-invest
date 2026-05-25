"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authGet, authPost } from "@/lib/api";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";

const API = process.env.NEXT_PUBLIC_API_URL;

function fmt(n: number) { return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

const SECTORS: Record<string, { label: string; icon: string }> = {
  AGRICULTURE: { label: "Agriculture", icon: "🌾" },
  COMMERCE: { label: "Commerce", icon: "🛒" },
  TRANSPORT: { label: "Transport", icon: "🚗" },
  TECH: { label: "Technologie", icon: "💻" },
  RESTAURATION: { label: "Restauration", icon: "🍽️" },
  ARTISANAT: { label: "Artisanat", icon: "🎨" },
  SANTE: { label: "Santé", icon: "🏥" },
  EDUCATION: { label: "Éducation", icon: "📚" },
  ENERGIE: { label: "Énergie", icon: "⚡" },
  SERVICES: { label: "Services", icon: "🤝" },
  AUTRE: { label: "Autre", icon: "📦" },
};

export default function NewProjectPage() {
  const { fees } = usePlatformConfig();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoPreview, setVideoPreview] = useState("");
  const [success, setSuccess] = useState(false);
  const [taxonomy, setTaxonomy] = useState<Record<string, string[]>>({});
  const [subSectors, setSubSectors] = useState<string[]>([]);
  const [slotCheck, setSlotCheck] = useState<any>(null);
  const [checkingSlot, setCheckingSlot] = useState(false);
  const [mentors, setMentors] = useState<any[]>([]);

  const [form, setForm] = useState({
    title: "", description: "", sector: "", subSector: "",
    city: "", country: "SN", goalAmount: "", minimumInvestment: "5000",
    expectedReturn: "", durationMonths: "6", riskLevel: "MEDIUM", pitchVideoUrl: "", pitchVideoPublicId: "",
    mentorId: "", campaignEndsAt: "",
    useOfFunds: "", businessPlan: "",
  });

  useEffect(() => {
    fetch(`${API}/api/geo/taxonomy`).then(r => r.json()).then(d => setTaxonomy(d.data || {}));
    authGet("/api/admin/mentors").then((r: any) => { if (r.success) setMentors(r.data || []); });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (name === "sector") {
      setForm(f => ({ ...f, sector: value, subSector: "" }));
      setSubSectors(taxonomy[value] || []);
      setSlotCheck(null);
    }
  };

  const checkSlot = async () => {
    if (!form.sector || !form.subSector || !form.city) return;
    setCheckingSlot(true);
    const res = await fetch(`${API}/api/geo/check-subsector/${form.sector}/${encodeURIComponent(form.subSector)}/${encodeURIComponent(form.city)}`);
    const data = await res.json();
    setSlotCheck(data.data);
    setCheckingSlot(false);
  };

  useEffect(() => {
    if (form.sector && form.subSector && form.city) checkSlot();
  }, [form.subSector, form.city]);

  const submit = async () => {
    const minReturn = fees?.return_min || 23;
    if (!form.expectedReturn || Number(form.expectedReturn) < minReturn) {
      setError(`❌ Le taux de retour minimum est ${minReturn}%. Actuellement configuré à ${minReturn}% par l'administration.`);
      return;
    }
    setLoading(true); setError("");
    const payload = {
      ...form,
      goalAmount: Number(form.goalAmount),
      minimumInvestment: Number(form.minimumInvestment),
      expectedReturn: Number(form.expectedReturn),
      pitchVideoUrl: form.pitchVideoUrl || undefined,
      durationMonths: Number(form.durationMonths),
      mentorId: form.mentorId || undefined,
      campaignEndsAt: form.campaignEndsAt || undefined,
    };
    const res = await authPost("/api/projects", payload);
    if (res.success) {
      setSuccess(true);
      setTimeout(() => router.push("/entrepreneur"), 2000);
    } else {
      setError(res.message || "Erreur lors de la soumission");
      if (res.data?.projects) setSlotCheck({ available: false, projects: res.data.projects });
    }
    setLoading(false);
  };

  const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-400";
  const labelClass = "text-xs font-semibold text-gray-600 mb-1 block";

  if (success) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-8 text-center max-w-md w-full">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Projet soumis !</h2>
        <p className="text-gray-500">Votre projet est en attente de validation par l équipe BAOBAB INVEST. Redirection...</p>
      </div>
    </div>
  );

  const handleVideoUpload = async (file: File) => {
    if (!file) return;
    const allowed = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (!allowed.includes(file.type)) {
      setError("Format non supporté. Utilisez MP4, MOV, AVI ou WebM.");
      return;
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = async () => {
      URL.revokeObjectURL(video.src);
      const dur = video.duration;
      setVideoDuration(Math.round(dur));
      if (dur > 105) {
        setError(`Vidéo trop longue (${Math.round(dur)}s). Maximum : 1 minute 45 secondes.`);
        return;
      }
      setVideoUploading(true);
      setVideoProgress(0);
      setError("");
      try {
        const formData = new FormData();
        formData.append('video', file);
        const token = localStorage.getItem('accessToken');
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setVideoProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          const res = JSON.parse(xhr.responseText);
          if (res.success) {
            setForm((f: any) => ({ ...f, pitchVideoUrl: res.data.videoUrl, pitchVideoPublicId: res.data.publicId }));
            setVideoPreview(res.data.videoUrl);
            setVideoProgress(100);
          } else {
            setError(res.message || "Erreur upload vidéo");
          }
          setVideoUploading(false);
        };
        xhr.onerror = () => { setError("Erreur réseau lors de l'upload"); setVideoUploading(false); };
        xhr.open('POST', `${process.env.NEXT_PUBLIC_API_URL}/api/upload/pitch-video`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      } catch (e) {
        setError("Erreur lors de l'upload");
        setVideoUploading(false);
      }
    };
    video.src = URL.createObjectURL(file);
  };


  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">← Retour</button>
          <h1 className="font-bold text-gray-900">Nouveau projet</h1>
          <span className="text-xs text-gray-400">Étape {step}/3</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Progress */}
        <div className="flex gap-2 mb-6">
          {[1,2,3].map(s => (
            <div key={s} className={`flex-1 h-2 rounded-full ${s <= step ? "bg-green-600" : "bg-gray-200"}`} />
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 text-sm text-red-700">
            {error}
            {slotCheck && !slotCheck.available && slotCheck.projects?.length > 0 && (
              <div className="mt-3">
                <div className="font-bold mb-2">Projets actifs dans ce sous-secteur :</div>
                {slotCheck.projects.map((p: any) => (
                  <a key={p.id} href={`/projects/${p.id}`} className="block bg-white rounded-xl p-2 mb-1 hover:bg-red-50 border border-red-100">
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs">{fmt(p.raisedAmount)} / {fmt(p.goalAmount)} FCFA</div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ÉTAPE 1 — Secteur & Localisation */}
        {step === 1 && (
          <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-5">
            <h2 className="font-bold text-gray-900 text-lg">Secteur & Localisation</h2>

            <div>
              <label className={labelClass}>Secteur d activité *</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {Object.entries(SECTORS).map(([key, val]) => (
                  <button key={key} type="button" onClick={() => { setForm(f => ({...f, sector: key, subSector: ""})); setSubSectors(taxonomy[key] || []); setSlotCheck(null); }}
                    className={`p-3 rounded-xl border-2 text-center text-xs font-medium transition-all ${form.sector === key ? "border-green-600 bg-green-50 text-green-700" : "border-gray-200 hover:border-green-300"}`}>
                    <div className="text-xl mb-1">{val.icon}</div>{val.label}
                  </button>
                ))}
              </div>
            </div>

            {subSectors.length > 0 && (
              <div>
                <label className={labelClass}>Sous-secteur *</label>
                <select name="subSector" value={form.subSector} onChange={handleChange} className={inputClass}>
                  <option value="">-- Sélectionner --</option>
                  {subSectors.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {/* Vérification disponibilité */}
            {checkingSlot && <div className="text-xs text-blue-600 animate-pulse">Vérification des slots disponibles...</div>}
            {slotCheck && form.subSector && (
              <div className={`rounded-xl p-3 text-xs border ${slotCheck.available ? "bg-green-50 border-green-200 text-green-700" : "bg-orange-50 border-orange-200 text-orange-700"}`}>
                {slotCheck.available
                  ? `✅ ${slotCheck.max - slotCheck.count} slot(s) disponible(s) pour "${form.subSector}" dans votre zone`
                  : `⚠️ Slots complets (${slotCheck.count}/${slotCheck.max}) pour ce sous-secteur dans votre zone`}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Ville du projet *</label>
                <select name="city" value={form.city} onChange={handleChange} className={inputClass}>
                  <option value="">-- Sélectionner une ville --</option>
                  {form.country === "SN" && <>
                    <option value="Dakar">Dakar</option>
                    <option value="Thiès">Thiès</option>
                    <option value="Saint-Louis">Saint-Louis</option>
                    <option value="Ziguinchor">Ziguinchor</option>
                    <option value="Touba">Touba</option>
                    <option value="Kaolack">Kaolack</option>
                    <option value="Mbour">Mbour</option>
                    <option value="Diourbel">Diourbel</option>
                    <option value="Tambacounda">Tambacounda</option>
                    <option value="Kolda">Kolda</option>
                    <option value="Louga">Louga</option>
                    <option value="Fatick">Fatick</option>
                    <option value="Kaffrine">Kaffrine</option>
                    <option value="Sédhiou">Sédhiou</option>
                    <option value="Matam">Matam</option>
                  </>}
                  {form.country === "CI" && <>
                    <option value="Abidjan">Abidjan</option>
                    <option value="Bouaké">Bouaké</option>
                    <option value="Yamoussoukro">Yamoussoukro</option>
                    <option value="San-Pédro">San-Pédro</option>
                    <option value="Korhogo">Korhogo</option>
                    <option value="Daloa">Daloa</option>
                    <option value="Man">Man</option>
                  </>}
                  {form.country === "CM" && <>
                    <option value="Yaoundé">Yaoundé</option>
                    <option value="Douala">Douala</option>
                    <option value="Bafoussam">Bafoussam</option>
                    <option value="Garoua">Garoua</option>
                    <option value="Maroua">Maroua</option>
                    <option value="Bamenda">Bamenda</option>
                  </>}
                  {form.country === "ML" && <>
                    <option value="Bamako">Bamako</option>
                    <option value="Sikasso">Sikasso</option>
                    <option value="Mopti">Mopti</option>
                    <option value="Ségou">Ségou</option>
                    <option value="Gao">Gao</option>
                  </>}
                  {form.country === "BF" && <>
                    <option value="Ouagadougou">Ouagadougou</option>
                    <option value="Bobo-Dioulasso">Bobo-Dioulasso</option>
                    <option value="Koudougou">Koudougou</option>
                    <option value="Ouahigouya">Ouahigouya</option>
                  </>}
                  {form.country === "GN" && <>
                    <option value="Conakry">Conakry</option>
                    <option value="Nzérékoré">Nzérékoré</option>
                    <option value="Kankan">Kankan</option>
                    <option value="Kindia">Kindia</option>
                  </>}
                  {form.country === "TG" && <>
                    <option value="Lomé">Lomé</option>
                    <option value="Sokodé">Sokodé</option>
                    <option value="Kara">Kara</option>
                  </>}
                  {form.country === "BJ" && <>
                    <option value="Cotonou">Cotonou</option>
                    <option value="Porto-Novo">Porto-Novo</option>
                    <option value="Parakou">Parakou</option>
                    <option value="Abomey-Calavi">Abomey-Calavi</option>
                  </>}
                  {form.country === "NE" && <>
                    <option value="Niamey">Niamey</option>
                    <option value="Zinder">Zinder</option>
                    <option value="Maradi">Maradi</option>
                  </>}
                  {form.country === "TD" && <>
                    <option value="N&apos;Djamena">N&apos;Djamena</option>
                    <option value="Moundou">Moundou</option>
                    <option value="Sarh">Sarh</option>
                  </>}
                </select>
              </div>
              <div>
                <label className={labelClass}>Pays</label>
                <select name="country" value={form.country} onChange={e => { handleChange(e); setForm(f => ({...f, city: ""})); }} className={inputClass}>
                  <option value="SN">🇸🇳 Sénégal</option>
                  <option value="CI">🇨🇮 Côte d&apos;Ivoire</option>
                  <option value="CM">🇨🇲 Cameroun</option>
                  <option value="ML">🇲🇱 Mali</option>
                  <option value="BF">🇧🇫 Burkina Faso</option>
                  <option value="GN">🇬🇳 Guinée</option>
                  <option value="TG">🇹🇬 Togo</option>
                  <option value="BJ">🇧🇯 Bénin</option>
                  <option value="NE">🇳🇪 Niger</option>
                  <option value="TD">🇹🇩 Tchad</option>
                </select>
              </div>
            </div>

            <button onClick={() => {
              if (!form.sector || !form.subSector || !form.city) { setError("Veuillez remplir tous les champs"); return; }
              if (slotCheck && !slotCheck.available) { setError("Slots complets pour ce sous-secteur dans votre zone"); return; }
              setError(""); setStep(2);
            }} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700">
              Continuer →
            </button>
          </div>
        )}

        {/* ÉTAPE 2 — Informations projet */}
        {step === 2 && (
          <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4">
            <h2 className="font-bold text-gray-900 text-lg">Informations du projet</h2>
            <div>
              <label className={labelClass}>Titre du projet *</label>
              <input name="title" value={form.title} onChange={handleChange} placeholder="Ex: Élevage de poulets de chair à Dakar" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Description détaillée * (min 50 caractères)</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows={4}
                placeholder="Décrivez votre projet, votre expérience, vos objectifs..." className={inputClass} />
              <div className="text-xs text-gray-400 mt-1">{form.description.length}/50 caractères minimum</div>
            </div>
            <div>
              <label className={labelClass}>Utilisation des fonds</label>
              <textarea name="useOfFunds" value={form.useOfFunds} onChange={handleChange} rows={3}
                placeholder="Comment seront utilisés les fonds levés ?" className={inputClass} />
            </div>
            {/* PITCH VIDEO */}
            <div>
              <label className={labelClass}>🎥 Pitch vidéo * (max 1 min 45 sec)</label>
              <p className="text-xs text-gray-400 mb-2">Présentez votre projet en vidéo. Formats : MP4, MOV, AVI, WebM. Cette vidéo sera conservée par BAOBAB INVEST.</p>
              {!videoPreview ? (
                <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-colors ${videoUploading ? "border-green-300 bg-green-50" : "border-gray-300 hover:border-green-400 hover:bg-green-50"}`}>
                  <input type="file" accept="video/mp4,video/quicktime,video/x-msvideo,video/webm" className="hidden"
                    onChange={e => e.target.files?.[0] && handleVideoUpload(e.target.files[0])} />
                  {videoUploading ? (
                    <div className="text-center w-full">
                      <div className="text-2xl mb-2 animate-pulse">{videoProgress < 100 ? "📤" : "⚙️"}</div>
                      <div className="text-sm font-medium text-green-700 mb-2">
                        {videoProgress < 100 ? `Envoi en cours... ${videoProgress}%` : "⚙️ Traitement par Cloudinary..."}
                      </div>
                      <div className="bg-gray-200 rounded-full h-2 w-full mb-2">
                        <div className={`h-2 rounded-full transition-all ${videoProgress < 100 ? "bg-green-500" : "bg-blue-500 animate-pulse"}`}
                          style={{width: `${videoProgress}%`}}></div>
                      </div>
                      {videoProgress >= 100 && (
                        <div className="text-xs text-orange-600 font-medium bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                          ⚠️ Ne quittez pas cette page — La vidéo est en cours de traitement, cela peut prendre 30 à 60 secondes...
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="text-4xl mb-3">🎬</div>
                      <div className="text-sm font-medium text-gray-700">Cliquez pour choisir votre vidéo</div>
                      <div className="text-xs text-gray-400 mt-1">ou glissez-déposez ici</div>
                      <div className="text-xs text-green-600 mt-2 font-medium">Maximum : 1 minute 45 secondes</div>
                    </>
                  )}
                </label>
              ) : (
                <div className="rounded-2xl overflow-hidden border border-green-200 bg-black">
                  <video
                    src={videoPreview}
                    controls
                    controlsList="nodownload"
                    style={{ maxHeight: "420px", width: "100%", objectFit: "contain", background: "#000" }}
                  />
                  <div className="bg-gray-800 px-3 py-2 flex justify-between items-center">
                    <div className="text-xs text-green-400 font-medium">
                      ✅ Vidéo uploadée ({videoDuration}s) — Stockée de façon permanente par BAOBAB INVEST
                    </div>
                    <button onClick={() => { setVideoPreview(""); setForm((f: any) => ({...f, pitchVideoUrl: "", pitchVideoPublicId: ""})); setVideoProgress(0); setVideoDuration(0); }}
                      className="text-xs text-red-400 hover:text-red-300 hover:underline ml-3 flex-shrink-0">
                      🔄 Changer
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-50">← Retour</button>
              <button onClick={() => {
                if (!form.title || form.description.length < 50) { setError("Remplissez tous les champs correctement"); return; }
                if (!form.pitchVideoUrl) { setError("La vidéo de pitch est obligatoire"); return; }
                setError(""); setStep(3);
              }} className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 disabled:opacity-50"
              disabled={videoUploading}>Continuer →</button>
            </div>
          </div>
        )}

        {/* ÉTAPE 3 — Financement */}
        {step === 3 && (
          <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4">
            <h2 className="font-bold text-gray-900 text-lg">Paramètres de financement</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Montant à lever (FCFA) *</label>
                <input name="goalAmount" type="number" value={form.goalAmount} onChange={handleChange} placeholder="500000" className={inputClass} min="100000" />
                <div className="text-xs text-gray-400 mt-1">Min: 100 000 FCFA</div>
              </div>
              <div>
                <label className={labelClass}>Investissement minimum</label>
                <input name="minimumInvestment" type="number" value={form.minimumInvestment} onChange={handleChange} className={inputClass} min="5000" />
              </div>
              <div>
                <label className={labelClass}>Durée (mois) *</label>
                <input name="durationMonths" type="number" value={form.durationMonths} onChange={handleChange} className={inputClass} min="1" max="60" />
              </div>
              <div>
                <label className={labelClass}>Taux de retour (%) *</label>
                <input name="expectedReturn" type="number" value={form.expectedReturn} onChange={handleChange} className={inputClass} min={String(fees?.return_min || 23)} max="100" placeholder={String(fees?.return_min || 23)} />
                <div className="text-xs text-gray-400 mt-1">Min: {fees?.return_min || 23}%</div>
              </div>
              <div>
                <label className={labelClass}>Niveau de risque</label>
                <select name="riskLevel" value={form.riskLevel} onChange={handleChange} className={inputClass}>
                  <option value="LOW">🟢 Faible</option>
                  <option value="MEDIUM">🟡 Moyen</option>
                  <option value="HIGH">🔴 Élevé</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Fin de campagne</label>
                <input name="campaignEndsAt" type="date" value={form.campaignEndsAt} onChange={handleChange} className={inputClass} />
              </div>
            </div>

            {/* Mentor */}
            {mentors.length > 0 && (
              <div>
                <label className={labelClass}>Mentor / Garant (optionnel)</label>
                <select name="mentorId" value={form.mentorId} onChange={handleChange} className={inputClass}>
                  <option value="">-- Sans mentor (taux retour +2%) --</option>
                  {mentors.map((m: any) => (
                    <option key={m.id} value={m.id}>{m.firstName} {m.lastName} — Score: {m.reputationScore}/100</option>
                  ))}
                </select>
              </div>
            )}

            {/* Récapitulatif financier avec nouvelle stratégie */}
            {form.goalAmount && (() => {
              const netAmount = Number(form.goalAmount)
              const hasMentor = !!form.mentorId
              const baobabPct = fees?.commission_baobab_collection || 6, mentorPct = hasMentor ? (fees?.commission_mentor || 2) : 0, assurancePct = fees?.commission_guarantee || 2
              const diviseur = 1 - (baobabPct + mentorPct + assurancePct) / 100
              const goalAmount = Math.ceil(netAmount / diviseur)
              const baobabFee = Math.round(goalAmount * baobabPct / 100)
              const mentorFee = Math.round(goalAmount * mentorPct / 100)
              const assuranceFee = Math.round(goalAmount * assurancePct / 100)
              const retour = Number(form.expectedReturn) || (fees?.return_min || 23)
              const totalRemboursement = Math.round(netAmount * (1 + retour / 100))
              const mensualite = Math.round(totalRemboursement / Number(form.durationMonths || 12))
              const agriSectors = ['AGRICULTURE', 'ELEVAGE']
              const grace = agriSectors.includes(form.sector) ? 2 : 1
              return (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-xs space-y-2">
                  <div className="font-bold text-green-800 text-sm mb-1">📊 Récapitulatif financier</div>
                  <div className="bg-white rounded-lg p-3 space-y-1.5">
                    <div className="flex justify-between text-gray-600">
                      <span>Votre besoin net</span>
                      <span className="font-bold text-gray-900">{fmt(netAmount)} FCFA</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>BAOBAB {fees?.commission_baobab_collection || 6}%</span>
                      <span>-{fmt(baobabFee)} FCFA</span>
                    </div>
                    {hasMentor && <div className="flex justify-between text-gray-500">
                      <span>Mentor 2%</span>
                      <span>-{fmt(mentorFee)} FCFA</span>
                    </div>}
                    <div className="flex justify-between text-gray-500">
                      <span>Assurance 2%</span>
                      <span>-{fmt(assuranceFee)} FCFA</span>
                    </div>
                    <div className="border-t border-gray-200 pt-1.5 flex justify-between font-bold text-green-700">
                      <span>Montant à collecter</span>
                      <span>{fmt(goalAmount)} FCFA</span>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3 space-y-1.5">
                    <div className="flex justify-between text-gray-600">
                      <span>Vous remboursez {retour}% sur {form.durationMonths} mois</span>
                      <span className="font-bold text-orange-600">{fmt(totalRemboursement)} FCFA</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Mensualité estimée</span>
                      <span className="font-bold">{fmt(mensualite)} FCFA/mois</span>
                    </div>
                    {grace > 0 && <div className="flex justify-between text-blue-600">
                      <span>🕐 Délai de grâce</span>
                      <span>{grace} mois (1er paiement mois {grace+1})</span>
                    </div>}
                  </div>
                  <p className="text-green-700 text-xs">✅ Vous recevrez exactement <strong>{fmt(netAmount)} FCFA</strong> nets sur votre wallet.</p>
                </div>
              )
            })()}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-50">← Retour</button>
              <button onClick={submit} disabled={loading || !form.goalAmount}
                className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 disabled:opacity-50">
                {loading ? "Soumission..." : "🚀 Soumettre le projet"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
