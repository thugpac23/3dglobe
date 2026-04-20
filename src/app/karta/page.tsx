'use client';

import { useState, useEffect } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { Visit, VisitsByCountry, UserType, USER_COLOR, USER_DISPLAY } from '@/types';
import { fetchVisits } from '@/lib/api';
import { sounds, resumeAudio } from '@/lib/sounds';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const COUNTRY_ISO_MAP: Record<string, string> = {};

export default function KartaPage() {
  const [visits, setVisits] = useState<VisitsByCountry>({});
  const [activeUser, setActiveUser] = useState<UserType | 'both'>('both');
  const [tooltip, setTooltip] = useState<{ name: string; x: number; y: number } | null>(null);

  useEffect(() => {
    fetchVisits().then(data => {
      const map: VisitsByCountry = {};
      data.forEach((v: Visit) => {
        if (!map[v.country.isoCode]) {
          map[v.country.isoCode] = { country: v.country, tati: false, iva: false };
        }
        map[v.country.isoCode][v.user] = true;
      });
      setVisits(map);
    }).catch(() => {});
  }, []);

  function getColor(iso2: string): string {
    const entry = visits[iso2];
    if (!entry) return '#CBD5E1';
    if (activeUser === 'both') {
      if (entry.tati && entry.iva) return '#FB923C';
      if (entry.tati) return USER_COLOR.tati;
      if (entry.iva) return USER_COLOR.iva;
    } else {
      if (entry[activeUser]) return USER_COLOR[activeUser];
    }
    return '#CBD5E1';
  }

  const visitedCount = Object.values(visits).filter(v =>
    activeUser === 'both' ? (v.tati || v.iva) : v[activeUser]
  ).length;

  return (
    <main className="min-h-screen px-4 py-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-extrabold text-slate-800 mb-1">🗺️ Карта на пътешествията</h1>
      <p className="text-slate-500 text-sm mb-5">
        {visitedCount} посетени държави
      </p>

      {/* User filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['both', 'tati', 'iva'] as const).map(u => (
          <button
            key={u}
            onClick={() => { resumeAudio(); sounds.click(); setActiveUser(u); }}
            className="px-4 py-1.5 rounded-full font-bold text-sm transition-all"
            style={{
              background: activeUser === u
                ? (u === 'both' ? '#0EA5E9' : USER_COLOR[u])
                : 'white',
              color: activeUser === u ? 'white' : '#64748b',
              border: `2px solid ${activeUser === u ? (u === 'both' ? '#0EA5E9' : USER_COLOR[u]) : '#E2E8F0'}`,
            }}
          >
            {u === 'both' ? '🌍 И двамата' : USER_DISPLAY[u]}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs text-slate-500 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: USER_COLOR.tati }} />
          {USER_DISPLAY.tati}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: USER_COLOR.iva }} />
          {USER_DISPLAY.iva}
        </span>
        {activeUser === 'both' && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#FB923C' }} />
            И двамата
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block bg-slate-300" />
          Непосетена
        </span>
      </div>

      {/* Map */}
      <div className="rounded-2xl overflow-hidden shadow-md bg-sky-100 relative" style={{ height: 480 }}>
        <ComposableMap
          projection="geoNaturalEarth1"
          style={{ width: '100%', height: '100%' }}
        >
          <ZoomableGroup>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map(geo => {
                  const iso2 = geo.properties.ISO_A2 as string;
                  const color = getColor(iso2);
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={color}
                      stroke="#fff"
                      strokeWidth={0.4}
                      style={{
                        default: { outline: 'none', transition: 'fill 0.15s' },
                        hover: { outline: 'none', fill: '#38BDF8', cursor: 'pointer' },
                        pressed: { outline: 'none' },
                      }}
                      onMouseEnter={(e) => {
                        setTooltip({ name: geo.properties.NAME as string, x: e.clientX, y: e.clientY });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>

        {tooltip && (
          <div
            className="pointer-events-none fixed z-50 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg shadow-lg"
            style={{ left: tooltip.x + 12, top: tooltip.y - 30 }}
          >
            {tooltip.name}
          </div>
        )}
      </div>

      {/* Visited list */}
      {Object.keys(visits).length > 0 && (
        <div className="mt-6">
          <h2 className="text-base font-bold text-slate-700 mb-3">Посетени дестинации</h2>
          <div className="flex flex-wrap gap-2">
            {Object.values(visits)
              .filter(v => activeUser === 'both' ? (v.tati || v.iva) : v[activeUser])
              .sort((a, b) => a.country.name.localeCompare(b.country.name))
              .map(v => (
                <span
                  key={v.country.isoCode}
                  className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                  style={{
                    background: activeUser === 'both'
                      ? (v.tati && v.iva ? '#FB923C' : v.tati ? USER_COLOR.tati : USER_COLOR.iva)
                      : USER_COLOR[activeUser],
                  }}
                >
                  {v.country.name}
                </span>
              ))}
          </div>
        </div>
      )}
    </main>
  );
}
