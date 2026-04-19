'use client';

import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { VisitsByCountry, GlobePolygon, CapitalCity, USER_DISPLAY } from '@/types';
import { BG_NAMES } from '@/data/countryNamesBg';
import { CAPITALS } from '@/data/capitals';
import dynamic from 'next/dynamic';
import countriesGeoJson from '@/data/countries.json';

const ReactGlobe = dynamic(() => import('react-globe.gl'), { ssr: false });

interface GlobeProps {
  visitsByCountry: VisitsByCountry;
  onCountryClick: (isoCode: string, countryName: string) => void;
}

const COLOR = {
  default: 'rgba(44,120,44,0.92)',
  hover:   'rgba(100,190,255,0.92)',
  tati:    'rgba(255,215,0,0.94)',
  iva:     'rgba(255,80,160,0.94)',
  both:    'rgba(255,155,40,0.94)',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const polygonsData = (countriesGeoJson as any).features as GlobePolygon[];

// Compute bounding-box centre of each GeoJSON feature for label placement
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

interface LabelDatum {
  lat: number;
  lng: number;
  name: string;
  labelrank: number;
}

// Only show labels for countries important enough to be legible on globe
const labelsData: LabelDatum[] = polygonsData.flatMap((feature) => {
  const iso = feature.properties?.ISO_A2;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const labelrank: number = (feature.properties as any)?.LABELRANK ?? 99;
  if (labelrank > 5) return [];
  const name = BG_NAMES[iso] ?? feature.properties?.NAME ?? '';
  if (!name) return [];
  const [lng, lat] = featureCentroid(feature);
  return [{ lat, lng, name, labelrank }];
});

function getCapColor(
  iso: string,
  visitsByCountry: VisitsByCountry,
  hoveredIso: string | null
): string {
  if (iso === hoveredIso) return COLOR.hover;
  const e = visitsByCountry[iso];
  if (!e) return COLOR.default;
  if (e.tati && e.iva) return COLOR.both;
  if (e.tati) return COLOR.tati;
  if (e.iva) return COLOR.iva;
  return COLOR.default;
}

function countryTooltip(name: string, iso: string, visitsByCountry: VisitsByCountry): string {
  const e = visitsByCountry[iso];
  const badges: string[] = [];
  if (e?.tati)
    badges.push(`<span style="background:rgba(255,215,0,0.18);color:#FFD700;border:1px solid rgba(255,215,0,0.4);border-radius:20px;padding:2px 9px;font-size:11px">✈ ${USER_DISPLAY.tati}</span>`);
  if (e?.iva)
    badges.push(`<span style="background:rgba(255,80,160,0.18);color:#ff50a0;border:1px solid rgba(255,80,160,0.4);border-radius:20px;padding:2px 9px;font-size:11px">✈ ${USER_DISPLAY.iva}</span>`);
  return `<div style="background:rgba(6,14,36,0.97);border:1px solid rgba(80,140,230,0.3);border-radius:12px;padding:10px 14px;color:#e2e8f0;font-family:-apple-system,sans-serif;font-size:13px;pointer-events:none;box-shadow:0 8px 32px rgba(0,0,0,0.7);min-width:120px">
    <div style="font-weight:700;color:#93c5fd;font-size:14px${badges.length ? ';margin-bottom:7px' : ''}">${name}</div>
    ${badges.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${badges.join('')}</div>` : ''}
  </div>`;
}

function capitalTooltip(c: CapitalCity): string {
  return `<div style="background:rgba(6,14,36,0.95);border:1px solid rgba(255,210,80,0.25);border-radius:9px;padding:6px 11px;color:#e2e8f0;font-family:-apple-system,sans-serif;font-size:12px;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.5)">
    <div style="color:#fde68a;font-weight:600">🏛 ${c.capital}</div>
    <div style="color:#64748b;font-size:11px;margin-top:2px">${c.name}</div>
  </div>`;
}

export default function Globe({ visitsByCountry, onCountryClick }: GlobeProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  const visitsByCountryRef = useRef(visitsByCountry);
  const [hoveredIso, setHoveredIso] = useState<string | null>(null);
  const [dims, setDims] = useState({ w: 320, h: 320 });

  visitsByCountryRef.current = visitsByCountry;

  // Ocean sphere material — created client-side only
  const globeMaterial = useMemo(() => new THREE.MeshPhongMaterial({
    color: new THREE.Color('#0e6494'),
    emissive: new THREE.Color('#071d30'),
    emissiveIntensity: 0.35,
    shininess: 6,
    specular: new THREE.Color('#1a4a6e'),
  }), []);

  useEffect(() => {
    function resize() {
      const size = Math.min(window.innerWidth - 16, Math.floor(window.innerHeight * 0.75));
      setDims({ w: Math.max(size, 300), h: Math.max(size, 300) });
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const handleGlobeReady = useCallback(() => {
    if (!globeRef.current) return;
    const ctrl = globeRef.current.controls();
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
    return getCapColor(iso, visitsByCountry, hoveredIso);
  }, [visitsByCountry, hoveredIso]);

  const polygonAltitude = useCallback((d: object) => {
    const iso = (d as GlobePolygon).properties?.ISO_A2;
    return iso === hoveredIso ? 0.03 : 0.012;
  }, [hoveredIso]);

  const handlePolygonHover = useCallback((polygon: object | null) => {
    const iso = (polygon as GlobePolygon | null)?.properties?.ISO_A2 || null;
    setHoveredIso(iso);
    if (globeRef.current?.controls) {
      globeRef.current.controls().autoRotate = !iso;
    }
  }, []);

  const handlePolygonClick = useCallback((polygon: object) => {
    const poly = polygon as GlobePolygon;
    const iso = poly.properties?.ISO_A2;
    if (iso) onCountryClick(iso, poly.properties?.NAME || iso);
  }, [onCountryClick]);

  const polygonLabel = useCallback((d: object) => {
    const poly = d as GlobePolygon;
    const iso = poly.properties?.ISO_A2;
    return countryTooltip(poly.properties?.NAME || iso, iso, visitsByCountry);
  }, [visitsByCountry]);

  const labelSize = useCallback((d: object) => {
    const l = d as LabelDatum;
    return l.labelrank <= 2 ? 0.9 : l.labelrank <= 3 ? 0.65 : 0.45;
  }, []);

  const labelColor = useCallback(() => 'rgba(255,255,255,0.92)', []);

  return (
    <ReactGlobe
      ref={globeRef}
      width={dims.w}
      height={dims.h}
      backgroundColor="rgba(0,0,0,0)"
      globeMaterial={globeMaterial}
      atmosphereColor="#5dade2"
      atmosphereAltitude={0.25}
      // Countries
      polygonsData={polygonsData}
      polygonAltitude={polygonAltitude}
      polygonCapColor={capColor}
      polygonSideColor={() => 'rgba(20,70,20,0.7)'}
      polygonStrokeColor={() => 'rgba(255,255,255,0.55)'}
      polygonLabel={polygonLabel}
      onPolygonClick={handlePolygonClick}
      onPolygonHover={handlePolygonHover}
      // Country name labels always visible
      labelsData={labelsData}
      labelLat={(d: object) => (d as LabelDatum).lat}
      labelLng={(d: object) => (d as LabelDatum).lng}
      labelText={(d: object) => (d as LabelDatum).name}
      labelSize={labelSize}
      labelColor={labelColor}
      labelAltitude={0.013}
      labelIncludeDot={false}
      labelResolution={3}
      // Capital dots
      pointsData={CAPITALS}
      pointLat="lat"
      pointLng="lng"
      pointColor={() => '#ffe880'}
      pointAltitude={0.013}
      pointRadius={0.22}
      pointLabel={(d: object) => capitalTooltip(d as CapitalCity)}
      onGlobeReady={handleGlobeReady}
    />
  );
}
