"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const SECTORS = ["Tous","Agro-alimentaire","Commerce général","Matériaux & Construction","Équipements","Transport","Informatique","Santé","Énergie","Autre"];
const COUNTRIES = [
  { code: "", name: "Tous les pays" },
  { code: "SN", flag: "🇸🇳", name: "Sénégal" },
  { code: "CI", flag: "🇨🇮", name: "Côte d'Ivoire" },
  { code: "CM", flag: "🇨🇲", name: "Cameroun" },
  { code: "ML", flag: "🇲🇱", name: "Mali" },
  { code: "BF", flag: "🇧🇫", name: "Burkina Faso" },
  { code: "GN", flag: "🇬🇳", name: "Guinée" },
];
const PROVIDERS = ["Tous","WAVE","ORANGE","MTN","MOOV","FREE"];

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("Tous");
  const [country, setCountry] = useState("");
  const [provider, setProvider] = useState("Tous");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const user = localStorage.getItem("user");
    if (token && user) {
      setIsLoggedIn(true);
      setUserRole(JSON.parse(user).role);
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/suppliers`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setSuppliers(d.data || []);
          setFiltered(d.data || []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Filtrage en temps réel
  useEffect(() => {
    let result = [...suppliers];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(f =>
        f.companyName?.toLowerCase().includes(s) ||
        f.contactName?.toLowerCase().includes(s) ||
        f.city?.toLowerCase().includes(s) ||
        f.description?.toLowerCase().includes(s)
      );
    }
    if (sector !== "Tous") result = result.filter(f => f.sector === sector);
    if (country) result = result.filter(f => f.country === country);
    if (provider !== "Tous") result = result.filter(f => f.mobileMoneyProvider === provider);
    setFiltered(result);
  }, [search, sector, country, provider, suppliers]);

  const handleBecomeSeller = () => {
    if (!isLoggedIn) {
      router.push("/auth/login?redirect=/suppliers/register");
      return;
    }
    router.push("/suppliers/register");
  };

  const COUNTRY_MAP: Record<string, string> = {
    SN: "🇸🇳 Sénégal", CI: "🇨🇮 Côte d'Ivoire",
    CM: "🇨🇲 Cameroun", ML: "🇲🇱 Mali",
    BF: "🇧🇫 Burkina Faso", GN: "🇬🇳 Guinée",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={isLoggedIn ? (userRole === "ENTREPRENEUR" ? "/entrepreneur" : "/dashboard") : "/"} className="text-gray-400 hover:text-green-600">← Retour</Link>
            <span className="font-bold text-green-600">Partenaires Fournisseurs</span>
          </div>
          <button onClick={handleBecomeSeller} className="btn-primary text-sm py-2">
            🏪 Devenir fournisseur
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">🏪 Fournisseurs Partenaires Vérifiés</h1>
          <p className="text-gray-500 text-sm">{filtered.length} fournisseur(s) trouvé(s) — KYB validé par BAOBAB INVEST</p>
        </div>

        {/* Explication paiement direct */}
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6">
          <div className="font-semibold text-green-800 mb-3">💡 Comment fonctionne le paiement direct ?</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-sm">
            {[
              { icon: "🏗️", text: "Entrepreneur demande déblocage d'un jalon" },
              { icon: "🧾", text: "Fournit un devis pro forma" },
              { icon: "✅", text: "Admin valide sous 48h" },
              { icon: "💳", text: "Fournisseur reçoit sur Mobile Money" },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-xl p-3">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-xs text-gray-600">{s.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Recherche */}
            <div className="md:col-span-1">
              <label className="text-xs font-semibold text-gray-500 mb-1 block">🔍 RECHERCHE</label>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Nom, ville, activité..."
                className="input-field text-sm" />
            </div>
            {/* Secteur */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">🏭 SECTEUR</label>
              <select value={sector} onChange={e => setSector(e.target.value)} className="input-field text-sm">
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {/* Pays */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">🌍 PAYS</label>
              <select value={country} onChange={e => setCountry(e.target.value)} className="input-field text-sm">
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag || ""} {c.name}</option>)}
              </select>
            </div>
            {/* Opérateur */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">💳 OPÉRATEUR</label>
              <select value={provider} onChange={e => setProvider(e.target.value)} className="input-field text-sm">
                {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          {(search || sector !== "Tous" || country || provider !== "Tous") && (
            <button onClick={() => { setSearch(""); setSector("Tous"); setCountry(""); setProvider("Tous"); }}
              className="text-xs text-gray-400 hover:text-red-500 mt-3 transition-colors">
              ✕ Effacer les filtres
            </button>
          )}
        </div>

        {/* Liste */}
        {loading ? (
          <div className="text-center py-20">
            <div className="text-5xl animate-bounce mb-4">🏪</div>
            <p className="text-gray-500">Chargement...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="font-bold text-gray-900 text-lg mb-2">Aucun résultat</h3>
            <p className="text-gray-500 mb-4">Essaie d'autres critères de recherche</p>
            <button onClick={() => { setSearch(""); setSector("Tous"); setCountry(""); setProvider("Tous"); }}
              className="btn-secondary text-sm py-2 px-5">
              Voir tous les fournisseurs
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((s: any) => (
              <div key={s.id} className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all ${s.isPremium ? "border-yellow-300" : "border-gray-100"}`}>
                {s.isPremium && (
                  <div className="text-xs bg-yellow-50 text-yellow-700 font-bold px-2 py-0.5 rounded-full inline-block mb-2">⭐ Premium</div>
                )}
                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center text-xl font-bold text-green-700 flex-shrink-0">
                    {s.companyName?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 truncate">{s.companyName}</div>
                    <div className="text-xs text-gray-500">{s.contactName}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{COUNTRY_MAP[s.country] || s.country} · {s.city}</div>
                  </div>
                  <span className="text-xs bg-green-50 text-green-700 font-bold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                    ✅ KYB
                  </span>
                </div>

                {/* Infos */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span>🏭</span>
                    <span className="font-medium">{s.sector}</span>
                  </div>
                  {s.description && (
                    <div className="flex items-start gap-2 text-xs text-gray-500">
                      <span>📝</span>
                      <span className="line-clamp-2">{s.description}</span>
                    </div>
                  )}
                  {s.rccmNumber && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>📋</span>
                      <span>RCCM : {s.rccmNumber}</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-50 pt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                      s.mobileMoneyProvider === "WAVE" ? "bg-blue-50 text-blue-700" :
                      s.mobileMoneyProvider === "ORANGE" ? "bg-orange-50 text-orange-700" :
                      s.mobileMoneyProvider === "MTN" ? "bg-yellow-50 text-yellow-700" :
                      "bg-green-50 text-green-700"}`}>
                      {s.mobileMoneyProvider}
                    </span>
                    <span className="text-xs text-gray-400">{s.mobileMoneyNumber}</span>
                  </div>
                  {s.rating > 0 && (
                    <div className="text-xs text-gray-500">⭐ {s.rating.toFixed(1)}/5</div>
                  )}
                </div>

                {s.totalPayments > 0 && (
                  <div className="mt-2 text-xs text-center text-gray-400">
                    💰 {s.totalPayments.toLocaleString()} FCFA de paiements reçus
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
