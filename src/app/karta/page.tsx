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
import { CAPITALS } from '@/data/capitals';
import {
  resolveIso, getNaturalEarthColor, getOverlayColor, getVisitingUsers,
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

// Map utilities + label data are imported from @/lib/mapHelpers (shared
// across karta page, MapEmbed, and Globe so all three stay in sync).

interface ToastMsg { id: number; text: string; ok: boolean }

type FilterUser = 'tati' | 'iva' | 'both' | null;

export default function KartaPage() {
  const [visits, setVisits]     = useState<Visit[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [mode, setMode]         = useState<AppMode>('visited');
  const [activeUser, setActiveUser] = useState<UserType>('tati');
  const [mapZoom, setMapZoom]   = useState(1);
  const [mapCenter, setMapCenter] = useState<[number, number]>([15, 45]);
  const [isMobile, setIsMobile] = useState(false);
  const [tooltip, setTooltip]   = useState<{ name: string; x: number; y: number } | null>(null);
  const [toasts, setToasts]     = useState<ToastMsg[]>([]);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [factPopup, setFactPopup] = useState<{ iso: string; name: string; fact: string } | null>(null);
  const [filterUser, setFilterUser] = useState<FilterUser>(null);
  const factTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string, ok = true) => {
    const id = Date.now();
    setToasts(p => [...p, { id, text, ok }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 2800);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    Promise.all([fetchVisits(), fetchWishlist()])
      .then(([v, w]) => { setVisits(v); setWishlist(w); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Reset filter when mode changes
  useEffect(() => { setFilterUser(null); }, [mode]);

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

  // Selected country: yellow ring; unfiltered countries dim when filter active.
  // Returns color for BASE layer (natural earth biome).
  function getBaseFill(iso2: string): string {
    if (iso2 === selectedIso) return '#FBBF24';
    const data = mode === 'visited' ? visitsByCountry[iso2] : wishlistByCountry[iso2];
    if (filterUser && !data) return '#2A4030'; // dim unrelated countries
    return getNaturalEarthColor(iso2);
  }

  // Returns semi-transparent overlay color (or null) — applied on top of base
  function getOverlay(iso2: string): string | null {
    if (iso2 === selectedIso) return null; // selection takes precedence
    const data = mode === 'visited' ? visitsByCountry[iso2] : wishlistByCountry[iso2];
    if (!data) return null;
    const passes = !filterUser
      || (filterUser === 'tati' && data.tati)
      || (filterUser === 'iva'  && data.iva)
      || (filterUser === 'both' && data.tati && data.iva);
    if (!passes) return null;
    return getOverlayColor(iso2, visitsByCountry, wishlistByCountry, mode);
  }

  // Labels: tiered by zoom; ALL countries shown at deep zoom (no missing names)
  const visibleLabels = useMemo(() => visibleLabelsAtZoom(mapZoom), [mapZoom]);

  // Extra zoom depth: max 20 instead of 12 (adds ~2 more deep-zoom steps)
  function zoomIn()  { setMapZoom(z => Math.min(z * 1.5, 20)); }
  function zoomOut() { setMapZoom(z => Math.max(z / 1.5, 1)); }

  const FILTER_OPTS: { key: FilterUser & string; label: string; color: string }[] = [
    { key: 'tati', label: USER_DISPLAY.tati, color: USER_COLOR.tati },
    { key: 'iva',  label: USER_DISPLAY.iva,  color: USER_COLOR.iva  },
    { key: 'both', label: 'Двамата',          color: '#7C3AED'        },
  ];

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
          <LegendDot color={USER_COLOR.tati} label={USER_DISPLAY.tati} />
          <LegendDot color={USER_COLOR.iva}  label={USER_DISPLAY.iva} />
          <LegendDot color="#7C3AED" label="Заедно" />
          <LegendDot color="#4A8050" label="Непосетено" />
        </div>
      </div>

      {/* BODY: map (flex-1) + sidebar (right) */}
      <div className="flex gap-4 max-w-7xl mx-auto">

        {/* Map column */}
        <div className="flex-1 min-w-0">
          <div className="relative rounded-2xl overflow-hidden shadow-md" style={{ height: 520, background: '#1256a0' }}>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-blue-50 z-10">
                <div className="text-slate-400 text-sm">Зареждане…</div>
              </div>
            )}

            <ComposableMap projection="geoNaturalEarth1" style={{ width: '100%', height: '100%', background: 'transparent' }}>
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
                      {/* Base layer: natural earth colors + interactions */}
                      {geographies.map(geo => {
                        const iso2 = resolveIso(geo.properties);
                        if (!iso2) return null;
                        const bgName = BG_NAMES[iso2] ?? geo.properties?.NAME ?? iso2;
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={getBaseFill(iso2)}
                            stroke="rgba(255,255,255,0.85)"
                            strokeWidth={1.1 / mapZoom}
                            style={{
                              default: { outline: 'none', transition: 'fill 0.15s' },
                              hover:   { outline: 'none', fill: '#93C5FD', cursor: 'pointer' },
                              pressed: { outline: 'none' },
                            }}
                            onClick={() => handleCountryClick(iso2, bgName)}
                            onMouseEnter={(e) => setTooltip({ name: `${getFlagEmoji(iso2)} ${bgName}`, x: e.clientX, y: e.clientY })}
                            onMouseMove={(e) => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                            onMouseLeave={() => setTooltip(null)}
                          />
                        );
                      })}
                      {/* Overlay layer: semi-transparent user colors on visited/wishlist */}
                      {geographies.map(geo => {
                        const iso2 = resolveIso(geo.properties);
                        if (!iso2) return null;
                        const overlay = getOverlay(iso2);
                        if (!overlay) return null;
                        return (
                          <Geography
                            key={`ov-${geo.rsmKey}`}
                            geography={geo}
                            fill={overlay}
                            stroke="rgba(255,255,255,0.85)"
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

                {/* Country name labels */}
                {visibleLabels.map(lbl => (
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

                {/* Avatar markers — small colored badges for visited countries */}
                {visibleLabels.map(lbl => {
                  const users = getVisitingUsers(lbl.iso, visitsByCountry, wishlistByCountry, mode);
                  if (users.length === 0) return null;
                  const r       = (isMobile ? 8 : 3.2) / mapZoom;
                  const fontSz  = (isMobile ? 9 : 3.6) / mapZoom;
                  const stroke  = (isMobile ? 1.2 : 0.5) / mapZoom;
                  const offsetY = (isMobile ? 22 : 7) / mapZoom; // below the label
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

                {/* Capital city markers */}
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

          {/* Map visual filter */}
          <div className="flex flex-wrap gap-1.5 px-1">
            <span className="text-xs text-slate-400 w-full">Филтър на картата:</span>
            {FILTER_OPTS.map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setFilterUser(f => f === key ? null : key)}
                className="px-3 py-1 rounded-full text-xs font-bold transition-all"
                style={{
                  background: filterUser === key ? color : 'white',
                  color: filterUser === key ? 'white' : '#64748b',
                  border: `1.5px solid ${filterUser === key ? color : '#E2E8F0'}`,
                  boxShadow: filterUser === key ? `0 2px 8px ${color}40` : 'none',
                }}
              >
                {label}
              </button>
            ))}
            {filterUser && (
              <button
                onClick={() => setFilterUser(null)}
                className="px-2 py-1 rounded-full text-xs text-slate-400 border border-slate-200 hover:border-slate-400 transition-all"
              >
                ✕ Всички
              </button>
            )}
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
