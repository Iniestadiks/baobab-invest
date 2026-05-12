"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authGet, authPost, authPatch } from "@/lib/api";

const DAYS = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
const AMOUNTS = [500, 1000, 2000, 5000, 10000, 25000];

export default function SavingsPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ amount: "", dayOfWeek: "5", projectId: "" });

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/auth/login"); return; }
    Promise.all([
      authGet("/api/investments/savings-plans"),
      authGet("/api/investments/my"),
    ]).then(([plans, inv]) => {
      if (plans.success) setPlans(plans.data || []);
      if (inv.success) {
        const uniqueProjects = inv.data.investments?.map((i: any) => i.project).filter(Boolean) || [];
        setProjects(uniqueProjects);
      }
    }).finally(() => setLoading(false));
  }, [router]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };

  const createPlan = async () => {
    if (!form.amount || Number(form.amount) < 500) { flash("❌ Montant minimum 500 FCFA"); return; }
    const res = await authPost("/api/investments/savings-plan", {
      amount: Number(form.amount),
      dayOfWeek: Number(form.dayOfWeek),
      projectId: form.projectId || null,
    });
    if (res.success) {
      flash("✅ Plan d'épargne activé !");
      setShowCreate(false);
      const updated = await authGet("/api/investments/savings-plans");
      if (updated.success) setPlans(updated.data || []);
    } else flash("❌ " + res.message);
  };

  const togglePlan = async (id: string) => {
    const res = await authPatch(`/api/investments/savings-plan/${id}/toggle`, {});
    if (res.success) {
      const updated = await authGet("/api/investments/savings-plans");
      if (updated.success) setPlans(updated.data || []);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="text-5xl animate-bounce mb-4">💰</div><p className="text-gray-500">Chargement...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-400 hover:text-green-600">← Dashboard</Link>
          <span className="font-bold text-green-600">💰 Épargne Programmée</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {msg && (
          <div className={`p-3 rounded-xl text-sm font-medium text-center mb-6 ${msg.startsWith("✅") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {msg}
          </div>
        )}

        {/* Explication */}
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6">
          <h2 className="font-bold text-green-900 text-lg mb-2">🌱 Investis automatiquement</h2>
          <p className="text-green-700 text-sm mb-4">
            Programme un investissement automatique hebdomadaire dès 500 FCFA.
            Comme Fatou qui met 1 000 FCFA chaque vendredi — en 6 mois elle avait investi dans 3 projets !
          </p>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            {[
              { icon: "📅", label: "Tu choisis le jour", desc: "Lundi, vendredi, etc." },
              { icon: "💳", text: "Débité de ton wallet", label: "Automatique", desc: "Depuis ton solde" },
              { icon: "📈", label: "Investi dans un projet", desc: "Ou réparti automatiquement" },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-xl p-3">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="font-semibold text-gray-900 text-xs">{s.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bouton créer */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-gray-900">Mes Plans d'Épargne ({plans.length})</h3>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary text-sm py-2">
            + Nouveau plan
          </button>
        </div>

        {/* Formulaire création */}
        {showCreate && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
            <h4 className="font-bold text-gray-900 mb-4">Créer un plan d'épargne</h4>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">Montant (FCFA) *</label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {AMOUNTS.map(a => (
                    <button key={a} type="button" onClick={() => setForm(f => ({ ...f, amount: String(a) }))}
                      className={`p-2.5 rounded-xl border-2 text-sm font-bold transition-all ${form.amount === String(a) ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:border-green-200"}`}>
                      {a.toLocaleString()} FCFA
                    </button>
                  ))}
                </div>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="Ou saisir un montant (min 500 FCFA)" className="input-field text-sm" min="500" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">Jour de prélèvement *</label>
                <div className="grid grid-cols-4 gap-2">
                  {DAYS.map((d, i) => (
                    <button key={i} type="button" onClick={() => setForm(f => ({ ...f, dayOfWeek: String(i) }))}
                      className={`p-2 rounded-xl border-2 text-xs font-medium transition-all ${form.dayOfWeek === String(i) ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:border-green-200"}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Projet cible (optionnel)</label>
                <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} className="input-field text-sm">
                  <option value="">Répartir automatiquement sur les meilleurs projets</option>
                  {projects.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              {form.amount && Number(form.amount) >= 500 && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700">
                  📊 Projection : En investissant {Number(form.amount).toLocaleString()} FCFA chaque {DAYS[Number(form.dayOfWeek)]},
                  tu investis <strong>{(Number(form.amount) * 52).toLocaleString()} FCFA par an</strong>.
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Annuler</button>
                <button onClick={createPlan} className="btn-primary flex-1">✅ Activer le plan</button>
              </div>
            </div>
          </div>
        )}

        {/* Liste des plans */}
        {plans.length === 0 && !showCreate ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-5xl mb-4">🌱</div>
            <h3 className="font-bold text-gray-900 text-lg mb-2">Aucun plan d'épargne</h3>
            <p className="text-gray-500 mb-6">Commence à épargner automatiquement dès 500 FCFA par semaine !</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex">
              Créer mon premier plan →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map((plan: any) => (
              <div key={plan.id} className={`bg-white rounded-2xl border p-5 shadow-sm ${plan.isActive ? "border-green-200" : "border-gray-100 opacity-60"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${plan.isActive ? "bg-green-100" : "bg-gray-100"}`}>
                      {plan.isActive ? "💰" : "⏸️"}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-lg">
                        {Number(plan.amount).toLocaleString()} FCFA
                      </div>
                      <div className="text-sm text-gray-500">
                        Chaque {DAYS[plan.dayOfWeek]} · {plan.frequency === "WEEKLY" ? "Hebdomadaire" : "Mensuel"}
                      </div>
                      {plan.project && (
                        <div className="text-xs text-green-600 mt-1">📋 → {plan.project.title}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-xs font-bold px-2 py-1 rounded-full mb-2 ${plan.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {plan.isActive ? "✅ Actif" : "⏸️ Suspendu"}
                    </div>
                    <button onClick={() => togglePlan(plan.id)}
                      className={`text-xs font-medium ${plan.isActive ? "text-red-500 hover:underline" : "text-green-600 hover:underline"}`}>
                      {plan.isActive ? "Suspendre" : "Réactiver"}
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="font-bold text-gray-900">{plan.totalExecutions}</div>
                    <div className="text-xs text-gray-400">Exécutions</div>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3">
                    <div className="font-bold text-green-700">{Number(plan.totalInvested).toLocaleString()} FCFA</div>
                    <div className="text-xs text-gray-400">Total investi</div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3">
                    <div className="font-bold text-blue-700 text-xs">
                      {plan.nextExecutionAt ? new Date(plan.nextExecutionAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—"}
                    </div>
                    <div className="text-xs text-gray-400">Prochaine exéc.</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
