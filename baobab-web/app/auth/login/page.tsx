"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  // Si déjà connecté → rediriger selon le rôle
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const user = localStorage.getItem("user");
    if (token && user) {
      const u = JSON.parse(user);
      if (redirect) { router.push(redirect); return; }
      if (u.role === "ENTREPRENEUR") router.push("/entrepreneur");
      else if (u.role === "ADMIN") router.push("/admin");
      else if (u.role === "MENTOR") router.push("/mentor");
      else router.push("/dashboard");
    }
  }, [router, redirect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) { setError(data.message); return; }

      localStorage.setItem("accessToken", data.data.accessToken);
      localStorage.setItem("refreshToken", data.data.refreshToken);
      localStorage.setItem("user", JSON.stringify(data.data.user));

      // Redirection selon le rôle ou l'URL de redirect
      if (redirect) { router.push(redirect); return; }
      const role = data.data.user.role;
      if (role === "ENTREPRENEUR") router.push("/entrepreneur");
      else if (role === "ADMIN") router.push("/admin");
      else if (role === "MENTOR") router.push("/mentor");
      else router.push("/dashboard");

    } catch {
      setError("Impossible de se connecter au serveur. Vérifie ta connexion internet.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <div className="text-5xl mb-3 cursor-pointer">🌳</div>
          </Link>
          <h1 className="text-2xl font-bold text-green-600">Bon retour !</h1>
          <p className="text-gray-500 text-sm mt-1">Connecte-toi à BAOBAB INVEST</p>
          {redirect && (
            <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-600">
              🔒 Connecte-toi pour accéder à cette page
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-sm mb-5 flex items-start gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Adresse email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange}
              placeholder="ton@email.com" required
              className="input-field" autoComplete="email" />
          </div>

          {/* Mot de passe avec afficher/masquer */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-600">Mot de passe</label>
              <Link href="/auth/forgot-password" className="text-xs text-green-600 hover:underline">
                Mot de passe oublié ?
              </Link>
            </div>
            <div className="relative">
              <input name="password" type={showPassword ? "text" : "password"}
                value={form.password} onChange={handleChange}
                placeholder="••••••••" required
                className="input-field pr-12" autoComplete="current-password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors text-lg">
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="btn-primary w-full py-4 text-base mt-2">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Connexion en cours...
              </span>
            ) : "Se connecter →"}
          </button>
        </form>

        {/* Comptes de test */}
        <div className="mt-6 bg-gray-50 rounded-xl p-4">
          <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">🧪 Comptes de test</div>
          <div className="space-y-1.5">
            {[
              { role: "🌳 Investisseur", email: "amadou@test.com", pwd: "motdepasse123" },
              { role: "🚀 Entrepreneur", email: "entrepreneur@test.com", pwd: "motdepasse123" },
              { role: "🎓 Mentor", email: "mentor@test.com", pwd: "motdepasse123" },
              { role: "🛡️ Admin", email: "admin@baobabinvest.com", pwd: "Admin@Baobab2025" },
            ].map(c => (
              <button key={c.email} type="button"
                onClick={() => setForm({ email: c.email, password: c.pwd })}
                className="w-full text-left text-xs text-gray-500 hover:text-green-600 hover:bg-green-50 px-2 py-1.5 rounded-lg transition-colors">
                <span className="font-medium">{c.role}</span> — {c.email}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">Clique sur un compte pour le remplir automatiquement</p>
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          Pas encore de compte ?{" "}
          <Link href="/auth/register" className="text-green-600 font-semibold hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
