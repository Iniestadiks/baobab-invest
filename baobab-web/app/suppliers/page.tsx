"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const SECTORS = ["Tous","Agriculture","Restauration","Commerce","BTP","Transport","Sante","Education","Technologie","Autre"];

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("Tous");
  const API = process.env.NEXT_PUBLIC_API_URL || "https://korapact.com";

  useEffect(() => {
    fetch(`${API}/api/suppliers`)
      .then(r => r.json())
      .then(d => { if (d.success) setSuppliers(d.data || []); setLoading(false); });
  }, []);

  const filtered = suppliers.filter(s => {
    const matchSearch = !search ||
      s.companyName?.toLowerCase().includes(search.toLowerCase()) ||
      s.description?.toLowerCase().includes(search.toLowerCase());
    const matchSector = sector === "Tous" || s.sector === sector;
    return matchSearch && matchSector && s.isVerified;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-green-700 text-white px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/entrepreneur" className="text-green-300 hover:text-white text-sm mb-4 inline-block">← Retour dashboard</Link>
          <h1 className="text-2xl font-black mb-1">Fournisseurs Certifies BAOBAB</h1>
          <p className="text-green-200 text-sm">Partenaires verifies — Contactez-les et payez directement via votre wallet</p>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 flex gap-3 flex-wrap items-center">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un fournisseur..."
            className="flex-1 min-w-48 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
          <select value={sector} onChange={e => setSector(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm">
            {SECTORS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <div className="text-2xl">💡</div>
          <div className="text-sm text-blue-700">
            <div className="font-bold mb-1">Comment payer un fournisseur ?</div>
            <div>Contactez le fournisseur, convenez du prix, puis payez directement via Mobile Money (Wave, Orange Money) depuis votre wallet BAOBAB. Vous etes libre de vos achats.</div>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-20 text-gray-400">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-5xl mb-4">🏪</div>
            <p>Aucun fournisseur verifie disponible</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filtered.map(s => (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-100 hover:border-green-300 shadow-sm p-5 transition-all">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                    {s.logoUrl ? <img src={s.logoUrl} className="w-10 h-10 rounded-lg object-cover" alt="" /> : '🏪'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900">{s.companyName}</span>
                      {s.isPremium && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">⭐ Premium</span>}
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ Verifie</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{s.sector} · {s.city}, {s.country}</div>
                  </div>
                </div>
                {s.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{s.description}</p>}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-400">
                    {s.phone}
                    {s.rating > 0 && <span className="ml-2">⭐ {s.rating.toFixed(1)}</span>}
                  </div>
                  <a href={`tel:${s.phone}`}
                    className="bg-green-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-green-700">
                    Contacter
                  </a>
                </div>
                {s.mobileMoneyProvider && (
                  <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                    💳 Accepte : <strong>{s.mobileMoneyProvider}</strong>
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
