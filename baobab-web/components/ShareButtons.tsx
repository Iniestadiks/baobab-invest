"use client";
import { useState } from "react";

interface Props {
  title: string;
  url?: string;
  amount?: number;
  returnRate?: number;
}

export default function ShareButtons({ title, url, amount, returnRate }: Props) {
  const [copied, setCopied] = useState(false);
  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const text = `🌳 Investis dans ce projet KORAPACT : "${title}"${returnRate ? ` — Retour estimé : +${returnRate}%` : ""}${amount ? ` — Dès ${amount.toLocaleString()} FCFA` : ""}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shares = [
    {
      label: "WhatsApp",
      icon: "📱",
      color: "bg-green-500 hover:bg-green-600 text-white",
      action: () => window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + shareUrl)}`, "_blank"),
    },
    {
      label: "Facebook",
      icon: "👥",
      color: "bg-blue-600 hover:bg-blue-700 text-white",
      action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank"),
    },
    {
      label: "Twitter",
      icon: "🐦",
      color: "bg-sky-400 hover:bg-sky-500 text-white",
      action: () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, "_blank"),
    },
    {
      label: copied ? "Copié !" : "Copier le lien",
      icon: copied ? "✅" : "🔗",
      color: copied ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-100 text-gray-700 hover:bg-gray-200",
      action: copyLink,
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <h3 className="font-bold text-gray-900 mb-3">📢 Partager ce projet</h3>
      <p className="text-xs text-gray-500 mb-4">
        Partage ce projet avec ta communauté et aide cet entrepreneur à atteindre son objectif !
      </p>
      <div className="grid grid-cols-2 gap-2">
        {shares.map(s => (
          <button key={s.label} onClick={s.action}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-colors ${s.color}`}>
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
