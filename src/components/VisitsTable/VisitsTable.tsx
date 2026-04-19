'use client';

import { VisitsByCountry } from '@/types';
import { BG_NAMES } from '@/data/countryNamesBg';

interface VisitsTableProps {
  visitsByCountry: VisitsByCountry;
}

interface CountryRow {
  isoCode: string;
  nameBg: string;
}

export default function VisitsTable({ visitsByCountry }: VisitsTableProps) {
  const tatiOnly: CountryRow[] = [];
  const ivaOnly: CountryRow[] = [];
  const both: CountryRow[] = [];

  for (const [isoCode, entry] of Object.entries(visitsByCountry)) {
    const row: CountryRow = {
      isoCode,
      nameBg: BG_NAMES[isoCode] ?? entry.country.name,
    };
    if (entry.tati && entry.iva) both.push(row);
    else if (entry.tati) tatiOnly.push(row);
    else if (entry.iva) ivaOnly.push(row);
  }

  const sortByName = (a: CountryRow, b: CountryRow) =>
    a.nameBg.localeCompare(b.nameBg, 'bg');
  tatiOnly.sort(sortByName);
  ivaOnly.sort(sortByName);
  both.sort(sortByName);

  const columns = [
    { label: 'Тати',           color: '#FFD700', data: tatiOnly, emoji: '🟡' },
    { label: 'Ива',            color: '#FF69B4', data: ivaOnly,  emoji: '🩷' },
    { label: 'Двамата заедно', color: '#FFB347', data: both,     emoji: '🌍' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto mt-6 px-4">
      <h2 className="text-center text-slate-500 text-xs font-semibold uppercase tracking-widest mb-4">
        Посетени Държави
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {columns.map((col) => (
          <div
            key={col.label}
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: col.color + '38', background: 'rgba(4,10,28,0.82)' }}
          >
            {/* Header */}
            <div
              className="py-3 px-3 text-center font-bold text-sm tracking-wide"
              style={{
                color: col.color,
                background: col.color + '14',
                borderBottom: `1px solid ${col.color}28`,
              }}
            >
              {col.emoji} {col.label}
              <span className="ml-1 text-xs font-normal opacity-55">
                ({col.data.length})
              </span>
            </div>

            {/* Rows */}
            <div className="overflow-y-auto" style={{ maxHeight: '260px' }}>
              {col.data.length === 0 ? (
                <div className="py-7 text-center text-slate-700 text-xs italic">
                  Няма държави все още
                </div>
              ) : (
                <ul>
                  {col.data.map((row, idx) => (
                    <li
                      key={row.isoCode}
                      className="flex items-center gap-2 px-3 py-2 text-sm border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors"
                    >
                      <span className="text-slate-600 text-xs w-5 text-right shrink-0">
                        {idx + 1}.
                      </span>
                      <span className="text-slate-200">{row.nameBg}</span>
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
