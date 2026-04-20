'use client';

import { VisitsByCountry, WishlistByCountry, AppMode } from '@/types';
import { BG_NAMES } from '@/data/countryNamesBg';

interface VisitsTableProps {
  visitsByCountry: VisitsByCountry;
  wishlistByCountry: WishlistByCountry;
  mode: AppMode;
}

interface CountryRow {
  isoCode: string;
  nameBg: string;
}

export default function VisitsTable({ visitsByCountry, wishlistByCountry, mode }: VisitsTableProps) {
  if (mode === 'wishlist') {
    const tatiWish: CountryRow[] = [];
    const ivaWish: CountryRow[] = [];
    const bothWish: CountryRow[] = [];

    for (const [isoCode, entry] of Object.entries(wishlistByCountry)) {
      const row: CountryRow = { isoCode, nameBg: BG_NAMES[isoCode] ?? entry.country.name };
      if (entry.tati && entry.iva) bothWish.push(row);
      else if (entry.tati) tatiWish.push(row);
      else if (entry.iva) ivaWish.push(row);
    }

    const sort = (a: CountryRow, b: CountryRow) => a.nameBg.localeCompare(b.nameBg, 'bg');
    tatiWish.sort(sort); ivaWish.sort(sort); bothWish.sort(sort);

    const cols = [
      { label: 'Тати',      color: '#F59E0B', data: tatiWish,  emoji: '⭐' },
      { label: 'Ива',       color: '#EC4899', data: ivaWish,   emoji: '⭐' },
      { label: 'Двамата',   color: '#14B8A6', data: bothWish,  emoji: '🌍' },
    ];

    return <TableGrid cols={cols} emptyText="Няма желани дестинации" />;
  }

  const tatiOnly: CountryRow[] = [];
  const ivaOnly: CountryRow[] = [];
  const both: CountryRow[] = [];

  for (const [isoCode, entry] of Object.entries(visitsByCountry)) {
    const row: CountryRow = { isoCode, nameBg: BG_NAMES[isoCode] ?? entry.country.name };
    if (entry.tati && entry.iva) both.push(row);
    else if (entry.tati) tatiOnly.push(row);
    else if (entry.iva) ivaOnly.push(row);
  }

  const sort = (a: CountryRow, b: CountryRow) => a.nameBg.localeCompare(b.nameBg, 'bg');
  tatiOnly.sort(sort); ivaOnly.sort(sort); both.sort(sort);

  const cols = [
    { label: 'Тати',           color: '#F59E0B', data: tatiOnly, emoji: '🟡' },
    { label: 'Ива',            color: '#EC4899', data: ivaOnly,  emoji: '🩷' },
    { label: 'Двамата заедно', color: '#F97316', data: both,     emoji: '🌍' },
  ];

  return <TableGrid cols={cols} emptyText="Няма държави все още" />;
}

function TableGrid({ cols, emptyText }: {
  cols: { label: string; color: string; data: { isoCode: string; nameBg: string }[]; emoji: string }[];
  emptyText: string;
}) {
  return (
    <div className="w-full max-w-4xl mx-auto mt-5 px-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cols.map((col) => (
          <div
            key={col.label}
            className="rounded-2xl overflow-hidden"
            style={{ background: 'white', border: `1.5px solid ${col.color}28`, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
          >
            <div
              className="py-2.5 px-3 text-center font-bold text-sm"
              style={{ color: col.color, background: `${col.color}12`, borderBottom: `1px solid ${col.color}20` }}
            >
              {col.emoji} {col.label}
              <span className="ml-1.5 text-xs font-normal opacity-60">({col.data.length})</span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
              {col.data.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs italic">{emptyText}</div>
              ) : (
                <ul>
                  {col.data.map((row, idx) => (
                    <li key={row.isoCode} className="flex items-center gap-2 px-3 py-1.5 text-sm border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <span className="text-slate-400 text-xs w-5 text-right shrink-0">{idx + 1}.</span>
                      <span className="text-slate-700">{row.nameBg}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
