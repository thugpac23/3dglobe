'use client';

import { UserType, USER_DISPLAY } from '@/types';

interface UserToggleProps {
  activeUser: UserType;
  onToggle: (user: UserType) => void;
  visitCount: { tati: number; iva: number; both: number };
}

export default function UserToggle({ activeUser, onToggle, visitCount }: UserToggleProps) {
  return (
    <div className="flex flex-col items-center gap-3 mb-4">
      <p className="text-slate-400 text-sm">
        Кликни върху държава на глобуса, за да я отбележиш като посетена
      </p>

      <div className="flex items-center gap-5">
        <button
          onClick={() => onToggle('tati')}
          className={`px-7 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 ${
            activeUser === 'tati'
              ? 'bg-[#FFD700] text-slate-900 shadow-[0_0_24px_rgba(255,215,0,0.55)] scale-110'
              : 'bg-slate-800/70 text-slate-400 hover:bg-slate-700 border border-slate-600/60'
          }`}
        >
          ✈️ {USER_DISPLAY.tati}
        </button>

        <div className="text-center text-xs text-slate-600 leading-5">
          <span className="text-[#FFD700]">{visitCount.tati}</span>
          <span className="mx-1 text-slate-700">+</span>
          <span className="text-[#FF69B4]">{visitCount.iva}</span>
          <span className="mx-1 text-slate-700">+</span>
          <span className="text-[#FFB347]">{visitCount.both}</span>
          <div className="text-slate-700">двете</div>
        </div>

        <button
          onClick={() => onToggle('iva')}
          className={`px-7 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 ${
            activeUser === 'iva'
              ? 'bg-[#FF69B4] text-slate-900 shadow-[0_0_24px_rgba(255,105,180,0.55)] scale-110'
              : 'bg-slate-800/70 text-slate-400 hover:bg-slate-700 border border-slate-600/60'
          }`}
        >
          ✈️ {USER_DISPLAY.iva}
        </button>
      </div>

      <div className="text-xs text-slate-500">
        Активен потребител:{' '}
        <span
          className="font-bold"
          style={{ color: activeUser === 'tati' ? '#FFD700' : '#FF69B4' }}
        >
          {USER_DISPLAY[activeUser]}
        </span>
      </div>
    </div>
  );
}
