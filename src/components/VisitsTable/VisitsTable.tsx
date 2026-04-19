'use client';

import { VisitsByCountry } from '@/types';

interface VisitsTableProps {
  visitsByCountry: VisitsByCountry;
}

interface CountryRow {
  isoCode: string;
  name: string;
  capital: string;
}

export default function VisitsTable({ visitsByCountry }: VisitsTableProps) {
  const tatiOnly: CountryRow[] = [];
  const ivaOnly: CountryRow[] = [];
  const both: CountryRow[] = [];

  for (const [isoCode, entry] of Object.entries(visitsByCountry)) {
    const row: CountryRow = {
      isoCode,
      name: entry.country.name,
      capital: entry.country.capital,
    };
    if (entry.tati && entry.iva) both.push(row);
    else if (entry.tati) tatiOnly.push(row);
    else if (entry.iva) ivaOnly.push(row);
  }

  const sortByName = (a: CountryRow, b: CountryRow) => a.name.localeCompare(b.name);
  tatiOnly.sort(sortByName);
  ivaOnly.sort(sortByName);
  both.sort(sortByName);

  const columns = [
    { label: 'тати', color: '#FFD700', data: tatiOnly, emoji: '🟡' },
    { label: 'ива', color: '#FF69B4', data: ivaOnly, emoji: '🩷' },
    { label: 'двете', color: '#FFB347', data: both, emoji: '🌍' },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto mt-8 px-4">
      <h2 className="text-center text-slate-400 text-sm font-semibold uppercase tracking-widest mb-4">
        Посетени Държави
      </h2>
      <div className="grid grid-cols-3 gap-4">
        {columns.map((col) => (
          <div
            key={col.label}
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: col.color + '40', background: 'rgba(5,13,31,0.8)' }}
          >
            <div
              className="py-3 px-4 text-center font-bold text-sm uppercase tracking-wider"
              style={{
                color: col.color,
                background: col.color + '15',
                borderBottom: `1px solid ${col.color}30`,
              }}
            >
              {col.emoji} {col.label}
              <span className="ml-2 text-xs font-normal opacity-70">
                ({col.data.length})
              </span>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: '320px' }}>
              {col.data.length === 0 ? (
                <div className="py-8 text-center text-slate-600 text-sm italic">
                  Няма държави все още
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="py-2 px-3 text-left text-slate-500 font-medium">
                        Държава
                      </th>
                      <th className="py-2 px-3 text-left text-slate-500 font-medium">
                        Столица
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {col.data.map((row) => (
                      <tr
                        key={row.isoCode}
                        className="border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2 px-3 text-slate-300">{row.name}</td>
                        <td className="py-2 px-3 text-slate-500">{row.capital}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
