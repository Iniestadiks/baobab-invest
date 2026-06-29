"use client";
import { useState } from "react";
import { GeoSelector } from "@/hooks/useGeo";
import Link from "next/link";
import { useRouter } from "next/navigation";

const ROLES = [
  {
    value: "INVESTOR",
    icon: "🌳",
    label: "Investisseur",
    sublabel: "Baobab",
    desc: "Je veux investir dès 500 FCFA dans des projets locaux et percevoir des retours.",
  },
  {
    value: "ENTREPRENEUR",
    icon: "🚀",
    label: "Entrepreneur",
    sublabel: "Porteur de projet",
    desc: "J'ai un projet viable et je veux lever des fonds auprès de la communauté.",
  },
  {
    value: "MENTOR",
    icon: "🎓",
    label: "Mentor / Garant",
    sublabel: "Expert validateur",
    desc: "Je suis expert ou figure locale. Je valide des projets et j'engage ma réputation.",
  },
  {
    value: "BUILDER",
    icon: "🏗️",
    label: "Bâtisseur",
    sublabel: "Mécène / Partenaire",
    desc: "Entreprise, institution ou mécène : je soutiens les jeunes entrepreneurs à grande échelle.",
  },
];

const COUNTRIES = [
  { code: "SN", flag: "🇸🇳", name: "Sénégal" },
  { code: "CI", flag: "🇨🇮", name: "Côte d'Ivoire" },
  { code: "CM", flag: "🇨🇲", name: "Cameroun" },
  { code: "ML", flag: "🇲🇱", name: "Mali" },
  { code: "BF", flag: "🇧🇫", name: "Burkina Faso" },
  { code: "GN", flag: "🇬🇳", name: "Guinée" },
  { code: "TG", flag: "🇹🇬", name: "Togo" },
  { code: "BJ", flag: "🇧🇯", name: "Bénin" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "",
    phone: "", password: "", confirmPassword: "",
    role: "INVESTOR", country: "SN", city: "", companyName: "", sector: "",
  });
  const [geo, setGeo] = useState({
    country: "Senegal", countryCode: "SN", indicatif: "+221",
    state: "", stateCode: "", city: ""
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    if (form.password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            phone: form.phone,
            password: form.password,
            role: form.role,
            country: form.country,
            city: form.city,
          }),
        }
      );
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      localStorage.setItem("accessToken", data.data.accessToken);
      localStorage.setItem("refreshToken", data.data.refreshToken);
      localStorage.setItem("user", JSON.stringify(data.data.user));
      const role = data.data.user.role;
      if (role === "ENTREPRENEUR") router.push("/entrepreneur");
      else if (role === "MENTOR") router.push("/mentor");
      else if (role === "BUILDER") router.push("/builder");
      else router.push("/dashboard");
    } catch {
      setError("Erreur de connexion au serveur. Réessaie.");
    } finally {
      setLoading(false);
    }
  };

  const selectedRole = ROLES.find((r) => r.value === form.role);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🌳</div>
          <h1 className="text-2xl font-bold text-green-600">KORAPACT</h1>
          <p className="text-gray-500 text-sm mt-1">
            Rejoins la communauté d'investissement africaine
          </p>
        </div>

        {/* Choix du rôle */}
        <div className="mb-6">
          <label className="text-xs font-semibold text-gray-600 mb-3 block uppercase tracking-wide">
            Je suis un...
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setForm({ ...form, role: r.value })}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  form.role === r.value
                    ? "border-green-500 bg-green-50 shadow-sm"
                    : "border-gray-200 hover:border-green-200"
                }`}
              >
                <div className="text-2xl mb-1">{r.icon}</div>
                <div className="font-semibold text-xs text-gray-800">{r.label}</div>
                <div className="text-xs text-gray-400">{r.sublabel}</div>
              </button>
            ))}
          </div>

          {/* Description du rôle sélectionné */}
          {selectedRole && (
            <div className="mt-3 bg-green-50 border border-green-100 rounded-xl p-3">
              <p className="text-xs text-green-700 leading-relaxed">
                <span className="font-semibold">{selectedRole.icon} {selectedRole.label} :</span>{" "}
                {selectedRole.desc}
              </p>
              {form.role === "MENTOR" && (
                <p className="text-xs text-orange-600 mt-2 font-medium">
                  ⚠️ Ton profil sera examiné par notre équipe avant validation.
                </p>
              )}
              {form.role === "BUILDER" && (
                <p className="text-xs text-yellow-700 mt-2 font-medium">
                  🏗️ Profil Bâtisseur — Vérification KYC renforcée. Dashboard dédié avec impact social.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-sm mb-5">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Prénom + Nom */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">
                Prénom *
              </label>
              <input
                name="firstName" value={form.firstName}
                onChange={handleChange} placeholder="Amadou"
                required className="input-field"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">
                Nom *
              </label>
              <input
                name="lastName" value={form.lastName}
                onChange={handleChange} placeholder="Diallo"
                required className="input-field"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              Adresse email *
            </label>
            <input
              name="email" type="email" value={form.email}
              onChange={handleChange} placeholder="amadou@email.com"
              required className="input-field"
            />
          </div>

          {/* Téléphone */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              Téléphone Mobile Money *
            </label>
            <input
              name="phone" value={form.phone}
              onChange={handleChange} placeholder="221771234567 (avec indicatif)"
              required className="input-field"
            />
            <p className="text-xs text-gray-400 mt-1">
              Ce numéro sera utilisé pour tes paiements Wave / Orange Money / MTN
            </p>
          </div>

          {/* Pays + Région + Ville */}
          <GeoSelector value={geo} onChange={v => {
            setGeo(v);
            setForm(f => ({ ...f, country: v.countryCode, city: v.city }));
          }} />
          {/* Champs spécifiques Bâtisseur */}
          {form.role === "BUILDER" && (
            <div className="space-y-3 border-2 border-yellow-200 rounded-2xl p-4 bg-yellow-50">
              <div className="text-xs font-bold text-yellow-800 mb-2">🏗️ Informations Bâtisseur</div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Entreprise / Organisation</label>
                <input
                  name="companyName" value={form.companyName}
                  onChange={handleChange}
                  placeholder="Ex: Groupe Bolloré, Orange CI, UNESCO..."
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Secteur d'activité</label>
                <select name="sector" value={form.sector} onChange={handleChange} className="input-field">
                  <option value="">Sélectionner...</option>
                  <option value="BANQUE_FINANCE">Banque & Finance</option>
                  <option value="TECH">Technologie</option>
                  <option value="AGRICULTURE">Agriculture</option>
                  <option value="SANTE">Santé</option>
                  <option value="EDUCATION">Éducation</option>
                  <option value="COMMERCE">Commerce & Distribution</option>
                  <option value="ENERGIE">Énergie</option>
                  <option value="IMMOBILIER">Immobilier</option>
                  <option value="TELECOMS">Télécommunications</option>
                  <option value="INSTITUTION">Institution / ONG</option>
                  <option value="AUTRE">Autre</option>
                </select>
              </div>
              <p className="text-xs text-yellow-700">
                ⚠️ Votre profil Bâtisseur sera examiné et vérifié par notre équipe avant validation.
              </p>
            </div>
          )}
          {/* Indicatif auto */}
          {geo.indicatif && (
            <p className="text-xs text-green-600 -mt-1">
              📞 Indicatif détecté : <strong>{geo.indicatif}</strong> — pensez à l&apos;inclure dans votre numéro
            </p>
          )}

          {/* Mot de passe */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              Mot de passe * (min. 8 caractères)
            </label>
            <input
              name="password" type="password" value={form.password}
              onChange={handleChange} placeholder="••••••••"
              required className="input-field"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              Confirmer le mot de passe *
            </label>
            <input
              name="confirmPassword" type="password"
              value={form.confirmPassword} onChange={handleChange}
              placeholder="••••••••" required className="input-field"
            />
          </div>

          {/* CGU */}
          <div className="flex items-start gap-2">
            <input type="checkbox" required className="mt-1 accent-green-600" id="cgu" />
            <label htmlFor="cgu" className="text-xs text-gray-500 leading-relaxed">
              J'accepte les{" "}
              <Link href="/cgu" className="text-green-600 hover:underline">
                Conditions Générales d'Utilisation
              </Link>{" "}
              et la{" "}
              <Link href="/privacy" className="text-green-600 hover:underline">
                Politique de Confidentialité
              </Link>{" "}
              de KORAPACT, ainsi que la{" "}
              <span className="font-medium text-gray-700">
                Clause de Transparence Sociale
              </span>
              .
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full text-base py-4 mt-2"
          >
            {loading
              ? "Création du compte..."
              : `Créer mon compte ${selectedRole?.icon || "🌳"}`}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Déjà un compte ?{" "}
          <Link
            href="/auth/login"
            className="text-green-600 font-semibold hover:underline"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
