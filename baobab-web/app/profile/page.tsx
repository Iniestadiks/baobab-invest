"use client";
import { GeoSelector } from "@/hooks/useGeo";
import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authGet, authPatch } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  INVESTOR: "💰 Investisseur", ENTREPRENEUR: "🚀 Entrepreneur",
  MENTOR: "🎓 Mentor", SUPPLIER: "🏪 Fournisseur", ADMIN: "👑 Admin"
};
const ROLE_DASHBOARD: Record<string, string> = {
  INVESTOR: "/dashboard", ENTREPRENEUR: "/entrepreneur",
  MENTOR: "/mentor", SUPPLIER: "/supplier/dashboard", ADMIN: "/admin"
};

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const needsCompletion = searchParams.get("complete") === "1";
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", city: "", country: "", countryCode: "", region: "", stateCode: "", bio: "" });
  const [geo, setGeo] = useState({ country: "", countryCode: "", indicatif: "", state: "", stateCode: "", city: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.replace("/auth/login"); return; }
    authGet("/api/auth/me").then(res => {
      if (res.success) {
        setUser(res.data);
        setForm({
          firstName: res.data.firstName || "",
          lastName: res.data.lastName || "",
          phone: res.data.phone?.startsWith("google_") ? "" : (res.data.phone || ""),
          city: res.data.city || "",
          country: res.data.countryCode || res.data.country || "",
          countryCode: res.data.countryCode || res.data.country || "",
          region: res.data.region || "",
          stateCode: res.data.stateCode || "",
          bio: res.data.bio || "",
        });
        setGeo({
          country: res.data.country || "",
          countryCode: res.data.countryCode || res.data.country || "",
          indicatif: res.data.indicatif || "",
          state: res.data.region || "",
          stateCode: res.data.stateCode || "",
          city: res.data.city || "",
        });
      }
    }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await authPatch("/api/auth/profile", form);
      if (res.success) {
        setMsg("✅ Profil mis à jour !");
        const stored = localStorage.getItem("user");
        if (stored) {
          const u = JSON.parse(stored);
          localStorage.setItem("user", JSON.stringify({ ...u, firstName: form.firstName, lastName: form.lastName }));
        }
      } else setMsg("❌ " + res.message);
    } finally { setSaving(false); setTimeout(() => setMsg(""), 3000); }
  };

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setMsg("❌ Photo trop lourde (max 8MB)"); return; }
    const allowed = ["image/jpeg","image/jpg","image/png","image/webp"];
    if (!allowed.includes(file.type)) { setMsg("❌ Format non supporté (JPG, PNG, WEBP)"); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "korapact_avatars");
      formData.append("folder", `korapact/avatars/${user?.id || "unknown"}`);
      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
      );
      const cloudData = await cloudRes.json();
      if (!cloudData.secure_url) { setMsg("❌ Erreur upload Cloudinary"); setUploading(false); return; }
      const res = await authPatch("/api/auth/avatar", { avatarUrl: cloudData.secure_url });
      if (res.success) {
        setUser((prev: any) => ({ ...prev, profileImageUrl: cloudData.secure_url }));
        setMsg("✅ Photo mise à jour !");
      } else setMsg("❌ " + res.message);
    } catch { setMsg("❌ Erreur upload photo"); }
    finally { setUploading(false); setTimeout(() => setMsg(""), 3000); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-5xl animate-bounce">👤</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href={ROLE_DASHBOARD[user?.role] || "/"} className="text-gray-400 hover:text-green-600">←</Link>
          <span className="font-bold text-gray-900">Mon profil</span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">
        {needsCompletion && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-2xl">👋</span>
            <div>
              <div className="font-bold text-blue-900 text-sm">Bienvenue sur KORAPACT !</div>
              <div className="text-xs text-blue-700 mt-1">Complète ton téléphone, ton pays et ta région pour profiter de toutes les fonctionnalités (investir, KYC, retraits...).</div>
            </div>
          </div>
        )}

        {msg && <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl p-3 text-center">{msg}</div>}

        {/* Photo de profil */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
          <div className="relative inline-block mb-4">
            <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center text-3xl font-bold text-green-700 overflow-hidden mx-auto">
              {user?.profileImageUrl ? (
                <img src={user.profileImageUrl} className="w-24 h-24 object-cover" alt="photo" />
              ) : (
                <span>{user?.firstName?.[0]}{user?.lastName?.[0]}</span>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm hover:bg-green-700 shadow-md"
            >
              📷
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={uploadPhoto} className="hidden" />
          <div className="font-bold text-gray-900 text-lg">{user?.firstName} {user?.lastName}</div>
          <div className="text-sm text-gray-500 mt-1">{ROLE_LABELS[user?.role] || user?.role}</div>
          <div className="text-xs text-gray-400 mt-0.5">{user?.email}</div>
          {uploading && <p className="text-xs text-green-600 mt-2">⏳ Chargement de la photo...</p>}
          <button onClick={() => fileRef.current?.click()} className="mt-3 text-xs text-green-600 hover:underline">
            Changer ma photo de profil
          </button>
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h3 className="font-bold text-gray-900">Informations personnelles</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "firstName", label: "Prénom" },
              { key: "lastName", label: "Nom" },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
                <input
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Téléphone</label>
            <input value={form.phone} onChange={e => setForm(prev => ({...prev, phone: e.target.value}))}
              placeholder="+221 77 000 00 00"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400" />
          </div>
          <GeoSelector value={geo} onChange={v => {
            setGeo(v);
            setForm(f => ({ ...f, country: v.countryCode, countryCode: v.countryCode, city: v.city, region: v.state, stateCode: v.stateCode }));
          }} />
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Bio / Présentation</label>
            <textarea
              value={form.bio}
              onChange={e => setForm(prev => ({ ...prev, bio: e.target.value }))}
              placeholder="Parlez-nous de vous..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-green-400"
            />
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : "💾 Sauvegarder"}
          </button>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-3">📊 Mes statistiques</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <div className="font-bold text-green-700">{user?.reputationScore || 50}/100</div>
              <div className="text-xs text-gray-500">Score réputation</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <div className={`font-bold ${user?.kycStatus === "VERIFIED" ? "text-green-700" : user?.kycStatus === "REJECTED" ? "text-red-700" : "text-orange-700"}`}>
                {user?.kycStatus === "VERIFIED" ? "✅ Vérifié" : user?.kycStatus === "REJECTED" ? "❌ Rejeté" : user?.kycStatus === "PENDING" ? "⏳ En cours de vérification" : "📄 Non soumis"}
              </div>
              <div className="text-xs text-gray-500">Statut KYC</div>
              {user?.kycStatus !== "VERIFIED" && (
                <a href="/kyc" className="mt-2 block w-full bg-orange-500 text-white text-xs font-bold py-2 rounded-xl text-center hover:bg-orange-600">
                  {user?.kycStatus === "REJECTED" ? "🔄 Resoumettre mes documents" : "📄 Soumettre mes documents KYC"}
                </a>
              )}
              {user?.kycStatus !== "VERIFIED" && (
                <div className="mt-2 text-xs text-gray-400 text-center">
                  Document d&apos;identité + selfie requis
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
