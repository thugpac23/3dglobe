'use client';

import { useState, useEffect } from 'react';
import { Visit, UserType, USER_COLOR, USER_DISPLAY } from '@/types';
import { fetchVisits } from '@/lib/api';
import { sounds, resumeAudio } from '@/lib/sounds';

const COUNTRY_EMOJI: Record<string, string> = {
  BG: '🇧🇬', DE: '🇩🇪', FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸', GR: '🇬🇷',
  TR: '🇹🇷', HR: '🇭🇷', AT: '🇦🇹', CH: '🇨🇭', NL: '🇳🇱', BE: '🇧🇪',
  PL: '🇵🇱', CZ: '🇨🇿', SK: '🇸🇰', HU: '🇭🇺', RO: '🇷🇴', RS: '🇷🇸',
  US: '🇺🇸', GB: '🇬🇧', JP: '🇯🇵', CN: '🇨🇳', IN: '🇮🇳', BR: '🇧🇷',
  AU: '🇦🇺', CA: '🇨🇦', MX: '🇲🇽', AR: '🇦🇷', ZA: '🇿🇦', EG: '🇪🇬',
  TH: '🇹🇭', VN: '🇻🇳', ID: '🇮🇩', MY: '🇲🇾', SG: '🇸🇬', AE: '🇦🇪',
  PT: '🇵🇹', SE: '🇸🇪', NO: '🇳🇴', DK: '🇩🇰', FI: '🇫🇮', IE: '🇮🇪',
  UA: '🇺🇦', RU: '🇷🇺', IL: '🇮🇱', MA: '🇲🇦', TN: '🇹🇳',
};

function getEmoji(isoCode: string): string {
  return COUNTRY_EMOJI[isoCode] ?? '🌍';
}

function stampColor(user: UserType, both: boolean): string {
  if (both) return '#FB923C';
  return USER_COLOR[user];
}

export default function PasportPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [activeUser, setActiveUser] = useState<UserType>('tati');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVisits().then(data => { setVisits(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const userVisits = visits.filter(v => v.user === activeUser);
  const otherUser: UserType = activeUser === 'tati' ? 'iva' : 'tati';
  const otherSet = new Set(visits.filter(v => v.user === otherUser).map(v => v.country.isoCode));

  return (
    <main className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-extrabold text-slate-800 mb-1">📕 Паспорт</h1>
      <p className="text-slate-500 text-sm mb-5">Всички посетени дестинации</p>

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

      {/* Passport cover */}
      <div
        className="rounded-2xl p-5 mb-6 shadow-md text-white"
        style={{ background: `linear-gradient(135deg, ${USER_COLOR[activeUser]}, ${USER_COLOR[activeUser]}bb)` }}
      >
        <div className="flex items-center gap-3">
          <span className="text-4xl">📕</span>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest opacity-80">Паспорт</div>
            <div className="text-xl font-extrabold">{USER_DISPLAY[activeUser]}</div>
            <div className="text-sm opacity-80">{userVisits.length} посетени държави</div>
          </div>
        </div>
      </div>

      {loading && <div className="text-slate-400 text-sm text-center py-10">Зареждане…</div>}

      {!loading && userVisits.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <div className="text-4xl mb-3">✈️</div>
          <div className="font-semibold">Все още няма посетени страни</div>
          <div className="text-sm mt-1">Добавете страни от глобуса!</div>
        </div>
      )}

      {/* Stamps grid */}
      {userVisits.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {userVisits
            .sort((a, b) => a.country.name.localeCompare(b.country.name))
            .map(v => {
              const both = otherSet.has(v.country.isoCode);
              const color = stampColor(activeUser, both);
              return (
                <div
                  key={v.id}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl text-center shadow-sm"
                  style={{
                    background: `${color}12`,
                    border: `2px solid ${color}44`,
                  }}
                  onClick={() => { resumeAudio(); sounds.stamp(); }}
                >
                  <span className="text-3xl">{getEmoji(v.country.isoCode)}</span>
                  <div className="font-bold text-slate-800 text-sm leading-tight">{v.country.name}</div>
                  <div className="text-xs text-slate-500">{v.country.capital}</div>
                  {both && (
                    <span className="text-xs px-2 py-0.5 rounded-full text-white font-bold" style={{ background: color }}>
                      Заедно!
                    </span>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </main>
  );
}
