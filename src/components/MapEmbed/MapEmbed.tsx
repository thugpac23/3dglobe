'use client';

import { useState, useEffect } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { VisitsByCountry, WishlistByCountry, AppMode } from '@/types';
import { BG_NAMES } from '@/data/countryNamesBg';
import { CAPITALS } from '@/data/capitals';
import countriesGeoJson from '@/data/countries.json';
import {
  resolveIso, getOverlayColor, getVisitingUsers,
  visibleLabelsAtZoom, USER_FILL,
} from '@/lib/mapHelpers';

function getFlagEmoji(iso: string): string {
  if (!iso || iso.length !== 2) return '🌍';
  try {
    return String.fromCodePoint(
      0x1F1E6 + iso.toUpperCase().charCodeAt(0) - 65,
      0x1F1E6 + iso.toUpperCase().charCodeAt(1) - 65,
    );
  } catch { return '🌍'; }
}

interface Props {
  visitsByCountry: VisitsByCountry;
  wishlistByCountry: WishlistByCountry;
  mode: AppMode;
  onCountryClick: (iso2: string, name: string) => void;
  loading?: boolean;
  height?: number;
  fullscreen?: boolean;
}

export default function MapEmbed({
  visitsByCountry, wishlistByCountry, mode, onCountryClick, loading, height = 300, fullscreen = false,
}: Props) {
  const [mapZoom, setMapZoom]     = useState(1);
  const [mapCenter, setMapCenter] = useState<[number, number]>([15, 45]);
  const [tooltip, setTooltip]     = useState<{ name: string; x: number; y: number } | null>(null);
  const [isMobile, setIsMobile]   = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const labels = visibleLabelsAtZoom(mapZoom);

  const containerStyle: React.CSSProperties = {
    height: fullscreen ? '100%' : height,
    borderRadius: fullscreen ? 0 : 16,
    backgroundImage: 'url(/earth-satellite.jpg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };

  return (
    <div className="relative overflow-hidden shadow-md" style={containerStyle}>
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
          maxZoom={20}
        >
          <Geographies geography={countriesGeoJson}>
            {({ geographies }) => (
              <>
                {/* Base layer: near-transparent land (click target + subtle border) */}
                {geographies.map(geo => {
                  const iso2 = resolveIso(geo.properties);
                  if (!iso2) return null;
                  const bgName = BG_NAMES[iso2] ?? geo.properties?.NAME ?? iso2;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="rgba(30,90,30,0.18)"
                      stroke="rgba(255,255,255,0.7)"
                      strokeWidth={1.1 / mapZoom}
                      style={{
                        default: { outline: 'none', transition: 'fill 0.15s' },
                        hover:   { outline: 'none', fill: 'rgba(147,197,253,0.55)', cursor: 'pointer' },
                        pressed: { outline: 'none' },
                      }}
                      onClick={() => onCountryClick(iso2, bgName)}
                      onMouseEnter={(e) => setTooltip({ name: `${getFlagEmoji(iso2)} ${bgName}`, x: e.clientX, y: e.clientY })}
                      onMouseMove={(e) => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
                {/* Overlay: semi-transparent visited/wishlist colors */}
                {geographies.map(geo => {
                  const iso2 = resolveIso(geo.properties);
                  if (!iso2) return null;
                  const overlay = getOverlayColor(iso2, visitsByCountry, wishlistByCountry, mode);
                  if (!overlay) return null;
                  return (
                    <Geography
                      key={`ov-${geo.rsmKey}`}
                      geography={geo}
                      fill={overlay}
                      stroke="rgba(255,255,255,0.7)"
                      strokeWidth={1.1 / mapZoom}
                      style={{
                        default: { outline: 'none', pointerEvents: 'none' },
                        hover:   { outline: 'none', pointerEvents: 'none' },
                        pressed: { outline: 'none', pointerEvents: 'none' },
                      }}
                    />
                  );
                })}
              </>
            )}
          </Geographies>

          {/* Country labels */}
          {labels.map(lbl => (
            <Marker key={lbl.iso} coordinates={[lbl.lng, lbl.lat]}>
              <text
                textAnchor="middle"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
                fontSize={
                  (isMobile
                    ? (lbl.rank <= 2 ? 26 : lbl.rank <= 3 ? 18 : lbl.rank <= 4 ? 13 : 11)
                    : (lbl.rank <= 2 ? 8  : lbl.rank <= 3 ? 6  : lbl.rank <= 4 ? 4.5 : 3.5)
                  ) / mapZoom
                }
                fontWeight="700"
                fill="#ffffff"
                stroke="rgba(0,0,0,0.9)"
                strokeWidth={(isMobile ? 2.2 : 0.7) / mapZoom}
                paintOrder="stroke"
              >
                {lbl.name}
              </text>
            </Marker>
          ))}

          {/* Avatar markers */}
          {labels.map(lbl => {
            const users = getVisitingUsers(lbl.iso, visitsByCountry, wishlistByCountry, mode);
            if (users.length === 0) return null;
            const r       = (isMobile ? 8 : 3.2) / mapZoom;
            const fontSz  = (isMobile ? 9 : 3.6) / mapZoom;
            const stroke  = (isMobile ? 1.2 : 0.5) / mapZoom;
            const offsetY = (isMobile ? 22 : 7) / mapZoom;
            return (
              <Marker key={`av-${lbl.iso}`} coordinates={[lbl.lng, lbl.lat]}>
                <g transform={`translate(0, ${offsetY})`} style={{ pointerEvents: 'none' }}>
                  {users.map((u, i) => {
                    const dx = (users.length === 1 ? 0 : (i === 0 ? -r * 1.05 : r * 1.05));
                    const fill = users.length === 2 ? USER_FILL.both : USER_FILL[u];
                    return (
                      <g key={u} transform={`translate(${dx}, 0)`}>
                        <circle r={r} fill={fill} stroke="white" strokeWidth={stroke} />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={fontSz}
                          fontWeight="800"
                          fill="white"
                          style={{ userSelect: 'none' }}
                        >
                          {u === 'tati' ? 'Т' : 'И'}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </Marker>
            );
          })}

          {/* Capital city dots */}
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
        {[{ label: '+', fn: () => setMapZoom(z => Math.min(z * 1.5, 20)) },
          { label: '−', fn: () => setMapZoom(z => Math.max(z / 1.5, 1)) }].map(({ label, fn }) => (
          <button
            key={label}
            onClick={fn}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-base font-bold transition-all hover:scale-110 active:scale-95"
            style={{
              background: 'rgba(6,18,40,0.85)',
              color: 'rgba(180,210,255,0.9)',
              border: '1px solid rgba(80,140,230,0.25)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
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
          style={{ left: tooltip.x + 12, top: tooltip.y - 36, background: 'rgba(6,14,36,0.97)', border: '1px solid rgba(80,140,230,0.3)' }}
        >
          {tooltip.name}
        </div>
      )}
    </div>
  );
}
