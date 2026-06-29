"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { authGet, authPost } from "@/lib/api";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  PENDING:   { label: "En attente",  color: "text-gray-600",   bg: "bg-gray-100",   icon: "⏳" },
  SUBMITTED: { label: "Soumis",      color: "text-blue-700",   bg: "bg-blue-100",   icon: "📋" },
  APPROVED:  { label: "Approuvé",    color: "text-green-700",  bg: "bg-green-100",  icon: "✅" },
  REJECTED:  { label: "Rejeté",      color: "text-red-700",    bg: "bg-red-100",    icon: "❌" },
  PAID:      { label: "Payé",        color: "text-purple-700", bg: "bg-purple-100", icon: "💰" },
};

export default function MilestonesPage() {
  const { projectId } = useParams();
  const router = useRouter();
  const [milestones, setMilestones] = useState<any[]>([]);
  const [project, setProject] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newMilestones, setNewMilestones] = useState([{ title: "", description: "", amount: "", dueDate: "" }]);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [budget, setBudget] = useState<any>(null);
  const [investors, setInvestors] = useState<any[]>([]);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [requestForm, setRequestForm] = useState({ invoiceUrl: "", supplierId: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const stored = localStorage.getItem("user");
    if (!token || !stored) { router.push("/auth/login"); return; }

    const u = JSON.parse(stored);

    // ✅ Vérification du rôle — seuls ENTREPRENEUR et ADMIN peuvent accéder
    if (u.role !== "ENTREPRENEUR" && u.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }

    Promise.all([
      authGet(`/api/milestones/project/${projectId}`),
      authGet(`/api/projects/${projectId}`),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/suppliers`).then(r => r.json()),
      authGet(`/api/milestones/project/${projectId}/budget`),
    ]).then(([m, p, s, b]) => {
      if (m.success) setMilestones(m.data || []);
      if (p.success) {
        // Vérifier que l'entrepreneur est bien le propriétaire du projet
        if (u.role === "ENTREPRENEUR" && p.data.entrepreneurId !== u.id) {
          router.push("/entrepreneur");
          return;
        }
        setProject(p.data || p);
      }
      if (s.success) setSuppliers(s.data || []);
      if (b?.success) {
        setBudget(b.data);
        setInvestors(b.data?.investors || []);
      }
    }).finally(() => setLoading(false));
  }, [projectId, router]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };

  const createMilestones = async () => {
    const data = newMilestones.filter(m => m.title && m.description && m.amount);
    if (data.length === 0) { flash("❌ Remplis au moins un jalon complet"); return; }
    const res = await authPost(`/api/milestones/project/${projectId}`, {
      milestones: data.map(m => ({ ...m, amount: Number(m.amount) }))
    });
    if (res.success) {
      flash("✅ Jalons créés !");
      setShowCreate(false);
      const m = await authGet(`/api/milestones/project/${projectId}`);
      if (m.success) setMilestones(m.data || []);
    } else { flash("❌ " + res.message); }
  };

  const submitRequest = async (milestoneId: string) => {
    const res = await authPost(`/api/milestones/${milestoneId}/request`, requestForm);
    if (res.success) {
      flash("✅ Demande soumise — validation sous 48h ouvrées");
      setRequesting(null);
      const m = await authGet(`/api/milestones/project/${projectId}`);
      if (m.success) setMilestones(m.data || []);
    } else { flash("❌ " + res.message); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="text-5xl animate-bounce mb-4">🏗️</div><p className="text-gray-500">Chargement...</p></div>
    </div>
  );

  const totalMilestones = milestones.reduce((s, m) => s + m.amount, 0);
  const totalPaid = milestones.filter(m => ["APPROVED","PAID"].includes(m.status)).reduce((s, m) => s + m.amount, 0);
  // Budget basé sur jalons validés (APPROVED/PAID) — pas sur jalons créés
  const raisedAmount = budget?.raisedAmount || project?.raisedAmount || 0;
  const totalApprouve = milestones.filter(m => ["APPROVED","PAID"].includes(m.status)).reduce((s, m) => s + m.amount, 0);
  // Budget restant = levé - jalons déjà validés (APPROVED/PAID seulement)
  // Les jalons en attente (PENDING/SUBMITTED) ne bloquent pas la création
  const budgetRestant = Math.max(raisedAmount - totalApprouve, 0);
  const canAddMilestone = budgetRestant > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/dashboard/redirect" className="text-gray-400 hover:text-green-600">← Dashboard</Link>
          <span className="font-bold text-green-600">Gestion des Jalons</span>
          <span className="ml-auto text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-medium">
            🚀 Espace Entrepreneur
          </span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {msg && (
          <div className={`p-3 rounded-xl text-sm font-medium text-center mb-6 ${msg.startsWith("✅") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {msg}
          </div>
        )}

        {project && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
            <h2 className="font-bold text-gray-900 text-lg mb-1">{project.title}</h2>
            <div className="text-sm text-gray-500 mb-4">
              Objectif : {project.goalAmount?.toLocaleString()} FCFA · Levé : {project.raisedAmount?.toLocaleString()} FCFA
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="font-bold text-gray-900">{milestones.length}</div>
                <div className="text-xs text-gray-400">Jalons créés</div>
              </div>
              <div className="bg-green-50 rounded-xl p-3">
                <div className="font-bold text-green-700">{totalPaid.toLocaleString()} FCFA</div>
                <div className="text-xs text-gray-400">Débloqué</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="font-bold text-blue-700">{(project.raisedAmount - totalPaid).toLocaleString()} FCFA</div>
                <div className="text-xs text-gray-400">Disponible</div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6">
          <div className="font-semibold text-yellow-800 mb-1">⚠️ Règle KORAPACT — Paiement direct fournisseur</div>
          <p className="text-sm text-yellow-700">
            Tu ne reçois <strong>jamais de cash direct</strong>. Les fonds sont payés directement 
            au fournisseur pré-enregistré après validation admin (48h ouvrées). 
            Fournis une facture pro forma comme justificatif.
          </p>
        </div>

        {!showCreate && canAddMilestone && (
          <button onClick={() => setShowCreate(true)} className="btn-primary w-full mb-6 py-4">
            + Ajouter un jalon
          </button>
        )}

        {!showCreate && !canAddMilestone && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <div className="text-2xl mb-1">✅</div>
            <p className="text-sm font-medium text-green-800">Budget entièrement alloué</p>
            <p className="text-xs text-green-600 mt-1">Tous les fonds levés ont été attribués aux jalons</p>
          </div>
        )}

        {showCreate && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
            <h3 className="font-bold text-gray-900 mb-2">📋 Créer les jalons</h3>
            {budget && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3 text-sm">
                <span className="text-blue-700 font-medium">💰 Budget disponible : </span>
                <span className="font-bold text-blue-900">{budgetRestant.toLocaleString()} FCFA</span>
              </div>
            )}
            <p className="text-sm text-gray-500 mb-4">
              Divise ton financement en étapes claires. Chaque jalon = un paiement direct à un fournisseur vérifié.
            </p>
            {newMilestones.map((m, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-4 mb-3">
                <div className="font-semibold text-sm text-gray-700 mb-3">Jalon {i + 1}</div>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Titre *</label>
                    <input value={m.title} onChange={e => {
                      const u = [...newMilestones]; u[i].title = e.target.value; setNewMilestones(u);
                    }} placeholder="Ex: Achat équipements" className="input-field text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Montant FCFA *</label>
                    <input type="number" value={m.amount} onChange={e => {
                      const u = [...newMilestones]; u[i].amount = e.target.value; setNewMilestones(u);
                    }} placeholder="150000" className="input-field text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Description *</label>
                  <input value={m.description} onChange={e => {
                    const u = [...newMilestones]; u[i].description = e.target.value; setNewMilestones(u);
                  }} placeholder="Détaille ce que tu vas acheter avec ce montant" className="input-field text-sm" />
                </div>
              </div>
            ))}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setNewMilestones([...newMilestones, { title: "", description: "", amount: "", dueDate: "" }])}
                className="btn-secondary text-sm flex-1">+ Ajouter un jalon</button>
              <button onClick={createMilestones} className="btn-primary text-sm flex-1">✅ Enregistrer</button>
            </div>
          </div>
        )}

        {milestones.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900">Mes Jalons ({milestones.length})</h3>
            {milestones.map((m: any) => {
              const s = STATUS_CONFIG[m.status] || STATUS_CONFIG.PENDING;
              return (
                <div key={m.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${s.bg}`}>
                        {s.icon}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">{m.title}</div>
                        <div className="text-sm text-gray-500">{m.description}</div>
                        {m.adminNote && (
                          <div className="text-xs text-blue-600 mt-1 bg-blue-50 px-2 py-1 rounded-lg inline-block">
                            💬 Note admin : {m.adminNote}
                          </div>
                        )}
                        {m.payments?.length > 0 && (
                          <div className="text-xs text-purple-600 mt-1 bg-purple-50 px-2 py-1 rounded-lg inline-block">
                            💳 Payé à : {m.payments[0]?.supplier?.companyName}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-green-700 text-lg">{m.amount.toLocaleString()} FCFA</div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.color}`}>{s.label}</span>
                    </div>
                  </div>

                  {m.status === "PENDING" && (
                    <div className="border-t border-gray-50 pt-3">
                      {requesting === m.id ? (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-600 mb-1 block">
                              URL Facture / Devis Pro Forma
                            </label>
                            <input value={requestForm.invoiceUrl}
                              onChange={e => setRequestForm(f => ({ ...f, invoiceUrl: e.target.value }))}
                              placeholder="https://drive.google.com/votre-facture..." className="input-field text-sm" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 mb-1 block">
                              Fournisseur pré-enregistré (paiement direct)
                            </label>
                            {suppliers.length === 0 ? (
                              <div className="text-xs text-yellow-700 bg-yellow-50 p-3 rounded-xl">
                                Aucun fournisseur vérifié disponible.{" "}
                                <Link href="/suppliers/register" className="underline font-medium">
                                  Enregistrer un fournisseur →
                                </Link>
                              </div>
                            ) : (
                              <select value={requestForm.supplierId}
                                onChange={e => setRequestForm(f => ({ ...f, supplierId: e.target.value }))}
                                className="input-field text-sm">
                                <option value="">Choisir un fournisseur vérifié...</option>
                                {suppliers.map((s: any) => (
                                  <option key={s.id} value={s.id}>
                                    {s.companyName} — {s.mobileMoneyProvider} : {s.mobileMoneyNumber}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setRequesting(null)} className="btn-secondary text-sm flex-1 py-2">
                              Annuler
                            </button>
                            <button onClick={() => submitRequest(m.id)} className="btn-primary text-sm flex-1 py-2">
                              Soumettre →
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setRequesting(m.id); setRequestForm({ invoiceUrl: "", supplierId: "" }); }}
                          className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors border border-blue-200">
                          📋 Demander le déblocage de ce jalon
                        </button>
                      )}
                    </div>
                  )}

                  {m.status === "SUBMITTED" && (
                    <div className="border-t border-gray-50 pt-3">
                      <div className="bg-blue-50 text-blue-700 text-sm p-3 rounded-xl text-center">
                        ⏳ Demande en cours de validation par l'admin — délai : 48h ouvrées
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
