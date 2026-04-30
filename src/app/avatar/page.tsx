'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserType, AvatarConfig, USER_DISPLAY, USER_COLOR } from '@/types';
import AvatarSVG from '@/components/AvatarSVG/AvatarSVG';
import { sounds, resumeAudio } from '@/lib/sounds';

const HAIR_STYLES: { value: AvatarConfig['hairStyle']; label: string }[] = [
  { value: 'short',    label: 'Кратка' },
  { value: 'long',     label: 'Дълга' },
  { value: 'curly',    label: 'Къдрава' },
  { value: 'ponytail', label: 'Опашка' },
  { value: 'bald',     label: 'Плешив' },
];
const HAIR_COLORS = ['#8B4513','#1a1a1a','#F59E0B','#DC2626','#7C3AED','#D1D5DB','#F97316'];
const EYE_COLORS  = ['#4B5563','#1E40AF','#065F46','#92400E','#7C3AED','#DB2777'];
const SKIN_COLORS = ['#FBBF8A','#F5CBA7','#C68642','#8D5524','#FFDAB9'];
const OUTFITS: { value: AvatarConfig['outfit']; label: string; emoji: string }[] = [
  { value: 'casual',    label: 'Ежедневно',    emoji: '👕' },
  { value: 'travel',    label: 'Пътна яке',    emoji: '🧥' },
  { value: 'explorer',  label: 'Изследовател', emoji: '🦺' },
  { value: 'summer',    label: 'Лятно',        emoji: '🌞' },
  { value: 'winter',    label: 'Зимно',        emoji: '🧣' },
  { value: 'sporty',    label: 'Спортно',      emoji: '🏃' },
  { value: 'adventure', label: 'Приключение',  emoji: '🧗' },
  { value: 'beach',     label: 'Плажно',       emoji: '🏖️' },
  { value: 'city',      label: 'Градско',      emoji: '🏙️' },
];
const ACCESSORIES_LIST = [
  { id: 'hat',            label: 'Цилиндър',        emoji: '🎩' },
  { id: 'glasses',        label: 'Очила',            emoji: '👓' },
  { id: 'backpack',       label: 'Раница',           emoji: '🎒' },
  { id: 'cap',            label: 'Шапка с козирка',  emoji: '🧢' },
  { id: 'sunglasses',     label: 'Слънчеви очила',   emoji: '🕶️' },
  { id: 'travel-backpack',label: 'Туристическа раница', emoji: '🏕️' },
  { id: 'camera',         label: 'Фотоапарат',       emoji: '📷' },
  { id: 'scarf',          label: 'Шал',              emoji: '🧣' },
  { id: 'headphones',     label: 'Слушалки',         emoji: '🎧' },
];

const DEFAULT_AVATAR: Omit<AvatarConfig, 'id' | 'user'> = {
  hairStyle: 'short', hairColor: '#8B4513', eyeColor: '#4B5563',
  skinColor: '#FBBF8A', outfit: 'casual', accessories: [],
};

export default function AvatarPage() {
  const [activeUser, setActiveUser] = useState<UserType>('tati');
  const [avatars, setAvatars] = useState<Record<UserType, Omit<AvatarConfig,'id'|'user'>>>({
    tati: { ...DEFAULT_AVATAR },
    iva:  { ...DEFAULT_AVATAR, hairStyle: 'long', hairColor: '#1a1a1a' },
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/avatar').then(r => r.json()).then(data => {
      if (data.tati) setAvatars(prev => ({
        ...prev,
        tati: { hairStyle: data.tati.hairStyle, hairColor: data.tati.hairColor, eyeColor: data.tati.eyeColor, skinColor: data.tati.skinColor, outfit: data.tati.outfit, accessories: data.tati.accessories },
        iva:  { hairStyle: data.iva.hairStyle,  hairColor: data.iva.hairColor,  eyeColor: data.iva.eyeColor,  skinColor: data.iva.skinColor,  outfit: data.iva.outfit,  accessories: data.iva.accessories },
      }));
    }).catch(() => {});
  }, []);

  const update = useCallback(<K extends keyof Omit<AvatarConfig,'id'|'user'>>(key: K, val: Omit<AvatarConfig,'id'|'user'>[K]) => {
    resumeAudio(); sounds.click();
    setAvatars(prev => ({ ...prev, [activeUser]: { ...prev[activeUser], [key]: val } }));
  }, [activeUser]);

  const toggleAccessory = useCallback((id: string) => {
    resumeAudio(); sounds.click();
    setAvatars(prev => {
      const cur = prev[activeUser].accessories;
      const next = cur.includes(id) ? cur.filter(a => a !== id) : [...cur, id];
      return { ...prev, [activeUser]: { ...prev[activeUser], accessories: next } };
    });
  }, [activeUser]);

  const save = useCallback(async () => {
    setSaving(true);
    resumeAudio(); sounds.add();
    try {
      await fetch('/api/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: activeUser, ...avatars[activeUser] }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    setSaving(false);
  }, [activeUser, avatars]);

  const av = avatars[activeUser];

  return (
    <main className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-extrabold text-slate-800 mb-1">🧑 Моят герой</h1>
      <p className="text-slate-500 text-sm mb-5">Персонализирай своя пътешественик</p>

      {/* User tabs */}
      <div className="flex gap-2 mb-6">
        {(['tati','iva'] as UserType[]).map(u => (
          <button
            key={u}
            onClick={() => { sounds.click(); resumeAudio(); setActiveUser(u); }}
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

      <div className="flex gap-6 items-start flex-wrap">
        {/* Live preview */}
        <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white shadow-md min-w-[140px]"
             style={{ border: `2px solid ${USER_COLOR[activeUser]}30` }}>
          <AvatarSVG avatar={{ ...av, user: activeUser }} size={110} />
          <span className="font-bold text-slate-700">{USER_DISPLAY[activeUser]}</span>
        </div>

        {/* Controls */}
        <div className="flex-1 min-w-[220px] space-y-4">

          {/* Hair style */}
          <Section label="Прическа">
            <div className="flex flex-wrap gap-2">
              {HAIR_STYLES.map(h => (
                <ChoiceBtn key={h.value} active={av.hairStyle === h.value} color={USER_COLOR[activeUser]} onClick={() => update('hairStyle', h.value)}>
                  {h.label}
                </ChoiceBtn>
              ))}
            </div>
          </Section>

          {/* Hair color */}
          <Section label="Цвят на косата">
            <div className="flex gap-2 flex-wrap">
              {HAIR_COLORS.map(c => (
                <ColorDot key={c} color={c} active={av.hairColor === c} onClick={() => update('hairColor', c)} />
              ))}
            </div>
          </Section>

          {/* Eye color */}
          <Section label="Цвят на очите">
            <div className="flex gap-2 flex-wrap">
              {EYE_COLORS.map(c => (
                <ColorDot key={c} color={c} active={av.eyeColor === c} onClick={() => update('eyeColor', c)} />
              ))}
            </div>
          </Section>

          {/* Skin color */}
          <Section label="Цвят на кожата">
            <div className="flex gap-2 flex-wrap">
              {SKIN_COLORS.map(c => (
                <ColorDot key={c} color={c} active={av.skinColor === c} onClick={() => update('skinColor', c)} />
              ))}
            </div>
          </Section>

          {/* Outfit */}
          <Section label="Облекло">
            <div className="flex gap-2 flex-wrap">
              {OUTFITS.map(o => (
                <ChoiceBtn key={o.value} active={av.outfit === o.value} color={USER_COLOR[activeUser]} onClick={() => update('outfit', o.value)}>
                  {o.emoji} {o.label}
                </ChoiceBtn>
              ))}
            </div>
          </Section>

          {/* Accessories */}
          <Section label="Аксесоари">
            <div className="flex gap-2 flex-wrap">
              {ACCESSORIES_LIST.map(a => (
                <ChoiceBtn key={a.id} active={av.accessories.includes(a.id)} color={USER_COLOR[activeUser]} onClick={() => toggleAccessory(a.id)}>
                  {a.emoji} {a.label}
                </ChoiceBtn>
              ))}
            </div>
          </Section>

          {/* Save */}
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-3 rounded-2xl font-bold text-white text-sm transition-all"
            style={{ background: saved ? '#059669' : USER_COLOR[activeUser], opacity: saving ? 0.7 : 1 }}
          >
            {saved ? '✓ Запазено!' : saving ? 'Запазване…' : '💾 Запази героя'}
          </button>
        </div>
      </div>
    </main>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      {children}
    </div>
  );
}

function ChoiceBtn({ children, active, color, onClick }: { children: React.ReactNode; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
      style={{
        background: active ? color : 'white',
        color: active ? 'white' : '#64748b',
        border: `1.5px solid ${active ? color : '#E2E8F0'}`,
        boxShadow: active ? `0 2px 8px ${color}40` : '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {children}
    </button>
  );
}

function ColorDot({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 rounded-full transition-all"
      style={{
        background: color,
        border: active ? '3px solid #1e293b' : '2px solid rgba(0,0,0,0.15)',
        transform: active ? 'scale(1.2)' : 'scale(1)',
        boxShadow: active ? '0 0 0 2px white, 0 0 0 4px ' + color : 'none',
      }}
      title={color}
    />
  );
}
