'use client';

import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { VisitsByCountry, GlobePolygon, CapitalCity, USER_DISPLAY } from '@/types';
import { BG_NAMES } from '@/data/countryNamesBg';
import { CAPITALS } from '@/data/capitals';
import dynamic from 'next/dynamic';
import countriesGeoJson from '@/data/countries.json';

const ReactGlobe = dynamic(() => import('react-globe.gl'), { ssr: false });

import { AppMode, WishlistByCountry } from '@/types';

interface GlobeProps {
  visitsByCountry: VisitsByCountry;
  wishlistByCountry: WishlistByCountry;
  activeUser: string;
  mode: AppMode;
  onCountryClick: (isoCode: string, countryName: string) => void;
  fullscreen?: boolean;
}

const COLOR = {
  default:  'rgba(44,120,44,0.92)',
  tati:     'rgba(255,215,0,0.94)',
  iva:      'rgba(255,80,160,0.94)',
  both:     'rgba(255,155,40,0.94)',
  wishlist: 'rgba(20,184,166,0.88)',
  hover:    'rgba(255,220,60,0.92)',
  selected: 'rgba(255,255,255,0.97)',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const polygonsData = (countriesGeoJson as any).features as GlobePolygon[];

function featureCentroid(feature: GlobePolygon): [number, number] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geom = (feature as any).geometry;
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

function getFlagEmoji(iso2: string): string {
  if (!iso2 || iso2.length !== 2) return '';
  try {
    return String.fromCodePoint(
      0x1F1E6 + iso2.toUpperCase().charCodeAt(0) - 65,
      0x1F1E6 + iso2.toUpperCase().charCodeAt(1) - 65,
    );
  } catch { return ''; }
}

interface LabelDatum {
  lat: number;
  lng: number;
  name: string;
  labelrank: number;
  type: 'label' | 'flag' | 'select-ring';
}

const allLabels: LabelDatum[] = polygonsData.flatMap((feature) => {
  const iso = feature.properties?.ISO_A2;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const labelrank: number = (feature.properties as any)?.LABELRANK ?? 99;
  if (labelrank > 5) return [];
  const name = BG_NAMES[iso] ?? feature.properties?.NAME ?? '';
  if (!name) return [];
  const [lng, lat] = featureCentroid(feature);
  return [{ lat, lng, name, labelrank, type: 'label' as const }];
});

const centroidByIso = new Map<string, [number, number]>();
for (const feature of polygonsData) {
  const iso = feature.properties?.ISO_A2;
  if (iso) centroidByIso.set(iso, featureCentroid(feature));
}

function getCapColor(
  iso: string,
  visitsByCountry: VisitsByCountry,
  wishlistByCountry: WishlistByCountry,
  hoveredIso: string | null,
  selectedIso: string | null,
  mode: AppMode,
): string {
  if (iso === selectedIso) return COLOR.selected;
  if (iso === hoveredIso)  return COLOR.hover;
  if (mode === 'wishlist') {
    const w = wishlistByCountry[iso];
    if (w && (w.tati || w.iva)) return COLOR.wishlist;
    return COLOR.default;
  }
  const v = visitsByCountry[iso];
  if (v) {
    if (v.tati && v.iva) return COLOR.both;
    if (v.tati) return COLOR.tati;
    if (v.iva) return COLOR.iva;
  }
  return COLOR.default;
}

function makeTooltip(name: string, iso: string, visited: VisitsByCountry, wished: WishlistByCountry, mode: AppMode): string {
  const flag = getFlagEmoji(iso);
  const bgName = BG_NAMES[iso] ?? name;
  const badges: string[] = [];
  if (mode === 'visited') {
    const e = visited[iso];
    if (e?.tati) badges.push(`<span style="background:rgba(255,215,0,0.18);color:#FFD700;border:1px solid rgba(255,215,0,0.4);border-radius:20px;padding:2px 9px;font-size:11px">✈ ${USER_DISPLAY.tati}</span>`);
    if (e?.iva)  badges.push(`<span style="background:rgba(255,80,160,0.18);color:#ff50a0;border:1px solid rgba(255,80,160,0.4);border-radius:20px;padding:2px 9px;font-size:11px">✈ ${USER_DISPLAY.iva}</span>`);
  } else {
    const e = wished[iso];
    if (e?.tati) badges.push(`<span style="background:rgba(20,184,166,0.18);color:#14B8A6;border:1px solid rgba(20,184,166,0.4);border-radius:20px;padding:2px 9px;font-size:11px">⭐ ${USER_DISPLAY.tati}</span>`);
    if (e?.iva)  badges.push(`<span style="background:rgba(20,184,166,0.18);color:#14B8A6;border:1px solid rgba(20,184,166,0.4);border-radius:20px;padding:2px 9px;font-size:11px">⭐ ${USER_DISPLAY.iva}</span>`);
  }
  return `<div style="background:rgba(6,14,36,0.97);border:1px solid rgba(80,140,230,0.3);border-radius:12px;padding:10px 14px;color:#e2e8f0;font-family:-apple-system,sans-serif;font-size:13px;pointer-events:none;box-shadow:0 8px 32px rgba(0,0,0,0.7);min-width:120px">
    <div style="font-weight:700;color:#93c5fd;font-size:14px${badges.length ? ';margin-bottom:7px' : ''}">${flag} ${bgName}</div>
    ${badges.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${badges.join('')}</div>` : ''}
  </div>`;
}

function makeHtmlEl(d: object): HTMLElement {
  const datum = d as LabelDatum;
  const el = document.createElement('div');

  if (datum.type === 'select-ring') {
    el.style.cssText = [
      'width:58px',
      'height:58px',
      'border-radius:50%',
      'border:2px solid rgba(255,255,255,0.9)',
      'box-shadow:0 0 16px rgba(255,255,255,0.55),0 0 32px rgba(255,255,255,0.2)',
      'pointer-events:none',
      'transform:translate(-50%,-50%)',
      'animation:pulse-select 1.4s ease-in-out infinite',
    ].join(';');
  } else if (datum.type === 'flag') {
    el.textContent = datum.name;
    el.style.cssText = [
      'font-size:22px',
      'line-height:1',
      'pointer-events:none',
      'filter:drop-shadow(0 1px 3px rgba(0,0,0,0.8))',
      'transform:translate(-50%,-50%)',
      'user-select:none',
    ].join(';');
  } else {
    const sz = datum.labelrank <= 2 ? 11 : datum.labelrank <= 3 ? 9 : 8;
    el.textContent = datum.name;
    el.style.cssText = [
      'color:rgba(255,255,255,0.95)',
      `font-size:${sz}px`,
      'font-weight:700',
      'font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif',
      'text-shadow:0 1px 4px rgba(0,0,0,0.95),0 0 8px rgba(0,0,0,0.7)',
      'pointer-events:none',
      'white-space:nowrap',
      'user-select:none',
      'transform:translate(-50%,-50%)',
      'letter-spacing:0.03em',
    ].join(';');
  }
  return el;
}

const ZoomBtn = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-9 h-9 rounded-xl flex items-center justify-center text-xl font-bold transition-all hover:scale-110 active:scale-95"
    style={{
      background: 'rgba(6,18,40,0.85)',
      color: 'rgba(180,210,255,0.9)',
      border: '1px solid rgba(80,140,230,0.25)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    }}
  >
    {label}
  </button>
);

export default function Globe({ visitsByCountry, wishlistByCountry, mode, onCountryClick, fullscreen = false }: GlobeProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef     = useRef<any>(null);
  const [hoveredIso,  setHoveredIso]  = useState<string | null>(null);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [dims, setDims]               = useState({ w: 320, h: 320 });
  const [cameraAlt, setCameraAlt]     = useState(2.5);

  const globeMaterial = useMemo(() => new THREE.MeshPhongMaterial({
    color: new THREE.Color('#0e6494'),
    emissive: new THREE.Color('#071d30'),
    emissiveIntensity: 0.35,
    shininess: 6,
    specular: new THREE.Color('#1a4a6e'),
  }), []);

  // Resize
  useEffect(() => {
    function resize() {
      const size = fullscreen
        ? Math.min(window.innerWidth, window.innerHeight - 72)
        : Math.min(window.innerWidth - 16, Math.floor(window.innerHeight * 0.75));
      setDims({ w: Math.max(size, 300), h: Math.max(size, 300) });
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [fullscreen]);

  // Poll camera altitude for label threshold
  useEffect(() => {
    const id = setInterval(() => {
      const pov = globeRef.current?.pointOfView?.();
      if (pov?.altitude !== undefined) {
        setCameraAlt(prev => Math.abs(prev - pov.altitude) > 0.05 ? pov.altitude : prev);
      }
    }, 300);
    return () => clearInterval(id);
  }, []);

  // Labels: only show after zoom in
  const visibleLabels = useMemo<LabelDatum[]>(() => {
    if (cameraAlt > 2.0) return [];
    if (cameraAlt > 1.4) return allLabels.filter(l => l.labelrank <= 2);
    if (cameraAlt > 0.9) return allLabels.filter(l => l.labelrank <= 3);
    return allLabels.filter(l => l.labelrank <= 5);
  }, [cameraAlt]);

  // Labels + hover flag + selection ring
  const htmlData = useMemo<LabelDatum[]>(() => {
    const base = [...visibleLabels];
    // Show hover flag only when not hovering the selected country
    if (hoveredIso && hoveredIso !== selectedIso) {
      const coords = centroidByIso.get(hoveredIso);
      const flag   = getFlagEmoji(hoveredIso);
      if (coords && flag) {
        base.push({ lat: coords[1], lng: coords[0], name: flag, labelrank: -1, type: 'flag' });
      }
    }
    // Selected country: flag + pulsing ring
    if (selectedIso) {
      const coords = centroidByIso.get(selectedIso);
      const flag   = getFlagEmoji(selectedIso);
      if (coords) {
        if (flag) base.push({ lat: coords[1], lng: coords[0], name: flag, labelrank: -1, type: 'flag' });
        base.push({ lat: coords[1], lng: coords[0], name: selectedIso, labelrank: -2, type: 'select-ring' });
      }
    }
    return base;
  }, [visibleLabels, hoveredIso, selectedIso]);

  const handleGlobeReady = useCallback(() => {
    const ctrl = globeRef.current?.controls();
    if (ctrl) {
      ctrl.autoRotate = true;
      ctrl.autoRotateSpeed = 0.3;
      ctrl.enableDamping = true;
      ctrl.dampingFactor = 0.1;
      ctrl.minDistance = 120;
      ctrl.maxDistance = 700;
    }
  }, []);

  const capColor = useCallback((d: object) => {
    const iso = (d as GlobePolygon).properties?.ISO_A2;
    return getCapColor(iso, visitsByCountry, wishlistByCountry, hoveredIso, selectedIso, mode);
  }, [visitsByCountry, wishlistByCountry, hoveredIso, selectedIso, mode]);

  // 3-level altitude: selected (0.08) > hovered (0.03) > default (0.012)
  const polygonAltitude = useCallback((d: object) => {
    const iso = (d as GlobePolygon).properties?.ISO_A2;
    if (iso === selectedIso) return 0.08;
    if (iso === hoveredIso)  return 0.03;
    return 0.012;
  }, [hoveredIso, selectedIso]);

  // Golden side color on selected polygon enhances the 3D lift effect
  const polygonSideColor = useCallback((d: object) => {
    const iso = (d as GlobePolygon).properties?.ISO_A2;
    if (iso === selectedIso) return 'rgba(255,200,50,0.85)';
    return 'rgba(20,70,20,0.7)';
  }, [selectedIso]);

  const handlePolygonHover = useCallback((polygon: object | null) => {
    const iso = (polygon as GlobePolygon | null)?.properties?.ISO_A2 || null;
    setHoveredIso(iso);
    // Only resume auto-rotate on un-hover if nothing is selected
    if (globeRef.current?.controls && !selectedIso) {
      globeRef.current.controls().autoRotate = !iso;
    }
  }, [selectedIso]);

  // Two-click: first click selects, second click on same country confirms
  const handlePolygonClick = useCallback((polygon: object) => {
    const poly = polygon as GlobePolygon;
    const iso  = poly.properties?.ISO_A2;
    if (!iso) return;

    if (iso === selectedIso) {
      // ── Second click → confirm ──
      onCountryClick(iso, poly.properties?.NAME || iso);
      setSelectedIso(null);
      if (globeRef.current?.controls) {
        globeRef.current.controls().autoRotate = !hoveredIso;
      }
    } else {
      // ── First click → select ──
      setSelectedIso(iso);
      if (globeRef.current?.controls) {
        globeRef.current.controls().autoRotate = false;
      }
    }
  }, [selectedIso, hoveredIso, onCountryClick]);

  // Clicking empty globe area clears selection
  const handleGlobeClick = useCallback(() => {
    if (selectedIso) {
      setSelectedIso(null);
      if (globeRef.current?.controls && !hoveredIso) {
        globeRef.current.controls().autoRotate = true;
      }
    }
  }, [selectedIso, hoveredIso]);

  const polygonLabel = useCallback((d: object) => {
    const poly = d as GlobePolygon;
    const iso  = poly.properties?.ISO_A2;
    return makeTooltip(poly.properties?.NAME || iso, iso, visitsByCountry, wishlistByCountry, mode);
  }, [visitsByCountry, wishlistByCountry, mode]);

  function zoomIn() {
    const pov = globeRef.current?.pointOfView?.();
    if (!pov) return;
    globeRef.current.pointOfView({ ...pov, altitude: Math.max(0.3, pov.altitude * 0.65) }, 380);
  }
  function zoomOut() {
    const pov = globeRef.current?.pointOfView?.();
    if (!pov) return;
    globeRef.current.pointOfView({ ...pov, altitude: Math.min(5, pov.altitude * 1.5) }, 380);
  }

  const selectedName = selectedIso ? (BG_NAMES[selectedIso] ?? selectedIso) : null;

  return (
    <div className="relative inline-block">
      <ReactGlobe
        ref={globeRef}
        width={dims.w}
        height={dims.h}
        backgroundColor="rgba(0,0,0,0)"
        globeMaterial={globeMaterial}
        atmosphereColor="#5dade2"
        atmosphereAltitude={0.25}
        polygonsData={polygonsData}
        polygonAltitude={polygonAltitude}
        polygonCapColor={capColor}
        polygonSideColor={polygonSideColor}
        polygonStrokeColor={() => 'rgba(255,240,120,0.85)'}
        polygonLabel={polygonLabel}
        onPolygonClick={handlePolygonClick}
        onPolygonHover={handlePolygonHover}
        onGlobeClick={handleGlobeClick}
        htmlElementsData={htmlData}
        htmlLat={(d: object) => (d as LabelDatum).lat}
        htmlLng={(d: object) => (d as LabelDatum).lng}
        htmlAltitude={0.02}
        htmlElement={makeHtmlEl}
        pointsData={CAPITALS}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => '#ffe880'}
        pointAltitude={0.013}
        pointRadius={0.22}
        pointLabel={(d: object) => {
          const c = d as CapitalCity;
          return `<div style="background:rgba(6,14,36,0.95);border:1px solid rgba(255,210,80,0.25);border-radius:9px;padding:6px 11px;color:#e2e8f0;font-family:-apple-system,sans-serif;font-size:12px;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.5)"><div style="color:#fde68a;font-weight:600">🏛 ${c.capital}</div><div style="color:#64748b;font-size:11px;margin-top:2px">${c.name}</div></div>`;
        }}
        onGlobeReady={handleGlobeReady}
      />

      {/* Zoom buttons */}
      <div className="absolute flex flex-col gap-2 z-10" style={{ top: 16, right: 16 }}>
        <ZoomBtn label="+" onClick={zoomIn} />
        <ZoomBtn label="−" onClick={zoomOut} />
      </div>

      {/* Selection confirmation hint */}
      {selectedName && (
        <div style={{
          position: 'absolute', bottom: 14, left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.78)',
          color: '#f1f5f9',
          padding: '5px 16px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          pointerEvents: 'none',
          zIndex: 10,
          whiteSpace: 'nowrap',
          border: '1px solid rgba(255,255,255,0.14)',
        }}>
          {selectedName} — кликни отново за потвърждение
        </div>
      )}
    </div>
  );
}
