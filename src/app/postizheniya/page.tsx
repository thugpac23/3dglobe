'use client';

import { useState, useEffect } from 'react';
import { UserProgress, UserType, USER_COLOR } from '@/types';
import { ACHIEVEMENTS } from '@/lib/xp';
import { fetchProgress } from '@/lib/api';
import { sounds, resumeAudio } from '@/lib/sounds';
import UserCard from '@/components/XPBar/XPBar';

export default function PostizheniyaPage() {
  const [progress, setProgress] = useState<{ tati: UserProgress; iva: UserProgress } | null>(null);
  const [activeUser, setActiveUser] = useState<UserType>('tati');

  useEffect(() => {
    fetchProgress().then(setProgress).catch(() => {});
  }, []);

  if (!progress) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400 text-sm">Зареждане…</div>
      </main>
    );
  }

  const p = progress[activeUser];
  const unlocked = new Set<string>(p.achievements);

  return (
    <main className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-extrabold text-slate-800 mb-1">🏅 Постижения</h1>
      <p className="text-slate-500 text-sm mb-5">Отключи награди за пътешестване</p>

      {/* User tabs */}
      <div className="flex gap-2 mb-6">
        {(['tati', 'iva'] as UserType[]).map(u => (
          <UserCard
            key={u}
            user={u}
            isActive={activeUser === u}
            onClick={() => { resumeAudio(); sounds.click(); setActiveUser(u); }}
          />
        ))}
      </div>

      {/* Achievements grid */}
      <h2 className="text-base font-bold text-slate-700 mb-3">
        Значки ({unlocked.size} / {ACHIEVEMENTS.length})
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ACHIEVEMENTS.map(a => {
          const done = unlocked.has(a.id);
          return (
            <div
              key={a.id}
              className="flex items-center gap-4 p-4 rounded-2xl transition-all"
              style={{
                background: done ? `${USER_COLOR[activeUser]}14` : '#F8FAFC',
                border: `1.5px solid ${done ? USER_COLOR[activeUser] + '44' : '#E2E8F0'}`,
                opacity: done ? 1 : 0.55,
              }}
            >
              <span className="text-3xl" style={{ filter: done ? 'none' : 'grayscale(1)' }}>
                {a.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800 text-sm">{a.title}</div>
                <div className="text-xs text-slate-500">{a.desc}</div>
                <div className="text-xs font-semibold mt-0.5" style={{ color: USER_COLOR[activeUser] }}>
                  +{a.xp} XP
                </div>
              </div>
              {done && (
                <span className="text-emerald-500 text-xl">✓</span>
              )}
            </div>
          );
        })}
      </div>

    </main>
  );
}
