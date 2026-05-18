"use client";
import { useEffect, useState } from "react";
import { authGet } from "@/lib/api";

function fmt(n: number) { return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

const LEVEL_COLORS: Record<number, string> = {
  1: "from-gray-400 to-gray-600",
  2: "from-green-400 to-green-600",
  3: "from-blue-400 to-blue-600",
  4: "from-purple-400 to-purple-600",
  5: "from-yellow-400 to-yellow-600",
};

export function ReputationWidget() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    authGet("/api/reputation/me").then((r: any) => { if (r.success) setData(r.data); });
  }, []);

  if (!data) return null;

  const { reputationPoints, levelInfo, badges, events } = data;
  const prevLevelPts = levelInfo.level === 1 ? 0 : levelInfo.level === 2 ? 100 : levelInfo.level === 3 ? 300 : levelInfo.level === 4 ? 600 : 1000;
  const progress = levelInfo.level === 5 ? 100 : Math.round(((reputationPoints - prevLevelPts) / (levelInfo.nextLevelPoints - prevLevelPts)) * 100);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      <h3 className="font-bold text-gray-900 text-sm">⭐ Ma Réputation</h3>

      {/* Niveau actuel */}
      <div className={`bg-gradient-to-br ${LEVEL_COLORS[levelInfo.level]} rounded-2xl p-4 text-white`}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs text-white/70">Niveau {levelInfo.level}</div>
            <div className="text-lg font-bold">{levelInfo.icon} {levelInfo.label}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{reputationPoints}</div>
            <div className="text-xs text-white/70">points</div>
          </div>
        </div>
        {levelInfo.level < 5 && (
          <div>
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>{progress}% vers niveau {levelInfo.level + 1}</span>
              <span>{levelInfo.nextLevelPoints - reputationPoints} pts restants</span>
            </div>
            <div className="bg-white/20 rounded-full h-2">
              <div className="bg-white h-2 rounded-full transition-all" style={{width: progress + "%"}} />
            </div>
          </div>
        )}
      </div>

      {/* Badges */}
      {badges && badges.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 mb-2">Mes badges ({badges.length})</div>
          <div className="flex flex-wrap gap-2">
            {badges.map((b: any) => (
              <div key={b.badge} title={b.label}
                className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-gray-700 flex items-center gap-1 hover:bg-yellow-50 hover:border-yellow-200 transition-colors cursor-default">
                <span className="text-base">{b.icon}</span>
                <span className="hidden sm:block">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Derniers événements */}
      {events && events.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 mb-2">Historique récent</div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {events.slice(0, 5).map((e: any) => (
              <div key={e.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-600 truncate">{e.description}</span>
                <span className={`font-bold flex-shrink-0 ml-2 ${e.points > 0 ? "text-green-600" : "text-red-500"}`}>
                  {e.points > 0 ? "+" : ""}{e.points} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Widget mini pour les héros
export function ReputationBadgeMini({ userId }: { userId?: string }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (userId) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reputation/user/${userId}`)
        .then(r => r.json()).then(d => { if (d.success) setData(d.data); });
    } else {
      authGet("/api/reputation/me").then((r: any) => { if (r.success) setData(r.data); });
    }
  }, [userId]);

  if (!data) return null;
  const levelInfo = data.levelInfo;

  return (
    <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
      {levelInfo?.icon} {levelInfo?.label}
    </span>
  );
}
