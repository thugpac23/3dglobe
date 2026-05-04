'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { UserType, USER_DISPLAY, USER_COLOR, AvatarConfig, FaceType, Expression } from '@/types';
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
  { value: 'round',    label: 'Заоблено' },
  { value: 'long',     label: 'Издължено' },
  { value: 'child',    label: 'Детско' },
  { value: 'angular',  label: 'Ъгловато' },
];

const EXPRESSIONS: { value: Expression; label: string }[] = [
  { value: 'smile',     label: '😊 Усмивка' },
  { value: 'neutral',   label: '😐 Неутрално' },
  { value: 'surprised', label: '😮 Изненадан' },
  { value: 'thinking',  label: '🤔 Мислещ' },
];

const SKIN_PRESETS = ['#FBBF8A', '#F4A460', '#D2691E', '#8B4513', '#FFDAB9', '#C68642'];
const HAIR_PRESETS = ['#8B4513', '#1a1a1a', '#D4AF37', '#FF6B35', '#C0C0C0', '#FFFFFF'];
const EYE_PRESETS  = ['#4B5563', '#3B82F6', '#10B981', '#8B4513', '#6B21A8', '#9CA3AF'];

// ── Defaults ──────────────────────────────────────────────────────────────────

function defaultConfig(user: UserType): AvatarConfig {
  return {
    id: user,
    user,
    hairStyle:   user === 'tati' ? 'short' : 'long',
    hairColor:   user === 'tati' ? '#8B4513' : '#1a1a1a',
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
  const [activeUser, setActiveUser] = useState<UserType>('tati');
  const [configs, setConfigs] = useState<Record<UserType, AvatarConfig>>({
    tati: defaultConfig('tati'),
    iva:  defaultConfig('iva'),
  });
  const [avatarUrls, setAvatarUrls] = useState<Record<UserType, string | null>>({
    tati: null,
    iva:  null,
  });
  const [importInput, setImportInput] = useState('');
  const [saving, setSaving]           = useState(false);
  const [saved,  setSaved]            = useState(false);
  const [tab, setTab]                 = useState<'build' | 'import'>('build');
  const [backgrounds, setBackgrounds] = useState<Record<UserType, string>>({ tati: 'studio', iva: 'studio' });

  // Persist background choice per user in localStorage (no DB column needed)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('avatar-bg');
      if (raw) {
        const parsed = JSON.parse(raw) as Record<UserType, string>;
        setBackgrounds({ tati: parsed.tati ?? 'studio', iva: parsed.iva ?? 'studio' });
      }
    } catch { /* ignore */ }
  }, []);
  const setBackground = useCallback((bg: string) => {
    setBackgrounds(prev => {
      const next = { ...prev, [activeUser]: bg };
      try { localStorage.setItem('avatar-bg', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [activeUser]);

  // Load persisted data on mount
  useEffect(() => {
    fetch('/api/avatar').then(r => r.json()).then(data => {
      const map = (user: UserType, d: Record<string, unknown>): AvatarConfig => ({
        ...defaultConfig(user),
        hairStyle:  (d.hairStyle  as AvatarConfig['hairStyle'])  ?? defaultConfig(user).hairStyle,
        hairColor:  (d.hairColor  as string) ?? defaultConfig(user).hairColor,
        eyeColor:   (d.eyeColor   as string) ?? defaultConfig(user).eyeColor,
        skinColor:  (d.skinColor  as string) ?? defaultConfig(user).skinColor,
        outfit:     (d.outfit     as AvatarConfig['outfit'])     ?? defaultConfig(user).outfit,
        accessories:(d.accessories as string[]) ?? [],
        faceType:   (d.faceType   as FaceType)   ?? 'standard',
        expression: (d.expression as Expression) ?? 'smile',
      });
      setConfigs({
        tati: map('tati', data.tati ?? {}),
        iva:  map('iva',  data.iva  ?? {}),
      });
      setAvatarUrls({
        tati: (data.tati?.avatarUrl as string | null) ?? null,
        iva:  (data.iva?.avatarUrl  as string | null) ?? null,
      });
      setImportInput((data[activeUser]?.avatarUrl as string) ?? '');
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync importInput when user tab switches
  useEffect(() => {
    setImportInput(avatarUrls[activeUser] ?? '');
  }, [activeUser, avatarUrls]);

  const cfg = configs[activeUser];
  const color = USER_COLOR[activeUser];

  // ── Helpers ────────────────────────────────────────────────────────────────

  const updateConfig = useCallback(<K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) => {
    setConfigs(prev => ({
      ...prev,
      [activeUser]: { ...prev[activeUser], [key]: value },
    }));
    setSaved(false);
  }, [activeUser]);

  const persist = useCallback(async (overrides?: Partial<AvatarConfig> & { avatarUrl?: string | null }) => {
    setSaving(true);
    resumeAudio(); sounds.add();
    const { id: _id, user: _user, ...cfgFields } = configs[activeUser];
    const payload = { user: activeUser, ...cfgFields, ...overrides };
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
  }, [activeUser, configs]);

  const handleImport = useCallback(async () => {
    const url = importInput.trim();
    if (!url) return;
    setAvatarUrls(prev => ({ ...prev, [activeUser]: url }));
    await persist({ avatarUrl: url });
  }, [importInput, activeUser, persist]);

  const handleClearImport = useCallback(async () => {
    setImportInput('');
    setAvatarUrls(prev => ({ ...prev, [activeUser]: null }));
    await persist({ avatarUrl: null });
  }, [activeUser, persist]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen px-4 py-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-extrabold text-slate-800 mb-1">🧑 Моят герой</h1>
      <p className="text-slate-500 text-sm mb-5">Персонализирай своя 3D герой</p>

      {/* User tabs */}
      <div className="flex gap-2 mb-6">
        {(['tati', 'iva'] as UserType[]).map(u => (
          <button
            key={u}
            onClick={() => { sounds.click(); resumeAudio(); setActiveUser(u); setSaved(false); }}
            className="px-5 py-2 rounded-full font-bold text-sm transition-all"
            style={{
              background: activeUser === u ? USER_COLOR[u] : 'white',
              color: activeUser === u ? 'white' : '#64748b',
              border: `2px solid ${activeUser === u ? USER_COLOR[u] : '#E2E8F0'}`,
              boxShadow: activeUser === u ? `0 4px 16px ${USER_COLOR[u]}40` : '0 1px 4px rgba(0,0,0,0.08)',
            }}
          >
            {USER_DISPLAY[u]}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Avatar preview (sticky on scroll) ────────────────────────── */}
        <div
          className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white shadow-md flex-shrink-0 sticky top-2 self-start z-10"
          style={{ border: `2px solid ${color}28` }}
        >
          {avatarUrls[activeUser] ? (
            <>
              <AvatarRPM avatarUrl={avatarUrls[activeUser]!} width={220} height={290} />
              <span className="font-bold text-slate-700 text-sm">{USER_DISPLAY[activeUser]}</span>
              <span className="text-xs text-slate-400">Завърти / Приближи</span>
            </>
          ) : (
            <>
              <Avatar3D
                avatar={cfg}
                expression={cfg.expression ?? 'smile'}
                width={220}
                height={290}
                background={backgrounds[activeUser]}
              />
              <span className="font-bold text-slate-700 text-sm">{USER_DISPLAY[activeUser]}</span>
            </>
          )}
        </div>

        {/* ── Editor panel ──────────────────────────────────────────────── */}
        <div className="flex-1 space-y-4 w-full">

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

              {/* Background */}
              <Section color={color} label="Фон">
                <div className="flex flex-wrap gap-1.5">
                  {BACKGROUNDS.map(({ value, label }) => (
                    <Chip
                      key={value}
                      active={backgrounds[activeUser] === value}
                      color={color}
                      onClick={() => setBackground(value)}
                    >
                      {label}
                    </Chip>
                  ))}
                </div>
              </Section>

              <button
                onClick={() => persist()}
                className="w-full py-3 rounded-2xl font-bold text-white text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: color, boxShadow: `0 4px 16px ${color}40` }}
              >
                💾 Запази героя
              </button>
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

              {avatarUrls[activeUser] && (
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
