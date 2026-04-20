export const XP_THRESHOLDS = [0, 50, 120, 200, 300];

export const LEVEL_TITLES = [
  'Начинаещ пътешественик',
  'Любител на приключения',
  'Изследовател',
  'Откривател',
  'Глобален герой',
];

export const ACHIEVEMENTS = [
  { id: 'first_visit',  emoji: '🌱', title: 'Първи стъпки',  desc: '1 посетена държава',  xp: 15, visitThreshold: 1 },
  { id: 'visited_5',   emoji: '🗺️',  title: 'Изследовател',  desc: '5 посетени държави',  xp: 15, visitThreshold: 5 },
  { id: 'visited_10',  emoji: '✈️',  title: 'Пътешественик', desc: '10 посетени държави', xp: 15, visitThreshold: 10 },
  { id: 'visited_25',  emoji: '🌍',  title: 'Авантюрист',    desc: '25 посетени държави', xp: 15, visitThreshold: 25 },
  { id: 'wishlist_5',  emoji: '⭐',  title: 'Мечтател',      desc: '5 желани дестинации', xp: 15, visitThreshold: -1, wishlistThreshold: 5 },
] as const;

export function calculateLevel(xp: number): number {
  let level = 1;
  for (let i = 0; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return Math.min(level, XP_THRESHOLDS.length);
}

export function getLevelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
}

export function xpForLevel(level: number): number {
  return XP_THRESHOLDS[Math.min(level - 1, XP_THRESHOLDS.length - 1)];
}

export function xpToNextLevel(level: number): number {
  if (level >= XP_THRESHOLDS.length) return XP_THRESHOLDS[XP_THRESHOLDS.length - 1];
  return XP_THRESHOLDS[level];
}

export function xpProgress(xp: number, level: number): { current: number; needed: number; pct: number } {
  const start = xpForLevel(level);
  const end = xpToNextLevel(level);
  if (end <= start) return { current: xp - start, needed: 0, pct: 100 };
  return {
    current: xp - start,
    needed: end - start,
    pct: Math.min(100, Math.round(((xp - start) / (end - start)) * 100)),
  };
}
