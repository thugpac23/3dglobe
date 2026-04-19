'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { VisitsByCountry, GlobePolygon, CapitalCity, USER_DISPLAY } from '@/types';
import { CAPITALS } from '@/data/capitals';
import dynamic from 'next/dynamic';
import countriesGeoJson from '@/data/countries.json';

const ReactGlobe = dynamic(() => import('react-globe.gl'), { ssr: false });

interface GlobeProps {
  visitsByCountry: VisitsByCountry;
  onCountryClick: (isoCode: string, countryName: string) => void;
}

const COLOR = {
  default: 'rgba(58,138,58,0.82)',
  hover:   'rgba(136,204,240,0.88)',
  tati:    'rgba(255,215,0,0.88)',
  iva:     'rgba(255,105,180,0.88)',
  both:    'rgba(255,179,71,0.88)',
};

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
    badges.push(`<span style="background:rgba(255,215,0,0.2);color:#FFD700;border:1px solid rgba(255,215,0,0.4);border-radius:20px;padding:2px 8px;font-size:11px">✈ ${USER_DISPLAY.tati}</span>`);
  if (e?.iva)
    badges.push(`<span style="background:rgba(255,105,180,0.2);color:#FF69B4;border:1px solid rgba(255,105,180,0.4);border-radius:20px;padding:2px 8px;font-size:11px">✈ ${USER_DISPLAY.iva}</span>`);
  return `
    <div style="background:rgba(4,10,28,0.96);border:1px solid rgba(80,130,220,0.35);border-radius:12px;padding:11px 15px;color:#e2e8f0;font-family:-apple-system,sans-serif;font-size:13px;pointer-events:none;box-shadow:0 8px 32px rgba(0,0,0,0.6);min-width:130px">
      <div style="font-weight:700;color:#93c5fd;font-size:14px;${badges.length ? 'margin-bottom:8px' : ''}">${name}</div>
      ${badges.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${badges.join('')}</div>` : ''}
    </div>`;
}

function capitalTooltip(c: CapitalCity): string {
  return `
    <div style="background:rgba(4,10,28,0.94);border:1px solid rgba(255,220,100,0.3);border-radius:10px;padding:7px 11px;color:#e2e8f0;font-family:-apple-system,sans-serif;font-size:12px;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.5)">
      <div style="color:#fde68a;font-weight:700">🏛 ${c.capital}</div>
      <div style="color:#64748b;font-size:11px;margin-top:2px">${c.name}</div>
    </div>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const polygonsData = (countriesGeoJson as any).features as GlobePolygon[];

export default function Globe({ visitsByCountry, onCountryClick }: GlobeProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  const visitsByCountryRef = useRef(visitsByCountry);
  const [hoveredIso, setHoveredIso] = useState<string | null>(null);
  const [dims, setDims] = useState({ w: 320, h: 320 });

  visitsByCountryRef.current = visitsByCountry;

  useEffect(() => {
    function resize() {
      const size = Math.min(window.innerWidth - 16, Math.floor(window.innerHeight * 0.75));
      setDims({ w: Math.max(size, 320), h: Math.max(size, 320) });
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Set up controls once globe is mounted
  const handleGlobeMounted = useCallback(() => {
    if (!globeRef.current) return;
    const ctrl = globeRef.current.controls();
    if (ctrl) {
      ctrl.autoRotate = true;
      ctrl.autoRotateSpeed = 0.35;
      ctrl.enableDamping = true;
      ctrl.dampingFactor = 0.08;
      ctrl.minDistance = 120;
      ctrl.maxDistance = 700;
    }
  }, []);

  // Callbacks that depend on hoveredIso and visitsByCountry recreate on each change
  const capColor = useCallback((d: object) => {
    const iso = (d as GlobePolygon).properties?.ISO_A2;
    return getCapColor(iso, visitsByCountry, hoveredIso);
  }, [visitsByCountry, hoveredIso]);

  const polygonAltitude = useCallback((d: object) => {
    const iso = (d as GlobePolygon).properties?.ISO_A2;
    return iso === hoveredIso ? 0.035 : 0.015;
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

  return (
    <ReactGlobe
      ref={globeRef}
      width={dims.w}
      height={dims.h}
      backgroundColor="rgba(0,0,0,0)"
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
      bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
      atmosphereColor="#4a90e2"
      atmosphereAltitude={0.22}
      polygonsData={polygonsData}
      polygonAltitude={polygonAltitude}
      polygonCapColor={capColor}
      polygonSideColor={() => 'rgba(30,80,30,0.6)'}
      polygonStrokeColor={() => 'rgba(255,255,255,0.9)'}
      polygonLabel={polygonLabel}
      onPolygonClick={handlePolygonClick}
      onPolygonHover={handlePolygonHover}
      pointsData={CAPITALS}
      pointLat="lat"
      pointLng="lng"
      pointColor={() => '#ffe880'}
      pointAltitude={0.015}
      pointRadius={0.2}
      pointLabel={(d: object) => capitalTooltip(d as CapitalCity)}
      onGlobeReady={handleGlobeMounted}
    />
  );
}
