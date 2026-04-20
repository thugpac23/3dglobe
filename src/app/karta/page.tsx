'use client';

import { useState, useEffect } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { Visit, VisitsByCountry, UserType, USER_COLOR, USER_DISPLAY } from '@/types';
import { BG_NAMES } from '@/data/countryNamesBg';
import { fetchVisits } from '@/lib/api';
import { sounds, resumeAudio } from '@/lib/sounds';
import countriesGeoJson from '@/data/countries.json';

// Compute centroid from GeoJSON feature for label placement
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function featureCentroid(feature: any): [number, number] {
  const geom = feature.geometry;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ring: [number, number][] = [];
  if (geom.type === 'Polygon') {
    ring = geom.coordinates[0];
  } else if (geom.type === 'MultiPolygon') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ring = geom.coordinates.reduce((a: any, b: any) =>
      a[0].length >= b[0].length ? a : b
    )[0];
  }
  if (!ring.length) return [0, 0];
  const lons = ring.map((c) => c[0]);
  const lats = ring.map((c) => c[1]);
  return [
    (Math.min(...lons) + Math.max(...lons)) / 2,
    (Math.min(...lats) + Math.max(...lats)) / 2,
  ];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const geoFeatures = (countriesGeoJson as any).features as any[];

interface LabelFeature {
  iso: string;
  name: string;
  lng: number;
  lat: number;
  rank: number;
}

// Only label important countries (LABELRANK ≤ 4) to avoid clutter
const labelFeatures: LabelFeature[] = geoFeatures.flatMap(f => {
  const iso = f.properties?.ISO_A2 as string;
  const rank = (f.properties?.LABELRANK ?? 99) as number;
  if (rank > 4) return [];
  const name = BG_NAMES[iso] ?? f.properties?.NAME ?? '';
  if (!name) return [];
  const [lng, lat] = featureCentroid(f);
  return [{ iso, name, lng, lat, rank }];
});

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
        {visitedCount > 0 ? `${visitedCount} посетени държави` : 'Все още няма посетени държави'}
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
      <div
        className="rounded-2xl overflow-hidden shadow-md relative"
        style={{ height: 480, background: '#bfdbfe' }}
      >
        <ComposableMap
          projection="geoNaturalEarth1"
          style={{ width: '100%', height: '100%' }}
        >
          <ZoomableGroup>
            <Geographies geography={countriesGeoJson}>
              {({ geographies }) =>
                geographies.map(geo => {
                  const iso2 = geo.properties?.ISO_A2 as string;
                  const color = getColor(iso2);
                  const bgName = BG_NAMES[iso2] ?? geo.properties?.NAME ?? iso2;
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
                        setTooltip({ name: bgName, x: e.clientX, y: e.clientY });
                      }}
                      onMouseMove={(e) => {
                        setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null);
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })
              }
            </Geographies>

            {/* Country name labels for major countries */}
            {labelFeatures.map(lbl => (
              <Marker key={lbl.iso} coordinates={[lbl.lng, lbl.lat]}>
                <text
                  textAnchor="middle"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                  fontSize={lbl.rank <= 2 ? 5 : lbl.rank <= 3 ? 4 : 3.5}
                  fontWeight="bold"
                  fill="#1e293b"
                  stroke="white"
                  strokeWidth={0.8}
                  paintOrder="stroke"
                >
                  {lbl.name}
                </text>
              </Marker>
            ))}
          </ZoomableGroup>
        </ComposableMap>

        {tooltip && (
          <div
            className="pointer-events-none fixed z-50 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg shadow-lg font-semibold"
            style={{ left: tooltip.x + 12, top: tooltip.y - 36 }}
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
                  {BG_NAMES[v.country.isoCode] ?? v.country.name}
                </span>
              ))}
          </div>
        </div>
      )}
    </main>
  );
}
