'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { VisitsByCountry, UserType, GlobePolygon } from '@/types';

interface GlobeProps {
  visitsByCountry: VisitsByCountry;
  activeUser: UserType;
  onCountryClick: (isoCode: string, countryName: string) => void;
}

const COLORS = {
  tati: '#FFD700',
  iva: '#FF69B4',
  both: '#FFB347',
  default: '#1a2744',
  hover: '#2a4a8a',
  ocean: '#050d1f',
};

function getCountryColor(isoCode: string, visitsByCountry: VisitsByCountry): string {
  const entry = visitsByCountry[isoCode];
  if (!entry) return COLORS.default;
  const { tati, iva } = entry;
  if (tati && iva) return COLORS.both;
  if (tati) return COLORS.tati;
  if (iva) return COLORS.iva;
  return COLORS.default;
}

function makeLabel(iso: string, name: string, visitsByCountry: VisitsByCountry): string {
  const entry = visitsByCountry[iso];
  const visitors: string[] = [];
  if (entry?.tati) visitors.push('🟡 tati');
  if (entry?.iva) visitors.push('🩷 iva');
  return `
    <div style="background:rgba(5,13,31,0.92);border:1px solid #1e3a6e;border-radius:8px;padding:8px 12px;color:#e2e8f0;font-family:sans-serif;font-size:13px;pointer-events:none;">
      <b style="color:#93c5fd">${name}</b>
      ${visitors.length ? `<div style="margin-top:4px">${visitors.join(' ')}</div>` : ''}
    </div>
  `;
}

export default function Globe({ visitsByCountry, activeUser, onCountryClick }: GlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  const visitsByCountryRef = useRef(visitsByCountry);
  const [polygonsData, setPolygonsData] = useState<GlobePolygon[]>([]);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const [hoveredIso, setHoveredIso] = useState<string | null>(null);

  visitsByCountryRef.current = visitsByCountry;

  useEffect(() => {
    function updateDimensions() {
      if (mountRef.current) {
        const container = mountRef.current.parentElement;
        const available = container ? container.clientWidth : window.innerWidth;
        const size = Math.min(available - 32, Math.floor(window.innerHeight * 0.65), 680);
        setDimensions({ width: Math.max(size, 300), height: Math.max(size, 300) });
      }
    }
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    fetch(
      'https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson'
    )
      .then((r) => r.json())
      .then((data) => setPolygonsData(data.features as GlobePolygon[]))
      .catch(() => console.error('Failed to load country polygons'));
  }, []);

  useEffect(() => {
    if (!mountRef.current || polygonsData.length === 0) return;

    const el = mountRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let globe: any = null;
    let destroyed = false;

    import('globe.gl').then((mod) => {
      if (destroyed || !el) return;

      // globe.gl is a factory function but typed as a constructor; cast to work around it
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const GlobeFactory = mod.default as any;
      globe = GlobeFactory()(el);
      globeRef.current = globe;

      globe
        .width(dimensions.width)
        .height(dimensions.height)
        .backgroundColor(COLORS.ocean)
        .globeImageUrl('//unpkg.com/three-globe/example/img/earth-dark.jpg')
        .atmosphereColor('#1e3a8a')
        .atmosphereAltitude(0.15)
        .polygonsData(polygonsData)
        .polygonAltitude((d: object) => {
          const iso = (d as GlobePolygon).properties?.ISO_A2;
          return iso === hoveredIso ? 0.03 : 0.008;
        })
        .polygonCapColor((d: object) => {
          const iso = (d as GlobePolygon).properties?.ISO_A2;
          if (iso === hoveredIso) return COLORS.hover;
          return getCountryColor(iso, visitsByCountryRef.current);
        })
        .polygonSideColor(() => 'rgba(10,20,50,0.5)')
        .polygonStrokeColor(() => '#0d1f3c')
        .polygonLabel((d: object) => {
          const poly = d as GlobePolygon;
          return makeLabel(poly.properties?.ISO_A2, poly.properties?.NAME || poly.properties?.ISO_A2, visitsByCountryRef.current);
        })
        .onPolygonClick((polygon: object) => {
          const poly = polygon as GlobePolygon;
          const iso = poly.properties?.ISO_A2;
          if (iso) onCountryClick(iso, poly.properties?.NAME || iso);
        })
        .onPolygonHover((polygon: object | null) => {
          const iso = (polygon as GlobePolygon | null)?.properties?.ISO_A2 || null;
          setHoveredIso(iso);
        });

      globe.controls().autoRotate = true;
      globe.controls().autoRotateSpeed = 0.5;
      globe.controls().enableDamping = true;
    });

    return () => {
      destroyed = true;
      if (el) el.innerHTML = '';
      globeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polygonsData, dimensions]);

  // Update colors without rebuilding
  useEffect(() => {
    if (!globeRef.current) return;
    globeRef.current
      .polygonCapColor((d: object) => {
        const iso = (d as GlobePolygon).properties?.ISO_A2;
        if (iso === hoveredIso) return COLORS.hover;
        return getCountryColor(iso, visitsByCountry);
      })
      .polygonAltitude((d: object) => {
        const iso = (d as GlobePolygon).properties?.ISO_A2;
        return iso === hoveredIso ? 0.03 : 0.008;
      })
      .polygonLabel((d: object) => {
        const poly = d as GlobePolygon;
        return makeLabel(poly.properties?.ISO_A2, poly.properties?.NAME || poly.properties?.ISO_A2, visitsByCountry);
      });
  }, [visitsByCountry, hoveredIso]);

  return (
    <div
      ref={mountRef}
      style={{ width: dimensions.width, height: dimensions.height }}
      className="cursor-pointer"
    />
  );
}
