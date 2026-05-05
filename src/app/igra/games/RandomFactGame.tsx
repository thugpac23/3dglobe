'use client';

import { useState, useCallback } from 'react';
import { UserType, USER_COLOR } from '@/types';
import { sounds, resumeAudio } from '@/lib/sounds';
import { getRandomFactWithCountry } from '@/data/countryFacts';
import { BG_NAMES } from '@/data/countryNamesBg';

function getFlagEmoji(iso: string): string {
  if (!iso || iso.length !== 2) return '🌍';
  try {
    return String.fromCodePoint(
      0x1F1E6 + iso.toUpperCase().charCodeAt(0) - 65,
      0x1F1E6 + iso.toUpperCase().charCodeAt(1) - 65,
    );
  } catch { return '🌍'; }
}

interface FactState {
  iso: string;
  name: string;
  flag: string;
  fact: string;
}

export default function RandomFactGame({ activeUser }: { activeUser: UserType }) {
  const [state, setState] = useState<FactState | null>(null);
  const [busy, setBusy]   = useState(false);

  const showRandom = useCallback(() => {
    resumeAudio(); sounds.click();
    setBusy(true);
    // Brief delay so the animation plays even if everything is in-memory
    setTimeout(() => {
      let pick = getRandomFactWithCountry();
      // Avoid showing the same country twice in a row when possible
      if (state && pick && pick.iso === state.iso) {
        const second = getRandomFactWithCountry();
        if (second) pick = second;
      }
      if (pick) {
        const name = BG_NAMES[pick.iso] ?? pick.iso;
        setState({ iso: pick.iso, name, flag: getFlagEmoji(pick.iso), fact: pick.fact });
      }
      setBusy(false);
    }, 220);
  }, [state]);

  const color = USER_COLOR[activeUser];

  return (
    <div>
      <div className="text-center mb-5">
        <div className="text-6xl mb-2">🎲</div>
        <h2 className="text-xl font-bold text-slate-700 mb-1">Произволен факт</h2>
        <p className="text-slate-500 text-xs">Открий нещо ново за случайна държава</p>
      </div>

      {state ? (
        <div
          key={state.iso + state.fact}
          className="rounded-3xl p-6 text-center shadow-lg fact-fade-in"
          style={{
            background: `linear-gradient(135deg, ${color}1a, ${color}05)`,
            border: `2px solid ${color}30`,
          }}
        >
          <div className="text-7xl mb-3 leading-none">{state.flag}</div>
          <div className="text-xl font-extrabold mb-3" style={{ color }}>{state.name}</div>
          <p className="text-base text-slate-700 leading-relaxed">{state.fact}</p>
        </div>
      ) : (
        <div className="rounded-3xl p-8 text-center text-slate-400 italic" style={{ background: '#F8FAFC', border: '2px dashed #E2E8F0' }}>
          Натисни бутона по-долу за да видиш първия факт
        </div>
      )}

      <button
        onClick={showRandom}
        disabled={busy}
        className="mt-5 w-full py-3.5 rounded-2xl font-bold text-white text-base shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
        style={{ background: color, boxShadow: `0 4px 16px ${color}40` }}
      >
        {state ? '🎲 Покажи нов факт' : '🎲 Покажи произволен факт'}
      </button>

      <style jsx>{`
        .fact-fade-in {
          animation: factPop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes factPop {
          0%   { opacity: 0; transform: scale(0.92) translateY(8px); }
          100% { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </div>
  );
}
