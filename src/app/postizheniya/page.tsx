'use client';

import { useState, useEffect } from 'react';
import { UserProgress, UserType, USER_COLOR, USER_DISPLAY } from '@/types';
import { ACHIEVEMENTS, LEVEL_TITLES, xpProgress, getLevelTitle } from '@/lib/xp';
import { fetchProgress } from '@/lib/api';
import { sounds, resumeAudio } from '@/lib/sounds';

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
  const { current, needed, pct } = xpProgress(p.xp, p.level);
  const unlocked = new Set<string>(p.achievements);

  return (
    <main className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-extrabold text-slate-800 mb-1">🏅 Постижения</h1>
      <p className="text-slate-500 text-sm mb-5">Отключи награди за пътешестване</p>

      {/* User tabs */}
      <div className="flex gap-2 mb-6">
        {(['tati', 'iva'] as UserType[]).map(u => (
          <button
            key={u}
            onClick={() => { resumeAudio(); sounds.click(); setActiveUser(u); }}
            className="px-5 py-2 rounded-full font-bold text-sm transition-all"
            style={{
              background: activeUser === u ? USER_COLOR[u] : 'white',
              color: activeUser === u ? 'white' : '#64748b',
              border: `2px solid ${activeUser === u ? USER_COLOR[u] : '#E2E8F0'}`,
              boxShadow: activeUser === u ? `0 4px 16px ${USER_COLOR[u]}40` : '0 1px 4px rgba(0,0,0,0.08)',
            }}
          >
            {USER_DISPLAY[u]}
          </button>
        ))}
      </div>

      {/* Level card */}
      <div
        className="rounded-2xl p-5 mb-6 shadow-md"
        style={{ background: `linear-gradient(135deg, ${USER_COLOR[activeUser]}22, ${USER_COLOR[activeUser]}08)`, border: `1.5px solid ${USER_COLOR[activeUser]}30` }}
      >
        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg"
            style={{ background: USER_COLOR[activeUser] }}
          >
            {p.level}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ниво {p.level}</div>
            <div className="font-bold text-slate-800 text-lg">{getLevelTitle(p.level)}</div>
            <div className="text-xs text-slate-500">{p.xp} XP общо</div>
          </div>
        </div>
        {p.level < 5 && (
          <>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Прогрес към ниво {p.level + 1}</span>
              <span>{current} / {needed} XP</span>
            </div>
            <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: USER_COLOR[activeUser] }}
              />
            </div>
          </>
        )}
        {p.level >= 5 && (
          <div className="text-center text-sm font-bold text-emerald-600">🎉 Максимално ниво!</div>
        )}
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

      {/* Level titles reference */}
      <div className="mt-8">
        <h2 className="text-base font-bold text-slate-700 mb-3">Нива</h2>
        <div className="space-y-2">
          {LEVEL_TITLES.map((title, i) => {
            const lvl = i + 1;
            const isCurrentOrPast = p.level >= lvl;
            return (
              <div
                key={lvl}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                style={{
                  background: p.level === lvl ? `${USER_COLOR[activeUser]}18` : '#F8FAFC',
                  border: `1.5px solid ${p.level === lvl ? USER_COLOR[activeUser] + '44' : '#E2E8F0'}`,
                  opacity: isCurrentOrPast ? 1 : 0.5,
                }}
              >
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white"
                  style={{ background: isCurrentOrPast ? USER_COLOR[activeUser] : '#CBD5E1' }}
                >
                  {lvl}
                </span>
                <span className="text-sm font-semibold text-slate-700">{title}</span>
                {p.level === lvl && <span className="ml-auto text-xs font-bold" style={{ color: USER_COLOR[activeUser] }}>← Сега</span>}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
