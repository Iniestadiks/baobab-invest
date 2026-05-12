"use client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulation — l'intégration email réelle viendra avec SMTP
    await new Promise(r => setTimeout(r, 1500));
    setSent(true);
    setLoading(false);
  };

  if (sent) return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10 text-center">
        <div className="text-6xl mb-4">📧</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Email envoyé !</h2>
        <p className="text-gray-500 mb-2">
          Si un compte existe avec <strong>{email}</strong>, tu recevras un lien de réinitialisation dans quelques minutes.
        </p>
        <p className="text-gray-400 text-sm mb-6">Vérifie aussi tes spams.</p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800 mb-6">
          <strong>⚡ En mode développement</strong> — L'email n'est pas encore envoyé réellement. Contacte l'admin pour réinitialiser ton mot de passe.
        </div>
        <Link href="/auth/login" className="btn-primary inline-flex">← Retour à la connexion</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔑</div>
          <h1 className="text-2xl font-bold text-green-600">Mot de passe oublié</h1>
          <p className="text-gray-500 text-sm mt-1">
            Saisis ton email — on t'envoie un lien de réinitialisation
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Adresse email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="ton@email.com" required className="input-field" autoFocus />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-4">
            {loading ? "Envoi en cours..." : "Envoyer le lien →"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Tu te souviens ?{" "}
          <Link href="/auth/login" className="text-green-600 font-semibold hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
