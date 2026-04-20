'use client';

import { AvatarConfig } from '@/types';

interface Props {
  avatar: Partial<AvatarConfig>;
  size?: number;
  label?: string;
}

type SleeveStyle = 'full' | 'short' | 'none';
type CollarStyle = 'crew' | 'v' | 'turtle' | 'lapel' | 'wide' | 'polo';

interface OutfitDef {
  primary: string;
  secondary: string;
  accent: string;
  sleeve: SleeveStyle;
  collar: CollarStyle;
}

const OUTFIT_DEFS: Record<string, OutfitDef> = {
  casual:    { primary: '#60A5FA', secondary: '#3B82F6', accent: '#BFDBFE', sleeve: 'short', collar: 'crew' },
  travel:    { primary: '#4B5563', secondary: '#374151', accent: '#D1D5DB', sleeve: 'full',  collar: 'lapel' },
  explorer:  { primary: '#92400E', secondary: '#78350F', accent: '#D97706', sleeve: 'none',  collar: 'v' },
  summer:    { primary: '#FCD34D', secondary: '#F59E0B', accent: '#FEF3C7', sleeve: 'none',  collar: 'wide' },
  winter:    { primary: '#1E3A5F', secondary: '#1E40AF', accent: '#93C5FD', sleeve: 'full',  collar: 'turtle' },
  sporty:    { primary: '#10B981', secondary: '#059669', accent: '#6EE7B7', sleeve: 'short', collar: 'crew' },
  adventure: { primary: '#78350F', secondary: '#451A03', accent: '#D97706', sleeve: 'short', collar: 'polo' },
  beach:     { primary: '#FB923C', secondary: '#EA580C', accent: '#FED7AA', sleeve: 'none',  collar: 'wide' },
  city:      { primary: '#6D28D9', secondary: '#5B21B6', accent: '#DDD6FE', sleeve: 'full',  collar: 'lapel' },
};

export default function AvatarSVG({ avatar, size = 80, label }: Props) {
  const hair      = avatar.hairStyle ?? 'short';
  const hairColor = avatar.hairColor ?? '#8B4513';
  const eyeColor  = avatar.eyeColor  ?? '#4B5563';
  const skin      = avatar.skinColor ?? '#FBBF8A';
  const outfit    = avatar.outfit    ?? 'casual';
  const acc: string[] = avatar.accessories ?? [];
  const isMale    = avatar.user !== 'iva';

  const def     = OUTFIT_DEFS[outfit] ?? OUTFIT_DEFS.casual;
  const bodyC   = def.primary;
  const bodyC2  = def.secondary;
  const accentC = def.accent;

  const shoulderRx = isMale ? 32 : 26;
  const armW  = isMale ? 13 : 11;
  const armLX = isMale ? 7  : 10;
  const armRX = isMale ? 80 : 79;
  const armColor = def.sleeve === 'none' ? skin : bodyC;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size * 1.4} viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg">

        {/* ── Arms (behind torso) ── */}
        <rect x={armLX} y="72" width={armW} height="52" rx="6" fill={armColor} />
        <rect x={armRX} y="72" width={armW} height="52" rx="6" fill={armColor} />
        {def.sleeve === 'short' && (
          <>
            <rect x={armLX} y="72" width={armW} height="22" rx="5" fill={bodyC} />
            <rect x={armRX} y="72" width={armW} height="22" rx="5" fill={bodyC} />
          </>
        )}

        {/* ── Travel backpack (behind, drawn before torso) ── */}
        {acc.includes('travel-backpack') && (
          <>
            <rect x="61" y="70" width="18" height="34" rx="5" fill="#65A30D" stroke="#3F6212" strokeWidth="1" />
            <rect x="63" y="74" width="14" height="9"  rx="2" fill="#4D7C0F" />
            <line x1="65" y1="70" x2="65" y2="104" stroke="#3F6212" strokeWidth="1.5" />
            <line x1="75" y1="70" x2="75" y2="104" stroke="#3F6212" strokeWidth="1.5" />
          </>
        )}

        {/* ── Torso ── */}
        <ellipse cx="50" cy="72" rx={shoulderRx} ry={isMale ? 9 : 7} fill={bodyC} />
        {isMale
          ? <rect x="18" y="72" width="64" height="58" rx="8" fill={bodyC} />
          : <path d="M24 72 Q21 96 24 130 L76 130 Q79 96 76 72 Z" fill={bodyC} />
        }

        {/* ── Outfit details ── */}
        {(outfit === 'travel' || outfit === 'city') && (
          <>
            <polygon points="50,72 34,84 38,130 50,118" fill={bodyC2} />
            <polygon points="50,72 66,84 62,130 50,118" fill={bodyC2} />
            <polygon points="50,72 36,78 40,86" fill={accentC} opacity="0.7" />
            <polygon points="50,72 64,78 60,86" fill={accentC} opacity="0.7" />
            <circle cx="50" cy="95"  r="2.5" fill={accentC} />
            <circle cx="50" cy="107" r="2.5" fill={accentC} />
            <circle cx="50" cy="118" r="2.5" fill={accentC} />
          </>
        )}
        {outfit === 'explorer' && (
          <>
            <rect x="28" y="82" width="14" height="11" rx="2" fill={bodyC2} />
            <rect x="58" y="82" width="14" height="11" rx="2" fill={bodyC2} />
            <line x1="28" y1="87" x2="42" y2="87" stroke={accentC} strokeWidth="0.8" />
            <line x1="58" y1="87" x2="72" y2="87" stroke={accentC} strokeWidth="0.8" />
            <line x1="50" y1="72" x2="50" y2="130" stroke={bodyC2} strokeWidth="2" />
            <circle cx="50" cy="88"  r="2" fill={accentC} />
            <circle cx="50" cy="100" r="2" fill={accentC} />
          </>
        )}
        {outfit === 'winter' && (
          <>
            <rect x={armLX - 1} y="114" width={armW + 2} height="10" rx="4" fill={bodyC2} />
            <rect x={armRX - 1} y="114" width={armW + 2} height="10" rx="4" fill={bodyC2} />
            <line x1="24" y1="96"  x2="76" y2="96"  stroke={accentC} strokeWidth="1.5" opacity="0.45" />
            <line x1="24" y1="110" x2="76" y2="110" stroke={accentC} strokeWidth="1.5" opacity="0.45" />
          </>
        )}
        {outfit === 'sporty' && (
          <>
            <rect x={armLX}        y="72" width="5" height="52" rx="2" fill={accentC} opacity="0.65" />
            <rect x={armRX + armW - 5} y="72" width="5" height="52" rx="2" fill={accentC} opacity="0.65" />
            <line x1="24" y1="100" x2="76" y2="100" stroke={accentC} strokeWidth="2" opacity="0.5" />
          </>
        )}
        {outfit === 'adventure' && (
          <>
            <rect x="40" y="84" width="20" height="13" rx="2" fill={bodyC2} />
            <rect x="41" y="84" width="18" height="4"  rx="1" fill={accentC} opacity="0.5" />
            <line x1="40" y1="90" x2="60" y2="90" stroke={accentC} strokeWidth="0.8" />
            <rect x={armLX} y="90" width={armW} height="5" rx="2" fill={bodyC2} />
            <rect x={armRX} y="90" width={armW} height="5" rx="2" fill={bodyC2} />
          </>
        )}
        {(outfit === 'summer' || outfit === 'beach') && (
          <rect x="43" y="72" width="14" height="58" fill={bodyC2} opacity="0.22" />
        )}
        {outfit === 'casual' && (
          <line x1="50" y1="74" x2="50" y2="130" stroke={bodyC2} strokeWidth="1.5" opacity="0.25" />
        )}

        {/* ── Collar ── */}
        {def.collar === 'crew'   && <ellipse cx="50" cy="70" rx="10" ry="5" fill={skin} />}
        {def.collar === 'v'      && (
          <>
            <polygon points="43,70 50,86 57,70" fill={bodyC} />
            <line x1="43" y1="70" x2="50" y2="85" stroke={bodyC2} strokeWidth="1" />
            <line x1="57" y1="70" x2="50" y2="85" stroke={bodyC2} strokeWidth="1" />
          </>
        )}
        {def.collar === 'turtle' && <rect x="40" y="62" width="20" height="14" rx="5" fill={bodyC} />}
        {def.collar === 'wide'   && <ellipse cx="50" cy="70" rx="14" ry="5" fill={bodyC2} opacity="0.55" />}
        {def.collar === 'polo'   && (
          <>
            <rect x="44" y="68" width="12" height="10" rx="3" fill={bodyC2} />
            <line x1="50" y1="70" x2="50" y2="84" stroke={accentC} strokeWidth="1.5" />
          </>
        )}
        {def.collar === 'lapel' && null /* handled by torso detail above */}

        {/* ── Neck & Head ── */}
        <rect x="44" y="62" width="12" height="12" fill={skin} />
        <circle cx="50" cy="44" r="22" fill={skin} />

        {/* ── Hair ── */}
        {hair === 'short' && (
          <path d="M28 44 Q28 22 50 22 Q72 22 72 44 L68 40 Q60 18 50 20 Q40 18 32 40 Z" fill={hairColor} />
        )}
        {hair === 'long' && (
          <>
            <path d="M28 44 Q28 20 50 20 Q72 20 72 44 L70 38 Q62 16 50 18 Q38 16 30 38 Z" fill={hairColor} />
            <path d="M28 44 Q24 68 26 86" stroke={hairColor} strokeWidth="8" strokeLinecap="round" />
            <path d="M72 44 Q76 68 74 86" stroke={hairColor} strokeWidth="8" strokeLinecap="round" />
          </>
        )}
        {hair === 'curly' && (
          <>
            <ellipse cx="50" cy="28" rx="20" ry="10" fill={hairColor} />
            <circle cx="33" cy="37" r="8"  fill={hairColor} />
            <circle cx="67" cy="37" r="8"  fill={hairColor} />
            <circle cx="41" cy="27" r="7"  fill={hairColor} />
            <circle cx="59" cy="27" r="7"  fill={hairColor} />
          </>
        )}
        {hair === 'ponytail' && (
          <>
            <path d="M28 44 Q28 22 50 22 Q72 22 72 44 L68 40 Q60 18 50 20 Q40 18 32 40 Z" fill={hairColor} />
            <path d="M68 34 Q80 26 78 44 Q74 52 68 46" fill={hairColor} />
          </>
        )}

        {/* ── Eyes ── */}
        <circle cx="41" cy="46" r="4"   fill="white" />
        <circle cx="59" cy="46" r="4"   fill="white" />
        <circle cx="42" cy="47" r="2.5" fill={eyeColor} />
        <circle cx="60" cy="47" r="2.5" fill={eyeColor} />
        <circle cx="43" cy="46" r="1"   fill="white" />
        <circle cx="61" cy="46" r="1"   fill="white" />
        {/* Female lashes */}
        {!isMale && (
          <>
            <line x1="38" y1="43" x2="39" y2="41" stroke={hairColor} strokeWidth="1" />
            <line x1="41" y1="42" x2="41" y2="40" stroke={hairColor} strokeWidth="1" />
            <line x1="44" y1="42" x2="45" y2="40" stroke={hairColor} strokeWidth="1" />
            <line x1="56" y1="42" x2="55" y2="40" stroke={hairColor} strokeWidth="1" />
            <line x1="59" y1="42" x2="59" y2="40" stroke={hairColor} strokeWidth="1" />
            <line x1="62" y1="43" x2="63" y2="41" stroke={hairColor} strokeWidth="1" />
          </>
        )}
        {/* Smile */}
        <path d="M43 57 Q50 64 57 57" stroke="#92400E" strokeWidth="1.8" strokeLinecap="round" fill="none" />

        {/* ── Accessories ── */}

        {acc.includes('glasses') && (
          <g stroke="#1e293b" strokeWidth="1.5" fill="none">
            <circle cx="41" cy="47" r="6" />
            <circle cx="59" cy="47" r="6" />
            <line x1="47" y1="47" x2="53" y2="47" />
            <line x1="28" y1="45" x2="35" y2="45" />
            <line x1="65" y1="45" x2="72" y2="45" />
          </g>
        )}

        {acc.includes('sunglasses') && (
          <g>
            <ellipse cx="41" cy="46" rx="8" ry="5" fill="#1e293b" opacity="0.88" />
            <ellipse cx="59" cy="46" rx="8" ry="5" fill="#1e293b" opacity="0.88" />
            <line x1="49" y1="46" x2="51" y2="46" stroke="#4B5563" strokeWidth="1.5" />
            <line x1="26" y1="44" x2="33" y2="44" stroke="#4B5563" strokeWidth="1.5" />
            <line x1="67" y1="44" x2="74" y2="44" stroke="#4B5563" strokeWidth="1.5" />
          </g>
        )}

        {acc.includes('hat') && (
          <>
            <rect x="28" y="24" width="44" height="8" rx="3" fill="#DC2626" />
            <rect x="34" y="6"  width="32" height="20" rx="4" fill="#DC2626" />
          </>
        )}

        {acc.includes('cap') && (
          <>
            <path d="M28 36 Q28 16 50 16 Q72 16 72 36 Z" fill="#1D4ED8" />
            <rect x="28" y="33" width="44" height="5" rx="2" fill="#1E3A5F" />
            <path d="M28 36 Q13 34 11 40 Q15 45 28 42" fill="#2563EB" />
          </>
        )}

        {acc.includes('backpack') && (
          <rect x="63" y="74" width="12" height="19" rx="4" fill="#D97706" stroke="#92400E" strokeWidth="1" />
        )}

        {acc.includes('camera') && (
          <>
            <line x1="34" y1="74" x2="42" y2="94" stroke="#4B5563" strokeWidth="1.5" />
            <rect x="36" y="92" width="16" height="13" rx="3" fill="#1F2937" />
            <circle cx="44" cy="98" r="4.5" fill="#374151" />
            <circle cx="44" cy="98" r="2.5" fill="#6B7280" />
            <rect x="38" y="92" width="7" height="4" rx="1" fill="#374151" />
          </>
        )}

        {acc.includes('scarf') && (
          <>
            <path d="M36 68 Q50 75 64 68 Q56 81 50 77 Q44 81 36 68Z" fill="#DC2626" opacity="0.92" />
            <path d="M50 77 Q48 90 46 102" stroke="#DC2626" strokeWidth="5" strokeLinecap="round" />
          </>
        )}

        {acc.includes('headphones') && (
          <>
            <path d="M28 44 Q28 18 50 18 Q72 18 72 44" stroke="#1F2937" strokeWidth="4" fill="none" strokeLinecap="round" />
            <rect x="24" y="40" width="8"  height="14" rx="4" fill="#374151" />
            <rect x="68" y="40" width="8"  height="14" rx="4" fill="#374151" />
          </>
        )}
      </svg>
      {label && <span className="text-xs font-semibold text-slate-600">{label}</span>}
    </div>
  );
}
