'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { UserType, USER_COLOR } from '@/types';
import { sounds, resumeAudio } from '@/lib/sounds';

interface Item { id: string; emoji: string; name: string }

const ITEMS: Item[] = [
  { id: 'comb',        emoji: '🪮',  name: 'Гребен' },
  { id: 'toothbrush',  emoji: '🪥',  name: 'Четка за зъби' },
  { id: 'clothes',     emoji: '👕',  name: 'Дрехи' },
  { id: 'shoes',       emoji: '👟',  name: 'Обувки' },
  { id: 'sunglasses',  emoji: '🕶️',  name: 'Очила' },
  { id: 'camera',      emoji: '📷',  name: 'Фотоапарат' },
  { id: 'book',        emoji: '📚',  name: 'Книга' },
  { id: 'shampoo',     emoji: '🧴',  name: 'Шампоан' },
  { id: 'meds',        emoji: '💊',  name: 'Лекарства' },
  { id: 'passport',    emoji: '🪪',  name: 'Паспорт' },
  { id: 'phone',       emoji: '📱',  name: 'Телефон' },
  { id: 'map',         emoji: '🗺️',  name: 'Карта' },
  { id: 'sunscreen',   emoji: '🧴',  name: 'Слънцезащитен крем' },
  { id: 'toy',         emoji: '🧸',  name: 'Плюшена играчка' },
  { id: 'umbrella',    emoji: '☂️',  name: 'Чадър' },
  { id: 'hat',         emoji: '🧢',  name: 'Шапка' },
  { id: 'water',       emoji: '🥤',  name: 'Бутилка вода' },
  { id: 'snack',       emoji: '🍪',  name: 'Лакомство' },
];

interface PreviewState { id: string; x: number; y: number }

export default function SuitcaseGame({ activeUser }: { activeUser: UserType }) {
  const [packed, setPacked]     = useState<Item[]>([]);
  const [preview, setPreview]   = useState<PreviewState | null>(null);
  const [overDrop, setOverDrop] = useState(false);
  const dropRef = useRef<HTMLDivElement | null>(null);
  // Track over-drop in a ref for the up handler (state isn't yet committed at the time of pointerup)
  const overDropRef = useRef(false);
  useEffect(() => { overDropRef.current = overDrop; }, [overDrop]);

  const color = USER_COLOR[activeUser];

  const available = ITEMS.filter(it => !packed.some(p => p.id === it.id));

  const onPointerDown = useCallback((e: React.PointerEvent, item: Item) => {
    if (packed.some(p => p.id === item.id)) return;
    e.preventDefault();
    resumeAudio();
    setPreview({ id: item.id, x: e.clientX, y: e.clientY });

    const onMove = (ev: PointerEvent) => {
      setPreview({ id: item.id, x: ev.clientX, y: ev.clientY });
      const el = dropRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const inside = ev.clientX >= r.left && ev.clientX <= r.right
                    && ev.clientY >= r.top  && ev.clientY <= r.bottom;
        setOverDrop(inside);
      }
    };
    const cleanup = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
    const onUp = () => {
      cleanup();
      if (overDropRef.current) {
        sounds.add();
        setPacked(prev => prev.some(p => p.id === item.id) ? prev : [...prev, item]);
      }
      setPreview(null);
      setOverDrop(false);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }, [packed]);

  const removeItem = useCallback((id: string) => {
    resumeAudio(); sounds.click();
    setPacked(prev => prev.filter(p => p.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    resumeAudio(); sounds.click();
    setPacked([]);
  }, []);

  return (
    <div>
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-slate-700 mb-1">🧳 Виртуален куфар</h2>
        <p className="text-slate-500 text-xs">Завлечи вещите в куфара за пътуване</p>
      </div>

      {/* Suitcase drop zone */}
      <div
        ref={dropRef}
        className="rounded-3xl p-3 transition-all"
        style={{
          background: `linear-gradient(135deg, ${color}10, ${color}03)`,
          border: `3px ${overDrop ? 'solid' : 'dashed'} ${overDrop ? color : color + '60'}`,
          boxShadow: overDrop ? `0 0 0 6px ${color}25` : 'none',
        }}
      >
        <Suitcase color={color} packed={packed} onRemove={removeItem} />
      </div>

      {/* Items shelf */}
      <div className="mt-5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Налични вещи</p>
        {available.length === 0 ? (
          <div className="rounded-2xl p-5 text-center text-slate-400 italic" style={{ background: '#F8FAFC', border: '2px dashed #E2E8F0' }}>
            Опаковано! Провери списъка по-долу.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {available.map(item => (
              <button
                key={item.id}
                onPointerDown={e => onPointerDown(e, item)}
                className="flex flex-col items-center gap-1 px-2 py-3 rounded-xl bg-white shadow-sm transition-all active:scale-95 select-none"
                style={{
                  border: `2px solid ${preview?.id === item.id ? color : '#E2E8F0'}`,
                  opacity: preview?.id === item.id ? 0.4 : 1,
                  touchAction: 'none',
                  cursor: 'grab',
                }}
              >
                <span className="text-3xl leading-none pointer-events-none">{item.emoji}</span>
                <span className="text-xs font-semibold text-slate-700 text-center leading-tight pointer-events-none">{item.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Packed list */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            Списък с вещи за пътуване ({packed.length})
          </p>
          {packed.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors"
            >
              Изпразни
            </button>
          )}
        </div>
        {packed.length === 0 ? (
          <div className="rounded-2xl p-4 text-center text-slate-400 text-sm italic" style={{ background: '#F8FAFC' }}>
            Списъкът ще се попълва когато добавиш вещи
          </div>
        ) : (
          <ul className="rounded-2xl bg-white shadow-sm overflow-hidden" style={{ border: `1.5px solid ${color}28` }}>
            {packed.map((it, i) => (
              <li key={it.id} className="flex items-center gap-3 px-3 py-2 border-b border-slate-100 last:border-0 text-sm">
                <span className="text-slate-300 text-xs w-5 text-right">{i + 1}.</span>
                <span className="text-2xl leading-none">{it.emoji}</span>
                <span className="flex-1 text-slate-700 font-semibold">{it.name}</span>
                <button
                  onClick={() => removeItem(it.id)}
                  className="text-slate-400 hover:text-rose-600 transition-colors text-base px-2"
                  title="Премахни"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Drag preview floats with the pointer */}
      {preview && (() => {
        const item = ITEMS.find(it => it.id === preview.id);
        if (!item) return null;
        return (
          <div
            style={{
              position: 'fixed',
              left: preview.x - 28,
              top:  preview.y - 28,
              fontSize: 56,
              pointerEvents: 'none',
              zIndex: 9999,
              filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.35))',
              transform: overDrop ? 'scale(1.18)' : 'scale(1)',
              transition: 'transform 120ms ease-out',
              userSelect: 'none',
            }}
          >
            {item.emoji}
          </div>
        );
      })()}
    </div>
  );
}

function Suitcase({ color, packed, onRemove }: { color: string; packed: Item[]; onRemove: (id: string) => void }) {
  return (
    <div className="relative" style={{ aspectRatio: '4 / 3' }}>
      <svg viewBox="0 0 400 300" width="100%" height="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="bag-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#A0673E" />
            <stop offset="1" stopColor="#7C4A24" />
          </linearGradient>
          <linearGradient id="lid-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#B17746" />
            <stop offset="1" stopColor="#8B5A2B" />
          </linearGradient>
        </defs>
        {/* Lid (upper, slightly tilted open) */}
        <g transform="translate(0,0)">
          <rect x="40" y="20" width="320" height="120" rx="14" fill="url(#lid-grad)" stroke="#5C3A1E" strokeWidth="3" />
          {/* Inside lining */}
          <rect x="55" y="34" width="290" height="92" rx="8" fill="#F5DEB3" />
          {/* Travel stickers */}
          <circle cx="100" cy="78" r="14" fill="#F87171" stroke="#7F1D1D" strokeWidth="1.5" />
          <text x="100" y="83" textAnchor="middle" fontSize="14" fontWeight="700" fill="#7F1D1D">JP</text>
          <rect x="140" y="60" width="42" height="32" rx="4" fill="#60A5FA" stroke="#1E3A8A" strokeWidth="1.5" />
          <text x="161" y="80" textAnchor="middle" fontSize="14" fontWeight="700" fill="white">FR</text>
          <circle cx="220" cy="80" r="14" fill="#FBBF24" stroke="#92400E" strokeWidth="1.5" />
          <text x="220" y="85" textAnchor="middle" fontSize="13" fontWeight="700" fill="#7C2D12">IT</text>
          <rect x="260" y="62" width="42" height="32" rx="4" fill="#34D399" stroke="#065F46" strokeWidth="1.5" />
          <text x="281" y="82" textAnchor="middle" fontSize="14" fontWeight="700" fill="white">BR</text>
        </g>
        {/* Bottom (open part where items go) */}
        <rect x="40" y="140" width="320" height="148" rx="14" fill="url(#bag-grad)" stroke="#5C3A1E" strokeWidth="3" />
        {/* Inside compartment */}
        <rect x="55" y="154" width="290" height="120" rx="8" fill="#FFE4C4" />
        {/* Latches at the seam */}
        <circle cx="125" cy="140" r="7" fill="#F4D35E" stroke="#7C5A0A" strokeWidth="1.5" />
        <circle cx="275" cy="140" r="7" fill="#F4D35E" stroke="#7C5A0A" strokeWidth="1.5" />
        {/* Handle */}
        <rect x="170" y="6" width="60" height="14" rx="6" fill="#5C3A1E" />
        <rect x="170" y="14" width="60" height="6" rx="3" fill="#7C4A24" />
        {/* Highlight stripe */}
        <rect x="40" y="190" width="320" height="6" fill={color} opacity="0.35" />
      </svg>

      {/* Packed items overlaid in a grid inside the open compartment */}
      <div
        className="absolute"
        style={{
          left: '13.75%', right: '13.75%',
          top: '51.5%',   bottom: '5%',
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 4,
          padding: 4,
        }}
      >
        {packed.slice(0, 18).map(it => (
          <button
            key={it.id}
            onClick={() => onRemove(it.id)}
            title={`Премахни ${it.name}`}
            className="flex items-center justify-center rounded-md transition-transform active:scale-90 hover:scale-110"
            style={{
              fontSize: 22,
              lineHeight: 1,
              background: 'rgba(255,255,255,0.55)',
              border: '1.5px solid rgba(146,86,33,0.35)',
              animation: 'packPop 240ms cubic-bezier(.34,1.56,.64,1)',
            }}
          >
            {it.emoji}
          </button>
        ))}
      </div>
      <style jsx>{`
        @keyframes packPop {
          0%   { transform: scale(0); opacity: 0; }
          80%  { transform: scale(1.18); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
