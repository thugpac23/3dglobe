'use client';

import { AvatarConfig } from '@/types';

interface Props {
  avatar: Partial<AvatarConfig>;
  size?: number;
  label?: string;
}

const OUTFIT_COLORS: Record<string, string> = {
  casual:   '#60A5FA',
  travel:   '#6B7280',
  explorer: '#92400E',
};

export default function AvatarSVG({ avatar, size = 80, label }: Props) {
  const hair = avatar.hairStyle ?? 'short';
  const hairColor = avatar.hairColor ?? '#8B4513';
  const eyeColor = avatar.eyeColor ?? '#4B5563';
  const skin = avatar.skinColor ?? '#FBBF8A';
  const outfit = avatar.outfit ?? 'casual';
  const accessories: string[] = avatar.accessories ?? [];
  const bodyColor = OUTFIT_COLORS[outfit] ?? '#60A5FA';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size * 1.25} viewBox="0 0 80 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Body */}
        <ellipse cx="40" cy="85" rx="22" ry="14" fill={bodyColor} opacity="0.9" />
        <rect x="20" y="72" width="40" height="18" rx="6" fill={bodyColor} />

        {/* Backpack */}
        {accessories.includes('backpack') && (
          <rect x="57" y="68" width="12" height="16" rx="4" fill="#D97706" stroke="#92400E" strokeWidth="1" />
        )}

        {/* Neck */}
        <rect x="36" y="60" width="8" height="8" fill={skin} />

        {/* Head */}
        <circle cx="40" cy="50" r="22" fill={skin} />

        {/* Hair */}
        {hair === 'short' && (
          <path d="M18 50 Q18 28 40 28 Q62 28 62 50 L58 46 Q50 22 40 24 Q30 22 22 46 Z" fill={hairColor} />
        )}
        {hair === 'long' && (
          <>
            <path d="M18 50 Q18 26 40 26 Q62 26 62 50 L60 44 Q52 20 40 22 Q28 20 20 44 Z" fill={hairColor} />
            <path d="M18 50 Q16 70 20 80" stroke={hairColor} strokeWidth="6" strokeLinecap="round" />
            <path d="M62 50 Q64 70 60 80" stroke={hairColor} strokeWidth="6" strokeLinecap="round" />
          </>
        )}
        {hair === 'curly' && (
          <>
            <ellipse cx="40" cy="30" rx="18" ry="10" fill={hairColor} />
            <circle cx="24" cy="38" r="7" fill={hairColor} />
            <circle cx="56" cy="38" r="7" fill={hairColor} />
            <circle cx="32" cy="30" r="6" fill={hairColor} />
            <circle cx="48" cy="30" r="6" fill={hairColor} />
          </>
        )}
        {hair === 'ponytail' && (
          <>
            <path d="M18 50 Q18 28 40 28 Q62 28 62 50 L58 46 Q50 22 40 24 Q30 22 22 46 Z" fill={hairColor} />
            <path d="M60 36 Q70 30 68 44 Q64 50 60 46" fill={hairColor} />
          </>
        )}

        {/* Eyes */}
        <circle cx="33" cy="50" r="4" fill="white" />
        <circle cx="47" cy="50" r="4" fill="white" />
        <circle cx="34" cy="51" r="2.5" fill={eyeColor} />
        <circle cx="48" cy="51" r="2.5" fill={eyeColor} />
        <circle cx="35" cy="50" r="1" fill="white" />
        <circle cx="49" cy="50" r="1" fill="white" />

        {/* Mouth / smile */}
        <path d="M35 60 Q40 65 45 60" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" fill="none" />

        {/* Glasses */}
        {accessories.includes('glasses') && (
          <g stroke="#1e293b" strokeWidth="1.5" fill="none">
            <circle cx="33" cy="50" r="6" />
            <circle cx="47" cy="50" r="6" />
            <line x1="39" y1="50" x2="41" y2="50" />
            <line x1="22" y1="49" x2="27" y2="49" />
            <line x1="53" y1="49" x2="58" y2="49" />
          </g>
        )}

        {/* Hat */}
        {accessories.includes('hat') && (
          <>
            <rect x="22" y="30" width="36" height="8" rx="3" fill="#DC2626" />
            <rect x="28" y="14" width="24" height="18" rx="4" fill="#DC2626" />
          </>
        )}
      </svg>
      {label && <span className="text-xs font-semibold text-slate-600">{label}</span>}
    </div>
  );
}
