import { Visit, UserType, XPResult, WishlistItem, UserProgress } from '@/types';

export async function fetchVisits(): Promise<Visit[]> {
  const res = await fetch('/api/visits', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch visits');
  return res.json();
}

export async function addVisit(countryId: string, user: UserType): Promise<Visit> {
  const res = await fetch('/api/visit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ countryId, user }),
  });
  if (!res.ok) throw new Error('Failed to add visit');
  return res.json();
}

export async function removeVisit(countryId: string, user: UserType): Promise<void> {
  const res = await fetch('/api/visit', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ countryId, user }),
  });
  if (!res.ok) throw new Error('Failed to remove visit');
}

export async function fetchProgress(): Promise<{ tati: UserProgress; iva: UserProgress }> {
  const res = await fetch('/api/progress', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch progress');
  return res.json();
}

export async function addXP(user: UserType, amount: number): Promise<XPResult> {
  const res = await fetch('/api/xp/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, amount }),
  });
  if (!res.ok) throw new Error('Failed to add XP');
  return res.json();
}

export async function fetchWishlist(): Promise<WishlistItem[]> {
  const res = await fetch('/api/wishlist', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch wishlist');
  return res.json();
}

export async function addWishlist(countryId: string, user: UserType): Promise<WishlistItem> {
  const res = await fetch('/api/wishlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ countryId, user }),
  });
  if (!res.ok) throw new Error('Failed to add to wishlist');
  return res.json();
}

export async function removeWishlist(countryId: string, user: UserType): Promise<void> {
  const res = await fetch('/api/wishlist', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ countryId, user }),
  });
  if (!res.ok) throw new Error('Failed to remove from wishlist');
}
