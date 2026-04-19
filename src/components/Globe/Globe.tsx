'use client';

import { useEffect, useRef, useState } from 'react';
import { VisitsByCountry, GlobePolygon, CapitalCity, USER_DISPLAY } from '@/types';
import { CAPITALS } from '@/data/capitals';

interface GlobeProps {
  visitsByCountry: VisitsByCountry;
  onCountryClick: (isoCode: string, countryName: string) => void;
}

// Semi-transparent overlays on top of the realistic texture
function getCapColor(
  iso: string,
  visitsByCountry: VisitsByCountry,
  hoveredIso: string | null
): string {
  if (iso === hoveredIso) return 'rgba(210, 240, 255, 0.42)';
  const e = visitsByCountry[iso];
  if (!e) return 'rgba(255,255,255,0.04)';
  if (e.tati && e.iva) return 'rgba(255, 179, 71, 0.52)';
  if (e.tati) return 'rgba(255, 215, 0, 0.52)';
  if (e.iva) return 'rgba(255, 105, 180, 0.52)';
  return 'rgba(255,255,255,0.04)';
}

function countryTooltip(
  name: string,
  capital: string,
  iso: string,
  visitsByCountry: VisitsByCountry
): string {
  const e = visitsByCountry[iso];
  const badges: string[] = [];
  if (e?.tati)
    badges.push(
      `<span style="background:rgba(255,215,0,0.2);color:#FFD700;border:1px solid rgba(255,215,0,0.4);border-radius:20px;padding:2px 8px;font-size:11px">✈ ${USER_DISPLAY.tati}</span>`
    );
  if (e?.iva)
    badges.push(
      `<span style="background:rgba(255,105,180,0.2);color:#FF69B4;border:1px solid rgba(255,105,180,0.4);border-radius:20px;padding:2px 8px;font-size:11px">✈ ${USER_DISPLAY.iva}</span>`
    );
  return `
    <div style="background:rgba(4,10,28,0.96);border:1px solid rgba(80,130,220,0.35);border-radius:12px;padding:11px 15px;color:#e2e8f0;font-family:-apple-system,sans-serif;font-size:13px;pointer-events:none;box-shadow:0 8px 32px rgba(0,0,0,0.6);min-width:140px">
      <div style="font-weight:700;color:#93c5fd;font-size:14px;margin-bottom:5px">${name}</div>
      ${capital ? `<div style="color:#64748b;font-size:11px;margin-bottom:${badges.length ? 7 : 0}px">🏛 ${capital}</div>` : ''}
      ${badges.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${badges.join('')}</div>` : ''}
    </div>`;
}

function capitalTooltip(c: CapitalCity): string {
  return `
    <div style="background:rgba(4,10,28,0.94);border:1px solid rgba(255,220,100,0.3);border-radius:10px;padding:8px 12px;color:#e2e8f0;font-family:-apple-system,sans-serif;font-size:12px;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.5)">
      <div style="color:#fde68a;font-weight:700;font-size:13px">🏛 ${c.capital}</div>
      <div style="color:#64748b;font-size:11px;margin-top:2px">${c.name}</div>
    </div>`;
}

export default function Globe({ visitsByCountry, onCountryClick }: GlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  const visitsByCountryRef = useRef(visitsByCountry);
  const [polygonsData, setPolygonsData] = useState<GlobePolygon[]>([]);
  const [dims, setDims] = useState({ w: 800, h: 800 });
  const [hoveredIso, setHoveredIso] = useState<string | null>(null);

  visitsByCountryRef.current = visitsByCountry;

  // Responsive sizing — globe is the dominant element
  useEffect(() => {
    function resize() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const size = Math.min(vw - 16, Math.floor(vh * 0.65), 780);
      setDims({ w: Math.max(size, 320), h: Math.max(size, 320) });
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Load country polygon GeoJSON
  useEffect(() => {
    fetch(
      'https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson'
    )
      .then((r) => r.json())
      .then((d) => setPolygonsData(d.features as GlobePolygon[]))
      .catch(console.error);
  }, []);

  // Build globe once polygons + dimensions are ready
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
        // ── Realistic Earth textures ──────────────────────────────────
        .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
        .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
        // ── Moving cloud layer ────────────────────────────────────────
        .cloudsImageUrl('//unpkg.com/three-globe/example/img/fair_1_clouds_2048.png')
        .cloudsOpacity(0.28)
        // ── Atmosphere glow ───────────────────────────────────────────
        .atmosphereColor('#4a90e2')
        .atmosphereAltitude(0.22)
        // ── Country polygons (semi-transparent overlay) ───────────────
        .polygonsData(polygonsData)
        .polygonAltitude(0.006)
        .polygonCapColor((d: object) => {
          const iso = (d as GlobePolygon).properties?.ISO_A2;
          return getCapColor(iso, visitsByCountryRef.current, null);
        })
        .polygonSideColor(() => 'rgba(20, 50, 120, 0.25)')
        .polygonStrokeColor(() => 'rgba(255, 255, 255, 0.72)')
        .polygonLabel((d: object) => {
          const poly = d as GlobePolygon;
          const iso = poly.properties?.ISO_A2;
          const name = poly.properties?.NAME || iso;
          const cap = CAPITALS.find((c) => c.isoCode === iso);
          return countryTooltip(name, cap?.capital ?? '', iso, visitsByCountryRef.current);
        })
        .onPolygonClick((polygon: object) => {
          const poly = polygon as GlobePolygon;
          const iso = poly.properties?.ISO_A2;
          if (iso) onCountryClick(iso, poly.properties?.NAME || iso);
        })
        .onPolygonHover((polygon: object | null) => {
          const iso = (polygon as GlobePolygon | null)?.properties?.ISO_A2 || null;
          setHoveredIso(iso);
          // Pause auto-rotate on interaction
          if (globe?.controls) globe.controls().autoRotate = !iso;
        })
        // ── Capital city dots ─────────────────────────────────────────
        .pointsData(CAPITALS)
        .pointLat((d: object) => (d as CapitalCity).lat)
        .pointLng((d: object) => (d as CapitalCity).lng)
        .pointColor(() => 'rgba(255, 230, 120, 0.95)')
        .pointAltitude(0.006)
        .pointRadius(0.22)
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

  // Reactively update polygon colors + labels when visits or hover changes
  useEffect(() => {
    if (!globeRef.current) return;
    globeRef.current
      .polygonCapColor((d: object) => {
        const iso = (d as GlobePolygon).properties?.ISO_A2;
        return getCapColor(iso, visitsByCountry, hoveredIso);
      })
      .polygonAltitude((d: object) => {
        const iso = (d as GlobePolygon).properties?.ISO_A2;
        return iso === hoveredIso ? 0.02 : 0.006;
      })
      .polygonLabel((d: object) => {
        const poly = d as GlobePolygon;
        const iso = poly.properties?.ISO_A2;
        const name = poly.properties?.NAME || iso;
        const cap = CAPITALS.find((c) => c.isoCode === iso);
        return countryTooltip(name, cap?.capital ?? '', iso, visitsByCountry);
      });
  }, [visitsByCountry, hoveredIso]);

  return (
    <div
      ref={mountRef}
      style={{ width: dims.w, height: dims.h }}
      className="cursor-pointer select-none"
    />
  );
}
