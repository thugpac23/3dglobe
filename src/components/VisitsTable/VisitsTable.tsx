'use client';

import { VisitsByCountry, USER_DISPLAY } from '@/types';

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
    {
      label: `Държави посетени от ${USER_DISPLAY.tati}`,
      color: '#FFD700',
      data: tatiOnly,
      emoji: '🟡',
    },
    {
      label: `Държави посетени от ${USER_DISPLAY.iva}`,
      color: '#FF69B4',
      data: ivaOnly,
      emoji: '🩷',
    },
    {
      label: 'Държави посетени и от двамата',
      color: '#FFB347',
      data: both,
      emoji: '🌍',
    },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto mt-6 px-4">
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
            {/* Column header */}
            <div
              className="py-3 px-3 text-center font-semibold text-xs leading-tight"
              style={{
                color: col.color,
                background: col.color + '12',
                borderBottom: `1px solid ${col.color}28`,
              }}
            >
              {col.emoji} {col.label}
              <span className="ml-1 opacity-60">({col.data.length})</span>
            </div>

            {/* Country list */}
            <div className="overflow-y-auto" style={{ maxHeight: '280px' }}>
              {col.data.length === 0 ? (
                <div className="py-8 text-center text-slate-700 text-xs italic">
                  Няма държави все още
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800/80">
                      <th className="py-1.5 px-3 text-left text-slate-600 font-medium">
                        Държава
                      </th>
                      <th className="py-1.5 px-3 text-left text-slate-600 font-medium">
                        Столица
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {col.data.map((row) => (
                      <tr
                        key={row.isoCode}
                        className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors"
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
