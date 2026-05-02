'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isSoundEnabled, setSoundEnabled, resumeAudio } from '@/lib/sounds';
import { useState, useEffect } from 'react';

const ITEMS = [
  { href: '/',             icon: '🌍', label: 'Начало' },
  { href: '/pasport',      icon: '📕', label: 'Паспорт' },
  { href: '/igra',         icon: '🎮', label: 'Игра' },
  { href: '/postizheniya', icon: '🏅', label: 'Постижения' },
  { href: '/avatar',       icon: '🧑', label: 'Моят герой' },
];

export default function Nav() {
  const path = usePathname();
  const [sound, setSound] = useState(true);

  useEffect(() => { setSound(isSoundEnabled()); }, []);

  function toggleSound() {
    resumeAudio();
    const next = !sound;
    setSoundEnabled(next);
    setSound(next);
  }

  return (
    <nav
      className="sticky top-0 z-40 w-full flex items-center gap-1 px-3 py-2 overflow-x-auto"
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
      }}
    >
      <span className="text-sm font-extrabold text-sky-600 mr-2 shrink-0 hidden sm:block">
        🌍 Пътешествия
      </span>

      <div className="flex gap-1 flex-1 overflow-x-auto">
        {ITEMS.map(({ href, icon, label }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150"
              style={{
                background: active ? '#0EA5E9' : 'transparent',
                color: active ? 'white' : '#64748b',
                boxShadow: active ? '0 2px 8px rgba(14,165,233,0.35)' : 'none',
              }}
            >
              <span>{icon}</span>
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </div>

      <button
        onClick={toggleSound}
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg transition-all"
        style={{ background: sound ? '#E0F2FE' : '#F1F5F9', border: '1px solid rgba(0,0,0,0.1)' }}
        title={sound ? 'Изключи звука' : 'Включи звука'}
      >
        {sound ? '🔊' : '🔇'}
      </button>
    </nav>
  );
}
