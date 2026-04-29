'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import {
  Visit, WishlistItem, VisitsByCountry, WishlistByCountry,
  UserType, AppMode, USER_COLOR, USER_DISPLAY,
} from '@/types';
import { BG_NAMES } from '@/data/countryNamesBg';
import { fetchVisits, addVisit, removeVisit, fetchWishlist, addWishlist, removeWishlist } from '@/lib/api';
import { sounds, resumeAudio } from '@/lib/sounds';
import VisitsTable from '@/components/VisitsTable';
import countriesGeoJson from '@/data/countries.json';
import { COUNTRY_FACTS } from '@/data/countryFacts';

function getFlagEmoji(iso: string): string {
  if (!iso || iso.length !== 2) return '🌍';
  try {
    return String.fromCodePoint(
      0x1F1E6 + iso.toUpperCase().charCodeAt(0) - 65,
      0x1F1E6 + iso.toUpperCase().charCodeAt(1) - 65,
    );
  } catch { return '🌍'; }
}

// Centroid labels for major countries
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const geoFeatures = (countriesGeoJson as any).features as any[];

// Some countries have ISO_A2='-99' in Natural Earth data; resolve via ADM0_A3
const ADM_TO_ISO2: Record<string, string> = { FRA: 'FR', NOR: 'NO' };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveIso(props: any): string {
  const iso2 = props?.ISO_A2 as string;
  if (iso2 && iso2 !== '-99') return iso2;
  return ADM_TO_ISO2[props?.ADM0_A3 as string] ?? '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function featureCentroid(f: any): [number, number] {
  const geom = f.geometry;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ring: [number, number][] = [];
  if (geom.type === 'Polygon') ring = geom.coordinates[0];
  else if (geom.type === 'MultiPolygon') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ring = geom.coordinates.reduce((a: any, b: any) => a[0].length >= b[0].length ? a : b)[0];
  }
  if (!ring.length) return [0, 0];
  const lons = ring.map((c) => c[0]);
  const lats = ring.map((c) => c[1]);
  return [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
}

interface LabelEntry { iso: string; name: string; lng: number; lat: number; rank: number }
const allLabelFeatures: LabelEntry[] = geoFeatures.flatMap(f => {
  const iso = resolveIso(f.properties);
  if (!iso) return [];
  const rank = (f.properties?.LABELRANK ?? 99) as number;
  if (rank > 4) return [];
  const name = BG_NAMES[iso] ?? f.properties?.NAME ?? '';
  if (!name) return [];
  const [lng, lat] = featureCentroid(f);
  return [{ iso, name, lng, lat, rank }];
});

interface ToastMsg { id: number; text: string; ok: boolean }

export default function KartaPage() {
  const [visits, setVisits]     = useState<Visit[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [mode, setMode]         = useState<AppMode>('visited');
  const [activeUser, setActiveUser] = useState<UserType>('tati');
  const [mapZoom, setMapZoom]   = useState(1);
  const [mapCenter, setMapCenter] = useState<[number, number]>([15, 45]);
  const [tooltip, setTooltip]   = useState<{ name: string; x: number; y: number } | null>(null);
  const [toasts, setToasts]     = useState<ToastMsg[]>([]);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [factPopup, setFactPopup] = useState<{ iso: string; name: string; fact: string } | null>(null);
  const factTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string, ok = true) => {
    const id = Date.now();
    setToasts(p => [...p, { id, text, ok }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 2800);
  }, []);

  useEffect(() => {
    Promise.all([fetchVisits(), fetchWishlist()])
      .then(([v, w]) => { setVisits(v); setWishlist(w); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const visitsByCountry = useMemo<VisitsByCountry>(() => {
    const map: VisitsByCountry = {};
    for (const v of visits) {
      const iso = v.country.isoCode;
      if (!map[iso]) map[iso] = { country: v.country, tati: false, iva: false };
      map[iso][v.user] = true;
    }
    return map;
  }, [visits]);

  const wishlistByCountry = useMemo<WishlistByCountry>(() => {
    const map: WishlistByCountry = {};
    for (const w of wishlist) {
      const iso = w.country.isoCode;
      if (!map[iso]) map[iso] = { country: w.country, tati: false, iva: false };
      map[iso][w.user] = true;
    }
    return map;
  }, [wishlist]);

  // Click a country on the map: first click selects, second click confirms
  const handleCountryClick = useCallback(async (iso2: string, rawName: string) => {
    resumeAudio(); sounds.click();

    if (iso2 !== selectedIso) {
      setSelectedIso(iso2);
      return;
    }
    setSelectedIso(null);

    // Show fact popup on confirm
    const fact = COUNTRY_FACTS[iso2];
    if (fact) {
      const name = BG_NAMES[iso2] ?? rawName;
      if (factTimerRef.current) clearTimeout(factTimerRef.current);
      setFactPopup({ iso: iso2, name, fact });
      factTimerRef.current = setTimeout(() => setFactPopup(null), 6500);
    }

    const bgName = BG_NAMES[iso2] ?? rawName;

    if (mode === 'visited') {
      const alreadyVisited = visitsByCountry[iso2]?.[activeUser] ?? false;
      if (alreadyVisited) {
        const item = visits.find(v => v.country.isoCode === iso2 && v.user === activeUser);
        if (!item) return;
        setVisits(p => p.filter(v => v.id !== item.id));
        showToast(`${bgName} премахната`, true);
        try { await removeVisit(item.countryId, activeUser); }
        catch { setVisits(p => [...p, item]); showToast('Грешка', false); }
      } else {
        let countryId: string | null = null;
        const existing = visits.find(v => v.country.isoCode === iso2);
        if (existing) { countryId = existing.countryId; }
        else {
          try {
            const r = await fetch(`/api/country?iso=${iso2}`);
            if (!r.ok) throw new Error();
            countryId = (await r.json()).id;
          } catch { showToast(`${bgName} не е намерена`, false); return; }
        }
        const opt: Visit = {
          id: `tmp-${Date.now()}`, countryId: countryId!,
          user: activeUser,
          country: visitsByCountry[iso2]?.country ?? { id: countryId!, name: rawName, capital: '', isoCode: iso2 },
        };
        setVisits(p => [...p, opt]);
        showToast(`✓ ${bgName} добавена`, true);
        sounds.add();
        try {
          const real = await addVisit(countryId!, activeUser);
          setVisits(p => [...p.filter(v => v.id !== opt.id), real]);
        } catch {
          setVisits(p => p.filter(v => v.id !== opt.id));
          showToast('Грешка при запазване', false);
        }
      }
    } else {
      // wishlist mode
      const onList = wishlistByCountry[iso2]?.[activeUser] ?? false;
      if (onList) {
        const item = wishlist.find(w => w.country.isoCode === iso2 && w.user === activeUser);
        if (!item) return;
        setWishlist(p => p.filter(w => w.id !== item.id));
        showToast(`${bgName} премахната от желаните`, true);
        try { await removeWishlist(item.countryId, activeUser); }
        catch { setWishlist(p => [...p, item]); }
      } else {
        let countryId: string | null = null;
        const existing = visits.find(v => v.country.isoCode === iso2) ?? wishlist.find(w => w.country.isoCode === iso2);
        if (existing) { countryId = existing.countryId; }
        else {
          try {
            const r = await fetch(`/api/country?iso=${iso2}`);
            if (!r.ok) throw new Error();
            countryId = (await r.json()).id;
          } catch { showToast(`${bgName} не е намерена`, false); return; }
        }
        const opt: WishlistItem = {
          id: `tmp-${Date.now()}`, countryId: countryId!,
          user: activeUser,
          country: { id: countryId!, name: rawName, capital: '', isoCode: iso2 },
        };
        setWishlist(p => [...p, opt]);
        showToast(`⭐ ${bgName} добавена в желаните`, true);
        sounds.add();
        try {
          const real = await addWishlist(countryId!, activeUser);
          setWishlist(p => [...p.filter(w => w.id !== opt.id), real]);
        } catch {
          setWishlist(p => p.filter(w => w.id !== opt.id));
          showToast('Грешка при запазване', false);
        }
      }
    }
  }, [selectedIso, mode, visitsByCountry, wishlistByCountry, visits, wishlist, activeUser, showToast]);

  function getColor(iso2: string): string {
    // Transparent = satellite texture shows through; visited = semi-transparent overlay
    if (iso2 === selectedIso) return 'rgba(251,191,36,0.75)';
    if (mode === 'visited') {
      const e = visitsByCountry[iso2];
      if (!e) return 'rgba(0,0,0,0)';
      if (e.tati && e.iva) return 'rgba(124,58,237,0.78)';
      if (e.tati) return 'rgba(245,158,11,0.78)';
      if (e.iva) return 'rgba(236,72,153,0.78)';
      return 'rgba(0,0,0,0)';
    } else {
      const e = wishlistByCountry[iso2];
      if (!e) return 'rgba(0,0,0,0)';
      if (e.tati && e.iva) return 'rgba(13,148,136,0.78)';
      if (e.tati || e.iva) return 'rgba(20,184,166,0.78)';
      return 'rgba(0,0,0,0)';
    }
  }

  // Label visibility based on zoom — rank 2 (major countries) always visible
  const visibleLabels = useMemo(() => {
    if (mapZoom < 2) return allLabelFeatures.filter(l => l.rank <= 2);
    if (mapZoom < 4) return allLabelFeatures.filter(l => l.rank <= 3);
    return allLabelFeatures.filter(l => l.rank <= 4);
  }, [mapZoom]);

  function zoomIn()  { setMapZoom(z => Math.min(z * 1.5, 12)); }
  function zoomOut() { setMapZoom(z => Math.max(z / 1.5, 1)); }

  return (
    <main className="min-h-screen px-3 py-4">

      {/* TOP: title + mode + user controls */}
      <div className="flex flex-wrap items-center gap-3 mb-3 max-w-7xl mx-auto">
        <div className="mr-2">
          <h1 className="text-xl font-extrabold text-slate-800 leading-tight">🗺️ Карта</h1>
          <p className="text-slate-500 text-xs">Кликни два пъти за потвърждение</p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.8)', border: '1.5px solid rgba(0,0,0,0.1)' }}>
          {(['visited', 'wishlist'] as AppMode[]).map(m => (
            <button
              key={m}
              onClick={() => { resumeAudio(); sounds.click(); setMode(m); }}
              className="px-4 py-1.5 text-xs font-semibold transition-all"
              style={{
                background: mode === m ? USER_COLOR[activeUser] : 'transparent',
                color: mode === m ? 'white' : '#64748b',
                borderRadius: '9999px',
              }}
            >
              {m === 'visited' ? '🗺️ Посетено' : '⭐ Желано'}
            </button>
          ))}
        </div>

        {/* User tabs */}
        <div className="flex gap-2">
          {(['tati', 'iva'] as UserType[]).map(u => (
            <button
              key={u}
              onClick={() => { resumeAudio(); sounds.click(); setActiveUser(u); }}
              className="px-4 py-1.5 rounded-full font-bold text-xs transition-all"
              style={{
                background: activeUser === u ? USER_COLOR[u] : 'white',
                color: activeUser === u ? 'white' : '#64748b',
                border: `2px solid ${activeUser === u ? USER_COLOR[u] : '#E2E8F0'}`,
                boxShadow: activeUser === u ? `0 2px 10px ${USER_COLOR[u]}40` : 'none',
              }}
            >
              {USER_DISPLAY[u]}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="hidden sm:flex gap-3 ml-auto text-xs text-slate-500">
          {mode === 'visited' ? (
            <>
              <LegendDot color={USER_COLOR.tati} label={USER_DISPLAY.tati} />
              <LegendDot color={USER_COLOR.iva}  label={USER_DISPLAY.iva} />
              <LegendDot color="#7C3AED" label="Заедно" />
            </>
          ) : (
            <>
              <LegendDot color="#14B8A6" label="Желано" />
              <LegendDot color="#0D9488" label="Заедно" />
            </>
          )}
          <LegendDot color="rgba(255,255,255,0.18)" label="Непосетено" />
        </div>
      </div>

      {/* BODY: map (flex-1) + sidebar (right) */}
      <div className="flex gap-4 max-w-7xl mx-auto">

        {/* Map column */}
        <div className="flex-1 min-w-0">
          <div className="relative rounded-2xl overflow-hidden shadow-md"
               style={{ height: 520, background: 'url("/earth-satellite.jpg") center/cover no-repeat, #0a1628' }}>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-blue-50 z-10">
                <div className="text-slate-400 text-sm">Зареждане…</div>
              </div>
            )}

            <ComposableMap projection="geoNaturalEarth1" style={{ width: '100%', height: '100%' }}>
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
                      const color = getColor(iso2);
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={color}
                          stroke="rgba(255,255,255,0.22)"
                          strokeWidth={0.5 / mapZoom}
                          style={{
                            default: { outline: 'none', transition: 'fill 0.15s' },
                            hover:   { outline: 'none', fill: mode === 'visited' ? 'rgba(96,165,250,0.45)' : 'rgba(45,212,191,0.45)', cursor: 'pointer' },
                            pressed: { outline: 'none' },
                          }}
                          onClick={() => handleCountryClick(iso2, bgName)}
                          onMouseEnter={(e) => setTooltip({ name: bgName, x: e.clientX, y: e.clientY })}
                          onMouseMove={(e) => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      );
                    })
                  }
                </Geographies>

                {/* Country name labels — visible only when zoomed in */}
                {visibleLabels.map(lbl => (
                  <Marker key={lbl.iso} coordinates={[lbl.lng, lbl.lat]}>
                    <text
                      textAnchor="middle"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                      fontSize={(lbl.rank <= 2 ? 5 : lbl.rank <= 3 ? 4 : 3.5) / mapZoom}
                      fontWeight="700"
                      fill="#ffffff"
                      stroke="rgba(0,0,0,0.85)"
                      strokeWidth={0.7 / mapZoom}
                      paintOrder="stroke"
                    >
                      {lbl.name}
                    </text>
                  </Marker>
                ))}
              </ZoomableGroup>
            </ComposableMap>

            {/* Zoom controls overlay */}
            <div className="absolute flex flex-col gap-2 z-10" style={{ top: 12, right: 12 }}>
              <MapZoomBtn label="+" onClick={zoomIn} />
              <MapZoomBtn label="−" onClick={zoomOut} />
            </div>

            {/* Selection hint */}
            {selectedIso && (
              <div
                className="absolute bottom-3 left-1/2 pointer-events-none z-20"
                style={{ transform: 'translateX(-50%)' }}
              >
                <div
                  className="px-4 py-1.5 rounded-full text-xs font-semibold text-white shadow-lg whitespace-nowrap"
                  style={{ background: 'rgba(15,23,42,0.82)', backdropFilter: 'blur(4px)' }}
                >
                  {getFlagEmoji(selectedIso)} {BG_NAMES[selectedIso] ?? selectedIso} — кликни отново за потвърждение
                </div>
              </div>
            )}

            {/* Fact popup */}
            {factPopup && (
              <div
                className="fact-popup-enter absolute bottom-14 left-1/2 z-30 pointer-events-auto"
                style={{ transform: 'translateX(-50%)' }}
              >
                <div
                  className="rounded-2xl shadow-2xl px-5 py-4 flex items-start gap-3 max-w-xs"
                  style={{ background: 'rgba(255,255,255,0.97)', border: '1.5px solid #e2e8f0', minWidth: 260 }}
                >
                  <span className="text-3xl leading-none mt-0.5">{getFlagEmoji(factPopup.iso)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-slate-800 text-sm mb-1">{factPopup.name}</div>
                    <div className="text-slate-600 text-xs leading-snug">{factPopup.fact}</div>
                  </div>
                  <button
                    className="text-slate-400 hover:text-slate-600 text-base leading-none mt-0.5 shrink-0"
                    onClick={() => setFactPopup(null)}
                  >✕</button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile: tables below map */}
          <div className="mt-4 md:hidden">
            <VisitsTable
              visitsByCountry={visitsByCountry}
              wishlistByCountry={wishlistByCountry}
              mode={mode}
            />
          </div>
        </div>

        {/* Sidebar column */}
        <div className="hidden md:flex flex-col gap-3 w-72 shrink-0">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            {mode === 'visited' ? '🗺️ Посетени страни' : '⭐ Желани дестинации'}
          </div>
          <VisitsTable
            visitsByCountry={visitsByCountry}
            wishlistByCountry={wishlistByCountry}
            mode={mode}
            compact
          />
        </div>
      </div>

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 px-3 py-1.5 rounded-lg shadow-lg text-xs font-semibold text-white"
          style={{ left: tooltip.x + 12, top: tooltip.y - 36, background: 'rgba(15,23,42,0.92)' }}
        >
          {tooltip.name}
        </div>
      )}

      {/* Toasts */}
      <div className="fixed top-16 left-1/2 z-50 flex flex-col gap-2 pointer-events-none" style={{ transform: 'translateX(-50%)' }}>
        {toasts.map(t => (
          <div
            key={t.id}
            className="px-5 py-2 rounded-2xl text-sm font-semibold shadow-xl text-white text-center whitespace-nowrap"
            style={{ background: t.ok ? '#059669' : '#DC2626' }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </main>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="w-3 h-3 rounded-sm inline-block" style={{ background: color }} />
      {label}
    </span>
  );
}

function MapZoomBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold transition-all hover:scale-110 active:scale-95"
      style={{
        background: 'rgba(255,255,255,0.9)',
        color: '#334155',
        border: '1px solid rgba(0,0,0,0.12)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
      }}
    >
      {label}
    </button>
  );
}
