"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GeoSelector } from "@/hooks/useGeo";

const SECTORS = ["Agro-alimentaire","Commerce général","Matériaux & Construction","Équipements","Transport","Informatique","Santé","Énergie","Autre"];
const PROVIDERS = ["WAVE","ORANGE","MTN","MOOV","FREE"];
const COUNTRIES = [
  { code: "SN", flag: "🇸🇳", name: "Sénégal" },
  { code: "CI", flag: "🇨🇮", name: "Côte d'Ivoire" },
  { code: "CM", flag: "🇨🇲", name: "Cameroun" },
  { code: "ML", flag: "🇲🇱", name: "Mali" },
  { code: "BF", flag: "🇧🇫", name: "Burkina Faso" },
  { code: "GN", flag: "🇬🇳", name: "Guinée" },
];

export default function SupplierRegisterPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Vérifier si déjà fournisseur enregistré
    const token = localStorage.getItem("accessToken");
    if (!token) {
      // Pas connecté — OK, les fournisseurs peuvent s'inscrire sans compte utilisateur
    }
  }, []);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [geo, setGeo] = useState({ country: "Sénégal", countryCode: "SN", state: "", stateCode: "", city: "", indicatif: "+221" });
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    companyName: "", contactName: "", email: "", phone: "", password: "", confirmPassword: "",
    sector: "", city: "", country: "SN",
    rccmNumber: "", nineaNumber: "",
    mobileMoneyNumber: "", mobileMoneyProvider: "WAVE",
    description: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://korapact.com";
      const res = await fetch(`${API_URL}/api/suppliers/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) { setError(data.message); return; }
      setSuccess(true);
    } catch {
      setError("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Demande envoyée !</h2>
        <p className="text-gray-500 mb-6">
          Notre équipe va vérifier votre dossier KYB dans <strong>48h ouvrées</strong>.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 mb-6 text-left">
          <strong>📋 Prochaines étapes :</strong>
          <ul className="mt-2 space-y-1 list-disc list-inside text-blue-700">
            <li>Notre équipe vérifie votre RCCM et NINEA</li>
            <li>Votre compte Mobile Money est confirmé</li>
            <li>Vous êtes activé comme fournisseur partenaire</li>
            <li>Les entrepreneurs vous contactent et vous paient directement via Mobile Money</li>
          </ul>
        </div>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="btn-primary inline-flex">Retour à l&apos;accueil</Link>
          <Link href="/supplier/dashboard" className="bg-green-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-green-700 inline-flex">Mon espace →</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🏪</div>
          <h1 className="text-2xl font-bold text-green-600">Devenir Fournisseur Partenaire</h1>
          <p className="text-gray-500 text-sm mt-1">KORAPACT — Programme Partenaires</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-sm text-green-800">
          <strong>💡 Avantage :</strong> Tu reçois les paiements <strong>directement depuis l'escrow</strong> — zéro risque d'impayé.
        </div>

        <div className="flex items-center gap-2 mb-6">
          {[1,2,3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${step >= s ? "bg-green-600 text-white" : "bg-gray-100 text-gray-400"}`}>
                {step > s ? "✓" : s}
              </div>
              {s < 3 && <div className={`flex-1 h-1 rounded ${step > s ? "bg-green-500" : "bg-gray-100"}`} />}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-400 mb-6 -mt-4">
          <span>Identité</span><span>Documents KYB</span><span>Mobile Money</span>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-sm mb-4">⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Nom de l'entreprise *</label>
                <input name="companyName" value={form.companyName} onChange={handleChange} placeholder="Ex: SARL Diallo & Frères" required className="input-field" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Nom du contact *</label>
                <input name="contactName" value={form.contactName} onChange={handleChange} placeholder="Prénom Nom" required className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Email *</label>
                  <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="contact@entreprise.com" required className="input-field" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Téléphone *</label>
                  <input name="phone" value={form.phone} onChange={handleChange} placeholder="221771234567" required className="input-field" />
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Mot de passe *</label>
                  <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Minimum 6 caractères" required className="input-field" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Confirmer le mot de passe *</label>
                  <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} placeholder="Répétez votre mot de passe" required className="input-field" />
                </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Secteur *</label>
                  <select name="sector" value={form.sector} onChange={handleChange} required className="input-field">
                    <option value="">Choisir...</option>
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <GeoSelector value={geo} onChange={v => {
                setGeo(v);
                setForm(f => ({ ...f, country: v.countryCode, city: v.city }));
              }} />
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Description</label>
                <textarea name="description" value={form.description} onChange={handleChange}
                  placeholder="Vos produits, services, zones de livraison..." rows={3} className="input-field resize-none" />
              </div>
              <button type="button" onClick={() => {
                if (!form.companyName || !form.contactName || !form.email || !form.phone || !form.sector || !form.city) {
                  setError("Remplis tous les champs obligatoires (*)"); return;
                }
                setError(""); setStep(2);
              }} className="btn-primary w-full">Continuer →</button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
                <strong>📋 Documents KYB</strong> — Vérifient la légalité de ton entreprise avant activation.
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Numéro RCCM</label>
                <input name="rccmNumber" value={form.rccmNumber} onChange={handleChange} placeholder="Ex: SN-DKR-2020-B-12345" className="input-field" />
                <p className="text-xs text-gray-400 mt-1">Registre du Commerce et du Crédit Mobilier</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Numéro NINEA / Fiscal</label>
                <input name="nineaNumber" value={form.nineaNumber} onChange={handleChange} placeholder="Ex: 123456789 2A3" className="input-field" />
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
                ⚠️ Tu peux soumettre sans ces numéros — notre équipe te contactera.
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">← Retour</button>
                <button type="button" onClick={() => { setError(""); setStep(3); }} className="btn-primary flex-1">Continuer →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-sm text-green-700">
                <strong>💳 Mobile Money</strong> — C'est sur ce numéro que tu recevras les paiements KORAPACT.
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">Opérateur *</label>
                <div className="grid grid-cols-5 gap-2">
                  {PROVIDERS.map(p => (
                    <button key={p} type="button" onClick={() => setForm(f => ({ ...f, mobileMoneyProvider: p }))}
                      className={`p-2 rounded-xl border-2 text-xs font-bold transition-all ${form.mobileMoneyProvider === p ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-500"}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Numéro Mobile Money *</label>
                <input name="mobileMoneyNumber" value={form.mobileMoneyNumber} onChange={handleChange}
                  placeholder="221771234567" required className="input-field" />
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                <div className="font-semibold text-gray-700 mb-2">📋 Récapitulatif</div>
                {[["Entreprise", form.companyName], ["Secteur", form.sector], ["Ville", form.city], ["Opérateur", form.mobileMoneyProvider]].map(([k,v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-2">
                <input type="checkbox" required className="mt-1 accent-green-600 w-4 h-4" id="cgu" />
                <label htmlFor="cgu" className="text-xs text-gray-500">
                  Je certifie que les informations sont exactes et j'accepte les conditions d'utilisation KORAPACT.
                </label>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="btn-secondary flex-1">← Retour</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? "Envoi..." : "✅ Soumettre ma demande"}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
