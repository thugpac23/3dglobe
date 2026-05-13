export type UserType = string;
export type AppMode = 'visited' | 'wishlist';
export type FaceType   = 'standard' | 'round' | 'long' | 'child' | 'angular';
export type Expression = 'smile' | 'neutral' | 'surprised' | 'thinking';

export interface UserProfile {
  id: string;
  displayName: string;
  color: string;
  protected: boolean;
}

// Legacy static lookups — kept so existing imports don't break at compile time,
// but pages now derive display/color from UserProfile objects returned by /api/users.
export const USER_DISPLAY: Record<string, string> = {
  tati: 'Тати',
  iva:  'Ива',
};

export const USER_COLOR: Record<string, string> = {
  tati: '#F59E0B',
  iva:  '#EC4899',
};

export interface Country {
  id: string;
  name: string;
  capital: string;
  isoCode: string;
}

export interface Visit {
  id: string;
  countryId: string;
  userId: string;
  user: { id: string; displayName: string; color: string };
  country: Country;
}

export interface VisitsByCountry {
  [isoCode: string]: { country: Country; [userId: string]: boolean | Country };
}

export interface WishlistItem {
  id: string;
  countryId: string;
  userId: string;
  user: { id: string; displayName: string; color: string };
  country: Country;
}

export interface WishlistByCountry {
  [isoCode: string]: { country: Country; [userId: string]: boolean | Country };
}

export interface UserProgress {
  id: string;
  userId: string;
  xp: number;
  level: number;
  achievements: string[];
}

export interface XPResult {
  progress: UserProgress;
  leveledUp: boolean;
  newAchievements: string[];
}

export interface AvatarConfig {
  id: string;
  userId: string;
  hairStyle: 'short' | 'long' | 'curly' | 'ponytail' | 'bald' | 'loose' | 'braid' | 'tied' | 'longest';
  hairColor: string;
  eyeColor: string;
  skinColor: string;
  outfit: 'casual' | 'travel' | 'explorer' | 'summer' | 'winter' | 'sporty' | 'adventure' | 'beach' | 'city' | 'formal' | 'safari' | 'ninja' | 'royal' | 'scuba';
  accessories: string[];
  faceType?: FaceType;
  expression?: Expression;
}

export interface GlobePolygon {
  properties: {
    ISO_A2: string;
    NAME: string;
    [key: string]: string | number;
  };
  [key: string]: unknown;
}

export interface CapitalCity {
  isoCode: string;
  name: string;
  capital: string;
  lat: number;
  lng: number;
}
