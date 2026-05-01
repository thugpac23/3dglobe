'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { VisitsByCountry, WishlistByCountry, AppMode } from '@/types';
import { BG_NAMES } from '@/data/countryNamesBg';

interface VisitsTableProps {
  visitsByCountry: VisitsByCountry;
  wishlistByCountry: WishlistByCountry;
  mode: AppMode;
  compact?: boolean;
}

interface CountryRow {
  isoCode: string;
  nameBg: string;
}

function useListOrder(key: string): [string[], (o: string[]) => void] {
  const [order, setOrder] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setOrder(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }
  }, [key]);

  const save = useCallback((o: string[]) => {
    setOrder(o);
    try { localStorage.setItem(key, JSON.stringify(o)); } catch { /* ignore */ }
  }, [key]);

  return [order, save];
}

function applyOrder(rows: CountryRow[], savedOrder: string[]): CountryRow[] {
  if (!savedOrder.length) return rows;
  const map = new Map(rows.map(r => [r.isoCode, r]));
  const result: CountryRow[] = [];
  for (const iso of savedOrder) {
    const r = map.get(iso);
    if (r) { result.push(r); map.delete(iso); }
  }
  map.forEach(r => result.push(r));
  return result;
}

function DraggableColumn({
  storageKey, rows, color, label, emoji, emptyText, maxHeight,
}: {
  storageKey: string;
  rows: CountryRow[];
  color: string;
  label: string;
  emoji: string;
  emptyText: string;
  maxHeight: number;
}) {
  const [savedOrder, setSavedOrder] = useListOrder(storageKey);
  const ordered = useMemo(() => applyOrder(rows, savedOrder), [rows, savedOrder]);
  const orderedRef = useRef(ordered);
  useEffect(() => { orderedRef.current = ordered; }, [ordered]);

  const dragSrc      = useRef<number | null>(null);
  const touchSrcRef  = useRef<number | null>(null);
  const touchToRef   = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // ── HTML5 drag (desktop) ──
  function onDragStart(idx: number) { dragSrc.current = idx; }
  function onDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDragOverIdx(idx); }
  function onDrop(e: React.DragEvent, toIdx: number) {
    e.preventDefault();
    const src = dragSrc.current;
    if (src === null || src === toIdx) { dragSrc.current = null; setDragOverIdx(null); return; }
    const next = [...orderedRef.current];
    const [item] = next.splice(src, 1);
    next.splice(toIdx, 0, item);
    setSavedOrder(next.map(r => r.isoCode));
    dragSrc.current = null;
    setDragOverIdx(null);
  }
  function onDragEnd() { setDragOverIdx(null); }

  // ── Touch drag (mobile) ──
  function onTouchStart(e: React.TouchEvent, idx: number) {
    const startY = e.touches[0].clientY;
    let activated = false;
    touchSrcRef.current = idx;
    touchToRef.current  = null;

    const handleMove = (ev: TouchEvent) => {
      const touch = ev.touches[0];
      if (!activated) {
        if (Math.abs(touch.clientY - startY) < 6) return;
        activated = true;
        setDragOverIdx(idx);
      }
      ev.preventDefault();
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const li = el?.closest('[data-drag-idx]') as HTMLElement | null;
      if (li) {
        const to = parseInt(li.dataset.dragIdx ?? '-1', 10);
        if (to >= 0) { touchToRef.current = to; setDragOverIdx(to); }
      }
    };

    const handleEnd = () => {
      const src = touchSrcRef.current;
      const to  = touchToRef.current;
      touchSrcRef.current = null;
      touchToRef.current  = null;
      setDragOverIdx(null);
      if (activated && src !== null && to !== null && src !== to) {
        const next = [...orderedRef.current];
        const [item] = next.splice(src, 1);
        next.splice(to, 0, item);
        setSavedOrder(next.map(r => r.isoCode));
      }
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };

    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{
      background: 'white',
      border: `1.5px solid ${color}28`,
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
    }}>
      <div className="py-2.5 px-3 text-center font-bold text-sm" style={{
        color, background: `${color}12`, borderBottom: `1px solid ${color}20`,
      }}>
        {emoji} {label}
        <span className="ml-1.5 text-xs font-normal opacity-60">({ordered.length})</span>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight }}>
        {ordered.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs italic">{emptyText}</div>
        ) : (
          <ul>
            {ordered.map((row, idx) => (
              <li
                key={row.isoCode}
                data-drag-idx={String(idx)}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={(e) => onDragOver(e, idx)}
                onDrop={(e) => onDrop(e, idx)}
                onDragEnd={onDragEnd}
                onTouchStart={(e) => onTouchStart(e, idx)}
                className="flex items-center gap-2 px-3 py-2 text-sm border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-grab active:cursor-grabbing select-none"
                style={{
                  background: dragOverIdx === idx ? `${color}12` : undefined,
                  borderLeft: dragOverIdx === idx ? `3px solid ${color}` : '3px solid transparent',
                }}
              >
                <span className="text-slate-300 shrink-0" style={{ fontSize: 10 }}>⠿⠿</span>
                <span className="text-slate-400 text-xs w-5 text-right shrink-0">{idx + 1}.</span>
                <span className="text-slate-700 text-xs sm:text-sm leading-tight">{row.nameBg}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function VisitsTable({ visitsByCountry, wishlistByCountry, mode, compact = false }: VisitsTableProps) {
  const sort = (a: CountryRow, b: CountryRow) => a.nameBg.localeCompare(b.nameBg, 'bg');

  let cols: { storageKey: string; color: string; label: string; emoji: string; rows: CountryRow[] }[];

  if (mode === 'wishlist') {
    const tatiWish: CountryRow[] = [];
    const ivaWish: CountryRow[]  = [];
    const bothWish: CountryRow[] = [];
    for (const [isoCode, entry] of Object.entries(wishlistByCountry)) {
      const row: CountryRow = { isoCode, nameBg: BG_NAMES[isoCode] ?? entry.country.name };
      if (entry.tati) tatiWish.push(row);
      if (entry.iva)  ivaWish.push(row);
      if (entry.tati && entry.iva) bothWish.push(row);
    }
    tatiWish.sort(sort); ivaWish.sort(sort); bothWish.sort(sort);
    cols = [
      { storageKey: 'wish-order-tati', color: '#F59E0B', label: 'Тати',    emoji: '⭐', rows: tatiWish },
      { storageKey: 'wish-order-iva',  color: '#EC4899', label: 'Ива',     emoji: '⭐', rows: ivaWish  },
      { storageKey: 'wish-order-both', color: '#14B8A6', label: 'Двамата', emoji: '🌍', rows: bothWish },
    ];
  } else {
    const tatiRows: CountryRow[] = [];
    const ivaRows: CountryRow[]  = [];
    const bothRows: CountryRow[] = [];
    for (const [isoCode, entry] of Object.entries(visitsByCountry)) {
      const row: CountryRow = { isoCode, nameBg: BG_NAMES[isoCode] ?? entry.country.name };
      if (entry.tati) tatiRows.push(row);
      if (entry.iva)  ivaRows.push(row);
      if (entry.tati && entry.iva) bothRows.push(row);
    }
    tatiRows.sort(sort); ivaRows.sort(sort); bothRows.sort(sort);
    cols = [
      { storageKey: 'visit-order-tati', color: '#F59E0B', label: 'Тати',           emoji: '🟡', rows: tatiRows },
      { storageKey: 'visit-order-iva',  color: '#EC4899', label: 'Ива',            emoji: '🩷', rows: ivaRows  },
      { storageKey: 'visit-order-both', color: '#F97316', label: 'Двамата заедно', emoji: '🌍', rows: bothRows },
    ];
  }

  const emptyText = mode === 'wishlist' ? 'Няма желани дестинации' : 'Няма държави все още';
  const maxH = compact ? 180 : 220;

  if (compact) {
    return (
      <div className="flex flex-col gap-3">
        {cols.map(c => <DraggableColumn key={c.storageKey} {...c} emptyText={emptyText} maxHeight={maxH} />)}
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto mt-5 px-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cols.map(c => <DraggableColumn key={c.storageKey} {...c} emptyText={emptyText} maxHeight={maxH} />)}
      </div>
    </div>
  );
}
