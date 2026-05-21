"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function TransparencePage() {
  const [fees, setFees] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    // Charger les taux publics
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/config/public`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          const cfg: any = {};
          res.data.forEach((c: any) => { cfg[c.key] = c.value; });
          setFees(cfg);
        }
      });
    // Charger les stats publiques
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects?limit=100`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          const projects = res.data.projects || [];
          setStats({
            totalProjects: projects.length,
            activeProjects: projects.filter((p: any) => p.status === "ACTIVE").length,
            fundedProjects: projects.filter((p: any) => ["FUNDED","IN_PROGRESS","COMPLETED"].includes(p.status)).length,
            completedProjects: projects.filter((p: any) => p.status === "COMPLETED").length,
            totalRaised: projects.reduce((s: number, p: any) => s + (p.raisedAmount || 0), 0),
          });
        }
      });
  }, []);

  const f = fees || {
    commission_baobab_collection: 5, commission_mentor: 2,
    commission_guarantee: 2, payin_recovery: 4,
    payin_repayment: 4, withdrawal_fee_standard: 3,
    return_min: 22,
    investment_min: 5000
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🌳</span>
            <span className="font-bold text-green-600">BAOBAB INVEST</span>
          </Link>
          <Link href="/auth/login" className="bg-green-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-green-700">
            Se connecter →
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* Hero */}
        <div className="bg-green-700 text-white rounded-2xl p-8">
          <h1 className="text-3xl font-bold mb-3">💡 Transparence totale</h1>
          <p className="text-green-100 text-lg leading-relaxed">
            Chez BAOBAB INVEST, chaque franc est tracé. Voici exactement comment fonctionne notre modèle économique,
            qui paie quoi, et combien chaque partie reçoit.
          </p>
        </div>

        {/* Stats en temps réel */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Projets actifs", value: stats.activeProjects, icon: "🚀" },
              { label: "Projets financés", value: stats.fundedProjects, icon: "✅" },
              { label: "Projets terminés", value: stats.completedProjects, icon: "🏆" },
              { label: "Total levé", value: `${(stats.totalRaised/1000000).toFixed(1)}M FCFA`, icon: "💰" },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="font-bold text-xl text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Frais en temps réel */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">💸 Frais & Commissions</h2>
          <p className="text-sm text-gray-500 mb-5">Ces taux sont mis à jour en temps réel par notre équipe.</p>
          <div className="space-y-3">
            {[
              { label: "Commission BAOBAB à la clôture", value: `${f.commission_baobab_collection}%`, desc: "Prélevé une fois sur chaque investissement", color: "bg-red-50 text-red-700" },
              { label: "Commission mentor", value: `${f.commission_mentor}%`, desc: "Versé au mentor qui accompagne le projet", color: "bg-purple-50 text-purple-700" },
              { label: "Fonds de garantie communautaire", value: `${f.commission_guarantee}%`, desc: "Protège les investisseurs en cas de défaut", color: "bg-blue-50 text-blue-700" },
              { label: "Payin mensualités remboursement", value: `${f.payin_repayment||4}%`, desc: "Prélevé sur chaque mensualité — compense frais opérateur", color: "bg-blue-50 text-blue-700" },
              { label: "Récupération Payin investissement", value: `${f.payin_recovery||4}%`, desc: "Prélevé à l'investissement — compense frais dépôt Mobile Money", color: "bg-gray-50 text-gray-700" },
              { label: "Frais retrait Mobile Money", value: `${f.withdrawal_fee_standard||3}%`, desc: "Prélevé uniquement au retrait vers Mobile Money", color: "bg-gray-50 text-gray-700" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-4 rounded-xl border border-gray-100">
                <div>
                  <div className="font-medium text-gray-900 text-sm">{item.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                </div>
                <span className={`font-bold text-lg px-3 py-1 rounded-xl ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Exemple concret */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-5">📊 Exemple concret — 100 000 FCFA investis</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-xl p-4">
              <h3 className="font-bold text-green-800 mb-3">À l&apos;investissement</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Vous investissez</span><span className="font-bold">100 000 FCFA</span></div>
                <div className="flex justify-between"><span className="text-gray-600">BAOBAB {f.commission_baobab_collection}%</span><span className="text-red-600">- {(100000*f.commission_baobab_collection/100).toLocaleString()} FCFA</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Mentor {f.commission_mentor}%</span><span className="text-red-600">- {(100000*f.commission_mentor/100).toLocaleString()} FCFA</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Garantie {f.commission_guarantee}%</span><span className="text-orange-600">- {(100000*f.commission_guarantee/100).toLocaleString()} FCFA</span></div>
                <div className="flex justify-between border-t pt-2 mt-2"><span className="font-bold">Net au projet</span><span className="font-bold text-green-700">{(100000*(1-f.commission_baobab_collection/100-f.commission_mentor/100-f.commission_guarantee/100)).toLocaleString()} FCFA</span></div>
              </div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4">
              <h3 className="font-bold text-blue-800 mb-3">Au remboursement ({f.return_min||22}%)</h3>
              <div className="space-y-2 text-sm">
                {(() => {
                  const gross = Math.round(100000 * (1 + (f.return_min||22)/100));
                  const payinMens = Math.round(gross * (f.payin_repayment||4)/100);
                  const payoutFee = 0;
                  const net = gross - payinMens;
                  return <>
                    <div className="flex justify-between"><span className="text-gray-600">Retour brut {f.return_min||22}%</span><span className="font-bold">{gross.toLocaleString()} FCFA</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Payin mensualités {f.payin_repayment||4}%</span><span className="text-blue-600">- {payinMens.toLocaleString()} FCFA</span></div>
                    <div className="flex justify-between"><span className="text-green-600">0% commission retour BAOBAB</span><span className="text-green-600">0 FCFA</span></div>
                    <div className="flex justify-between border-t pt-2 mt-2"><span className="font-bold">Vous recevez</span><span className="font-bold text-blue-700">{net.toLocaleString()} FCFA</span></div>
                    <div className="flex justify-between"><span className="text-gray-500 text-xs">Gain net</span><span className="text-green-600 font-bold text-xs">+{(net-100000).toLocaleString()} FCFA (+{((net/100000-1)*100).toFixed(1)}%)</span></div>
                  </>;
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Retour minimum */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📈 Taux de retour minimum garanti</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-purple-700">{f.return_min_with_mentor}%</div>
              <div className="font-medium text-purple-800 mt-1">Avec mentor</div>
              <div className="text-xs text-gray-500 mt-1">Projet accompagné par un expert</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-green-700">{f.return_min_no_mentor}%</div>
              <div className="font-medium text-green-800 mt-1">Sans mentor</div>
              <div className="text-xs text-gray-500 mt-1">+{f.return_min_no_mentor - f.return_min_with_mentor}% bonus investisseur</div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-green-700 text-white rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-3">Prêt à investir ?</h2>
          <p className="text-green-100 mb-6">Rejoignez des milliers d&apos;investisseurs africains qui font confiance à BAOBAB INVEST.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/auth/register" className="bg-white text-green-700 font-bold px-6 py-3 rounded-xl hover:bg-green-50">
              Créer un compte
            </Link>
            <Link href="/projects" className="bg-green-600 border border-green-400 text-white font-bold px-6 py-3 rounded-xl hover:bg-green-500">
              Voir les projets
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
