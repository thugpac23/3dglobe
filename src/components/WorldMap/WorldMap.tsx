'use client';

import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, useMap, useMapEvents } from 'react-leaflet';
import type { GeoJsonObject } from 'geojson';
import L from 'leaflet';
import { VisitsByCountry, WishlistByCountry, AppMode } from '@/types';
import { BG_NAMES } from '@/data/countryNamesBg';
import { getFact } from '@/data/countryFacts';
import countriesGeoJson from '@/data/countries.json';
import {
  resolveIso, getOverlayColor, USER_FILL, ALL_LABELS, CENTROID_BY_ISO,
} from '@/lib/mapHelpers';

// Esri World Imagery — free satellite tiles, no API key required
const ESRI_SAT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

function getFlagEmoji(iso: string): string {
  if (!iso || iso.length !== 2) return '';
  try {
    return String.fromCodePoint(
      0x1F1E6 + iso.toUpperCase().charCodeAt(0) - 65,
      0x1F1E6 + iso.toUpperCase().charCodeAt(1) - 65,
    );
  } catch { return ''; }
}

// Convert rgba() string → Leaflet PathOptions (Leaflet needs hex + separate opacity)
function overlayToStyle(overlay: string | null): L.PathOptions {
  const border = { color: 'rgba(255,255,255,0.6)', weight: 0.9 };
  if (!overlay) return { ...border, fillColor: '#2e6b3e', fillOpacity: 0.08 };
  const m = overlay.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  if (!m) return { ...border, fillColor: '#2e6b3e', fillOpacity: 0.08 };
  const hex = '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  return { fillColor: hex, fillOpacity: parseFloat(m[4]), color: 'rgba(255,255,255,0.75)', weight: 1.2 };
}

interface HoverFact { iso: string; name: string; fact: string; x: number; y: number; }

interface DataRef {
  visitsByCountry: VisitsByCountry;
  wishlistByCountry: WishlistByCountry;
  mode: AppMode;
  onCountryClick: (iso2: string, name: string) => void;
  isDesktop: boolean;
  setHoverFact: (f: HoverFact | null) => void;
  hoverTimer: { current: ReturnType<typeof setTimeout> | null };
  hoverState:  { current: { iso: string; clientX: number; clientY: number } | null };
}

const HOVER_FACT_DELAY_MS = 6000;

// ── ZoomControls (runs inside MapContainer) ───────────────────────────────────
function ZoomControls() {
  const map = useMap();
  return (
    <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[{ label: '+', fn: () => map.zoomIn() }, { label: '−', fn: () => map.zoomOut() }].map(({ label, fn }) => (
        <button
          key={label}
          onClick={fn}
          style={{
            width: 28, height: 28, borderRadius: 8, cursor: 'pointer',
            background: 'rgba(6,18,40,0.85)', color: 'rgba(180,210,255,0.9)',
            border: '1px solid rgba(80,140,230,0.25)', boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            fontWeight: 700, fontSize: 16, lineHeight: 1,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Country name labels (zoom-dependent, Bulgarian) ───────────────────────────
function CountryLabels() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  const visible = useMemo(() => {
    if (zoom < 3) return ALL_LABELS.filter(l => l.rank <= 2);
    if (zoom < 4) return ALL_LABELS.filter(l => l.rank <= 3);
    if (zoom < 5) return ALL_LABELS.filter(l => l.rank <= 4);
    if (zoom < 6) return ALL_LABELS.filter(l => l.rank <= 5);
    return ALL_LABELS;
  }, [zoom]);

  return (
    <>
      {visible.map(lbl => {
        const sz = lbl.rank <= 2 ? 12 : lbl.rank <= 3 ? 10 : 9;
        const icon = L.divIcon({
          html: `<div style="transform:translate(-50%,-50%);white-space:nowrap;pointer-events:none;user-select:none"><span style="color:rgba(255,255,255,0.95);font-size:${sz}px;font-weight:700;font-family:-apple-system,sans-serif;text-shadow:0 1px 4px rgba(0,0,0,0.95),0 0 10px rgba(0,0,0,0.8)">${lbl.name}</span></div>`,
          className: '',
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        return (
          <Marker key={lbl.iso} position={[lbl.lat, lbl.lng]} icon={icon} interactive={false} />
        );
      })}
    </>
  );
}

// ── Avatar markers (Т/И circles at country centroids) ────────────────────────
interface AvatarMarkersProps {
  visitsByCountry: VisitsByCountry;
  wishlistByCountry: WishlistByCountry;
  mode: AppMode;
}
function AvatarMarkers({ visitsByCountry, wishlistByCountry, mode }: AvatarMarkersProps) {
  const source = mode === 'visited' ? visitsByCountry : wishlistByCountry;
  const markers = useMemo(() => (
    Object.entries(source).flatMap(([iso, entry]) => {
      const coords = CENTROID_BY_ISO.get(iso);
      if (!coords) return [];
      const users: ('tati' | 'iva')[] = [];
      if (entry.tati) users.push('tati');
      if (entry.iva) users.push('iva');
      if (!users.length) return [];
      return [{ iso, coords, users }];
    })
  ), [source]);

  return (
    <>
      {markers.map(({ iso, coords, users }) => {
        const w = users.length === 2 ? 32 : 14;
        const circles = users.map((u, i) => {
          const fill = users.length === 2 ? USER_FILL.both : USER_FILL[u];
          const left = users.length === 1 ? '50%' : i === 0 ? 'calc(50% - 9px)' : 'calc(50% + 9px)';
          const letter = u === 'tati' ? 'Т' : 'И';
          return `<div style="position:absolute;left:${left};top:50%;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:50%;background:${fill};border:1.5px solid white;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:white;box-shadow:0 1px 3px rgba(0,0,0,0.5)">${letter}</div>`;
        }).join('');
        const icon = L.divIcon({
          html: `<div style="position:relative;width:${w}px;height:14px">${circles}</div>`,
          className: '',
          iconSize: [w, 14],
          iconAnchor: [w / 2, -8],
        });
        return (
          <Marker key={`av-${iso}`} position={[coords[1], coords[0]]} icon={icon} interactive={false} />
        );
      })}
    </>
  );
}

// ── Main WorldMap component ───────────────────────────────────────────────────
interface Props {
  visitsByCountry: VisitsByCountry;
  wishlistByCountry: WishlistByCountry;
  mode: AppMode;
  onCountryClick: (iso2: string, name: string) => void;
  height?: number;
  fullscreen?: boolean;
}

export default function WorldMap({
  visitsByCountry, wishlistByCountry, mode, onCountryClick, height = 300, fullscreen = false,
}: Props) {
  // Hover-fact state — DESKTOP ONLY. After cursor stays still on the same
  // country for HOVER_FACT_DELAY_MS the fact tooltip appears next to it.
  const [hoverFact, setHoverFact] = useState<HoverFact | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverState = useRef<{ iso: string; clientX: number; clientY: number } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => { mq.removeEventListener?.('change', update); };
  }, []);

  // Always-fresh ref for use inside stable Leaflet callbacks
  const dataRef = useRef<DataRef>({
    visitsByCountry, wishlistByCountry, mode, onCountryClick,
    isDesktop, setHoverFact, hoverTimer, hoverState,
  });
  dataRef.current = {
    visitsByCountry, wishlistByCountry, mode, onCountryClick,
    isDesktop, setHoverFact, hoverTimer, hoverState,
  };

  // Cancel any pending fact reveal & hide tooltip when leaving the map root
  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);

  // When this key changes, GeoJSON remounts with fresh styles
  const geoKey = useMemo(() => {
    const v = Object.keys(visitsByCountry).sort().join(',');
    const w = Object.keys(wishlistByCountry).sort().join(',');
    return `${mode}|${v}|${w}`;
  }, [mode, visitsByCountry, wishlistByCountry]);

  const styleFeature = useCallback((feature: unknown): L.PathOptions => {
    const { visitsByCountry, wishlistByCountry, mode } = dataRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iso = resolveIso((feature as any).properties);
    const overlay = getOverlayColor(iso, visitsByCountry, wishlistByCountry, mode);
    return overlayToStyle(overlay);
  }, []);

  const onEachFeature = useCallback((feature: unknown, layer: L.Layer) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props = (feature as any).properties;
    const iso  = resolveIso(props);
    const name = BG_NAMES[iso] ?? props?.NAME ?? iso;
    const flag = getFlagEmoji(iso);

    (layer as L.Path).bindTooltip(`${flag} ${name}`, {
      sticky: true,
      className: 'wmap-tip',
      offset: L.point(12, 0),
    });

    function startHoverTimer(clientX: number, clientY: number) {
      const d = dataRef.current;
      if (!d.isDesktop) return;
      if (d.hoverTimer.current) clearTimeout(d.hoverTimer.current);
      d.hoverState.current = { iso, clientX, clientY };
      d.hoverTimer.current = setTimeout(() => {
        const cur = d.hoverState.current;
        if (!cur || cur.iso !== iso) return;
        const fact = getFact(iso);
        if (!fact) return;
        d.setHoverFact({ iso, name, fact, x: cur.clientX, y: cur.clientY });
      }, HOVER_FACT_DELAY_MS);
    }

    function cancelHover() {
      const d = dataRef.current;
      if (d.hoverTimer.current) { clearTimeout(d.hoverTimer.current); d.hoverTimer.current = null; }
      d.hoverState.current = null;
      d.setHoverFact(null);
    }

    (layer as L.Path).on({
      mouseover(e: L.LeafletMouseEvent) {
        (e.target as L.Path).setStyle({
          weight: 2.5, color: '#93c5fd',
          fillOpacity: Math.max(0.35, (e.target as L.Path).options.fillOpacity ?? 0),
        });
        const oe = e.originalEvent as MouseEvent | undefined;
        if (oe) startHoverTimer(oe.clientX, oe.clientY);
      },
      mousemove(e: L.LeafletMouseEvent) {
        // Reset timer on every move while still over this country.
        const oe = e.originalEvent as MouseEvent | undefined;
        if (!oe) return;
        const d = dataRef.current;
        if (!d.isDesktop) return;
        // Hide currently shown fact if we move (so it follows the spec:
        // "disappears immediately when mouse leaves" + "reset timer on mouse move")
        d.setHoverFact(null);
        startHoverTimer(oe.clientX, oe.clientY);
      },
      mouseout(e: L.LeafletMouseEvent) {
        const { visitsByCountry, wishlistByCountry, mode } = dataRef.current;
        (e.target as L.Path).setStyle(overlayToStyle(getOverlayColor(iso, visitsByCountry, wishlistByCountry, mode)));
        cancelHover();
      },
      click() {
        cancelHover();
        dataRef.current.onCountryClick(iso, name);
      },
    });
  }, []);

  return (
    <div style={{ height: fullscreen ? '100%' : height, borderRadius: fullscreen ? 0 : 16, overflow: 'hidden', isolation: 'isolate', position: 'relative' }}>
      <MapContainer
        center={[20, 10]}
        zoom={2}
        minZoom={2}
        maxZoom={18}
        maxBounds={[[-85, -210], [85, 210]]}
        maxBoundsViscosity={0.85}
        style={{ height: '100%', width: '100%', background: '#0a1628' }}
        zoomControl={false}
        scrollWheelZoom
      >
        <TileLayer url={ESRI_SAT} maxZoom={18} />
        <GeoJSON
          key={geoKey}
          data={countriesGeoJson as unknown as GeoJsonObject}
          style={styleFeature}
          onEachFeature={onEachFeature}
        />
        <CountryLabels />
        <AvatarMarkers
          visitsByCountry={visitsByCountry}
          wishlistByCountry={wishlistByCountry}
          mode={mode}
        />
        <ZoomControls />
      </MapContainer>

      {/* Hover-fact tooltip — desktop only, after 6s of stillness on a country */}
      {hoverFact && isDesktop && (
        <div
          style={{
            position: 'fixed',
            left: hoverFact.x + 14,
            top:  hoverFact.y - 12,
            transform: 'translateY(-100%)',
            maxWidth: 280,
            background: 'rgba(6,14,36,0.97)',
            color: '#e2e8f0',
            border: '1px solid rgba(80,140,230,0.4)',
            borderRadius: 12,
            padding: '10px 12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            fontFamily: '-apple-system,Segoe UI,Roboto,sans-serif',
            pointerEvents: 'none',
            zIndex: 1500,
            animation: 'wmap-fact-in 0.18s ease-out both',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 14 }}>{getFlagEmoji(hoverFact.iso)}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#93c5fd' }}>{hoverFact.name}</span>
          </div>
          <div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#cbd5e1' }}>{hoverFact.fact}</div>
        </div>
      )}
      <style jsx global>{`
        @keyframes wmap-fact-in {
          from { opacity: 0; transform: translateY(-100%) scale(0.94); }
          to   { opacity: 1; transform: translateY(-100%) scale(1); }
        }
      `}</style>
    </div>
  );
}
