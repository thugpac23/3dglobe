'use client';

import { useEffect, useRef, useState } from 'react';
import { VisitsByCountry, GlobePolygon, CapitalCity, USER_DISPLAY } from '@/types';
import { CAPITALS } from '@/data/capitals';

interface GlobeProps {
  visitsByCountry: VisitsByCountry;
  onCountryClick: (isoCode: string, countryName: string) => void;
}

// globe.gl parses colors via tinycolor (supports rgba) — no external THREE needed.
// Use high-opacity rgba so countries are clearly visible over the Blue Marble texture.
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
        .polygonsData(polygonsData)
        .polygonAltitude(0.015)
        .polygonCapColor((d: object) => {
          const iso = (d as GlobePolygon).properties?.ISO_A2;
          return getCapColor(iso, visitsByCountryRef.current, hoveredIsoRef.current);
        })
        .polygonSideColor(() => 'rgba(30,80,30,0.6)')
        .polygonStrokeColor(() => 'rgba(255,255,255,0.9)')
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
              .polygonCapColor((d: object) => {
                const i = (d as GlobePolygon).properties?.ISO_A2;
                return getCapColor(i, visitsByCountryRef.current, hoveredIsoRef.current);
              })
              .polygonAltitude((d: object) => {
                const i = (d as GlobePolygon).properties?.ISO_A2;
                return i === hoveredIsoRef.current ? 0.035 : 0.015;
              });
            globe.controls().autoRotate = !iso;
          }
          setHoveredIso(iso);
        })
        .pointsData(CAPITALS)
        .pointLat((d: object) => (d as CapitalCity).lat)
        .pointLng((d: object) => (d as CapitalCity).lng)
        .pointColor(() => '#ffe880')
        .pointAltitude(0.015)
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

  useEffect(() => {
    if (!globeRef.current) return;
    globeRef.current
      .polygonCapColor((d: object) => {
        const iso = (d as GlobePolygon).properties?.ISO_A2;
        return getCapColor(iso, visitsByCountry, hoveredIsoRef.current);
      })
      .polygonLabel((d: object) => {
        const poly = d as GlobePolygon;
        const iso = poly.properties?.ISO_A2;
        return countryTooltip(poly.properties?.NAME || iso, iso, visitsByCountry);
      });
  }, [visitsByCountry]);

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
