"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authPost } from "@/lib/api";
import Link from "next/link";

const SECTORS = ["AGRICULTURE","COMMERCE","TECH","ARTISANAT","EDUCATION","SANTE","SERVICES","ENERGIE","TRANSPORT","AUTRE"];
const SECTOR_LABELS: Record<string,string> = {
  AGRICULTURE:"🌾 Agriculture",COMMERCE:"🛒 Commerce",TECH:"💻 Tech",
  ARTISANAT:"🎨 Artisanat",EDUCATION:"📚 Éducation",SANTE:"🏥 Santé",
  SERVICES:"🔧 Services",ENERGIE:"⚡ Énergie",TRANSPORT:"🚌 Transport",AUTRE:"📦 Autre",
};

const STEPS = [
  { num: 1, title: "Identité & Légitimité" },
  { num: 2, title: "Ton Projet" },
  { num: 3, title: "Plan Financier" },
  { num: 4, title: "Garanties & Contrat" },
];

export default function SubmitProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const toWords = (n: number): string => {
    if (!n || n === 0) return "";
    if (n >= 1000000000) return `${(n/1000000000).toFixed(n%1000000000===0?0:1)} milliard${n>=2000000000?"s":""}`;
    if (n >= 1000000) return `${(n/1000000).toFixed(n%1000000===0?0:1)} million${n>=2000000?"s":""}`;
    if (n >= 1000) return `${(n/1000).toFixed(n%1000===0?0:1)} mille`;
    return `${n}`;
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [mentors, setMentors] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  const [form, setForm] = useState({
    hasInvestedBefore: false,
    title: "", description: "", sector: "AGRICULTURE",
    city: "", country: "SN", pitchVideoUrl: "", coverImageUrl: "",
    goalAmount: "", minimumInvestment: "5000", expectedReturn: "",
    durationMonths: "", riskLevel: "MEDIUM", campaignEndsAt: "",
    mentorId: "", acceptContract: false, acceptTransparency: false,
  });

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const stored = localStorage.getItem("user");
    if (!token || !stored) { router.push("/auth/login"); return; }
    const u = JSON.parse(stored);
    setUser(u);

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/mentors`)
      .then(r => r.json())
      .then(d => { if (d.success) setMentors(d.data); })
      .catch(() => {});
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm(f => ({
      ...f,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value
    }));
    setError("");
  };

  const calcScore = () => {
    let s = 0;
    if (form.description.length > 200) s += 15;
    if (form.pitchVideoUrl) s += 20;
    if (form.coverImageUrl) s += 10;
    if (form.mentorId) s += 25;
    if (Number(form.goalAmount) <= 2000000) s += 10;
    if (Number(form.expectedReturn) <= 30) s += 10;
    if (Number(form.durationMonths) >= 6) s += 10;
    return Math.min(s, 100);
  };

  const handleSubmit = async () => {
    // Avertissement mentor (pas bloquant mais fortement recommandé)
    if (!form.mentorId) {
      const confirm = window.confirm(
        "⚠️ Tu n'as pas sélectionné de mentor.\n\n" +
        "Sans mentor :\n" +
        "• Ton projet sera moins crédible pour les investisseurs\n" +
        "• Aucun garant public n'engage sa réputation\n" +
        "• Les 2% de commission mentor reviennent aux investisseurs (bonus)\n\n" +
        "Veux-tu continuer sans mentor ?"
      );
      if (!confirm) return;
    }

    if (!form.acceptContract || !form.acceptTransparency) {
      setError("Tu dois accepter le contrat et la clause de transparence"); return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await authPost("/api/projects", {
        title: form.title,
        description: form.description,
        sector: form.sector,
        city: form.city,
        country: form.country,
        goalAmount: Number(form.goalAmount),
        minimumInvestment: Number(form.minimumInvestment),
        expectedReturn: Number(form.expectedReturn),
        durationMonths: Number(form.durationMonths),
        riskLevel: form.riskLevel,
        mentorId: form.mentorId || undefined,
        pitchVideoUrl: form.pitchVideoUrl || undefined,
        coverImageUrl: form.coverImageUrl || undefined,
        campaignEndsAt: form.campaignEndsAt || undefined,
      });
      if (!data.success) { setError(data.message); return; }
      setScore(data.data?.bankabilityScore || 0);
      setTimeout(() => router.push("/entrepreneur"), 3000);
    } catch (err: any) {
      if (err?.message?.includes('401') || err?.message?.includes('token')) {
        setError("Session expirée — reconnecte-toi");
        setTimeout(() => router.push("/auth/login"), 2000);
      } else {
        setError("Erreur de connexion — vérifie ta connexion et réessaie");
      }
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && !form.hasInvestedBefore) {
      setError("Tu dois confirmer avoir déjà investi dans la communauté"); return;
    }
    if (step === 2) {
      if (!form.title) { setError("Le titre est obligatoire"); return; }
      if (user?.kycStatus !== "VERIFIED") { setError("❌ Votre KYC doit être validé par l'administrateur avant de soumettre un projet."); return; }
      if (form.description.length < 50) { setError("Description trop courte (minimum 50 caractères)"); return; }
      if (!form.city) { setError("La ville est obligatoire"); return; }
    }
    if (step === 3) {
      if (Number(form.minimumInvestment) < 5000) { setError("❌ L'investissement minimum par personne ne peut pas être inférieur à 5 000 FCFA"); return; }
      if (Number(form.goalAmount) < 100000) { setError("❌ Le montant minimum à lever est 100 000 FCFA"); return; }
      if (!form.expectedReturn) { setError("Le taux de retour est obligatoire"); return; }
      if (Number(form.expectedReturn) < 15) { setError("❌ Le retour minimum est 15% — en dessous, les investisseurs perdent de l'argent après les frais de plateforme"); return; }
      if (!form.durationMonths) { setError("La durée est obligatoire"); return; }
    }
    setError(""); setStep(s => s + 1);
  };

  if (score !== null) return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10 text-center">
        <div className="text-6xl mb-4">🌳</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Projet soumis !</h2>
        <p className="text-gray-500 mb-6">Notre équipe va examiner ton dossier sous 48h ouvrées.</p>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-6">
          <div className="text-5xl font-bold text-green-600 mb-1">{score}/100</div>
          <div className="text-sm text-green-700 font-medium">Score de Bankabilité</div>
          <div className="text-xs text-green-600 mt-2">
            {score >= 70 ? "🏆 Excellent — Forte chance d'approbation !" : score >= 50 ? "👍 Bon dossier" : "⚠️ Ajoute une vidéo pitch et un mentor pour améliorer"}
          </div>
        </div>
        <p className="text-xs text-gray-400">Redirection vers le dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/entrepreneur" className="text-gray-400 hover:text-green-600">← Dashboard</Link>
          <span className="font-bold text-green-600">Soumettre un projet</span>
          {user && (
            <span className="ml-auto text-xs text-gray-400">
              {user.role === "ENTREPRENEUR" ? "🚀 Entrepreneur" : `Rôle : ${user.role}`}
            </span>
          )}
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Barre de progression */}
        <div className="flex items-center gap-2 mb-10">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2 flex-1">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all ${
                step > s.num ? "bg-green-600 text-white" : step === s.num ? "bg-green-600 text-white ring-4 ring-green-100" : "bg-gray-100 text-gray-400"}`}>
                {step > s.num ? "✓" : s.num}
              </div>
              <div className="hidden md:block">
                <div className={`text-xs font-semibold ${step === s.num ? "text-green-600" : "text-gray-400"}`}>{s.title}</div>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-1 rounded ml-2 ${step > s.num ? "bg-green-500" : "bg-gray-100"}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-sm mb-6">⚠️ {error}</div>}

          {/* ÉTAPE 1 */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">🪪 Identité & Légitimité</h2>
              <p className="text-gray-500 text-sm mb-6">Vérifions que tu fais partie de la communauté avant de commencer.</p>
              <div className="space-y-5">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <div className="font-semibold text-yellow-800 mb-2">⚡ Preuve d'Engagement Communautaire</div>
                  <p className="text-sm text-yellow-700 mb-3">
                    Selon les règles BAOBAB INVEST, tout porteur de projet doit avoir déjà investi dans un autre projet pour prouver son engagement dans la communauté.
                  </p>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="invested" name="hasInvestedBefore"
                      checked={form.hasInvestedBefore} onChange={handleChange}
                      className="accent-green-600 w-4 h-4" />
                    <label htmlFor="invested" className="text-sm font-medium text-yellow-800">
                      J'ai déjà investi dans au moins un projet sur BAOBAB INVEST ✓
                    </label>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <div className="font-semibold text-blue-800 mb-1">🪪 Statut KYC</div>
                  <div className={`text-sm font-medium ${user?.kycStatus === "VERIFIED" ? "text-green-600" : "text-red-600"}`}>
                    {user?.kycStatus === "VERIFIED" ? "✅ KYC Vérifié — Tu peux soumettre ton projet" : "❌ KYC non vérifié — Soumission bloquée"}
                  </div>
                  {user?.kycStatus !== "VERIFIED" && (
                    <div className="mt-2 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                      ⚠️ Votre identité doit être vérifiée par l&apos;administrateur avant de pouvoir soumettre un projet. Rendez-vous dans votre profil pour soumettre votre KYC.
                    </div>
                  )}
                </div>
                <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                  <div className="font-semibold text-green-800 mb-2">✅ Ce que tu vas créer</div>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Une fiche projet publique avec vidéo pitch</li>
                    <li>• Un plan de financement par jalons sécurisé</li>
                    <li>• Un contrat numérique d'engagement</li>
                    <li>• Un feed de reporting pour tes investisseurs</li>
                    <li>• Paiements directs aux fournisseurs via escrow</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE 2 */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">🚀 Ton Projet</h2>
              <p className="text-gray-500 text-sm mb-6">Présente ton projet de façon claire et convaincante.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Titre du projet *</label>
                  <input name="title" value={form.title} onChange={handleChange}
                    placeholder="Ex: Ferme avicole moderne à Thiès" required className="input-field" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-2 block">Secteur d'activité *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SECTORS.map(s => (
                      <button key={s} type="button" onClick={() => setForm(f => ({ ...f, sector: s }))}
                        className={`p-2 rounded-xl border-2 text-xs font-medium transition-all text-left ${
                          form.sector === s ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:border-green-200"}`}>
                        {SECTOR_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Ville *</label>
                    <input name="city" value={form.city} onChange={handleChange} placeholder="Dakar" className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Pays *</label>
                    <select name="country" value={form.country} onChange={handleChange} className="input-field">
                      <option value="SN">🇸🇳 Sénégal</option>
                      <option value="CI">🇨🇮 Côte d'Ivoire</option>
                      <option value="CM">🇨🇲 Cameroun</option>
                      <option value="ML">🇲🇱 Mali</option>
                      <option value="BF">🇧🇫 Burkina Faso</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">
                    Description complète * <span className="text-gray-400 font-normal">({form.description.length} caractères — min 50)</span>
                  </label>
                  <textarea name="description" value={form.description} onChange={handleChange}
                    placeholder="Décris ton projet en détail : quel problème tu résous, comment ça marche, pourquoi tu vas réussir, qui sont tes clients cibles..."
                    rows={5} className="input-field resize-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">
                    URL Vidéo Pitch 60s <span className="text-green-600 font-normal">+20 pts score</span>
                  </label>
                  <input name="pitchVideoUrl" value={form.pitchVideoUrl} onChange={handleChange}
                    placeholder="https://youtube.com/watch?v=..." className="input-field" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">
                    URL Image de couverture <span className="text-green-600 font-normal">+10 pts score</span>
                  </label>
                  <input name="coverImageUrl" value={form.coverImageUrl} onChange={handleChange}
                    placeholder="https://..." className="input-field" />
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-gray-700">Score de bankabilité actuel</span>
                    <span className="text-xl font-bold text-green-600">{calcScore()}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${calcScore()}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE 3 */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">💰 Plan Financier</h2>
              <p className="text-gray-500 text-sm mb-6">Définis les paramètres financiers de ta campagne.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">
                      Montant total à lever (FCFA) * <span className="text-red-500 font-bold">— minimum 100 000 FCFA obligatoire</span>
                    </label>
                  <input name="goalAmount" type="number" min="100000" onBlur={e => { if(Number(e.target.value) < 100000 && e.target.value) { const ev = {...e, target:{...e.target,name:"goalAmount",value:"100000"}}; handleChange(ev as any); }}} value={form.goalAmount} onChange={handleChange}
                    placeholder="500000" min="100000" className="input-field" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    {form.goalAmount && Number(form.goalAmount) > 0 && (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-sm font-bold text-green-700">{Number(form.goalAmount).toLocaleString("fr-FR")} FCFA</span>
                        <span className="text-xs text-gray-400">= {toWords(Number(form.goalAmount))} FCFA</span>
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">💡 Minimum 100 000 FCFA. Ce montant sera collecté auprès de plusieurs investisseurs. Ex: 500 000 FCFA = 100 investisseurs × 5 000 FCFA.</div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">
                      Investissement minimum par personne (FCFA) * <span className="text-red-500 font-bold">— minimum 5 000 FCFA obligatoire</span>
                    </label>
                    <input name="minimumInvestment" type="number" value={form.minimumInvestment} min="5000" onBlur={e => { if(Number(e.target.value) < 5000 && e.target.value) { const ev = {...e, target: {...e.target, name: "minimumInvestment", value: "5000"}}; handleChange(ev as any); }}}
                      onChange={handleChange} min="500" className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">
                      Retour investisseurs (%) * <span className="text-red-500 font-bold">— minimum 15% obligatoire</span>
                    </label>
                    <input name="expectedReturn" type="number" value={form.expectedReturn} onChange={handleChange}
                      placeholder="Ex: 20 (minimum 15%)" min="15" max="100" step="1" className="input-field"
                      onBlur={e => { if(Number(e.target.value) < 15 && e.target.value) { e.target.value = "15"; handleChange(e); }}} />
                    <div className="text-xs text-gray-400 mt-1 leading-relaxed">
                      💡 C'est le taux que tu t'engages à reverser aux investisseurs à la fin du projet.
                      Ex: pour 100 000 FCFA levés à 20%, tu rembourseras 120 000 FCFA.
                      <strong className="text-red-600"> Minimum imposé : 15%</strong> pour que les investisseurs gagnent réellement après les frais de plateforme.
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">
                      Durée du projet (mois) * — <span className="text-gray-400 font-normal">délai pour rembourser les investisseurs</span>
                    </label>
                    <input name="durationMonths" type="number" value={form.durationMonths} onChange={handleChange}
                      placeholder="12" min="1" max="60" className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">
                      Date limite de collecte de fonds
                      <span className="text-gray-400 font-normal ml-1">— date à laquelle la campagne se clôture (pas la date de remboursement)</span>
                    </label>
                    <input name="campaignEndsAt" type="date" value={form.campaignEndsAt} onChange={handleChange} className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-2 block">Niveau de risque *</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: "LOW", label: "🟢 Faible", desc: "Marché prouvé, stable" },
                      { value: "MEDIUM", label: "🟡 Modéré", desc: "Quelques incertitudes" },
                      { value: "HIGH", label: "🔴 Élevé", desc: "Innovant, risque fort" },
                    ].map(r => (
                      <button key={r.value} type="button" onClick={() => setForm(f => ({ ...f, riskLevel: r.value }))}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          form.riskLevel === r.value ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-green-200"}`}>
                        <div className="font-semibold text-sm">{r.label}</div>
                        <div className="text-xs text-gray-500 mt-1">{r.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                {form.goalAmount && form.expectedReturn && form.durationMonths && (
                  <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-sm">
                    <div className="font-semibold text-green-800 mb-2">📊 Simulation — ce que recevra un investisseur qui met 5 000 FCFA</div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><div className="font-bold text-green-700">5 000 FCFA</div><div className="text-xs text-gray-500">Investi</div></div>
                      <div><div className="font-bold text-green-700">+{Math.round(5000 * Number(form.expectedReturn) / 100)} FCFA</div><div className="text-xs text-gray-500">Retour estimé</div></div>
                      <div><div className="font-bold text-green-700">{form.durationMonths}m</div><div className="text-xs text-gray-500">Durée</div></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ÉTAPE 4 */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">🛡️ Garanties & Contrat</h2>
              <p className="text-gray-500 text-sm mb-6">Dernière étape — Ton engagement officiel.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-2 block">
                    🎓 Mentor / Garant <span className="text-green-600">+25 pts — Fortement recommandé</span>
                  </label>
                  {mentors.length === 0 ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-700">
                      Aucun mentor certifié disponible. Tu peux soumettre sans mentor (score réduit de 25pts).
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Tri par score */}
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">{mentors.length} mentor(s) certifié(s) disponible(s)</span>
                        {form.mentorId && (
                          <button type="button" onClick={() => setForm(f => ({ ...f, mentorId: "" }))}
                            className="text-xs text-red-500 hover:underline">
                            ✕ Déselectionner
                          </button>
                        )}
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {[...mentors].sort((a,b) => b.reputationScore - a.reputationScore).map((m: any) => (
                          <div key={m.id} className={`rounded-xl border-2 transition-all ${form.mentorId === m.id ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-green-200"}`}>
                            <div className="p-3 flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center font-bold text-white text-sm flex-shrink-0">
                                {m.firstName[0]}{m.lastName[0]}
                              </div>
                              <div className="flex-1 cursor-pointer" onClick={() => setForm(f => ({ ...f, mentorId: f.mentorId === m.id ? "" : m.id }))}>
                                <div className="font-semibold text-sm flex items-center gap-2">
                                  {m.firstName} {m.lastName}
                                  {form.mentorId === m.id && <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">✓ Sélectionné</span>}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  ⭐ {m.reputationScore}/100 · 📍 {m.city || "—"} · Niveau {m.level || 1}
                                </div>
                                {m.bio && <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{m.bio}</div>}
                              </div>
                              <a href={`/profile/${m.id}`} target="_blank" rel="noopener noreferrer"
                                className="text-xs bg-blue-50 text-blue-600 px-2 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-100 flex-shrink-0">
                                👤 Profil
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600 space-y-1">
                  <div className="font-bold text-gray-900 text-sm mb-2">📜 Contrat Numérique d'Engagement</div>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Rapport mensuel obligatoire sur l'avancement</li>
                    <li>Fonds utilisés uniquement via jalons validés</li>
                    <li>Paiements directs aux fournisseurs pré-enregistrés</li>
                    <li>Remboursement {form.expectedReturn || "X"}% sur {form.durationMonths || "X"} mois</li>
                    <li>Contact immédiat en cas de difficulté</li>
                  </ul>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700">
                  <div className="font-bold text-red-800 text-sm mb-1">⚠️ Clause de Transparence Sociale</div>
                  En cas de fraude prouvée, ton identité sera publiée publiquement et tu seras placé en liste noire partagée entre toutes les plateformes partenaires.
                </div>

                <div className="space-y-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.acceptContract}
                      onChange={e => setForm(f => ({ ...f, acceptContract: e.target.checked }))}
                      className="mt-1 accent-green-600 w-4 h-4" />
                    <span className="text-sm text-gray-700">J'accepte le <strong>Contrat Numérique d'Engagement</strong> — signature électronique valable selon les lois UEMOA.</span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.acceptTransparency}
                      onChange={e => setForm(f => ({ ...f, acceptTransparency: e.target.checked }))}
                      className="mt-1 accent-red-500 w-4 h-4" />
                    <span className="text-sm text-gray-700">J'accepte la <strong>Clause de Transparence Sociale</strong>.</span>
                  </label>
                </div>

                <div className="bg-gradient-to-r from-green-600 to-green-500 rounded-xl p-4 text-white text-center">
                  <div className="text-3xl font-bold">{calcScore()}/100</div>
                  <div className="text-sm opacity-90 mt-1">Score de Bankabilité estimé</div>
                  <div className="text-xs opacity-75 mt-1">
                    {calcScore() >= 70 ? "🏆 Excellent dossier !" : calcScore() >= 50 ? "👍 Bon dossier" : "⚠️ Ajoute une vidéo pitch et un mentor"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button type="button" onClick={() => setStep(s => s - 1)} className="btn-secondary flex-1">← Retour</button>
            )}
            {step < 4 ? (
              <button type="button" onClick={nextStep} className="btn-primary flex-1">Continuer →</button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary flex-1">
                {loading ? "Soumission..." : "🚀 Soumettre mon projet"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
