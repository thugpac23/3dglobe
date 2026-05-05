'use client';

import { useState, useCallback, useEffect } from 'react';
import { UserType, USER_COLOR, GlobePolygon } from '@/types';
import { addXP } from '@/lib/api';
import { sounds, resumeAudio } from '@/lib/sounds';
import { resolveIso } from '@/lib/mapHelpers';
import { BG_NAMES } from '@/data/countryNamesBg';
import countriesGeoJson from '@/data/countries.json';

const TOTAL_ROUNDS = 10;
const XP_PER_CORRECT = 6;

// Ocean / land colors
const OCEAN_TOP    = '#7DD3FC';
const OCEAN_BOTTOM = '#0369A1';
const LAND_FILL    = '#86A368';
const LAND_STROKE  = '#3F6212';

const SVG_W = 320;
const SVG_H = 220;
const PAD   = 18;

// Convert a feature's polygon geometry to one or more SVG path strings.
// Uses cosine-latitude scaling so high-latitude countries don't look stretched.
function geoToSvgPath(feature: GlobePolygon): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geom = (feature as any).geometry;
  if (!geom) return '';
  let polygons: number[][][];
  if (geom.type === 'Polygon') {
    polygons = [geom.coordinates[0] as number[][]];
  } else if (geom.type === 'MultiPolygon') {
    polygons = (geom.coordinates as number[][][][]).map(p => p[0]);
  } else {
    return '';
  }

  // Antimeridian fix: if total lon span > 180°, treat negative lons as +360.
  let allCoords = polygons.flat();
  const lons0 = allCoords.map(c => c[0]);
  if (Math.max(...lons0) - Math.min(...lons0) > 180) {
    polygons = polygons.map(ring => ring.map(([lon, lat]) => [lon < 0 ? lon + 360 : lon, lat]));
    allCoords = polygons.flat();
  }

  const lons = allCoords.map(c => c[0]);
  const lats = allCoords.map(c => c[1]);
  const lonMin = Math.min(...lons), lonMax = Math.max(...lons);
  const latMin = Math.min(...lats), latMax = Math.max(...lats);
  const lonR = lonMax - lonMin;
  const latR = latMax - latMin;
  const midLat   = ((latMin + latMax) / 2) * Math.PI / 180;
  const lonScale = Math.cos(midLat);
  const sx = (SVG_W - 2 * PAD) / Math.max(0.1, lonR * lonScale);
  const sy = (SVG_H - 2 * PAD) / Math.max(0.1, latR);
  const s  = Math.min(sx, sy);
  const cx = (lonMin + lonMax) / 2;
  const cy = (latMin + latMax) / 2;
  const project = (lon: number, lat: number) => [
    (SVG_W / 2 + (lon - cx) * s * lonScale).toFixed(1),
    (SVG_H / 2 - (lat - cy) * s).toFixed(1),
  ];

  return polygons
    .filter(ring => ring && ring.length >= 3)
    .map(ring => 'M' + ring.map(([lon, lat]) => project(lon, lat).join(',')).join('L') + 'Z')
    .join(' ');
}

interface ShapeQuestion {
  iso: string;
  correctName: string;
  path: string;
  choices: string[];
}

// Eligible features = those with an ISO + a Bulgarian name + a recognisable
// labelrank (≤ 6 → mostly known countries) + non-trivial geometry.
const allFeatures = (countriesGeoJson as unknown as { features: GlobePolygon[] }).features;
const eligibleFeatures: GlobePolygon[] = allFeatures.filter(f => {
  const iso = resolveIso(f.properties);
  if (!iso || !BG_NAMES[iso]) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const labelrank = (f.properties as any)?.LABELRANK ?? 99;
  return labelrank <= 6;
});

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRound(): ShapeQuestion[] {
  const picks = shuffle(eligibleFeatures).slice(0, TOTAL_ROUNDS);
  const allNames = eligibleFeatures
    .map(f => BG_NAMES[resolveIso(f.properties)])
    .filter((n): n is string => Boolean(n));
  return picks.map(f => {
    const iso  = resolveIso(f.properties);
    const correctName = BG_NAMES[iso];
    const wrongs = shuffle(allNames.filter(n => n !== correctName)).slice(0, 3);
    return {
      iso,
      correctName,
      path: geoToSvgPath(f),
      choices: shuffle([correctName, ...wrongs]),
    };
  });
}

type Phase = 'idle' | 'playing' | 'answered' | 'done';

export default function CountryShapeGame({ activeUser }: { activeUser: UserType }) {
  const [phase, setPhase]       = useState<Phase>('idle');
  const [round, setRound]       = useState(0);
  const [score, setScore]       = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ShapeQuestion[]>([]);

  useEffect(() => { setPhase('idle'); }, [activeUser]);

  const current = questions[round];

  const startGame = useCallback(() => {
    resumeAudio(); sounds.click();
    setQuestions(buildRound());
    setRound(0); setScore(0); setXpEarned(0);
    setSelected(null);
    setPhase('playing');
  }, []);

  const answer = useCallback((choice: string) => {
    if (phase !== 'playing' || !current) return;
    resumeAudio();
    setSelected(choice);
    if (choice === current.correctName) {
      sounds.quizCorrect();
      setScore(s => s + 1);
      setXpEarned(x => x + XP_PER_CORRECT);
    } else {
      sounds.quizWrong();
    }
    setPhase('answered');
  }, [phase, current]);

  const next = useCallback(() => {
    resumeAudio(); sounds.click();
    const r = round + 1;
    if (r >= TOTAL_ROUNDS) {
      setPhase('done');
      if (xpEarned > 0) addXP(activeUser, xpEarned).catch(() => {});
    } else {
      setRound(r);
      setSelected(null);
      setPhase('playing');
    }
  }, [round, xpEarned, activeUser]);

  const isCorrect = phase === 'answered' && selected === current?.correctName;

  if (phase === 'idle') {
    return (
      <div className="text-center py-10">
        <div className="text-6xl mb-4">🗺️</div>
        <h2 className="text-xl font-bold text-slate-700 mb-2">Познай държавата</h2>
        <p className="text-slate-500 text-sm mb-2">{TOTAL_ROUNDS} въпроса · {XP_PER_CORRECT} XP за всеки верен</p>
        <p className="text-slate-400 text-xs mb-6">Виж формата на държавата и избери правилния отговор</p>
        <button onClick={startGame} className="px-8 py-3 rounded-2xl font-bold text-white text-lg shadow-md transition-all hover:scale-105" style={{ background: USER_COLOR[activeUser] }}>
          Започни играта
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="text-center py-8">
        <div className="text-6xl mb-4">{score === TOTAL_ROUNDS ? '🏆' : score >= TOTAL_ROUNDS / 2 ? '🌟' : '📚'}</div>
        <h2 className="text-2xl font-extrabold text-slate-800 mb-2">{score} / {TOTAL_ROUNDS}</h2>
        <p className="text-slate-500 mb-2">
          {score === TOTAL_ROUNDS ? 'Перфектно!' : score >= TOTAL_ROUNDS / 2 ? 'Много добре!' : 'Продължавай да учиш!'}
        </p>
        {xpEarned > 0 && (
          <div className="inline-block px-4 py-1.5 rounded-full text-white text-sm font-bold mb-6" style={{ background: USER_COLOR[activeUser] }}>
            +{xpEarned} XP спечелени!
          </div>
        )}
        <div className="flex gap-3 justify-center">
          <button onClick={startGame} className="px-6 py-3 rounded-2xl font-bold text-white shadow-md" style={{ background: USER_COLOR[activeUser] }}>
            Играй отново
          </button>
          <button onClick={() => setPhase('idle')} className="px-6 py-3 rounded-2xl font-bold text-slate-600 border-2 border-slate-200">
            Меню
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div>
      {/* Progress + score */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${(round / TOTAL_ROUNDS) * 100}%`, background: USER_COLOR[activeUser] }} />
        </div>
        <span className="text-xs font-bold text-slate-500">{round + 1}/{TOTAL_ROUNDS}</span>
      </div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: `${USER_COLOR[activeUser]}20`, color: USER_COLOR[activeUser] }}>
          🌍 Форма на държавата
        </span>
        <span className="text-xs font-bold text-slate-500">{score} верни · +{xpEarned} XP</span>
      </div>

      {/* Shape display */}
      <div className="rounded-2xl mb-5 overflow-hidden shadow-sm" style={{ border: `2px solid ${USER_COLOR[activeUser]}30` }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ display: 'block', background: `linear-gradient(180deg, ${OCEAN_TOP}, ${OCEAN_BOTTOM})` }}>
          {/* Subtle ocean wave hints */}
          {[0.32, 0.55, 0.78].map((y, i) => (
            <path
              key={i}
              d={`M0 ${SVG_H * y} Q ${SVG_W * 0.25} ${SVG_H * y - 4} ${SVG_W * 0.5} ${SVG_H * y} T ${SVG_W} ${SVG_H * y}`}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={1}
              fill="none"
            />
          ))}
          <path d={current.path} fill={LAND_FILL} stroke={LAND_STROKE} strokeWidth={1.6} strokeLinejoin="round" />
        </svg>
      </div>

      {/* Choices */}
      <div className="grid grid-cols-2 gap-3">
        {current.choices.map(c => {
          const correct  = c === current.correctName;
          const isSel    = c === selected;
          let bg = 'white', border = '#E2E8F0', color = '#334155';
          if (phase === 'answered') {
            if (correct)       { bg = '#D1FAE5'; border = '#059669'; color = '#065F46'; }
            else if (isSel)    { bg = '#FEE2E2'; border = '#DC2626'; color = '#7F1D1D'; }
          }
          return (
            <button key={c} onClick={() => answer(c)} disabled={phase === 'answered'} className="px-4 py-3 rounded-xl font-semibold text-sm text-left transition-all" style={{ background: bg, border: `2px solid ${border}`, color }}>
              {c}
              {phase === 'answered' && correct && ' ✓'}
              {phase === 'answered' && isSel && !correct && ' ✗'}
            </button>
          );
        })}
      </div>

      {phase === 'answered' && (
        <div className="mt-5">
          <button onClick={next} className="w-full py-3 rounded-2xl font-bold text-white text-base transition-all" style={{ background: USER_COLOR[activeUser] }}>
            {isCorrect ? '🎉 ' : '🤔 '}
            {round + 1 >= TOTAL_ROUNDS ? 'Виж резултата' : 'Следващ въпрос →'}
          </button>
        </div>
      )}
    </div>
  );
}
