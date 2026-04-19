'use client';

import * as THREE from 'three';
import { useEffect, useRef, useState } from 'react';
import { VisitsByCountry, GlobePolygon, CapitalCity, USER_DISPLAY } from '@/types';
import { CAPITALS } from '@/data/capitals';

interface GlobeProps {
  visitsByCountry: VisitsByCountry;
  onCountryClick: (isoCode: string, countryName: string) => void;
}

// THREE.Color does not parse rgba() — use MeshLambertMaterial with explicit opacity.
// Pre-built and shared across polygons to avoid per-frame allocations.
function makeMat(hex: number, opacity: number) {
  return new THREE.MeshLambertMaterial({
    color: hex,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

const MAT = {
  default: makeMat(0x3a8a3a, 0.50), // natural green — clearly visible on land
  hover:   makeMat(0x88ccf0, 0.65), // light blue glow
  tati:    makeMat(0xFFD700, 0.70), // gold
  iva:     makeMat(0xFF69B4, 0.70), // pink
  both:    makeMat(0xFFB347, 0.72), // orange
};

function getCapMaterial(
  iso: string,
  visitsByCountry: VisitsByCountry,
  hoveredIso: string | null
): THREE.MeshLambertMaterial {
  if (iso === hoveredIso) return MAT.hover;
  const e = visitsByCountry[iso];
  if (!e) return MAT.default;
  if (e.tati && e.iva) return MAT.both;
  if (e.tati) return MAT.tati;
  if (e.iva) return MAT.iva;
  return MAT.default;
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

export default function Globe({ visitsByCountry, onCountryClick }: GlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  const visitsByCountryRef = useRef(visitsByCountry);
  const hoveredIsoRef = useRef<string | null>(null);
  const [polygonsData, setPolygonsData] = useState<GlobePolygon[]>([]);
  const [dims, setDims] = useState({ w: 700, h: 700 });
  const [hoveredIso, setHoveredIso] = useState<string | null>(null);

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

  useEffect(() => {
    // Bundled locally — no external CDN dependency
    fetch('/countries.geojson')
      .then((r) => r.json())
      .then((d) => setPolygonsData(d.features as GlobePolygon[]))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!mountRef.current || polygonsData.length === 0) return;
    const el = mountRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let globe: any = null;
    let destroyed = false;

    import('globe.gl').then((mod) => {
      if (destroyed || !el) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const GlobeFactory = mod.default as any;
      globe = GlobeFactory()(el);
      globeRef.current = globe;

      globe
        .width(dims.w)
        .height(dims.h)
        .backgroundColor('rgba(0,0,0,0)')
        .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
        .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
        .cloudsImageUrl('//unpkg.com/three-globe/example/img/fair_1_clouds_2048.png')
        .cloudsOpacity(0.25)
        .atmosphereColor('#4a90e2')
        .atmosphereAltitude(0.22)
        // Polygons — use polygonCapMaterial for real THREE.js transparency support
        .polygonsData(polygonsData)
        .polygonAltitude(0.012)
        .polygonCapMaterial((d: object) => {
          const iso = (d as GlobePolygon).properties?.ISO_A2;
          return getCapMaterial(iso, visitsByCountryRef.current, hoveredIsoRef.current);
        })
        .polygonSideColor(() => '#1a3a1a')
        .polygonStrokeColor(() => '#ffffff')   // solid white — THREE.Color handles this fine
        .polygonLabel((d: object) => {
          const poly = d as GlobePolygon;
          const iso = poly.properties?.ISO_A2;
          return countryTooltip(poly.properties?.NAME || iso, iso, visitsByCountryRef.current);
        })
        .onPolygonClick((polygon: object) => {
          const poly = polygon as GlobePolygon;
          const iso = poly.properties?.ISO_A2;
          if (iso) onCountryClick(iso, poly.properties?.NAME || iso);
        })
        .onPolygonHover((polygon: object | null) => {
          const iso = (polygon as GlobePolygon | null)?.properties?.ISO_A2 || null;
          hoveredIsoRef.current = iso;
          if (globe) {
            globe
              .polygonCapMaterial((d: object) => {
                const i = (d as GlobePolygon).properties?.ISO_A2;
                return getCapMaterial(i, visitsByCountryRef.current, hoveredIsoRef.current);
              })
              .polygonAltitude((d: object) => {
                const i = (d as GlobePolygon).properties?.ISO_A2;
                return i === hoveredIsoRef.current ? 0.030 : 0.012;
              });
            globe.controls().autoRotate = !iso;
          }
          setHoveredIso(iso);
        })
        // Capital dots
        .pointsData(CAPITALS)
        .pointLat((d: object) => (d as CapitalCity).lat)
        .pointLng((d: object) => (d as CapitalCity).lng)
        .pointColor(() => '#ffe880')
        .pointAltitude(0.012)
        .pointRadius(0.2)
        .pointLabel((d: object) => capitalTooltip(d as CapitalCity));

      const ctrl = globe.controls();
      ctrl.autoRotate = true;
      ctrl.autoRotateSpeed = 0.35;
      ctrl.enableDamping = true;
      ctrl.dampingFactor = 0.08;
      ctrl.minDistance = 120;
      ctrl.maxDistance = 700;
    });

    return () => {
      destroyed = true;
      if (el) el.innerHTML = '';
      globeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polygonsData, dims]);

  // Refresh materials when visited countries change
  useEffect(() => {
    if (!globeRef.current) return;
    globeRef.current
      .polygonCapMaterial((d: object) => {
        const iso = (d as GlobePolygon).properties?.ISO_A2;
        return getCapMaterial(iso, visitsByCountry, hoveredIsoRef.current);
      })
      .polygonLabel((d: object) => {
        const poly = d as GlobePolygon;
        const iso = poly.properties?.ISO_A2;
        return countryTooltip(poly.properties?.NAME || iso, iso, visitsByCountry);
      });
  }, [visitsByCountry]);

  // Refresh labels on hover (tooltip content updates)
  useEffect(() => {
    if (!globeRef.current) return;
    globeRef.current.polygonLabel((d: object) => {
      const poly = d as GlobePolygon;
      const iso = poly.properties?.ISO_A2;
      return countryTooltip(poly.properties?.NAME || iso, iso, visitsByCountryRef.current);
    });
  }, [hoveredIso]);

  return (
    <div
      ref={mountRef}
      style={{ width: dims.w, height: dims.h }}
      className="cursor-pointer select-none"
    />
  );
}
