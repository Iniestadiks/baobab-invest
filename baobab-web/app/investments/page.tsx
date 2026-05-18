"use client";
import { useRequireRole } from "@/hooks/useRequireRole";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authGet } from "@/lib/api";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:   { label: "En cours",   color: "text-blue-700",   bg: "bg-blue-50" },
  COMPLETED: { label: "Terminé",    color: "text-green-700",  bg: "bg-green-50" },
  FAILED:    { label: "Échoué",     color: "text-red-700",    bg: "bg-red-50" },
  CANCELLED: { label: "Annulé",     color: "text-gray-700",   bg: "bg-gray-50" },
};

const SECTOR_EMOJI: Record<string, string> = {
  AGRICULTURE:"🌾", COMMERCE:"🛒", TECH:"💻", ARTISANAT:"🎨",
  EDUCATION:"📚", SANTE:"🏥", SERVICES:"🔧", ENERGIE:"⚡",
  TRANSPORT:"🚌", AUTRE:"📦",
};

export default function InvestmentsPage() {
  const router = useRouter();
  useRequireRole(["INVESTOR"]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/auth/login"); return; }

    authGet("/api/investments/my").then(data => {
      if (data.success) {
        setInvestments(data.data.investments || []);
        setStats({
          totalInvested: data.data.totalInvested || 0,
          totalExpected: data.data.totalExpected || 0,
          totalReturned: data.data.totalReturned || 0,
          guaranteeContrib: data.data.guaranteeContrib || 0,
          projectsFunded: data.data.projectsFunded || 0,
        });
      }
    }).finally(() => setLoading(false));
  }, [router]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="text-5xl animate-bounce mb-4">📊</div><p className="text-gray-500">Chargement...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/dashboard/redirect" className="text-gray-400 hover:text-green-600">← Dashboard</Link>
          <span className="font-bold text-green-600">Mes Investissements</span>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Stats globales */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total investi", value: `${(stats?.totalInvested || 0).toLocaleString()} FCFA`, icon: "💰", color: "text-green-700", bg: "bg-green-50" },
            { label: "Retour attendu", value: `+${(stats?.totalExpected || 0).toLocaleString()} FCFA`, icon: "📈", color: "text-blue-700", bg: "bg-blue-50" },
            { label: "Déjà reçu", value: `${(stats?.totalReturned || 0).toLocaleString()} FCFA`, icon: "✅", color: "text-purple-700", bg: "bg-purple-50" },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-5`}>
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Explication du mécanisme */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
          <h3 className="font-bold text-gray-900 mb-3">💡 Comment fonctionne mon retour ?</h3>
          <div className="grid md:grid-cols-4 gap-3 text-center text-sm">
            {[
              { icon: "💳", step: "1", text: "Tu investis via ton wallet" },
              { icon: "🔒", step: "2", text: "Fonds sécurisés en séquestre" },
              { icon: "🏭", step: "3", text: "Fonds débloqués par jalons aux fournisseurs" },
              { icon: "💰", step: "4", text: "Tu reçois capital + retour à la fin" },
            ].map(s => (
              <div key={s.step} className="bg-gray-50 rounded-xl p-3">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-1">{s.step}</div>
                <div className="text-gray-600 text-xs">{s.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Liste des investissements */}
        {investments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-5xl mb-4">🌱</div>
            <h3 className="font-bold text-gray-900 text-lg mb-2">Aucun investissement</h3>
            <p className="text-gray-500 mb-6">Explore le catalogue et fais ton premier investissement dès 500 FCFA</p>
            <Link href="/projects" className="btn-primary inline-flex">Explorer les projets →</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {investments.map((inv: any) => {
              const status = STATUS_CONFIG[inv.status] || STATUS_CONFIG.PENDING;
              const project = inv.project;
              const fundingPercent = project ? Math.round((project.raisedAmount / project.goalAmount) * 100) : 0;
              const returnPercent = inv.returnedAmount > 0 ? Math.round((inv.returnedAmount / (inv.amount + inv.expectedReturn)) * 100) : 0;

              return (
                <div key={inv.id} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl flex-shrink-0">
                        {SECTOR_EMOJI[project?.sector] || "🌱"}
                      </div>
                      <div>
                        <Link href={`/projects/${project?.id}`} className="font-bold text-gray-900 hover:text-green-600 transition-colors">
                          {project?.title || "Projet"}
                        </Link>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Par {project?.entrepreneur?.firstName} {project?.entrepreneur?.lastName}
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${status.bg} ${status.color} whitespace-nowrap`}>
                      {status.label}
                    </span>
                  </div>

                  {/* Chiffres clés */}
                  <div className="grid grid-cols-4 gap-3 mb-4 text-center text-sm">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="font-bold text-gray-900">{inv.amount.toLocaleString()}</div>
                      <div className="text-xs text-gray-400">FCFA investis</div>
                    </div>
                    <div className="bg-green-50 rounded-xl p-3">
                      <div className="font-bold text-green-700">+{inv.expectedReturn.toLocaleString()}</div>
                      <div className="text-xs text-gray-400">FCFA attendus</div>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3">
                      <div className="font-bold text-blue-700">{(inv.amount + inv.expectedReturn).toLocaleString()}</div>
                      <div className="text-xs text-gray-400">Total à recevoir</div>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-3">
                      <div className="font-bold text-purple-700">{inv.returnRate}%</div>
                      <div className="text-xs text-gray-400">Taux de retour</div>
                    </div>
                  </div>

                  {/* Barre de progression financement */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Financement du projet</span>
                      <span className="font-semibold text-green-600">{fundingPercent}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(fundingPercent, 100)}%` }} />
                    </div>
                  </div>

                  {/* Barre remboursement */}
                  {inv.returnedAmount > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Remboursement reçu</span>
                        <span className="font-semibold text-purple-600">{inv.returnedAmount.toLocaleString()} FCFA</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${returnPercent}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Fonds de garantie */}
                  <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-50">
                    <span>🛡️ Contribution fonds de garantie : {inv.guaranteeContribution?.toLocaleString() || 0} FCFA</span>
                    <span>📅 {new Date(inv.createdAt).toLocaleDateString("fr-FR")}</span>
                  </div>

                  {/* Lien vers le feed */}
                  <div className="mt-3">
                    <Link href={`/feed/${project?.id}`}
                      className="text-xs text-green-600 hover:underline font-medium flex items-center gap-1">
                      📸 Voir les mises à jour de l'entrepreneur →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
