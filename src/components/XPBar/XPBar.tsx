'use client';

import { UserType, UserProgress, USER_DISPLAY, USER_COLOR } from '@/types';
import { getLevelTitle, xpProgress, xpToNextLevel } from '@/lib/xp';

interface XPBarProps {
  user: UserType;
  progress: UserProgress;
  isActive: boolean;
  onClick: () => void;
  /** compact=true: name + level only, no XP bar or numbers (for homepage banner) */
  compact?: boolean;
}

const AVATARS: Record<UserType, string> = { tati: '🧳', iva: '🌸' };

export default function XPBar({ user, progress, isActive, onClick, compact = false }: XPBarProps) {
  const color = USER_COLOR[user];
  const title = getLevelTitle(progress.level);

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="flex-1 text-left transition-all duration-200"
        style={{
          background: isActive ? 'white' : 'rgba(255,255,255,0.55)',
          border: `2px solid ${isActive ? color : 'rgba(0,0,0,0.08)'}`,
          borderRadius: 14,
          padding: '8px 12px',
          boxShadow: isActive ? `0 3px 14px ${color}28` : '0 1px 4px rgba(0,0,0,0.07)',
          cursor: 'pointer',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{AVATARS[user]}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm text-slate-800">{USER_DISPLAY[user]}</span>
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white"
                style={{ background: color }}
              >
                Ниво {progress.level}
              </span>
            </div>
            <div className="text-xs text-slate-400 truncate leading-tight">{title}</div>
          </div>
        </div>
      </button>
    );
  }

  const { pct, current, needed } = xpProgress(progress.xp, progress.level);
  const isMaxLevel = progress.level >= 5;

  return (
    <button
      onClick={onClick}
      className="flex-1 max-w-xs text-left transition-all duration-200"
      style={{
        background: isActive ? 'white' : 'rgba(255,255,255,0.55)',
        border: `2px solid ${isActive ? color : 'rgba(0,0,0,0.08)'}`,
        borderRadius: 16,
        padding: '12px 14px',
        boxShadow: isActive ? `0 4px 20px ${color}30` : '0 1px 4px rgba(0,0,0,0.08)',
        cursor: 'pointer',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl leading-none">{AVATARS[user]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-sm text-slate-800">{USER_DISPLAY[user]}</span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
              style={{ background: color }}
            >
              Ниво {progress.level}
            </span>
          </div>
          <div className="text-xs text-slate-500 truncate">{title}</div>
        </div>
      </div>

      {/* XP bar */}
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.08)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}cc, ${color})` }}
        />
      </div>
      <div className="flex justify-between items-center mt-1">
        <span className="text-xs text-slate-400">
          {isMaxLevel ? `${progress.xp} XP — Максимално ниво!` : `${current} / ${needed} XP`}
        </span>
        {!isMaxLevel && (
          <span className="text-xs" style={{ color }}>
            → Ниво {progress.level + 1} при {xpToNextLevel(progress.level)} XP
          </span>
        )}
      </div>
    </button>
  );
}
