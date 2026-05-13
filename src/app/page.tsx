'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  UserProfile, Visit, WishlistItem,
  VisitsByCountry, WishlistByCountry, UserProgress,
} from '@/types';
import { sounds, resumeAudio } from '@/lib/sounds';
import {
  fetchUsers, createUser, deleteUser,
  fetchVisits, fetchProgress,
  fetchWishlist, addWishlist, removeWishlist,
  addXP,
} from '@/lib/api';
import { ACHIEVEMENTS } from '@/lib/xp';
import { getFact } from '@/data/countryFacts';
import { BG_NAMES } from '@/data/countryNamesBg';
import UserCard from '@/components/XPBar/XPBar';
import VisitsTable from '@/components/VisitsTable';

const Globe    = dynamic(() => import('@/components/Globe'), { ssr: false });
const WorldMap = dynamic(() => import('@/components/WorldMap/WorldMap'), { ssr: false });

function getFlagEmoji(iso: string): string {
  if (!iso || iso.length !== 2) return '🌍';
  try {
    return String.fromCodePoint(
      0x1F1E6 + iso.toUpperCase().charCodeAt(0) - 65,
      0x1F1E6 + iso.toUpperCase().charCodeAt(1) - 65,
    );
  } catch { return '🌍'; }
}

const USER_COLORS = ['#8B5CF6','#10B981','#3B82F6','#F97316','#06B6D4','#EF4444','#84CC16','#EC4899'];

const EMOJI_CHOICES = [
  '🧳','🌸','✈️','🌍','🗺️','⭐','🏔️','🌊','🌺','🦋',
  '🌈','🎒','📸','🎭','🌙','☀️','🍀','🌴','🦁','🐬',
  '🦊','🌹','🎨','🏖️','🚀','🌻','🦄','🎵',
];

interface Toast { id: number; message: string; type: 'add' | 'remove' | 'xp' | 'level' | 'achievement' }

const DEFAULT_PROGRESS: UserProgress = { id: '', userId: '', xp: 0, level: 1, achievements: [] };

// Inline "add user" form
function AddUserForm({
  usedColors,
  onAdd,
  onCancel,
}: {
  usedColors: string[];
  onAdd: (displayName: string, color: string, emoji: string) => Promise<void>;
  onCancel: () => void;
}) {
  const nextColor = USER_COLORS.find(c => !usedColors.includes(c)) ?? USER_COLORS[0];
  const [name, setName] = useState('');
  const [color, setColor] = useState(nextColor);
  const [emoji, setEmoji] = useState('🌍');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    await onAdd(name.trim(), color, emoji);
    setSaving(false);
  };

  return (
    <div style={{
      background: 'white', borderRadius: 16, padding: '14px 16px',
      border: '1.5px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    }}>
      {/* Name + emoji row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <button
          onClick={() => {
            const idx = EMOJI_CHOICES.indexOf(emoji);
            setEmoji(EMOJI_CHOICES[(idx + 1) % EMOJI_CHOICES.length]);
          }}
          style={{ fontSize: 26, background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
          title="Смени иконата"
        >{emoji}</button>
        <input
          autoFocus
          placeholder="Въведи име..."
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
          style={{
            flex: 1, padding: '7px 12px', borderRadius: 10,
            border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none',
          }}
        />
      </div>

      {/* Color palette */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {USER_COLORS.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: 24, height: 24, borderRadius: '50%', background: c,
              border: color === c ? '3px solid #1e293b' : '2px solid transparent',
              cursor: 'pointer', padding: 0,
              boxShadow: color === c ? `0 0 0 2px white inset` : 'none',
            }}
          />
        ))}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={submit}
          disabled={!name.trim() || saving}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 10, fontWeight: 700, fontSize: 13,
            background: color, color: 'white', border: 'none', cursor: 'pointer',
            opacity: (!name.trim() || saving) ? 0.5 : 1,
          }}
        >
          {saving ? 'Запазване…' : '+ Добави'}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 16px', borderRadius: 10, fontSize: 13,
            background: '#F1F5F9', color: '#64748b', border: 'none', cursor: 'pointer',
          }}
        >
          Откажи
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [users, setUsers]       = useState<UserProfile[]>([]);
  const [visits, setVisits]     = useState<Visit[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [progress, setProgress] = useState<Record<string, UserProgress>>({});
  const [activeUser, setActiveUser]   = useState<UserProfile | null>(null);
  const [loading, setLoading]         = useState(true);
  const [toasts, setToasts]           = useState<Toast[]>([]);
  const [globeOpen, setGlobeOpen]     = useState(false);
  const [mapOpen, setMapOpen]         = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [factPopup, setFactPopup]     = useState<{ iso: string; name: string; fact: string } | null>(null);
  const xpPopRef = useRef<HTMLDivElement>(null);
  const factTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: Toast['type']) => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3200);
  }, []);

  useEffect(() => {
    Promise.all([fetchUsers(), fetchVisits(), fetchProgress(), fetchWishlist()])
      .then(([u, v, p, w]) => {
        setUsers(u);
        setActiveUser(u[0] ?? null);
        setVisits(v);
        setProgress(p);
        setWishlist(w);
      })
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
      if (!map[iso]) map[iso] = { country: v.country };
      (map[iso] as Record<string, unknown>)[v.userId] = true;
    }
    return map;
  }, [visits]);

  const wishlistByCountry = useMemo<WishlistByCountry>(() => {
    const map: WishlistByCountry = {};
    for (const w of wishlist) {
      const iso = w.country.isoCode;
      if (!map[iso]) map[iso] = { country: w.country };
      (map[iso] as Record<string, unknown>)[w.userId] = true;
    }
    return map;
  }, [wishlist]);

  const handleAwardXP = useCallback(async (userId: string, displayName: string, amount: number) => {
    try {
      const result = await addXP(userId, amount);
      setProgress((p) => ({ ...p, [userId]: result.progress }));
      if (result.leveledUp) {
        showToast(`🎉 ${displayName} достигна Ниво ${result.progress.level}!`, 'level');
      }
      for (const achId of result.newAchievements) {
        const ach = ACHIEVEMENTS.find((a) => a.id === achId);
        if (ach) showToast(`${ach.emoji} Постижение: ${ach.title}!`, 'achievement');
      }
    } catch { /* silent */ }
  }, [showToast]);

  const showFactPopup = useCallback((isoCode: string) => {
    const fact = getFact(isoCode);
    if (!fact) return;
    const name = BG_NAMES[isoCode] ?? isoCode;
    if (factTimerRef.current) clearTimeout(factTimerRef.current);
    setFactPopup({ iso: isoCode, name, fact });
    factTimerRef.current = setTimeout(() => setFactPopup(null), 6500);
  }, []);

  const handleCountryClick = useCallback(async (isoCode: string, countryName: string) => {
    if (!activeUser) return;
    showFactPopup(isoCode);

    const onWishlist = wishlistByCountry[isoCode]?.[activeUser.id] === true;

    if (onWishlist) {
      const item = wishlist.find((w) => w.country.isoCode === isoCode && w.userId === activeUser.id);
      if (!item) return;
      setWishlist((p) => p.filter((w) => w.id !== item.id));
      showToast(`${countryName} премахната от желаните на ${activeUser.displayName}`, 'remove');
      try { await removeWishlist(item.countryId, activeUser.id); }
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
        userId: activeUser.id,
        user: { id: activeUser.id, displayName: activeUser.displayName, color: activeUser.color },
        country: wishlistByCountry[isoCode]?.country ?? visitsByCountry[isoCode]?.country ?? { id: countryId!, name: countryName, capital: '', isoCode },
      };
      setWishlist((p) => [...p, optimistic]);
      showToast(`⭐ ${countryName} добавена в желаните на ${activeUser.displayName}`, 'add');
      handleAwardXP(activeUser.id, activeUser.displayName, 5);
      try {
        const real = await addWishlist(countryId!, activeUser.id);
        setWishlist((p) => [...p.filter((w) => w.id !== optimistic.id), real]);
      } catch {
        setWishlist((p) => p.filter((w) => w.id !== optimistic.id));
        showToast('Грешка при запазване', 'remove');
      }
    }
  }, [wishlistByCountry, wishlist, visits, visitsByCountry, activeUser, showToast, handleAwardXP, showFactPopup]);

  const handleAddUser = useCallback(async (displayName: string, color: string, emoji: string) => {
    const newUser = await createUser(displayName, color, emoji);
    setUsers(prev => [...prev, newUser]);
    setActiveUser(newUser);
    setShowAddForm(false);
  }, []);

  const handleDeleteUser = useCallback(async (userId: string) => {
    await deleteUser(userId);
    setUsers(prev => {
      const next = prev.filter(u => u.id !== userId);
      if (activeUser?.id === userId) setActiveUser(next[0] ?? null);
      return next;
    });
    setVisits(prev => prev.filter(v => v.userId !== userId));
    setWishlist(prev => prev.filter(w => w.userId !== userId));
    setProgress(prev => { const n = { ...prev }; delete n[userId]; return n; });
  }, [activeUser]);

  const toastColors: Record<Toast['type'], string> = {
    add: '#059669', remove: '#DC2626',
    xp: '#F59E0B', level: '#7C3AED', achievement: '#0EA5E9',
  };

  const activeColor = activeUser?.color ?? '#64748b';

  return (
    <main className="min-h-screen flex flex-col items-center pb-20 px-2">
      {/* Header */}
      <header className="w-full max-w-2xl pt-5 pb-2 text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800" style={{ letterSpacing: '-0.02em' }}>
          ⭐ Искам да посетя
        </h1>
        <p className="text-slate-500 text-xs mt-1 tracking-widest uppercase">Списък с мечтани дестинации</p>
      </header>

      {/* User switcher */}
      <div className="flex gap-3 w-full max-w-lg mt-3 px-2 flex-wrap">
        {users.map((u) => (
          <UserCard
            key={u.id}
            user={u}
            isActive={activeUser?.id === u.id}
            onClick={() => { sounds.click(); resumeAudio(); setActiveUser(u); setShowAddForm(false); }}
            onDelete={handleDeleteUser}
          />
        ))}
        {/* Add user button */}
        {!showAddForm && (
          <button
            onClick={() => { sounds.click(); resumeAudio(); setShowAddForm(true); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 14, fontSize: 13,
              background: 'rgba(255,255,255,0.7)', color: '#64748b',
              border: '2px dashed #CBD5E1', cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            + Добави
          </button>
        )}
      </div>

      {/* Add user form */}
      {showAddForm && (
        <div className="w-full max-w-lg mt-3 px-2">
          <AddUserForm
            usedColors={users.map(u => u.color)}
            onAdd={handleAddUser}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {/* Map section */}
      <div className="w-full max-w-2xl mt-4 px-2">
        <h2 className="text-base font-bold text-slate-700 mb-1.5 text-center">🗺️ Карта на пътешествието</h2>
        {!loading && activeUser && (
          <WorldMap
            visitsByCountry={visitsByCountry}
            wishlistByCountry={wishlistByCountry}
            mode="wishlist"
            onCountryClick={handleCountryClick}
            height={300}
          />
        )}
        {loading && (
          <div className="rounded-2xl flex items-center justify-center text-slate-400 text-sm" style={{ height: 300, background: 'rgba(0,0,0,0.06)' }}>
            Зареждане…
          </div>
        )}

        {/* Buttons below map */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => { resumeAudio(); sounds.click(); setGlobeOpen(true); }}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'white', color: activeColor, borderColor: activeColor }}
          >
            🌍 Покажи интерактивен глобус
          </button>
          <button
            onClick={() => { resumeAudio(); sounds.click(); setMapOpen(true); }}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: activeColor, color: 'white', boxShadow: `0 3px 12px ${activeColor}40` }}
          >
            🗺️ Покажи на цял екран
          </button>
        </div>
      </div>

      {/* Fullscreen globe modal */}
      {globeOpen && (
        <div className="fixed inset-0 flex flex-col" style={{ background: '#040c18', zIndex: 9999 }}>
          <div className="flex items-center gap-2 px-4 py-2.5 shrink-0"
            style={{ background: 'rgba(6,18,36,0.9)', borderBottom: '1px solid rgba(80,140,230,0.15)' }}>
            {users.map(u => (
              <button key={u.id} onClick={() => { resumeAudio(); sounds.click(); setActiveUser(u); }}
                className="px-4 py-1.5 rounded-full font-bold text-xs transition-all"
                style={{
                  background: activeUser?.id === u.id ? u.color : 'rgba(255,255,255,0.07)',
                  color: activeUser?.id === u.id ? 'white' : 'rgba(255,255,255,0.5)',
                  border: `1.5px solid ${activeUser?.id === u.id ? u.color : 'rgba(255,255,255,0.1)'}`,
                }}>
                {u.displayName}
              </button>
            ))}
            <button onClick={() => { resumeAudio(); sounds.click(); setGlobeOpen(false); setFactPopup(null); }}
              className="ml-auto w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg transition-all"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}
              title="Затвори">✕</button>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-hidden"
            style={{ filter: 'drop-shadow(0 0 40px rgba(14,100,148,0.4))', touchAction: 'none' }}>
            {activeUser && (
              <Globe
                visitsByCountry={visitsByCountry}
                wishlistByCountry={wishlistByCountry}
                activeUser={activeUser.id}
                mode="wishlist"
                onCountryClick={handleCountryClick}
                fullscreen
              />
            )}
          </div>
          {factPopup && (
            <div className="fact-popup-enter" style={{
              position: 'absolute', bottom: 44, left: '50%', transform: 'translateX(-50%)',
              zIndex: 60, width: 'min(90vw, 400px)',
              background: 'rgba(6,14,36,0.97)', border: '1px solid rgba(80,140,230,0.35)',
              borderRadius: 16, padding: '14px 18px', color: '#e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{getFlagEmoji(factPopup.iso)}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#93c5fd' }}>{factPopup.name}</span>
                <button onClick={() => setFactPopup(null)}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#cbd5e1' }}>{factPopup.fact}</div>
            </div>
          )}
          <div className="text-center pb-2 text-xs shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Кликни двукратно върху държава — добавя/премахва от желаните на {activeUser?.displayName}
          </div>
        </div>
      )}

      {/* Fullscreen map modal */}
      {mapOpen && (
        <div className="fixed inset-0 flex flex-col" style={{ background: '#040c18', zIndex: 9999 }}>
          <div className="flex items-center gap-2 px-4 py-2.5 shrink-0"
            style={{ background: 'rgba(6,18,36,0.9)', borderBottom: '1px solid rgba(30,120,60,0.2)' }}>
            {users.map(u => (
              <button key={u.id} onClick={() => { resumeAudio(); sounds.click(); setActiveUser(u); }}
                className="px-4 py-1.5 rounded-full font-bold text-xs transition-all"
                style={{
                  background: activeUser?.id === u.id ? u.color : 'rgba(255,255,255,0.07)',
                  color: activeUser?.id === u.id ? 'white' : 'rgba(255,255,255,0.5)',
                  border: `1.5px solid ${activeUser?.id === u.id ? u.color : 'rgba(255,255,255,0.1)'}`,
                }}>
                {u.displayName}
              </button>
            ))}
            <button onClick={() => { resumeAudio(); sounds.click(); setMapOpen(false); setFactPopup(null); }}
              className="ml-auto w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg transition-all"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}
              title="Затвори">✕</button>
          </div>
          <div className="flex-1 overflow-hidden">
            <WorldMap
              visitsByCountry={visitsByCountry}
              wishlistByCountry={wishlistByCountry}
              mode="wishlist"
              onCountryClick={handleCountryClick}
              fullscreen
            />
          </div>
          {factPopup && (
            <div className="fact-popup-enter" style={{
              position: 'absolute', bottom: 44, left: '50%', transform: 'translateX(-50%)',
              zIndex: 60, width: 'min(90vw, 400px)',
              background: 'rgba(6,14,36,0.97)', border: '1px solid rgba(80,140,230,0.35)',
              borderRadius: 16, padding: '14px 18px', color: '#e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{getFlagEmoji(factPopup.iso)}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#93c5fd' }}>{factPopup.name}</span>
                <button onClick={() => setFactPopup(null)}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#cbd5e1' }}>{factPopup.fact}</div>
            </div>
          )}
          <div className="text-center py-2 text-xs shrink-0"
            style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(6,18,36,0.7)' }}>
            Кликни върху държава — добавя/премахва от желаните на {activeUser?.displayName}
          </div>
        </div>
      )}

      {/* Wishlist table */}
      <VisitsTable
        visitsByCountry={visitsByCountry}
        wishlistByCountry={wishlistByCountry}
        mode="wishlist"
        users={users}
      />

      {/* Toasts */}
      <div className="fixed top-4 left-1/2 flex flex-col gap-2 pointer-events-none" style={{ transform: 'translateX(-50%)', zIndex: 10000 }}>
        {toasts.map((toast) => (
          <div key={toast.id} className="toast px-5 py-2.5 rounded-2xl text-sm font-semibold shadow-xl whitespace-nowrap text-white text-center"
            style={{ background: toastColors[toast.type] }}>
            {toast.message}
          </div>
        ))}
      </div>

      <div ref={xpPopRef} />
    </main>
  );
}
