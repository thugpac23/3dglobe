'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { UserProfile } from '@/types';
import { fetchUsers } from '@/lib/api';
import { sounds, resumeAudio } from '@/lib/sounds';
import QuizGame          from './games/QuizGame';
import SuitcaseGame      from './games/SuitcaseGame';
import RandomFactGame    from './games/RandomFactGame';

const CountryShapeGame = dynamic(() => import('./games/CountryShapeGame'), {
  ssr: false,
  loading: () => <div className="text-center py-10 text-slate-400 text-sm">Зареждане…</div>,
});

type GameMode = 'quiz' | 'shape' | 'suitcase' | 'fact';

const MODES: { id: GameMode; emoji: string; label: string }[] = [
  { id: 'quiz',     emoji: '🎮', label: 'Викторина' },
  { id: 'shape',    emoji: '🗺️', label: 'Познай държавата' },
  { id: 'suitcase', emoji: '🧳', label: 'Куфар' },
  { id: 'fact',     emoji: '🎲', label: 'Произволен факт' },
];

export default function IgraPage() {
  const [users, setUsers]     = useState<UserProfile[]>([]);
  const [activeUser, setActiveUser] = useState<UserProfile | null>(null);
  const [mode, setMode]             = useState<GameMode>('quiz');

  useEffect(() => {
    fetchUsers().then(u => { setUsers(u); setActiveUser(u[0] ?? null); }).catch(() => {});
  }, []);

  const color = activeUser?.color ?? '#64748b';

  return (
    <main className="min-h-screen px-4 py-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-extrabold text-slate-800 mb-1">🎮 Игри</h1>
      <p className="text-slate-500 text-sm mb-5">Викторини · Държави · Куфар · Факти</p>

      {/* User tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {users.map(u => (
          <button
            key={u.id}
            onClick={() => { resumeAudio(); sounds.click(); setActiveUser(u); }}
            className="px-5 py-2 rounded-full font-bold text-sm transition-all"
            style={{
              background: activeUser?.id === u.id ? u.color : 'white',
              color: activeUser?.id === u.id ? 'white' : '#64748b',
              border: `2px solid ${activeUser?.id === u.id ? u.color : '#E2E8F0'}`,
              boxShadow: activeUser?.id === u.id ? `0 4px 16px ${u.color}40` : '0 1px 4px rgba(0,0,0,0.08)',
            }}
          >
            {u.displayName}
          </button>
        ))}
      </div>

      {/* Game mode tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {MODES.map(m => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => { resumeAudio(); sounds.click(); setMode(m.id); }}
              className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl text-xs font-bold transition-all"
              style={{
                background: active ? color : 'white',
                color: active ? 'white' : '#64748b',
                border: `2px solid ${active ? color : '#E2E8F0'}`,
                boxShadow: active ? `0 3px 10px ${color}30` : '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <span className="text-xl leading-none">{m.emoji}</span>
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active game */}
      {activeUser && mode === 'quiz'     && <QuizGame         activeUser={activeUser.id} />}
      {activeUser && mode === 'shape'    && <CountryShapeGame activeUser={activeUser.id} />}
      {activeUser && mode === 'suitcase' && <SuitcaseGame     activeUser={activeUser.id} />}
      {activeUser && mode === 'fact'     && <RandomFactGame   activeUser={activeUser.id} />}
    </main>
  );
}
