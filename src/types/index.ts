export type UserType = 'tati' | 'iva';
export type AppMode = 'visited' | 'wishlist';

export const USER_DISPLAY: Record<UserType, string> = {
  tati: 'Тати',
  iva:  'Ива',
};

export const USER_COLOR: Record<UserType, string> = {
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
  user: UserType;
  country: Country;
}

export interface VisitsByCountry {
  [isoCode: string]: { country: Country; tati: boolean; iva: boolean };
}

export interface WishlistItem {
  id: string;
  countryId: string;
  user: UserType;
  country: Country;
}

export interface WishlistByCountry {
  [isoCode: string]: { country: Country; tati: boolean; iva: boolean };
}

export interface UserProgress {
  id: string;
  user: UserType;
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
  user: UserType;
  hairStyle: 'short' | 'long' | 'curly' | 'ponytail';
  hairColor: string;
  eyeColor: string;
  skinColor: string;
  outfit: 'casual' | 'travel' | 'explorer';
  accessories: string[];
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
