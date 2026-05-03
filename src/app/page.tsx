'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  UserType, AppMode, Visit, WishlistItem,
  VisitsByCountry, WishlistByCountry,
  UserProgress, USER_DISPLAY, USER_COLOR,
} from '@/types';
import { sounds, resumeAudio } from '@/lib/sounds';
import {
  fetchVisits, addVisit, removeVisit,
  fetchProgress, addXP,
  fetchWishlist, addWishlist, removeWishlist,
} from '@/lib/api';
import { ACHIEVEMENTS } from '@/lib/xp';
import { COUNTRY_FACTS } from '@/data/countryFacts';
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
import XPBar from '@/components/XPBar/XPBar';
import VisitsTable from '@/components/VisitsTable';

const Globe    = dynamic(() => import('@/components/Globe'), { ssr: false });
const WorldMap = dynamic(() => import('@/components/WorldMap/WorldMap'), { ssr: false });

interface Toast { id: number; message: string; type: 'add' | 'remove' | 'xp' | 'level' | 'achievement' }

const DEFAULT_PROGRESS: UserProgress = { id: '', user: 'tati', xp: 0, level: 1, achievements: [] };

export default function Home() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [progress, setProgress] = useState<{ tati: UserProgress; iva: UserProgress }>({
    tati: { ...DEFAULT_PROGRESS, user: 'tati' },
    iva:  { ...DEFAULT_PROGRESS, user: 'iva' },
  });
  const [activeUser, setActiveUser] = useState<UserType>('tati');
  const [mode, setMode] = useState<AppMode>('visited');
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [globeOpen, setGlobeOpen] = useState(false);
  const [mapOpen, setMapOpen]     = useState(false);
  const [factPopup, setFactPopup] = useState<{ iso: string; name: string; fact: string } | null>(null);
  const xpPopRef = useRef<HTMLDivElement>(null);
  const factTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: Toast['type']) => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3200);
  }, []);

  const triggerXPPop = useCallback((amount: number, x: number, y: number) => {
    const el = document.createElement('div');
    el.className = 'xp-pop';
    el.textContent = `+${amount} XP`;
    el.style.cssText = `left:${x}px;top:${y}px;color:#F59E0B;text-shadow:0 1px 4px rgba(0,0,0,0.2)`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }, []);

  useEffect(() => {
    Promise.all([fetchVisits(), fetchProgress(), fetchWishlist()])
      .then(([v, p, w]) => { setVisits(v); setProgress(p); setWishlist(w); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mapOpen)   { setMapOpen(false);   setFactPopup(null); }
        if (globeOpen) { setGlobeOpen(false); setFactPopup(null); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [globeOpen, mapOpen]);

  // Body scroll lock when any modal is open (iOS-safe pattern)
  useEffect(() => {
    const open = globeOpen || mapOpen;
    if (open) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      const top = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      if (top) window.scrollTo(0, parseInt(top) * -1);
    }
  }, [globeOpen, mapOpen]);

  const visitsByCountry = useMemo<VisitsByCountry>(() => {
    const map: VisitsByCountry = {};
    for (const v of visits) {
      const iso = v.country.isoCode;
      if (!map[iso]) map[iso] = { country: v.country, tati: false, iva: false };
      map[iso][v.user] = true;
    }
    return map;
  }, [visits]);

  const wishlistByCountry = useMemo<WishlistByCountry>(() => {
    const map: WishlistByCountry = {};
    for (const w of wishlist) {
      const iso = w.country.isoCode;
      if (!map[iso]) map[iso] = { country: w.country, tati: false, iva: false };
      map[iso][w.user] = true;
    }
    return map;
  }, [wishlist]);

  const visitCount = useMemo(() => {
    let tati = 0, iva = 0, both = 0;
    for (const e of Object.values(visitsByCountry)) {
      if (e.tati && e.iva) both++;
      else if (e.tati) tati++;
      else if (e.iva) iva++;
    }
    return { tati, iva, both };
  }, [visitsByCountry]);

  const handleAwardXP = useCallback(async (user: UserType, amount: number) => {
    try {
      const result = await addXP(user, amount);
      setProgress((p) => ({ ...p, [user]: result.progress }));
      if (result.leveledUp) {
        showToast(`🎉 ${USER_DISPLAY[user]} достигна Ниво ${result.progress.level}!`, 'level');
      }
      for (const achId of result.newAchievements) {
        const ach = ACHIEVEMENTS.find((a) => a.id === achId);
        if (ach) showToast(`${ach.emoji} Постижение: ${ach.title}!`, 'achievement');
      }
    } catch { /* silent fail — XP is non-critical */ }
  }, [showToast]);

  const showFactPopup = useCallback((isoCode: string) => {
    const fact = COUNTRY_FACTS[isoCode];
    if (!fact) return;
    const name = BG_NAMES[isoCode] ?? isoCode;
    if (factTimerRef.current) clearTimeout(factTimerRef.current);
    setFactPopup({ iso: isoCode, name, fact });
    factTimerRef.current = setTimeout(() => setFactPopup(null), 6500);
  }, []);

  const handleCountryClick = useCallback(async (isoCode: string, countryName: string) => {
    showFactPopup(isoCode);
    if (mode === 'wishlist') {
      const onWishlist = wishlistByCountry[isoCode]?.[activeUser] ?? false;
      const displayName = USER_DISPLAY[activeUser];

      if (onWishlist) {
        const item = wishlist.find((w) => w.country.isoCode === isoCode && w.user === activeUser);
        if (!item) return;
        setWishlist((p) => p.filter((w) => w.id !== item.id));
        showToast(`${countryName} премахната от желаните на ${displayName}`, 'remove');
        try { await removeWishlist(item.countryId, activeUser); }
        catch { setWishlist((p) => [...p, item]); }
      } else {
        let countryId: string | null = null;
        const existing = visits.find((v) => v.country.isoCode === isoCode) ?? wishlist.find((w) => w.country.isoCode === isoCode);
        if (existing) { countryId = existing.countryId; }
        else {
          try {
            const r = await fetch(`/api/country?iso=${isoCode}`);
            if (!r.ok) throw new Error();
            countryId = (await r.json()).id;
          } catch { showToast(`${countryName} не е намерена`, 'remove'); return; }
        }
        const optimistic: WishlistItem = {
          id: `tmp-${Date.now()}`, countryId: countryId!,
          user: activeUser,
          country: wishlistByCountry[isoCode]?.country ?? visitsByCountry[isoCode]?.country ?? { id: countryId!, name: countryName, capital: '', isoCode },
        };
        setWishlist((p) => [...p, optimistic]);
        showToast(`⭐ ${countryName} добавена в желаните на ${displayName}`, 'add');
        handleAwardXP(activeUser, 5);
        try {
          const real = await addWishlist(countryId!, activeUser);
          setWishlist((p) => [...p.filter((w) => w.id !== optimistic.id), real]);
        } catch {
          setWishlist((p) => p.filter((w) => w.id !== optimistic.id));
          showToast('Грешка при запазване', 'remove');
        }
      }
      return;
    }

    // visited mode (existing logic preserved)
    const entry = visitsByCountry[isoCode];
    const alreadyVisited = entry?.[activeUser] ?? false;
    const displayName = USER_DISPLAY[activeUser];

    if (alreadyVisited) {
      const visit = visits.find((v) => v.country.isoCode === isoCode && v.user === activeUser);
      if (!visit) return;
      setVisits((p) => p.filter((v) => v.id !== visit.id));
      showToast(`${countryName} премахната от ${displayName}`, 'remove');
      try { await removeVisit(visit.countryId, activeUser); }
      catch { setVisits((p) => [...p, visit]); showToast('Грешка при премахване', 'remove'); }
    } else {
      let countryId: string | null = null;
      const anyVisit = visits.find((v) => v.country.isoCode === isoCode);
      if (anyVisit) { countryId = anyVisit.countryId; }
      else {
        try {
          const r = await fetch(`/api/country?iso=${isoCode}`);
          if (!r.ok) throw new Error();
          countryId = (await r.json()).id;
        } catch { showToast(`${countryName} не е намерена`, 'remove'); return; }
      }

      const isShared = entry && (entry.tati || entry.iva);
      const xpAmount = isShared ? 15 : 10; // +10 base, +5 if other user visited

      const optimistic: Visit = {
        id: `tmp-${Date.now()}`, countryId: countryId!,
        user: activeUser,
        country: entry?.country ?? { id: countryId!, name: countryName, capital: '', isoCode },
      };
      setVisits((p) => [...p, optimistic]);
      showToast(`✓ ${countryName} добавена към ${displayName}`, 'add');
      handleAwardXP(activeUser, xpAmount);
      try {
        const real = await addVisit(countryId!, activeUser);
        setVisits((p) => [...p.filter((v) => v.id !== optimistic.id), real]);
      } catch {
        setVisits((p) => p.filter((v) => v.id !== optimistic.id));
        showToast('Грешка при запазване', 'remove');
      }
    }
  }, [mode, visitsByCountry, wishlistByCountry, visits, wishlist, activeUser, showToast, handleAwardXP, showFactPopup]);

  const toastColors: Record<Toast['type'], string> = {
    add: '#059669', remove: '#DC2626',
    xp: '#F59E0B', level: '#7C3AED', achievement: '#0EA5E9',
  };

  return (
    <main className="min-h-screen flex flex-col items-center pb-20 px-2">
      {/* Header */}
      <header className="w-full max-w-2xl pt-5 pb-2 text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800" style={{ letterSpacing: '-0.02em' }}>
          🌍 Пътешественически Глобус
        </h1>
        <p className="text-slate-500 text-xs mt-1 tracking-widest uppercase">Открийте света заедно</p>
      </header>

      {/* XP Bars */}
      <div className="flex gap-3 w-full max-w-lg mt-3 px-2">
        {(['tati', 'iva'] as UserType[]).map((user) => (
          <XPBar
            key={user}
            user={user}
            progress={progress[user]}
            isActive={activeUser === user}
            onClick={() => setActiveUser(user)}
          />
        ))}
      </div>

      {/* Mode toggle */}
      <div className="flex mt-4 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(0,0,0,0.1)' }}>
        {(['visited', 'wishlist'] as AppMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="px-5 py-2 text-sm font-semibold transition-all duration-200"
            style={{
              background: mode === m ? USER_COLOR[activeUser] : 'transparent',
              color: mode === m ? 'white' : '#64748b',
              borderRadius: '9999px',
            }}
          >
            {m === 'visited' ? '🗺️ Посетено' : '⭐ Искам да посетя'}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500 mt-1.5">
        {mode === 'visited'
          ? `Кликни върху държава, за да я отбележиш за ${USER_DISPLAY[activeUser]}`
          : `Добави дестинация в списъка на ${USER_DISPLAY[activeUser]}`}
      </p>

      {/* Globe section */}
      <div className="w-full max-w-2xl mt-4 px-2">
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-base font-bold text-slate-700">🌍 Интерактивен глобус</h2>
          <button
            onClick={() => { resumeAudio(); sounds.click(); setGlobeOpen(true); }}
            className="text-xs font-semibold text-sky-600 hover:text-sky-700 hover:underline transition-colors"
          >
            Покажи на цял екран →
          </button>
        </div>
        <div className="rounded-2xl overflow-hidden shadow-xl flex justify-center items-start"
          style={{ background: '#040c18', maxHeight: 370, touchAction: 'none' }}>
          {!loading && (
            <Globe
              visitsByCountry={visitsByCountry}
              wishlistByCountry={wishlistByCountry}
              activeUser={activeUser}
              mode={mode}
              onCountryClick={handleCountryClick}
            />
          )}
          {loading && (
            <div className="flex items-center justify-center text-white opacity-40 text-sm" style={{ height: 200 }}>
              Зареждане…
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen globe modal */}
      {globeOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: 'rgba(4,12,24,0.96)', backdropFilter: 'blur(6px)' }}
        >
          {/* Modal header */}
          <div className="flex items-center gap-2 px-4 py-2.5 shrink-0"
            style={{ background: 'rgba(6,18,36,0.9)', borderBottom: '1px solid rgba(80,140,230,0.15)' }}>
            {/* User tabs */}
            {(['tati', 'iva'] as UserType[]).map(u => (
              <button
                key={u}
                onClick={() => { resumeAudio(); sounds.click(); setActiveUser(u); }}
                className="px-4 py-1.5 rounded-full font-bold text-xs transition-all"
                style={{
                  background: activeUser === u ? USER_COLOR[u] : 'rgba(255,255,255,0.07)',
                  color: activeUser === u ? 'white' : 'rgba(255,255,255,0.5)',
                  border: `1.5px solid ${activeUser === u ? USER_COLOR[u] : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                {USER_DISPLAY[u]}
              </button>
            ))}
            {/* Mode toggle */}
            <div className="ml-2 flex rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {(['visited', 'wishlist'] as AppMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { resumeAudio(); sounds.click(); setMode(m); }}
                  className="px-3 py-1 text-xs font-semibold transition-all"
                  style={{
                    background: mode === m ? USER_COLOR[activeUser] : 'transparent',
                    color: mode === m ? 'white' : 'rgba(255,255,255,0.45)',
                    borderRadius: '9999px',
                  }}
                >
                  {m === 'visited' ? '🗺️ Посетено' : '⭐ Желано'}
                </button>
              ))}
            </div>
            {/* Close */}
            <button
              onClick={() => { resumeAudio(); sounds.click(); setGlobeOpen(false); setFactPopup(null); }}
              className="ml-auto w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg transition-all"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}
              title="Затвори"
            >
              ✕
            </button>
          </div>

          {/* Globe */}
          <div className="flex-1 flex items-center justify-center overflow-hidden"
            style={{ filter: 'drop-shadow(0 0 40px rgba(14,100,148,0.4))', touchAction: 'none' }}>
            <Globe
              visitsByCountry={visitsByCountry}
              wishlistByCountry={wishlistByCountry}
              activeUser={activeUser}
              mode={mode}
              onCountryClick={handleCountryClick}
              fullscreen
            />
          </div>

          {/* Country fact popup */}
          {factPopup && (
            <div
              className="fact-popup-enter"
              style={{
                position: 'absolute',
                bottom: 44,
                left: '50%',
                zIndex: 60,
                width: 'min(90vw, 400px)',
                background: 'rgba(6,14,36,0.97)',
                border: '1px solid rgba(80,140,230,0.35)',
                borderRadius: 16,
                padding: '14px 18px',
                color: '#e2e8f0',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{getFlagEmoji(factPopup.iso)}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#93c5fd' }}>{factPopup.name}</span>
                <button
                  onClick={() => setFactPopup(null)}
                  style={{
                    marginLeft: 'auto', background: 'none', border: 'none',
                    color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 16, lineHeight: 1,
                  }}
                >✕</button>
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#cbd5e1' }}>{factPopup.fact}</div>
            </div>
          )}

          {/* Footer hint */}
          <div className="text-center pb-2 text-xs shrink-0"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            {mode === 'visited'
              ? `Кликни двукратно върху държава — добавя/премахва за ${USER_DISPLAY[activeUser]}`
              : `Кликни двукратно върху държава — добавя/премахва от желаните на ${USER_DISPLAY[activeUser]}`}
          </div>
        </div>
      )}

      {/* Map section */}
      <div className="w-full max-w-2xl mt-5 px-2">
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-base font-bold text-slate-700">🗺️ Карта на пътешествията</h2>
          <button
            onClick={() => { resumeAudio(); sounds.click(); setMapOpen(true); }}
            className="text-xs font-semibold text-sky-600 hover:text-sky-700 hover:underline transition-colors"
          >
            Покажи на цял екран →
          </button>
        </div>
        {!loading && (
          <WorldMap
            visitsByCountry={visitsByCountry}
            wishlistByCountry={wishlistByCountry}
            mode={mode}
            onCountryClick={handleCountryClick}
            height={300}
          />
        )}
        {loading && (
          <div className="rounded-2xl flex items-center justify-center text-slate-400 text-sm" style={{ height: 300, background: 'rgba(0,0,0,0.06)' }}>
            Зареждане…
          </div>
        )}
      </div>

      {/* Fullscreen map modal */}
      {mapOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: 'rgba(4,12,24,0.96)', backdropFilter: 'blur(6px)' }}
        >
          {/* Modal header */}
          <div className="flex items-center gap-2 px-4 py-2.5 shrink-0"
            style={{ background: 'rgba(6,18,36,0.9)', borderBottom: '1px solid rgba(30,120,60,0.2)' }}>
            {(['tati', 'iva'] as UserType[]).map(u => (
              <button
                key={u}
                onClick={() => { resumeAudio(); sounds.click(); setActiveUser(u); }}
                className="px-4 py-1.5 rounded-full font-bold text-xs transition-all"
                style={{
                  background: activeUser === u ? USER_COLOR[u] : 'rgba(255,255,255,0.07)',
                  color: activeUser === u ? 'white' : 'rgba(255,255,255,0.5)',
                  border: `1.5px solid ${activeUser === u ? USER_COLOR[u] : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                {USER_DISPLAY[u]}
              </button>
            ))}
            <div className="ml-2 flex rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {(['visited', 'wishlist'] as AppMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { resumeAudio(); sounds.click(); setMode(m); }}
                  className="px-3 py-1 text-xs font-semibold transition-all"
                  style={{
                    background: mode === m ? USER_COLOR[activeUser] : 'transparent',
                    color: mode === m ? 'white' : 'rgba(255,255,255,0.45)',
                    borderRadius: '9999px',
                  }}
                >
                  {m === 'visited' ? '🗺️ Посетено' : '⭐ Желано'}
                </button>
              ))}
            </div>
            <button
              onClick={() => { resumeAudio(); sounds.click(); setMapOpen(false); setFactPopup(null); }}
              className="ml-auto w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg transition-all"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}
              title="Затвори"
            >
              ✕
            </button>
          </div>

          {/* Map fills remaining space */}
          <div className="flex-1 overflow-hidden">
            <WorldMap
              visitsByCountry={visitsByCountry}
              wishlistByCountry={wishlistByCountry}
              mode={mode}
              onCountryClick={handleCountryClick}
              fullscreen
            />
          </div>

          {/* Country fact popup */}
          {factPopup && (
            <div
              className="fact-popup-enter"
              style={{
                position: 'absolute',
                bottom: 44,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 60,
                width: 'min(90vw, 400px)',
                background: 'rgba(6,14,36,0.97)',
                border: '1px solid rgba(80,140,230,0.35)',
                borderRadius: 16,
                padding: '14px 18px',
                color: '#e2e8f0',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{getFlagEmoji(factPopup.iso)}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#93c5fd' }}>{factPopup.name}</span>
                <button
                  onClick={() => setFactPopup(null)}
                  style={{
                    marginLeft: 'auto', background: 'none', border: 'none',
                    color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 16, lineHeight: 1,
                  }}
                >✕</button>
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#cbd5e1' }}>{factPopup.fact}</div>
            </div>
          )}

          {/* Footer hint */}
          <div className="text-center py-2 text-xs shrink-0"
            style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(6,18,36,0.7)' }}>
            {mode === 'visited'
              ? `Кликни върху държава — добавя/премахва за ${USER_DISPLAY[activeUser]}`
              : `Кликни върху държава — добавя/премахва от желаните на ${USER_DISPLAY[activeUser]}`}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3 mt-4 px-4">
        {[
          { color: '#F59E0B', label: `само ${USER_DISPLAY.tati}` },
          { color: '#EC4899', label: `само ${USER_DISPLAY.iva}` },
          { color: '#7C3AED', label: 'двете заедно' },
          { color: '#14B8A6', label: 'желано' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>

      {/* Table */}
      <VisitsTable
        visitsByCountry={visitsByCountry}
        wishlistByCountry={wishlistByCountry}
        mode={mode}
      />

      {/* Toasts */}
      <div className="fixed top-4 left-1/2 z-50 flex flex-col gap-2 pointer-events-none" style={{ transform: 'translateX(-50%)' }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="toast px-5 py-2.5 rounded-2xl text-sm font-semibold shadow-xl whitespace-nowrap text-white text-center"
            style={{ background: toastColors[toast.type] }}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <div ref={xpPopRef} />
    </main>
  );
}
