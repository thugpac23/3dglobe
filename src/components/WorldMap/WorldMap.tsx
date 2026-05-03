'use client';

import { useRef, useMemo, useCallback, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, useMap, useMapEvents } from 'react-leaflet';
import type { GeoJsonObject } from 'geojson';
import L from 'leaflet';
import { VisitsByCountry, WishlistByCountry, AppMode } from '@/types';
import { BG_NAMES } from '@/data/countryNamesBg';
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

interface DataRef {
  visitsByCountry: VisitsByCountry;
  wishlistByCountry: WishlistByCountry;
  mode: AppMode;
  onCountryClick: (iso2: string, name: string) => void;
}

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
  // Always-fresh ref for use inside stable Leaflet callbacks
  const dataRef = useRef<DataRef>({ visitsByCountry, wishlistByCountry, mode, onCountryClick });
  dataRef.current = { visitsByCountry, wishlistByCountry, mode, onCountryClick };

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

    (layer as L.Path).on({
      mouseover(e: L.LeafletMouseEvent) {
        (e.target as L.Path).setStyle({
          weight: 2.5, color: '#93c5fd',
          fillOpacity: Math.max(0.35, (e.target as L.Path).options.fillOpacity ?? 0),
        });
      },
      mouseout(e: L.LeafletMouseEvent) {
        const { visitsByCountry, wishlistByCountry, mode } = dataRef.current;
        (e.target as L.Path).setStyle(overlayToStyle(getOverlayColor(iso, visitsByCountry, wishlistByCountry, mode)));
      },
      click() {
        dataRef.current.onCountryClick(iso, name);
      },
    });
  }, []);

  return (
    <div style={{ height: fullscreen ? '100%' : height, borderRadius: fullscreen ? 0 : 16, overflow: 'hidden', isolation: 'isolate' }}>
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
    </div>
  );
}
