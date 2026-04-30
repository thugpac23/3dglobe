'use client';

import { useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { VisitsByCountry, WishlistByCountry, AppMode } from '@/types';
import { BG_NAMES } from '@/data/countryNamesBg';
import { CAPITALS } from '@/data/capitals';
import countriesGeoJson from '@/data/countries.json';

function getFlagEmoji(iso: string): string {
  if (!iso || iso.length !== 2) return '🌍';
  try {
    return String.fromCodePoint(
      0x1F1E6 + iso.toUpperCase().charCodeAt(0) - 65,
      0x1F1E6 + iso.toUpperCase().charCodeAt(1) - 65,
    );
  } catch { return '🌍'; }
}

const ADM_TO_ISO2: Record<string, string> = { FRA: 'FR', NOR: 'NO' };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveIso(props: any): string {
  const iso2 = props?.ISO_A2 as string;
  if (iso2 && iso2 !== '-99') return iso2;
  return ADM_TO_ISO2[props?.ADM0_A3 as string] ?? '';
}

const ARCTIC_ISOS  = new Set(['GL','AQ','IS','SJ','FO']);
const DESERT_ISOS  = new Set(['DZ','EG','LY','MA','MR','ML','NE','TD','SD','ER','SO','DJ',
  'SA','YE','OM','AE','QA','KW','BH','IQ','IR','AF','PK','UZ','TM','KG','TJ','MN','KZ','NA']);
const SAVANNA_ISOS = new Set(['NG','GH','BF','TG','BJ','SN','GM','GW',
  'KE','TZ','UG','RW','BI','AO','ZM','MW','MZ','ZW','ZA','LS','SZ','ET','SS']);
const TROPICAL_ISOS = new Set(['BR','CO','VE','GY','SR','EC','PE',
  'CD','CG','GA','GQ','CM','CF','GN','SL','LR','CI',
  'ID','MY','PH','BN','TH','KH','LA','MM','VN','SG','TL','PG']);

function getUnvisitedColor(iso: string): string {
  if (ARCTIC_ISOS.has(iso))   return '#B0C8D4';
  if (DESERT_ISOS.has(iso))   return '#C4A36A';
  if (SAVANNA_ISOS.has(iso))  return '#7BA554';
  if (TROPICAL_ISOS.has(iso)) return '#1A5E30';
  return '#4A8050';
}

interface Props {
  visitsByCountry: VisitsByCountry;
  wishlistByCountry: WishlistByCountry;
  mode: AppMode;
  onCountryClick: (iso2: string, name: string) => void;
  loading?: boolean;
  height?: number;
}

export default function MapEmbed({
  visitsByCountry, wishlistByCountry, mode, onCountryClick, loading, height = 300,
}: Props) {
  const [mapZoom, setMapZoom]     = useState(1);
  const [mapCenter, setMapCenter] = useState<[number, number]>([15, 45]);
  const [tooltip, setTooltip]     = useState<{ name: string; x: number; y: number } | null>(null);

  function getColor(iso2: string): string {
    const natural = getUnvisitedColor(iso2);
    const data = mode === 'visited' ? visitsByCountry[iso2] : wishlistByCountry[iso2];
    if (!data) return natural;
    if (data.tati && data.iva) return '#7C3AED';
    if (data.tati) return '#F59E0B';
    if (data.iva)  return '#EC4899';
    return natural;
  }

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-md" style={{ height, background: '#1256a0' }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-white text-sm opacity-50">Зареждане…</div>
        </div>
      )}

      <ComposableMap
        projection="geoNaturalEarth1"
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <ZoomableGroup
          zoom={mapZoom}
          center={mapCenter}
          onMoveEnd={({ zoom, coordinates }) => { setMapZoom(zoom); setMapCenter(coordinates); }}
          minZoom={1}
          maxZoom={12}
        >
          <Geographies geography={countriesGeoJson}>
            {({ geographies }) =>
              geographies.map(geo => {
                const iso2 = resolveIso(geo.properties);
                if (!iso2) return null;
                const bgName = BG_NAMES[iso2] ?? geo.properties?.NAME ?? iso2;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getColor(iso2)}
                    stroke="rgba(255,255,255,0.45)"
                    strokeWidth={0.5 / mapZoom}
                    style={{
                      default: { outline: 'none', transition: 'fill 0.15s' },
                      hover:   { outline: 'none', fill: '#93C5FD', cursor: 'pointer' },
                      pressed: { outline: 'none' },
                    }}
                    onClick={() => onCountryClick(iso2, bgName)}
                    onMouseEnter={(e) => setTooltip({ name: `${getFlagEmoji(iso2)} ${bgName}`, x: e.clientX, y: e.clientY })}
                    onMouseMove={(e) => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })
            }
          </Geographies>

          {CAPITALS.map(cap => {
            const isMarked = mode === 'visited'
              ? !!(visitsByCountry[cap.isoCode])
              : !!(wishlistByCountry[cap.isoCode]);
            return (
              <Marker key={cap.isoCode} coordinates={[cap.lng, cap.lat]}>
                <circle
                  r={(isMarked ? 2.8 : 1.5) / mapZoom}
                  fill={isMarked ? 'rgba(255,225,60,0.95)' : 'rgba(255,255,255,0.28)'}
                  stroke="rgba(0,0,0,0.45)"
                  strokeWidth={0.5 / mapZoom}
                  style={{ pointerEvents: 'none' }}
                />
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {/* Zoom controls */}
      <div className="absolute flex flex-col gap-1.5 z-10" style={{ top: 10, right: 10 }}>
        {[{ label: '+', fn: () => setMapZoom(z => Math.min(z * 1.5, 12)) },
          { label: '−', fn: () => setMapZoom(z => Math.max(z / 1.5, 1)) }].map(({ label, fn }) => (
          <button
            key={label}
            onClick={fn}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-base font-bold transition-all hover:scale-110 active:scale-95"
            style={{
              background: 'rgba(255,255,255,0.9)',
              color: '#334155',
              border: '1px solid rgba(0,0,0,0.12)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 px-3 py-1.5 rounded-lg shadow-lg text-xs font-semibold text-white"
          style={{ left: tooltip.x + 12, top: tooltip.y - 36, background: 'rgba(15,23,42,0.92)' }}
        >
          {tooltip.name}
        </div>
      )}
    </div>
  );
}
