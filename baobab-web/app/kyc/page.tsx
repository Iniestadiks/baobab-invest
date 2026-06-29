"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authGet } from "@/lib/api";

export default function KYCPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [kycStatus, setKycStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<{ document: File | null; selfie: File | null; rccm: File | null }>({ document: null, selfie: null, rccm: null });
  const [documentType, setDocumentType] = useState("CNI");
  const [documentExpiry, setDocumentExpiry] = useState("");
  const [entrepreneurFields, setEntrepreneurFields] = useState({ rccmNumber: "", nineaNumber: "" });
  const [previews, setPreviews] = useState<{ document: string; selfie: string }>({ document: "", selfie: "" });
  const docRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const stored = localStorage.getItem("user");
    if (!token || !stored) { router.push("/auth/login"); return; }
    setUser(JSON.parse(stored));

    authGet("/api/kyc/status").then(d => {
      if (d.success) setKycStatus(d.data);
    }).finally(() => setLoading(false));
  }, [router]);

  const handleFile = (field: "document" | "selfie", file: File) => {
    setFiles(f => ({ ...f, [field]: file }));
    const reader = new FileReader();
    reader.onload = e => setPreviews(p => ({ ...p, [field]: e.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!files.document || !files.selfie) { setMsg("❌ Les deux fichiers sont obligatoires"); return; }
    setUploading(true);
    setMsg("");
    try {
      const token = localStorage.getItem("accessToken");
      const formData = new FormData();
      formData.append("document", files.document);
      if (files.rccm) formData.append("rccm", files.rccm);
      formData.append("documentType", documentType);
      if (documentExpiry) formData.append("documentExpiry", documentExpiry);
      if (entrepreneurFields.rccmNumber) formData.append("rccmNumber", entrepreneurFields.rccmNumber);
      if (entrepreneurFields.nineaNumber) formData.append("nineaNumber", entrepreneurFields.nineaNumber);
      formData.append("selfie", files.selfie);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/kyc/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setMsg("✅ Documents envoyés ! Notre équipe vérifiera sous 24h ouvrées.");
        setKycStatus({ kycStatus: "PENDING", kycDocumentUrl: data.data.docUrl, kycSelfieUrl: data.data.selfieUrl });
      } else {
        setMsg("❌ " + data.message);
      }
    } catch {
      setMsg("❌ Erreur de connexion");
    } finally {
      setUploading(false);
    }
  };

  const getDashboardLink = () => {
    if (!user) return "/dashboard";
    if (user.role === "ENTREPRENEUR") return "/entrepreneur";
    if (user.role === "ADMIN") return "/admin";
    if (user.role === "MENTOR") return "/mentor";
    return "/dashboard";
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="text-5xl animate-bounce mb-4">🪪</div><p className="text-gray-500">Chargement...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href={getDashboardLink()} className="text-gray-400 hover:text-green-600">← Dashboard</Link>
          <span className="font-bold text-green-600">Vérification d'identité (KYC)</span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {msg && (
          <div className={`p-4 rounded-xl text-sm font-medium text-center mb-6 ${msg.startsWith("✅") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {msg}
          </div>
        )}

        {/* Statut actuel */}
        {kycStatus?.kycStatus === "VERIFIED" ? (
          <div className="bg-white rounded-2xl border border-green-200 p-8 text-center mb-6">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">KYC Vérifié !</h2>
            <p className="text-gray-500 mb-2">Ton identité a été vérifiée par notre équipe.</p>
            <p className="text-green-600 font-medium">Tu peux investir, retirer des fonds et accéder à toutes les fonctionnalités.</p>
            <Link href={getDashboardLink()} className="btn-primary inline-flex mt-6">← Retour au dashboard</Link>
          </div>
        ) : kycStatus?.kycStatus === "PENDING" ? (
          <div className="bg-white rounded-2xl border border-yellow-200 p-8 text-center mb-6">
            <div className="text-6xl mb-4">⏳</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">En cours de vérification</h2>
            <p className="text-gray-500 mb-4">Tes documents ont été soumis. Notre équipe vérifie sous 24h ouvrées.</p>
            {kycStatus.kycDocumentUrl && (
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-left space-y-2">
                <div className="font-semibold text-gray-700 mb-2">Documents soumis :</div>
                <div className="flex items-center gap-2 text-green-600"><span>✓</span><span>Document d'identité uploadé</span></div>
                <div className="flex items-center gap-2 text-green-600"><span>✓</span><span>Selfie uploadé</span></div>
              </div>
            )}
            {kycStatus.kycRejectedReason && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-4 text-sm text-red-700">
                <strong>Dernier rejet :</strong> {kycStatus.kycRejectedReason}
              </div>
            )}
          </div>
        ) : kycStatus?.kycStatus === "REJECTED" ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6">
            <div className="font-bold text-red-800 mb-2">❌ KYC Rejeté</div>
            <p className="text-red-700 text-sm">Raison : {kycStatus.kycRejectedReason || "Documents non conformes"}</p>
            <p className="text-red-600 text-sm mt-1">Soumets de nouveaux documents ci-dessous.</p>
          </div>
        ) : null}

        {/* Formulaire si pas vérifié ou rejeté */}
        {(!kycStatus?.kycStatus || kycStatus.kycStatus === "REJECTED" || kycStatus.kycStatus === "" || kycStatus.kycStatus === "NOT_SUBMITTED") && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="font-bold text-gray-900 text-xl mb-2">Vérifier mon identité</h2>
            <p className="text-gray-500 text-sm mb-6">Requis pour investir, retirer des fonds et soumettre des projets.</p>

            {/* Barre de progression */}
            <div className="flex items-center gap-2 mb-6">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${step >= s ? "bg-green-600 text-white" : "bg-gray-100 text-gray-400"}`}>
                    {step > s ? "✓" : s}
                  </div>
                  {s < 3 && <div className={`flex-1 h-1 rounded ${step > s ? "bg-green-500" : "bg-gray-100"}`} />}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mb-6 -mt-4">
              <span>Informations</span><span>Document CNI</span><span>Selfie</span>
            </div>

            {/* ÉTAPE 1 */}
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">📋 Ce dont tu as besoin</h3>
                <div className="space-y-3">
                  {[
                    { icon: "🪪", title: "Carte Nationale d'Identité ou Passeport", desc: "Photo nette, lisible, non expirée. Formats acceptés : JPG, PNG, PDF (max 5MB)" },
                    { icon: "🤳", title: "Selfie avec ton document", desc: "Tiens ton CNI/Passeport à côté de ton visage. Les deux doivent être visibles et lisibles." },
                    { icon: "💡", title: "Conseils pour réussir", desc: "Bonne luminosité, pas de reflet, texte lisible sur le document. Évite les photos floues." },
                  ].map(item => (
                    <div key={item.title} className="flex gap-3 p-4 bg-gray-50 rounded-xl">
                      <span className="text-2xl flex-shrink-0">{item.icon}</span>
                      <div>
                        <div className="font-semibold text-sm text-gray-900">{item.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
                  🔒 <strong>Confidentialité</strong> — Tes documents sont chiffrés et accessibles uniquement par l'équipe KORAPACT pour la vérification. Ils ne sont jamais partagés avec des tiers.
                </div>
                <button onClick={() => setStep(2)} className="btn-primary w-full">Continuer →</button>
              </div>
            )}

            {/* ÉTAPE 2 — Upload CNI */}
            {step === 2 && (
              <div className="space-y-5">
                <h3 className="font-semibold text-gray-900">🪪 Upload ton document d&apos;identité</h3>
                {/* Type de document */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Type de document *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {["CNI", "Passeport", "Titre de séjour", "Permis de conduire"].map(t => (
                      <button key={t} type="button" onClick={() => setDocumentType(t)}
                        className={`text-sm py-2 px-3 rounded-xl font-medium border transition-colors ${documentType === t ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-700 border-gray-200 hover:border-green-300"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Date d'expiration */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Date d&apos;expiration du document *</label>
                  <input type="date" value={documentExpiry} onChange={e => setDocumentExpiry(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
                  />
                  <p className="text-xs text-gray-400">Nous vous alerterons avant l&apos;expiration de votre document</p>
                </div>
                <div
                  onClick={() => docRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${files.document ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-green-300 hover:bg-green-50"}`}
                >
                  {previews.document ? (
                    <div>
                      <img src={previews.document} alt="Document" className="max-h-48 mx-auto rounded-xl object-contain mb-3" />
                      <p className="text-green-600 font-semibold text-sm">✅ {files.document?.name}</p>
                      <p className="text-xs text-gray-400 mt-1">Clique pour changer</p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-4xl mb-3">🪪</div>
                      <p className="font-semibold text-gray-700 mb-1">Clique pour uploader ton CNI / Passeport</p>
                      <p className="text-xs text-gray-400">JPG, PNG ou PDF · Max 5MB</p>
                    </div>
                  )}
                  <input ref={docRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden"
                    onChange={e => e.target.files?.[0] && handleFile("document", e.target.files[0])} />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="btn-secondary flex-1">← Retour</button>
                  <button disabled={!files.document || !documentExpiry} onClick={() => {
                    if (!documentExpiry) { setMsg("❌ Date d'expiration obligatoire"); return; }
                    setStep(3);
                  }} className="btn-primary flex-1 disabled:opacity-50">
                    Continuer →
                  </button>
                </div>
              </div>
            )}

            {/* ÉTAPE 3 — Selfie */}
            {step === 3 && (
              <div className="space-y-5">
                <h3 className="font-semibold text-gray-900">🤳 Upload ton selfie avec le document</h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
                  📸 <strong>Important :</strong> Tiens ton CNI/Passeport à côté de ton visage. Les deux doivent être visibles sur la même photo.
                </div>
                <div
                  onClick={() => selfieRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${files.selfie ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-green-300 hover:bg-green-50"}`}
                >
                  {previews.selfie ? (
                    <div>
                      <img src={previews.selfie} alt="Selfie" className="max-h-48 mx-auto rounded-xl object-contain mb-3" />
                      <p className="text-green-600 font-semibold text-sm">✅ {files.selfie?.name}</p>
                      <p className="text-xs text-gray-400 mt-1">Clique pour changer</p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-4xl mb-3">🤳</div>
                      <p className="font-semibold text-gray-700 mb-1">Clique pour uploader ton selfie</p>
                      <p className="text-xs text-gray-400">JPG ou PNG · Max 5MB</p>
                    </div>
                  )}
                  <input ref={selfieRef} type="file" accept=".jpg,.jpeg,.png" className="hidden"
                    onChange={e => e.target.files?.[0] && handleFile("selfie", e.target.files[0])} />
                </div>

                {/* Récap */}
                <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
                  <div className="font-semibold text-gray-700 mb-2">📋 Récapitulatif</div>
                  <div className={`flex items-center gap-2 ${files.document ? "text-green-600" : "text-gray-400"}`}>
                    <span>{files.document ? "✅" : "○"}</span>
                    <span>{files.document ? `Document : ${files.document.name}` : "Document non sélectionné"}</span>
                  </div>
                  <div className={`flex items-center gap-2 ${files.selfie ? "text-green-600" : "text-gray-400"}`}>
                    <span>{files.selfie ? "✅" : "○"}</span>
                    <span>{files.selfie ? `Selfie : ${files.selfie.name}` : "Selfie non sélectionné"}</span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                  En soumettant ces documents, tu certifies qu'ils t'appartiennent et sont authentiques. Toute falsification entraîne un bannissement définitif.
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="btn-secondary flex-1">← Retour</button>
                  <button onClick={handleSubmit} disabled={!files.document || !files.selfie || uploading}
                    className="btn-primary flex-1 disabled:opacity-50">
                    {uploading ? "Envoi en cours..." : "✅ Soumettre mes documents"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Après soumission en attente — possibilité de resoumettre si besoin */}
        {kycStatus?.kycStatus === "PENDING" && (
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">
              Documents incorrects ?{" "}
              <button onClick={() => setKycStatus(null)} className="text-green-600 hover:underline font-medium">
                Soumettre de nouveaux documents
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
