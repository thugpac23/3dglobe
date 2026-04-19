export type UserType = 'tati' | 'iva';

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
  [isoCode: string]: {
    country: Country;
    tati: boolean;
    iva: boolean;
  };
}

export interface GlobePolygon {
  properties: {
    ISO_A2: string;
    NAME: string;
    [key: string]: string | number;
  };
  [key: string]: unknown;
}
