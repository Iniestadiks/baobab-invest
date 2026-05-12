"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { authGet, authPost } from "@/lib/api";

const REACTIONS = [
  { type: "TRUST", emoji: "🤝", label: "Confiance", field: "trustCount" },
  { type: "BRAVO", emoji: "👏", label: "Bravo", field: "bravoCount" },
  { type: "WORRY", emoji: "😟", label: "Inquiétude", field: "worryCount" },
];

export default function FeedPage() {
  const { projectId } = useParams();
  const router = useRouter();
  const [posts, setPosts] = useState<any[]>([]);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const user = localStorage.getItem("user");
    if (!token || !user) { router.push("/auth/login"); return; }
    const u = JSON.parse(user);
    setUserRole(u.role);

    Promise.all([
      authGet(`/api/feed/project/${projectId}`),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects/${projectId}`).then(r => r.json()),
    ]).then(([feedData, projData]) => {
      if (feedData.success) setPosts(feedData.data || []);
      else setError(feedData.message);
      if (projData.success) setProject(projData.data);
    }).finally(() => setLoading(false));
  }, [projectId, router]);

  const react = async (postId: string, type: string) => {
    const data = await authPost(`/api/feed/post/${postId}/react`, { type });
    if (data.success) {
      const feedData = await authGet(`/api/feed/project/${projectId}`);
      if (feedData.success) setPosts(feedData.data || []);
    }
  };

  const publishPost = async () => {
    if (!newPost.trim() || newPost.length < 20) return;
    setPosting(true);
    try {
      const data = await authPost(`/api/feed/project/${projectId}`, { content: newPost });
      if (data.success) {
        setNewPost("");
        const feedData = await authGet(`/api/feed/project/${projectId}`);
        if (feedData.success) setPosts(feedData.data || []);
      }
    } finally { setPosting(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="text-5xl animate-bounce mb-4">📸</div><p className="text-gray-500">Chargement du feed...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/investments" className="text-gray-400 hover:text-green-600">← Mes investissements</Link>
          <span className="font-bold text-green-600 truncate">{project?.title || "Feed projet"}</span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header projet */}
        {project && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl">🌾</div>
              <div>
                <div className="font-bold text-gray-900">{project.title}</div>
                <div className="text-sm text-gray-500">
                  Par {project.entrepreneur?.firstName} {project.entrepreneur?.lastName}
                </div>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
              <div className="bg-green-500 h-2 rounded-full"
                style={{ width: `${Math.min(Math.round(project.raisedAmount/project.goalAmount*100), 100)}%` }} />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>{project.raisedAmount?.toLocaleString()} FCFA levés</span>
              <span>{Math.round(project.raisedAmount/project.goalAmount*100)}% financé</span>
            </div>
          </div>
        )}

        {/* Formulaire publication (entrepreneur seulement) */}
        {userRole === "ENTREPRENEUR" && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
            <h3 className="font-bold text-gray-900 mb-3">📸 Publier une mise à jour</h3>
            <textarea
              value={newPost}
              onChange={e => setNewPost(e.target.value)}
              placeholder="Partage l'avancement de ton projet... (photos des achats, vidéo du chantier, captures de factures) — minimum 20 caractères"
              rows={4}
              className="input-field resize-none mb-3"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{newPost.length}/20 min</span>
              <button onClick={publishPost} disabled={posting || newPost.length < 20}
                className="btn-primary text-sm py-2 px-5">
                {posting ? "Publication..." : "Publier 📤"}
              </button>
            </div>
          </div>
        )}

        {/* Erreur accès */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center mb-6">
            <div className="text-4xl mb-3">🔒</div>
            <h3 className="font-bold text-red-800 mb-2">Accès restreint</h3>
            <p className="text-red-600 text-sm">{error}</p>
            <p className="text-gray-500 text-xs mt-2">Ce feed est réservé aux investisseurs de ce projet.</p>
            <Link href={`/projects/${projectId}`} className="btn-primary inline-flex mt-4 text-sm py-2">
              Investir dans ce projet →
            </Link>
          </div>
        )}

        {/* Posts */}
        {!error && (
          <div className="space-y-4">
            {posts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <div className="text-5xl mb-3">📭</div>
                <h3 className="font-bold text-gray-900 mb-2">Aucune mise à jour pour l'instant</h3>
                <p className="text-gray-500 text-sm">
                  L'entrepreneur publiera bientôt des preuves d'avancement (photos, vidéos, factures).
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  ⚠️ Une alerte automatique est déclenchée si aucun post n'est publié depuis 21 jours.
                </p>
              </div>
            ) : (
              posts.map((post: any) => (
                <div key={post.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 text-sm flex-shrink-0">
                      {post.author?.firstName?.[0]}{post.author?.lastName?.[0]}
                    </div>
                    <div>
                      <div className="font-medium text-sm text-gray-900">
                        {post.author?.firstName} {post.author?.lastName}
                        {post.author?.role === "ENTREPRENEUR" && (
                          <span className="ml-2 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Entrepreneur</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(post.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-700 text-sm leading-relaxed mb-4 whitespace-pre-line">{post.content}</p>

                  {post.mediaUrls?.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {post.mediaUrls.map((url: string, i: number) => (
                        <img key={i} src={url} alt="Media" className="w-full h-32 object-cover rounded-xl" />
                      ))}
                    </div>
                  )}

                  {/* Réactions */}
                  {userRole !== "ENTREPRENEUR" && (
                    <div className="flex gap-3 pt-3 border-t border-gray-50">
                      {REACTIONS.map(r => {
                        const myReaction = post.reactions?.[0]?.type === r.type;
                        return (
                          <button key={r.type} onClick={() => react(post.id, r.type)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                              myReaction ? "bg-green-100 text-green-700 border border-green-200" : "bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-100"}`}>
                            <span>{r.emoji}</span>
                            <span>{r.label}</span>
                            <span className="font-bold">{post[r.field] || 0}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
