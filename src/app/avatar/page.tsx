'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { UserProfile, AvatarConfig, FaceType, Expression } from '@/types';
import { fetchUsers } from '@/lib/api';
import { sounds, resumeAudio } from '@/lib/sounds';

const Avatar3D   = dynamic(() => import('@/components/Avatar3D/Avatar3D'),   { ssr: false });
const AvatarRPM  = dynamic(() => import('@/components/AvatarRPM/AvatarRPM'), { ssr: false });

// ── Constants ─────────────────────────────────────────────────────────────────

const HAIR_STYLES: { value: AvatarConfig['hairStyle']; label: string }[] = [
  { value: 'short',    label: 'Късa' },
  { value: 'long',     label: 'Дълга' },
  { value: 'longest',  label: 'Много дълга' },
  { value: 'loose',    label: 'Пусната' },
  { value: 'curly',    label: 'Къдрава' },
  { value: 'ponytail', label: 'Опашка' },
  { value: 'braid',    label: 'Плитка' },
  { value: 'tied',     label: 'Кок' },
  { value: 'bald',     label: 'Без коса' },
];

const BACKGROUNDS: { value: string; label: string }[] = [
  { value: 'studio',   label: '🎨 Студио' },
  { value: 'beach',    label: '🏖 Плаж' },
  { value: 'mountain', label: '⛰ Планина' },
  { value: 'city',     label: '🏙 Град' },
  { value: 'home',     label: '🏠 Вкъщи' },
  { value: 'forest',   label: '🌲 Гора' },
  { value: 'sunset',   label: '🌇 Залез' },
  { value: 'space',    label: '🌌 Космос' },
];

const OUTFITS: { value: AvatarConfig['outfit']; label: string }[] = [
  { value: 'casual',    label: 'Ежедневно' },
  { value: 'travel',    label: 'Пътуване' },
  { value: 'explorer',  label: 'Изследовател' },
  { value: 'summer',    label: 'Лято' },
  { value: 'winter',    label: 'Зима' },
  { value: 'sporty',    label: 'Спорт' },
  { value: 'adventure', label: 'Приключение' },
  { value: 'beach',     label: 'Плаж' },
  { value: 'city',      label: 'Град' },
  { value: 'formal',    label: 'Официално' },
  { value: 'safari',    label: 'Сафари' },
  { value: 'ninja',     label: 'Нинджа' },
  { value: 'royal',     label: 'Кралско' },
  { value: 'scuba',     label: 'Гмуркане' },
];

const FACE_TYPES: { value: FaceType; label: string }[] = [
  { value: 'standard', label: 'Стандартно' },
  { value: 'long',     label: 'Издължено' },
  { value: 'child',    label: 'Детско' },
  { value: 'angular',  label: 'Ъгловато' },
];

const OUTFIT_COLOR_PRESETS = [
  '#60A5FA', '#10B981', '#DC2626', '#FBBF24',
  '#7C3AED', '#EC4899', '#FB923C', '#1E293B',
  '#0EA5E9', '#84CC16',
];

const EXPRESSIONS: { value: Expression; label: string }[] = [
  { value: 'smile',     label: '😊 Усмивка' },
  { value: 'neutral',   label: '😐 Неутрално' },
  { value: 'surprised', label: '😮 Изненадан' },
  { value: 'thinking',  label: '🤔 Мислещ' },
];

const ACCESSORY_CATEGORIES: { label: string; items: { id: string; label: string }[] }[] = [
  { label: 'Глава', items: [
    { id: 'cap',          label: '🧢 Бейзболна' },
    { id: 'winter-hat',   label: '🎩 Зимна' },
    { id: 'explorer-hat', label: '🤠 Изследовател' },
    { id: 'crown',        label: '👑 Корона' },
    { id: 'flower-crown', label: '🌸 Цветна корона' },
    { id: 'headphones',   label: '🎧 Слушалки' },
    { id: 'pirate-hat',   label: '☠️ Пиратска' },
    { id: 'wizard-hat',   label: '🧙 Магьосник' },
    { id: 'animal-ears',  label: '🐱 Котешки уши' },
  ]},
  { label: 'Лице', items: [
    { id: 'glasses',        label: '🔵 Очила' },
    { id: 'sunglasses',     label: '😎 Слънчеви' },
    { id: 'sporty-glasses', label: '🟠 Спортни' },
    { id: 'ski-goggles',    label: '🎿 Ски' },
    { id: 'monocle',        label: '🧐 Монокъл' },
    { id: 'superhero-mask', label: '🦸 Маска' },
  ]},
  { label: 'Врат', items: [
    { id: 'scarf',            label: '🧣 Шал' },
    { id: 'tie',              label: '👔 Вратовръзка' },
    { id: 'bow-tie',          label: '🎀 Папийонка' },
    { id: 'necklace',         label: '📿 Огърлица' },
    { id: 'compass-necklace', label: '🧭 Компас' },
  ]},
  { label: 'Гръб', items: [
    { id: 'travel-backpack',  label: '🟢 Пътнически' },
    { id: 'backpack',         label: '🟡 Раница' },
    { id: 'hiking-backpack',  label: '🏔️ Туристическа' },
    { id: 'school-backpack',  label: '🎒 Ученическа' },
    { id: 'guitar-case',      label: '🎸 Китара' },
    { id: 'butterfly-wings',  label: '🦋 Крила' },
  ]},
  { label: 'Тяло', items: [
    { id: 'watch',      label: '⌚ Часовник' },
    { id: 'bracelet',   label: '📿 Гривна' },
    { id: 'gloves',     label: '🧤 Ръкавици' },
    { id: 'belt-bag',   label: '👜 Чантичка' },
    { id: 'camera',     label: '📷 Камера' },
    { id: 'medal',      label: '🥇 Медал' },
    { id: 'umbrella',   label: '☂️ Чадър' },
    { id: 'binoculars', label: '🔭 Бинокъл' },
    { id: 'map',        label: '🗺️ Карта' },
  ]},
];

const SKIN_PRESETS = ['#FBBF8A', '#F4A460', '#D2691E', '#8B4513', '#FFDAB9', '#C68642'];
const HAIR_PRESETS = ['#8B4513', '#1a1a1a', '#D4AF37', '#FF6B35', '#C0C0C0', '#FFFFFF'];
const EYE_PRESETS  = ['#4B5563', '#3B82F6', '#10B981', '#8B4513', '#6B21A8', '#9CA3AF'];

// ── Themed presets ────────────────────────────────────────────────────────────
type Preset = {
  id: string;
  emoji: string;
  label: string;
  patch: Partial<Pick<AvatarConfig, 'hairStyle' | 'hairColor' | 'outfit' | 'accessories' | 'eyeColor' | 'skinColor' | 'expression' | 'faceType'>>;
  outfitColor?: string | null;
};

const PRESETS: Preset[] = [
  { id: 'superhero', emoji: '🦸', label: 'Супергерой',
    patch: { hairStyle: 'short', hairColor: '#1a1a1a', outfit: 'sporty', accessories: ['superhero-mask','belt-bag','gloves'], expression: 'smile' },
    outfitColor: '#DC2626' },
  { id: 'astronaut', emoji: '🚀', label: 'Астронавт',
    patch: { hairStyle: 'short', hairColor: '#8B4513', outfit: 'scuba', accessories: ['ski-goggles','gloves','watch'], expression: 'surprised' },
    outfitColor: '#E5E7EB' },
  { id: 'pirate', emoji: '🏴‍☠️', label: 'Пират',
    patch: { hairStyle: 'long', hairColor: '#1a1a1a', outfit: 'adventure', accessories: ['pirate-hat','belt-bag','compass-necklace'], expression: 'smile' },
    outfitColor: '#1E293B' },
  { id: 'princess', emoji: '👸', label: 'Принцеса',
    patch: { hairStyle: 'longest', hairColor: '#D4AF37', outfit: 'royal', accessories: ['crown','necklace','flower-crown'], expression: 'smile' },
    outfitColor: '#EC4899' },
  { id: 'ninja', emoji: '🥷', label: 'Нинджа',
    patch: { hairStyle: 'tied', hairColor: '#1a1a1a', outfit: 'ninja', accessories: ['superhero-mask'], expression: 'thinking' },
    outfitColor: '#0F172A' },
  { id: 'scientist', emoji: '🔬', label: 'Учен',
    patch: { hairStyle: 'curly', hairColor: '#C0C0C0', outfit: 'formal', accessories: ['glasses','tie','watch'], expression: 'thinking' },
    outfitColor: '#F8FAFC' },
  { id: 'wizard', emoji: '🧙', label: 'Магьосник',
    patch: { hairStyle: 'long', hairColor: '#FFFFFF', outfit: 'royal', accessories: ['wizard-hat','compass-necklace'], expression: 'smile' },
    outfitColor: '#7C3AED' },
  { id: 'explorer', emoji: '🤠', label: 'Изследовател',
    patch: { hairStyle: 'short', hairColor: '#8B4513', outfit: 'explorer', accessories: ['explorer-hat','binoculars','map','compass-necklace'], expression: 'smile' },
    outfitColor: '#A16207' },
];

// ── Pets ─────────────────────────────────────────────────────────────────────
type PetId = 'none' | 'dog' | 'cat' | 'rabbit' | 'dragon' | 'butterfly' | 'parrot' | 'fox';
const PETS: { id: PetId; emoji: string; label: string }[] = [
  { id: 'none',      emoji: '🚫', label: 'Без' },
  { id: 'dog',       emoji: '🐶', label: 'Куче' },
  { id: 'cat',       emoji: '🐱', label: 'Котка' },
  { id: 'rabbit',    emoji: '🐰', label: 'Зайче' },
  { id: 'fox',       emoji: '🦊', label: 'Лисица' },
  { id: 'dragon',    emoji: '🐉', label: 'Дракон' },
  { id: 'butterfly', emoji: '🦋', label: 'Пеперуда' },
  { id: 'parrot',    emoji: '🦜', label: 'Папагал' },
];

// ── Emotes ───────────────────────────────────────────────────────────────────
type EmoteId = 'wave' | 'jump' | 'dance' | 'victory' | 'sleep';
const EMOTES: { id: EmoteId; emoji: string; label: string }[] = [
  { id: 'wave',    emoji: '👋', label: 'Здравей' },
  { id: 'jump',    emoji: '🤸', label: 'Скок' },
  { id: 'dance',   emoji: '💃', label: 'Танц' },
  { id: 'victory', emoji: '🏆', label: 'Победа' },
  { id: 'sleep',   emoji: '😴', label: 'Сън' },
];

// ── Defaults ──────────────────────────────────────────────────────────────────

function defaultConfig(userId = ''): AvatarConfig {
  return {
    id: userId,
    userId,
    hairStyle:   'short',
    hairColor:   '#8B4513',
    eyeColor:    '#4B5563',
    skinColor:   '#FBBF8A',
    outfit:      'casual',
    accessories: [],
    faceType:    'standard',
    expression:  'smile',
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AvatarPage() {
  const [users, setUsers]           = useState<UserProfile[]>([]);
  const [activeUser, setActiveUser] = useState<UserProfile | null>(null);
  const [configs, setConfigs]       = useState<Record<string, AvatarConfig>>({});
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string | null>>({});
  const [importInput, setImportInput] = useState('');
  const [saving, setSaving]           = useState(false);
  const [saved,  setSaved]            = useState(false);
  const [tab, setTab]                 = useState<'build' | 'import'>('build');
  const [backgrounds, setBackgrounds]   = useState<Record<string, string>>({});
  const [outfitColors, setOutfitColors] = useState<Record<string, string | null>>({});
  const [pets, setPets]                 = useState<Record<string, PetId>>({});
  const [petOffsets, setPetOffsets]     = useState<Record<string, { x: number; y: number }>>({});
  const [emote, setEmote]               = useState<{ type: EmoteId; id: number } | null>(null);
  const petDragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  const activeId = activeUser?.id ?? '';

  // Load users on mount
  useEffect(() => {
    fetchUsers().then(us => {
      setUsers(us);
      setActiveUser(u => u ?? (us[0] ?? null));
    }).catch(() => {});
  }, []);

  // Persist background choice per user in localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('avatar-bg');
      if (raw) setBackgrounds(JSON.parse(raw) as Record<string, string>);
    } catch { /* ignore */ }
  }, []);
  const setBackground = useCallback((bg: string) => {
    setBackgrounds(prev => {
      const next = { ...prev, [activeId]: bg };
      try { localStorage.setItem('avatar-bg', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [activeId]);

  // Persist outfit color choice per user
  useEffect(() => {
    try {
      const raw = localStorage.getItem('avatar-outfit-color');
      if (raw) setOutfitColors(JSON.parse(raw) as Record<string, string | null>);
    } catch { /* ignore */ }
  }, []);
  const setOutfitColor = useCallback((color: string | null) => {
    setOutfitColors(prev => {
      const next = { ...prev, [activeId]: color };
      try { localStorage.setItem('avatar-outfit-color', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [activeId]);

  // Persist pet choice per user
  useEffect(() => {
    try {
      const raw = localStorage.getItem('avatar-pet');
      if (raw) setPets(JSON.parse(raw) as Record<string, PetId>);
    } catch { /* ignore */ }
  }, []);
  const setPet = useCallback((p: PetId) => {
    setPets(prev => {
      const next = { ...prev, [activeId]: p };
      try { localStorage.setItem('avatar-pet', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    // Reset offset when switching pets (each pet has its own good default position)
    setPetOffsets(prev => {
      const next = { ...prev, [activeId]: { x: 0, y: 0 } };
      try { localStorage.setItem('avatar-pet-offsets', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [activeId]);

  // Persist pet drag offsets per user
  useEffect(() => {
    try {
      const raw = localStorage.getItem('avatar-pet-offsets');
      if (raw) setPetOffsets(JSON.parse(raw) as Record<string, { x: number; y: number }>);
    } catch { /* ignore */ }
  }, []);
  const savePetOffset = useCallback((offset: { x: number; y: number }) => {
    setPetOffsets(prev => {
      const next = { ...prev, [activeId]: offset };
      try { localStorage.setItem('avatar-pet-offsets', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [activeId]);

  // Apply preset → patches the config
  const applyPreset = useCallback((preset: Preset) => {
    setConfigs(prev => ({
      ...prev,
      [activeId]: { ...(prev[activeId] ?? defaultConfig(activeId)), ...preset.patch },
    }));
    if (preset.outfitColor !== undefined) setOutfitColor(preset.outfitColor);
    setSaved(false);
  }, [activeId, setOutfitColor]);

  // Surprise Me — randomise everything
  const surpriseMe = useCallback(() => {
    const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];
    const allAcc = ACCESSORY_CATEGORIES.flatMap(c => c.items.map(i => i.id));
    const randomAccessories = allAcc.filter(() => Math.random() < 0.12).slice(0, 4);
    const next: Partial<AvatarConfig> = {
      hairStyle: pick(HAIR_STYLES.map(h => h.value)),
      hairColor: pick(HAIR_PRESETS),
      eyeColor:  pick(EYE_PRESETS),
      skinColor: pick(SKIN_PRESETS),
      outfit:    pick(OUTFITS.map(o => o.value)),
      expression: pick(EXPRESSIONS.map(e => e.value)),
      faceType:   pick(FACE_TYPES.map(f => f.value)),
      accessories: randomAccessories,
    };
    setConfigs(prev => ({
      ...prev,
      [activeId]: { ...(prev[activeId] ?? defaultConfig(activeId)), ...next },
    }));
    setOutfitColor(Math.random() < 0.5 ? pick(OUTFIT_COLOR_PRESETS) : null);
    setSaved(false);
  }, [activeId, setOutfitColor]);

  // Trigger an emote — id timestamp so same emote retriggers
  const playEmote = useCallback((type: EmoteId) => {
    setEmote({ type, id: Date.now() });
  }, []);

  // Load persisted data on mount
  useEffect(() => {
    fetch('/api/avatar').then(r => r.json()).then(data => {
      const newConfigs: Record<string, AvatarConfig> = {};
      const newUrls: Record<string, string | null> = {};
      for (const userId of Object.keys(data)) {
        const d = data[userId] as Record<string, unknown>;
        newConfigs[userId] = {
          ...defaultConfig(userId),
          hairStyle:   (d.hairStyle  as AvatarConfig['hairStyle']) ?? 'short',
          hairColor:   (d.hairColor  as string) ?? '#8B4513',
          eyeColor:    (d.eyeColor   as string) ?? '#4B5563',
          skinColor:   (d.skinColor  as string) ?? '#FBBF8A',
          outfit:      (d.outfit     as AvatarConfig['outfit'])    ?? 'casual',
          accessories: (d.accessories as string[]) ?? [],
          faceType:    (d.faceType   as FaceType)  ?? 'standard',
          expression:  (d.expression as Expression) ?? 'smile',
        };
        newUrls[userId] = (d.avatarUrl as string | null) ?? null;
      }
      setConfigs(prev => ({ ...prev, ...newConfigs }));
      setAvatarUrls(prev => ({ ...prev, ...newUrls }));
    }).catch(() => {});
  }, []);

  // Sync importInput when user tab switches
  useEffect(() => {
    setImportInput(avatarUrls[activeId] ?? '');
  }, [activeId, avatarUrls]);

  const cfg   = configs[activeId] ?? defaultConfig(activeId);
  const color = activeUser?.color ?? '#64748b';

  // ── Helpers ────────────────────────────────────────────────────────────────

  const updateConfig = useCallback(<K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) => {
    setConfigs(prev => ({
      ...prev,
      [activeId]: { ...(prev[activeId] ?? defaultConfig(activeId)), [key]: value },
    }));
    setSaved(false);
  }, [activeId]);

  const persist = useCallback(async (overrides?: Partial<AvatarConfig> & { avatarUrl?: string | null }) => {
    if (!activeUser) return;
    setSaving(true);
    resumeAudio(); sounds.add();
    const current = configs[activeId] ?? defaultConfig(activeId);
    const { id: _id, userId: _userId, ...cfgFields } = current;
    const payload = { userId: activeId, ...cfgFields, ...overrides };
    try {
      await fetch('/api/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ }
    setSaving(false);
  }, [activeId, activeUser, configs]);

  const handleImport = useCallback(async () => {
    const url = importInput.trim();
    if (!url) return;
    setAvatarUrls(prev => ({ ...prev, [activeId]: url }));
    await persist({ avatarUrl: url });
  }, [importInput, activeId, persist]);

  const handleClearImport = useCallback(async () => {
    setImportInput('');
    setAvatarUrls(prev => ({ ...prev, [activeId]: null }));
    await persist({ avatarUrl: null });
  }, [activeId, persist]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen px-4 py-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-extrabold text-slate-800 mb-4">🧑 Моят герой</h1>

      {/* Two-column on desktop: sticky avatar left, editor right.
          Single column on mobile: avatar centered on top, editor below. */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">

      {/* ── Sticky avatar card ─────────────────────────────────────────── */}
      <div
        className="flex flex-col items-center gap-3 pt-3 pb-4 rounded-2xl bg-white shadow-md flex-shrink-0 sticky self-start z-10"
        style={{ border: `2px solid ${color}28`, width: 'fit-content', top: 56 }}
      >
        {/* User switcher — above the avatar */}
        <div className="flex gap-2 flex-wrap justify-center" style={{ maxWidth: 260, padding: '0 8px' }}>
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => { sounds.click(); resumeAudio(); setActiveUser(u); setSaved(false); }}
              className="px-3 py-1.5 rounded-full font-bold text-xs transition-all"
              style={{
                background: activeUser?.id === u.id ? u.color : '#F8FAFC',
                color: activeUser?.id === u.id ? 'white' : '#64748b',
                border: `2px solid ${activeUser?.id === u.id ? u.color : '#E2E8F0'}`,
                boxShadow: activeUser?.id === u.id ? `0 3px 12px ${u.color}40` : 'none',
              }}
            >
              {u.displayName}
            </button>
          ))}
        </div>

        {/* Avatar preview */}
        {avatarUrls[activeId] ? (
          <>
            <AvatarRPM avatarUrl={avatarUrls[activeId]!} width={220} height={290} />
            <span className="text-xs text-slate-400">Завърти / Приближи</span>
          </>
        ) : (
          <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
            <Avatar3D
              avatar={cfg}
              expression={cfg.expression ?? 'smile'}
              width={220}
              height={290}
              background={backgrounds[activeId] ?? 'studio'}
              outfitColor={outfitColors[activeId] ?? undefined}
              pet={pets[activeId] ?? 'none'}
              petOffset={petOffsets[activeId] ?? { x: 0, y: 0 }}
              emote={emote}
            />
            {/* Pet drag overlay — visible only when a pet is active */}
            {(pets[activeId] ?? 'none') !== 'none' && (
              <div
                style={{
                  position: 'absolute', inset: 0,
                  cursor: petDragRef.current ? 'grabbing' : 'grab',
                  zIndex: 5,
                  // Transparent — only captures pointer events for drag
                  background: 'transparent',
                }}
                title="Влачи любимеца"
                onPointerDown={e => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const cur = petOffsets[activeId] ?? { x: 0, y: 0 };
                  petDragRef.current = { startX: e.clientX, startY: e.clientY, baseX: cur.x, baseY: cur.y };
                }}
                onPointerMove={e => {
                  if (!petDragRef.current) return;
                  // 220×290 canvas — 1px ≈ 0.0098 world units
                  const scale = 0.0098;
                  const dx = (e.clientX - petDragRef.current.startX) * scale;
                  const dy = -(e.clientY - petDragRef.current.startY) * scale;
                  setPetOffsets(prev => ({
                    ...prev,
                    [activeId]: { x: petDragRef.current!.baseX + dx, y: petDragRef.current!.baseY + dy },
                  }));
                }}
                onPointerUp={e => {
                  if (!petDragRef.current) return;
                  e.currentTarget.releasePointerCapture(e.pointerId);
                  const cur = petOffsets[activeId] ?? { x: 0, y: 0 };
                  savePetOffset(cur);
                  petDragRef.current = null;
                }}
                onPointerCancel={() => { petDragRef.current = null; }}
              />
            )}
          </div>
        )}

        {/* Emote buttons — appear only in build mode (no GLB avatar) */}
        {!avatarUrls[activeId] && (
          <div className="flex gap-1.5 flex-wrap justify-center" style={{ maxWidth: 240 }}>
            {EMOTES.map(em => (
              <button
                key={em.id}
                onClick={() => { resumeAudio(); sounds.click(); playEmote(em.id); }}
                title={em.label}
                className="flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                style={{
                  width: 38, height: 38, borderRadius: 12,
                  background: 'white',
                  border: `1.5px solid ${color}30`,
                  fontSize: 18,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                {em.emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Editor panel (right column on desktop) ───────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Mode tabs */}
        <div className="flex rounded-xl overflow-hidden border border-slate-200">
          {(['build', 'import'] as const).map(t => (
            <button
              key={t}
              onClick={() => { sounds.click(); resumeAudio(); setTab(t); }}
              className="flex-1 py-2 text-xs font-bold transition-all"
              style={{
                background: tab === t ? color : 'white',
                color: tab === t ? 'white' : '#64748b',
              }}
            >
              {t === 'build' ? '🎨 Направи сам' : '🔗 Импортирай GLB'}
            </button>
          ))}
        </div>

        {tab === 'build' ? (
          <>
            {/* Themed presets — one-tap full looks */}
            <Section color={color} label="🎭 Бързи стилове">
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { resumeAudio(); sounds.click(); applyPreset(p); }}
                    title={p.label}
                    className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all hover:scale-105 active:scale-95"
                    style={{
                      background: 'white',
                      border: `1.5px solid ${color}28`,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    }}
                  >
                    <span style={{ fontSize: 22, lineHeight: 1 }}>{p.emoji}</span>
                    <span className="text-[10px] font-semibold text-slate-600 leading-tight text-center">{p.label}</span>
                  </button>
                ))}
              </div>
            </Section>

            {/* Pet companion */}
            <Section color={color} label="🐾 Любимец">
              <div className="flex flex-wrap gap-1.5">
                {PETS.map(p => {
                  const active = (pets[activeId] ?? 'none') === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { resumeAudio(); sounds.click(); setPet(p.id); }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                      style={{
                        background: active ? color : 'white',
                        color: active ? 'white' : '#64748b',
                        border: `1.5px solid ${active ? color : '#E2E8F0'}`,
                        boxShadow: active ? `0 2px 8px ${color}40` : 'none',
                      }}
                    >
                      <span style={{ fontSize: 14, lineHeight: 1 }}>{p.emoji}</span>
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Hair style */}
            <Section color={color} label="Прическа">
              <div className="flex flex-wrap gap-1.5">
                {HAIR_STYLES.map(({ value, label }) => (
                  <Chip
                    key={value}
                    active={cfg.hairStyle === value}
                    color={color}
                    onClick={() => updateConfig('hairStyle', value)}
                  >
                    {label}
                  </Chip>
                ))}
              </div>
            </Section>

            {/* Hair color */}
            <Section color={color} label="Цвят на косата">
              <ColorPicker
                value={cfg.hairColor}
                presets={HAIR_PRESETS}
                onChange={v => updateConfig('hairColor', v)}
              />
            </Section>

            {/* Skin color */}
            <Section color={color} label="Цвят на кожата">
              <ColorPicker
                value={cfg.skinColor}
                presets={SKIN_PRESETS}
                onChange={v => updateConfig('skinColor', v)}
              />
            </Section>

            {/* Eye color */}
            <Section color={color} label="Цвят на очите">
              <ColorPicker
                value={cfg.eyeColor}
                presets={EYE_PRESETS}
                onChange={v => updateConfig('eyeColor', v)}
              />
            </Section>

            {/* Face type */}
            <Section color={color} label="Форма на лицето">
              <div className="flex flex-wrap gap-1.5">
                {FACE_TYPES.map(({ value, label }) => (
                  <Chip
                    key={value}
                    active={cfg.faceType === value}
                    color={color}
                    onClick={() => updateConfig('faceType', value)}
                  >
                    {label}
                  </Chip>
                ))}
              </div>
            </Section>

            {/* Expression */}
            <Section color={color} label="Израз">
              <div className="flex flex-wrap gap-1.5">
                {EXPRESSIONS.map(({ value, label }) => (
                  <Chip
                    key={value}
                    active={cfg.expression === value}
                    color={color}
                    onClick={() => updateConfig('expression', value)}
                  >
                    {label}
                  </Chip>
                ))}
              </div>
            </Section>

            {/* Outfit */}
            <Section color={color} label="Облекло">
              <div className="flex flex-wrap gap-1.5">
                {OUTFITS.map(({ value, label }) => (
                  <Chip
                    key={value}
                    active={cfg.outfit === value}
                    color={color}
                    onClick={() => updateConfig('outfit', value)}
                  >
                    {label}
                  </Chip>
                ))}
              </div>
            </Section>

            {/* Outfit color */}
            <Section color={color} label="Цвят на облеклото">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setOutfitColor(null)}
                  title="Стандартен цвят"
                  style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: 'conic-gradient(#f87171,#fbbf24,#34d399,#60a5fa,#a78bfa,#f87171)',
                    border: outfitColors[activeId] === null || outfitColors[activeId] === undefined ? '3px solid #1e293b' : '2px solid #e2e8f0',
                  }}
                />
                {OUTFIT_COLOR_PRESETS.map(c => (
                  <button
                    key={c}
                    onClick={() => setOutfitColor(c)}
                    style={{
                      width: 26, height: 26, borderRadius: '50%', background: c,
                      border: outfitColors[activeId] === c ? '3px solid #1e293b' : '2px solid #e2e8f0',
                      boxShadow: outfitColors[activeId] === c ? '0 0 0 2px white inset' : 'none',
                    }}
                  />
                ))}
                <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="color"
                    value={outfitColors[activeId] ?? '#60A5FA'}
                    onChange={e => setOutfitColor(e.target.value)}
                    style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0 }}
                  />
                  <span className="text-xs text-slate-400">Избери</span>
                </label>
              </div>
            </Section>

            {/* Background */}
            <Section color={color} label="Фон">
              <div className="flex flex-wrap gap-1.5">
                {BACKGROUNDS.map(({ value, label }) => (
                  <Chip
                    key={value}
                    active={(backgrounds[activeId] ?? 'studio') === value}
                    color={color}
                    onClick={() => setBackground(value)}
                  >
                    {label}
                  </Chip>
                ))}
              </div>
            </Section>

            {/* Accessories */}
            <Section color={color} label="Аксесоари">
              <div className="space-y-3">
                {ACCESSORY_CATEGORIES.map(cat => (
                  <div key={cat.label}>
                    <p className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{cat.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.items.map(({ id, label }) => {
                        const curAcc = cfg.accessories ?? [];
                        const active = curAcc.includes(id);
                        return (
                          <Chip
                            key={id}
                            active={active}
                            color={color}
                            onClick={() => {
                              const next = active
                                ? curAcc.filter(a => a !== id)
                                : [...curAcc, id];
                              updateConfig('accessories', next);
                            }}
                          >
                            {label}
                          </Chip>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <div className="flex gap-2">
              <button
                onClick={() => { resumeAudio(); sounds.click(); surpriseMe(); }}
                className="flex-1 py-3 rounded-2xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'white',
                  color,
                  border: `2px dashed ${color}`,
                }}
              >
                🎲 Изненадай ме
              </button>
              <button
                onClick={() => persist()}
                className="flex-1 py-3 rounded-2xl font-bold text-white text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: color, boxShadow: `0 4px 16px ${color}40` }}
              >
                💾 Запази героя
              </button>
            </div>
          </>
        ) : (
          /* ── Import GLB tab ──────────────────────────────────────────── */
          <div className="space-y-4">
            <div
              className="rounded-2xl p-4 text-xs text-slate-600 leading-relaxed space-y-1"
              style={{ background: `${color}0e`, border: `1.5px solid ${color}28` }}
            >
              <p className="font-bold" style={{ color }}>🔗 Импортирай 3D аватар (GLB URL)</p>
              <p>Вземи GLB URL от всеки 3D avatar creator (напр. Ready Player Me, VRoid, Mixamo) и го постави тук. Трябва да е пряка връзка, завършваща на <code>.glb</code>.</p>
            </div>

            <div className="flex gap-2">
              <input
                type="url"
                value={importInput}
                onChange={e => setImportInput(e.target.value)}
                placeholder="https://models.readyplayer.me/abc123.glb"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2"
                style={{ focusRingColor: color } as React.CSSProperties}
              />
              <button
                onClick={handleImport}
                disabled={!importInput.trim()}
                className="px-4 py-2 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-40"
                style={{ background: color }}
              >
                Зареди
              </button>
            </div>

            {avatarUrls[activeId] && (
              <button
                onClick={handleClearImport}
                className="w-full py-2 rounded-xl text-sm text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all"
              >
                ✕ Премахни импортирания аватар
              </button>
            )}

            <p className="text-xs text-slate-400 leading-relaxed">
              Ако нямаш GLB URL, използвай таба „Направи сам" за да създадеш герой директно в приложението.
            </p>
          </div>
        )}

        {saving && (
          <p className="text-center text-xs text-slate-400 animate-pulse">Запазване…</p>
        )}
        {saved && (
          <p className="text-center text-xs font-semibold text-emerald-600">✓ Героят е запазен!</p>
        )}
      </div>
      {/* end outer flex row */}
      </div>
    </main>
  );
}

// ── Small reusable components ─────────────────────────────────────────────────

function Section({ color, label, children }: { color: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</p>
      <div
        className="p-3 rounded-xl"
        style={{ background: `${color}08`, border: `1px solid ${color}20` }}
      >
        {children}
      </div>
    </div>
  );
}

function Chip({
  active, color, onClick, children,
}: {
  active: boolean; color: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
      style={{
        background: active ? color : 'white',
        color: active ? 'white' : '#64748b',
        border: `1.5px solid ${active ? color : '#E2E8F0'}`,
        boxShadow: active ? `0 2px 8px ${color}40` : 'none',
      }}
    >
      {children}
    </button>
  );
}

function ColorPicker({
  value, presets, onChange,
}: {
  value: string; presets: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {presets.map(c => (
        <button
          key={c}
          onClick={() => onChange(c)}
          style={{
            width: 26, height: 26,
            borderRadius: '50%',
            background: c,
            border: value === c ? '3px solid #1e293b' : '2px solid #e2e8f0',
            boxShadow: value === c ? '0 0 0 2px white inset' : 'none',
          }}
        />
      ))}
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0 }}
        />
        <span className="text-xs text-slate-400">Избери</span>
      </label>
    </div>
  );
}
