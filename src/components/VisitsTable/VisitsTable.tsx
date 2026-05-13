'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { VisitsByCountry, WishlistByCountry, AppMode, UserProfile } from '@/types';
import { BG_NAMES } from '@/data/countryNamesBg';

interface VisitsTableProps {
  visitsByCountry: VisitsByCountry;
  wishlistByCountry: WishlistByCountry;
  mode: AppMode;
  compact?: boolean;
  users?: UserProfile[];
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

const ITEM_H = 36;
const MAX_VISIBLE = 10;

function DraggableColumn({
  storageKey, rows, color, label, emoji, emptyText,
}: {
  storageKey: string;
  rows: CountryRow[];
  color: string;
  label: string;
  emoji: string;
  emptyText: string;
}) {
  const [savedOrder, setSavedOrder] = useListOrder(storageKey);
  const ordered = useMemo(() => applyOrder(rows, savedOrder), [rows, savedOrder]);
  // Show at most MAX_VISIBLE rows before scroll kicks in
  const maxHeight = ordered.length > MAX_VISIBLE
    ? MAX_VISIBLE * ITEM_H
    : Math.max(60, ordered.length * ITEM_H);
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

export default function VisitsTable({ visitsByCountry, wishlistByCountry, mode, compact = false, users = [] }: VisitsTableProps) {
  const sort = (a: CountryRow, b: CountryRow) => a.nameBg.localeCompare(b.nameBg, 'bg');

  const sourceMap = mode === 'wishlist' ? wishlistByCountry : visitsByCountry;
  const emptyText = mode === 'wishlist' ? 'Няма желани дестинации' : 'Няма държави все още';
  const emoji = mode === 'wishlist' ? '⭐' : '🌍';

  // Build per-user rows
  const userCols = users.map(u => {
    const rows: CountryRow[] = [];
    for (const [isoCode, entry] of Object.entries(sourceMap)) {
      if (entry[u.id] === true) {
        rows.push({ isoCode, nameBg: BG_NAMES[isoCode] ?? (entry.country as { name: string }).name });
      }
    }
    rows.sort(sort);
    return {
      storageKey: `${mode}-order-${u.id}`,
      color: u.color,
      label: u.displayName,
      emoji,
      rows,
    };
  });

  // "Shared by all" column — countries every user has (only if 2+ users)
  const sharedCols = users.length >= 2 ? (() => {
    const rows: CountryRow[] = [];
    for (const [isoCode, entry] of Object.entries(sourceMap)) {
      if (users.every(u => entry[u.id] === true)) {
        rows.push({ isoCode, nameBg: BG_NAMES[isoCode] ?? (entry.country as { name: string }).name });
      }
    }
    rows.sort(sort);
    return [{
      storageKey: `${mode}-order-all`,
      color: '#14B8A6',
      label: 'Общи',
      emoji: '🤝',
      rows,
    }];
  })() : [];

  const cols = [...userCols, ...sharedCols];

  if (cols.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-col gap-3">
        {cols.map(c => <DraggableColumn key={c.storageKey} {...c} emptyText={emptyText} />)}
      </div>
    );
  }

  const gridCols = cols.length <= 2 ? cols.length : cols.length <= 4 ? 2 : 3;

  return (
    <div className="w-full max-w-4xl mx-auto mt-5 px-4">
      <div className={`grid gap-3 grid-cols-1 sm:grid-cols-${gridCols}`}>
        {cols.map(c => <DraggableColumn key={c.storageKey} {...c} emptyText={emptyText} />)}
      </div>
    </div>
  );
}
