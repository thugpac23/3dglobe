'use client';

import { UserType } from '@/types';

interface UserToggleProps {
  activeUser: UserType;
  onToggle: (user: UserType) => void;
  visitCount: { tati: number; iva: number; both: number };
}

export default function UserToggle({ activeUser, onToggle, visitCount }: UserToggleProps) {
  return (
    <div className="flex flex-col items-center gap-3 mb-6">
      <p className="text-slate-400 text-sm">
        Click a country on the globe to mark it as visited
      </p>
      <div className="flex items-center gap-4">
        <button
          onClick={() => onToggle('tati')}
          className={`px-6 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 ${
            activeUser === 'tati'
              ? 'bg-[#FFD700] text-slate-900 shadow-[0_0_20px_rgba(255,215,0,0.5)] scale-105'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-600'
          }`}
        >
          ✈️ tati
        </button>

        <div className="text-slate-600 text-xs">
          <div className="text-center">
            <span className="text-[#FFD700]">{visitCount.tati}</span>
            {' + '}
            <span className="text-[#FF69B4]">{visitCount.iva}</span>
            {' + '}
            <span className="text-[#FFB347]">{visitCount.both} both</span>
          </div>
        </div>

        <button
          onClick={() => onToggle('iva')}
          className={`px-6 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 ${
            activeUser === 'iva'
              ? 'bg-[#FF69B4] text-slate-900 shadow-[0_0_20px_rgba(255,105,180,0.5)] scale-105'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-600'
          }`}
        >
          ✈️ iva
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>Active:</span>
        <span
          className="font-bold"
          style={{ color: activeUser === 'tati' ? '#FFD700' : '#FF69B4' }}
        >
          {activeUser}
        </span>
      </div>
    </div>
  );
}
