"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authGet, authPost } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  INVESTOR: "🌳 Investisseur",
  ENTREPRENEUR: "🚀 Entrepreneur",
  MENTOR: "🎓 Mentor",
  ADMIN: "🛡️ Admin",
};

const ROLE_COLORS: Record<string, string> = {
  INVESTOR: "bg-green-100 text-green-700",
  ENTREPRENEUR: "bg-blue-100 text-blue-700",
  MENTOR: "bg-purple-100 text-purple-700",
  ADMIN: "bg-red-100 text-red-700",
};

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initUserId = searchParams.get("to");
  const initProjectId = searchParams.get("project");

  const [me, setMe] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeContact, setActiveContact] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout>();

  const getDashboardLink = (role: string) => {
    if (role === "ENTREPRENEUR") return "/entrepreneur";
    if (role === "ADMIN") return "/admin";
    if (role === "MENTOR") return "/mentor";
    return "/dashboard";
  };

  const loadConversations = useCallback(async () => {
    const d = await authGet("/api/messages/conversations");
    if (d.success) setConversations(d.data || []);
  }, []);

  const openConversation = useCallback(async (userId: string, projectId?: string | null) => {
    const url = projectId
      ? `/api/messages/with/${userId}?projectId=${projectId}`
      : `/api/messages/with/${userId}`;
    const data = await authGet(url);
    if (data.success) {
      setActiveContact(data.data.contact);
      setMessages(data.data.messages || []);
      loadConversations();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [loadConversations]);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.push("/auth/login"); return; }
    authGet("/api/auth/me").then(d => { if (d.success) setMe(d.data); });
    loadConversations().finally(() => setLoading(false));
  }, [router, loadConversations]);

  useEffect(() => {
    if (initUserId && !loading) openConversation(initUserId, initProjectId);
  }, [initUserId, loading, initProjectId, openConversation]);

  // Polling toutes les 5 secondes pour les nouveaux messages
  useEffect(() => {
    if (!activeContact) return;
    pollingRef.current = setInterval(async () => {
      const url = initProjectId
        ? `/api/messages/with/${activeContact.id}?projectId=${initProjectId}`
        : `/api/messages/with/${activeContact.id}`;
      const data = await authGet(url);
      if (data.success) {
        setMessages(prev => {
          const newMsgs = data.data.messages || [];
          if (newMsgs.length !== prev.length) {
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
            loadConversations();
          }
          return newMsgs;
        });
      }
    }, 5000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [activeContact, initProjectId, loadConversations]);

  const handleFileUpload = async (file: File) => {
    setUploadingFile(true);
    try {
      const token = localStorage.getItem("accessToken");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/messages/upload-attachment`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) setPendingAttachment(data.data);
    } finally {
      setUploadingFile(false);
    }
  };

  const sendMessage = async () => {
    if ((!newMsg.trim() && !pendingAttachment) || !activeContact || sending) return;
    setSending(true);
    const res = await authPost("/api/messages/send", {
      toUserId: activeContact.id,
      content: newMsg.trim() || (pendingAttachment ? `📎 ${pendingAttachment.name}` : ""),
      projectId: initProjectId || null,
      attachmentUrl: pendingAttachment?.url || null,
      attachmentName: pendingAttachment?.name || null,
      attachmentType: pendingAttachment?.type || null,
    });
    if (res.success) {
      setMessages(m => [...m, res.data]);
      setNewMsg("");
      setPendingAttachment(null);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      loadConversations();
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const getInitials = (user: any) => {
    if (!user) return "?";
    return `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-5xl animate-bounce mb-4">💬</div>
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 flex-shrink-0">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href={me ? getDashboardLink(me.role) : "/"} className="text-gray-400 hover:text-green-600">
            ← Dashboard
          </Link>
          <span className="font-bold text-green-600">💬 Messagerie</span>
          {conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0) > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)} non lu(s)
            </span>
          )}
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-6 flex-1 w-full">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          style={{ height: "calc(100vh - 140px)" }}>
          <div className="flex h-full">

            {/* Sidebar conversations */}
            <div className="w-72 border-r border-gray-100 flex flex-col flex-shrink-0">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">Conversations</h3>
                <p className="text-xs text-gray-400 mt-0.5">{conversations.length} conversation(s)</p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="p-6 text-center text-gray-400">
                    <div className="text-3xl mb-2">💬</div>
                    <p className="text-sm font-medium">Aucune conversation</p>
                    <p className="text-xs mt-1 leading-relaxed">
                      Va sur une fiche projet et clique "Contacter" pour démarrer
                    </p>
                  </div>
                ) : conversations.map((conv: any) => (
                  <div key={conv.contact.id}
                    onClick={() => openConversation(conv.contact.id, conv.projectId)}
                    className={`p-4 border-b border-gray-50 cursor-pointer hover:bg-green-50 transition-colors ${activeContact?.id === conv.contact.id ? "bg-green-50 border-l-4 border-l-green-500" : ""}`}>
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        {conv.contact.profileImageUrl ? (
                          <img src={`${process.env.NEXT_PUBLIC_API_URL}${conv.contact.profileImageUrl}`}
                            alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 text-sm">
                            {getInitials(conv.contact)}
                          </div>
                        )}
                        {conv.unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                            {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium text-sm truncate ${conv.unreadCount > 0 ? "text-gray-900 font-bold" : "text-gray-700"}`}>
                          {conv.contact.firstName} {conv.contact.lastName}
                        </div>
                        <div className="text-xs text-gray-400">{ROLE_LABELS[conv.contact.role]}</div>
                        {conv.lastMessage && (
                          <div className={`text-xs truncate mt-0.5 ${conv.unreadCount > 0 ? "text-gray-700 font-medium" : "text-gray-400"}`}>
                            {conv.lastMessage.attachmentUrl ? "📎 Pièce jointe" : conv.lastMessage.content?.substring(0, 35)}
                          </div>
                        )}
                      </div>
                      {conv.lastMessage && (
                        <div className="text-xs text-gray-300 flex-shrink-0">
                          {new Date(conv.lastMessage.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        </div>
                      )}
                    </div>
                    {conv.project && (
                      <div className="mt-1.5 text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full inline-block border border-green-100">
                        📋 {conv.project.title?.substring(0, 20)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Zone chat */}
            <div className="flex-1 flex flex-col min-w-0">
              {activeContact ? (
                <>
                  {/* Header contact */}
                  <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-white flex-shrink-0">
                    <Link href={`/auth/profile/${activeContact.id}`}
                      className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-1 min-w-0">
                      {activeContact.profileImageUrl ? (
                        <img src={`${process.env.NEXT_PUBLIC_API_URL}${activeContact.profileImageUrl}`}
                          alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 flex-shrink-0">
                          {getInitials(activeContact)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 flex items-center gap-2">
                          {activeContact.firstName} {activeContact.lastName}
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[activeContact.role]}`}>
                            {ROLE_LABELS[activeContact.role]}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          {activeContact.city && <span>📍 {activeContact.city}</span>}
                          {activeContact.reputationScore && <span>⭐ {activeContact.reputationScore}/100</span>}
                          <span className="text-green-500">● En ligne</span>
                        </div>
                      </div>
                    </Link>
                    {initProjectId && (
                      <div className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-200 flex-shrink-0">
                        📋 Lié au projet
                      </div>
                    )}
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {messages.length === 0 && (
                      <div className="text-center py-10 text-gray-400">
                        <div className="text-4xl mb-2">👋</div>
                        <p className="text-sm">Début de la conversation</p>
                        <p className="text-xs mt-1">Envoie ton premier message</p>
                      </div>
                    )}

                    {/* Grouper les messages par date */}
                    {messages.map((msg: any, i: number) => {
                      const isMe = msg.fromUser?.id === me?.id || msg.fromUserId === me?.id;
                      const prevMsg = i > 0 ? messages[i - 1] : null;
                      const prevIsMe = prevMsg ? (prevMsg.fromUser?.id === me?.id || prevMsg.fromUserId === me?.id) : null;
                      const showDate = !prevMsg || new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
                      const isImage = msg.attachmentUrl && ['.jpg','.jpeg','.png','.webp'].some(ext => msg.attachmentUrl.endsWith(ext));

                      return (
                        <div key={msg.id}>
                          {showDate && (
                            <div className="text-center my-2">
                              <span className="text-xs text-gray-400 bg-gray-200 px-3 py-1 rounded-full">
                                {new Date(msg.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                              </span>
                            </div>
                          )}
                          <div className={`flex ${isMe ? "justify-end" : "justify-start"} ${prevMsg && prevIsMe === isMe ? "mt-1" : "mt-3"}`}>
                            {/* Avatar expéditeur */}
                            {!isMe && (!prevMsg || prevIsMe !== isMe) && (
                              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 text-xs flex-shrink-0 mr-2 mt-auto">
                                {getInitials(activeContact)}
                              </div>
                            )}
                            {!isMe && prevMsg && prevIsMe === isMe && <div className="w-8 mr-2 flex-shrink-0" />}

                            <div className={`max-w-xs md:max-w-md flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                              {/* Pièce jointe image */}
                              {msg.attachmentUrl && isImage && (
                                <a href={`${process.env.NEXT_PUBLIC_API_URL}${msg.attachmentUrl}`} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={`${process.env.NEXT_PUBLIC_API_URL}${msg.attachmentUrl}`}
                                    alt="Image"
                                    className="max-w-xs rounded-2xl mb-1 cursor-pointer hover:opacity-90 transition-opacity"
                                    style={{ maxHeight: "200px", objectFit: "cover" }}
                                  />
                                </a>
                              )}

                              {/* Pièce jointe document */}
                              {msg.attachmentUrl && !isImage && (
                                <a href={`${process.env.NEXT_PUBLIC_API_URL}${msg.attachmentUrl}`} target="_blank" rel="noopener noreferrer"
                                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl mb-1 text-sm font-medium border transition-colors ${isMe ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-200" : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"}`}>
                                  <span>📎</span>
                                  <span className="truncate max-w-xs">{msg.attachmentName || "Pièce jointe"}</span>
                                  <span className="text-xs opacity-60">↗</span>
                                </a>
                              )}

                              {/* Texte du message */}
                              {msg.content && !(msg.attachmentUrl && msg.content === `📎 ${msg.attachmentName}`) && (
                                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                  isMe
                                    ? "bg-green-600 text-white rounded-br-sm"
                                    : "bg-white text-gray-900 rounded-bl-sm shadow-sm border border-gray-100"
                                }`}>
                                  {msg.content}
                                </div>
                              )}

                              {/* Timestamp + statut */}
                              {(!prevMsg || prevIsMe !== isMe || i === messages.length - 1) && (
                                <div className="text-xs text-gray-400 mt-1 px-1 flex items-center gap-1">
                                  <span>
                                    {new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                  {isMe && (
                                    <span className={msg.isRead ? "text-green-500" : "text-gray-300"}>
                                      {msg.isRead ? "✓✓" : "✓"}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Zone input */}
                  <div className="p-4 border-t border-gray-100 bg-white flex-shrink-0">
                    {/* Aperçu pièce jointe en attente */}
                    {pendingAttachment && (
                      <div className="mb-3 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-2.5">
                        {pendingAttachment.isImage ? (
                          <img src={`${process.env.NEXT_PUBLIC_API_URL}${pendingAttachment.url}`}
                            alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-xl flex-shrink-0">📎</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{pendingAttachment.name}</div>
                          <div className="text-xs text-gray-400">{(pendingAttachment.size / 1024).toFixed(0)} KB</div>
                        </div>
                        <button onClick={() => setPendingAttachment(null)} className="text-gray-400 hover:text-red-500 text-lg flex-shrink-0">×</button>
                      </div>
                    )}

                    <div className="flex gap-2 items-end">
                      {/* Bouton pièce jointe */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingFile}
                        className="w-10 h-10 flex-shrink-0 bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-600 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50"
                        title="Joindre un fichier"
                      >
                        {uploadingFile ? (
                          <span className="text-xs animate-spin">⏳</span>
                        ) : (
                          <span>📎</span>
                        )}
                      </button>
                      <input ref={fileInputRef} type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
                        className="hidden"
                        onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />

                      {/* Zone texte */}
                      <textarea
                        value={newMsg}
                        onChange={e => setNewMsg(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Écris ton message... (Entrée pour envoyer)"
                        rows={1}
                        style={{ minHeight: "40px", maxHeight: "120px" }}
                        className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />

                      {/* Bouton envoyer */}
                      <button onClick={sendMessage}
                        disabled={(!newMsg.trim() && !pendingAttachment) || sending}
                        className="w-10 h-10 flex-shrink-0 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center justify-center">
                        {sending ? "⏳" : "📤"}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      Entrée pour envoyer · Shift+Entrée pour nouvelle ligne · 📎 Images, PDF acceptés (10MB max)
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center bg-gray-50">
                  <div className="text-center max-w-sm mx-auto px-6">
                    <div className="text-6xl mb-4">💬</div>
                    <h3 className="font-bold text-gray-900 text-lg mb-2">Messagerie BAOBAB INVEST</h3>
                    <p className="text-gray-500 text-sm mb-6">
                      Communique directement avec les entrepreneurs, investisseurs et mentors.
                    </p>
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 text-left space-y-2">
                      <div className="font-semibold mb-1">💡 Comment démarrer ?</div>
                      <div className="text-xs space-y-1.5">
                        <div>📋 Va sur une fiche projet</div>
                        <div>💬 Clique "Contacter l'entrepreneur"</div>
                        <div>📎 Envoie texte, photos ou documents</div>
                        <div>🔔 Notification pour chaque message reçu</div>
                        <div>🔄 Actualisation automatique toutes les 5s</div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-gray-400 bg-gray-100 rounded-xl p-3">
                      ⚠️ Toutes les conversations sont modérées. Aucune transaction en dehors de la plateforme.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
