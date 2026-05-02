import { VisitsByCountry, WishlistByCountry, AppMode, UserType } from '@/types';
import { BG_NAMES } from '@/data/countryNamesBg';
import countriesGeoJson from '@/data/countries.json';

// ── Unified user colors (match across globe + map + map embed) ───────────────
export const USER_FILL = {
  tati: '#F59E0B', // orange / amber
  iva:  '#EC4899', // pink
  both: '#7C3AED', // purple
} as const;

// rgba versions for semi-transparent overlay on map
export const USER_FILL_RGBA = {
  tati: 'rgba(245,158,11,0.55)',
  iva:  'rgba(236,72,153,0.55)',
  both: 'rgba(124,58,237,0.55)',
  wishlist: 'rgba(20,184,166,0.50)',
} as const;

// rgba versions for globe (slightly lower alpha so satellite texture shows)
export const USER_FILL_GLOBE = {
  tati: 'rgba(245,158,11,0.55)',
  iva:  'rgba(236,72,153,0.55)',
  both: 'rgba(124,58,237,0.55)',
  wishlist: 'rgba(20,184,166,0.50)',
} as const;

// ── ISO resolution (handle Natural Earth quirks) ─────────────────────────────
const ADM_TO_ISO2: Record<string, string> = { FRA: 'FR', NOR: 'NO' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveIso(props: any): string {
  const iso2 = props?.ISO_A2 as string;
  if (iso2 && iso2 !== '-99') return iso2;
  return ADM_TO_ISO2[props?.ADM0_A3 as string] ?? '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function featureCentroid(f: any): [number, number] {
  const geom = f.geometry;
  let ring: [number, number][] = [];
  if (geom.type === 'Polygon') ring = geom.coordinates[0];
  else if (geom.type === 'MultiPolygon') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ring = geom.coordinates.reduce((a: any, b: any) => a[0].length >= b[0].length ? a : b)[0];
  }
  if (!ring.length) return [0, 0];
  const lons = ring.map((c) => c[0]);
  const lats = ring.map((c) => c[1]);
  return [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
}

// ── Biome-based natural earth fill ───────────────────────────────────────────
const ARCTIC_ISOS  = new Set(['GL','AQ','IS','SJ','FO']);
const DESERT_ISOS  = new Set(['DZ','EG','LY','MA','MR','ML','NE','TD','SD','ER','SO','DJ',
  'SA','YE','OM','AE','QA','KW','BH','IQ','IR','AF','PK','UZ','TM','KG','TJ','MN','KZ','NA']);
const SAVANNA_ISOS = new Set(['NG','GH','BF','TG','BJ','SN','GM','GW',
  'KE','TZ','UG','RW','BI','AO','ZM','MW','MZ','ZW','ZA','LS','SZ','ET','SS']);
const TROPICAL_ISOS = new Set(['BR','CO','VE','GY','SR','EC','PE',
  'CD','CG','GA','GQ','CM','CF','GN','SL','LR','CI',
  'ID','MY','PH','BN','TH','KH','LA','MM','VN','SG','TL','PG']);

export function getNaturalEarthColor(iso: string): string {
  if (ARCTIC_ISOS.has(iso))   return '#B0C8D4';
  if (DESERT_ISOS.has(iso))   return '#C4A36A';
  if (SAVANNA_ISOS.has(iso))  return '#7BA554';
  if (TROPICAL_ISOS.has(iso)) return '#1A5E30';
  return '#4A8050';
}

// ── Color resolution (visited/wishlist mode) ─────────────────────────────────
/** Returns the natural earth base color (always used as background fill) */
export function getBaseColor(iso: string): string {
  return getNaturalEarthColor(iso);
}

/** Returns semi-transparent overlay color for visited/wishlist countries, or null */
export function getOverlayColor(
  iso: string,
  visitsByCountry: VisitsByCountry,
  wishlistByCountry: WishlistByCountry,
  mode: AppMode,
): string | null {
  if (mode === 'wishlist') {
    const w = wishlistByCountry[iso];
    if (w?.tati && w?.iva) return USER_FILL_RGBA.both;
    if (w?.tati || w?.iva) return USER_FILL_RGBA.wishlist;
    return null;
  }
  const v = visitsByCountry[iso];
  if (!v) return null;
  if (v.tati && v.iva) return USER_FILL_RGBA.both;
  if (v.tati) return USER_FILL_RGBA.tati;
  if (v.iva) return USER_FILL_RGBA.iva;
  return null;
}

/** Which users have visited this country (for avatar markers) */
export function getVisitingUsers(
  iso: string,
  visitsByCountry: VisitsByCountry,
  wishlistByCountry: WishlistByCountry,
  mode: AppMode,
): UserType[] {
  const data = mode === 'visited' ? visitsByCountry[iso] : wishlistByCountry[iso];
  if (!data) return [];
  const users: UserType[] = [];
  if (data.tati) users.push('tati');
  if (data.iva) users.push('iva');
  return users;
}

// ── Label features (all countries with names, no rank filter) ────────────────
export interface LabelEntry {
  iso: string;
  name: string;
  lng: number;
  lat: number;
  rank: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const geoFeatures = (countriesGeoJson as any).features as any[];

export const ALL_LABELS: LabelEntry[] = geoFeatures.flatMap(f => {
  const iso = resolveIso(f.properties);
  if (!iso) return [];
  const rank = (f.properties?.LABELRANK ?? 99) as number;
  const name = BG_NAMES[iso] ?? f.properties?.NAME ?? '';
  if (!name) return [];
  const [lng, lat] = featureCentroid(f);
  return [{ iso, name, lng, lat, rank }];
});

/** Given a zoom level, return labels visible at that zoom — never disappear too early */
export function visibleLabelsAtZoom(zoom: number): LabelEntry[] {
  if (zoom < 1.5) return ALL_LABELS.filter(l => l.rank <= 2);
  if (zoom < 2.5) return ALL_LABELS.filter(l => l.rank <= 3);
  if (zoom < 4)   return ALL_LABELS.filter(l => l.rank <= 4);
  if (zoom < 6)   return ALL_LABELS.filter(l => l.rank <= 5);
  return ALL_LABELS; // all countries at deep zoom
}

/** Centroid index for fast lookup */
export const CENTROID_BY_ISO = new Map<string, [number, number]>();
for (const f of geoFeatures) {
  const iso = resolveIso(f.properties);
  if (iso) CENTROID_BY_ISO.set(iso, featureCentroid(f));
}
