import { Visit, XPResult, WishlistItem, UserProgress, UserProfile } from '@/types';

export async function fetchUsers(): Promise<UserProfile[]> {
  const res = await fetch('/api/users', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function createUser(displayName: string, color: string, emoji: string): Promise<UserProfile> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName, color, emoji }),
  });
  if (!res.ok) throw new Error('Failed to create user');
  return res.json();
}

export async function deleteUser(id: string): Promise<void> {
  const res = await fetch('/api/users', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error('Failed to delete user');
}

export async function fetchVisits(): Promise<Visit[]> {
  const res = await fetch('/api/visits', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch visits');
  return res.json();
}

export async function addVisit(countryId: string, userId: string): Promise<Visit> {
  const res = await fetch('/api/visit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ countryId, userId }),
  });
  if (!res.ok) throw new Error('Failed to add visit');
  return res.json();
}

export async function removeVisit(countryId: string, userId: string): Promise<void> {
  const res = await fetch('/api/visit', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ countryId, userId }),
  });
  if (!res.ok) throw new Error('Failed to remove visit');
}

export async function fetchProgress(): Promise<Record<string, UserProgress>> {
  const res = await fetch('/api/progress', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch progress');
  return res.json();
}

export async function addXP(userId: string, amount: number): Promise<XPResult> {
  const res = await fetch('/api/xp/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, amount }),
  });
  if (!res.ok) throw new Error('Failed to add XP');
  return res.json();
}

export async function fetchWishlist(): Promise<WishlistItem[]> {
  const res = await fetch('/api/wishlist', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch wishlist');
  return res.json();
}

export async function addWishlist(countryId: string, userId: string): Promise<WishlistItem> {
  const res = await fetch('/api/wishlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ countryId, userId }),
  });
  if (!res.ok) throw new Error('Failed to add to wishlist');
  return res.json();
}

export async function removeWishlist(countryId: string, userId: string): Promise<void> {
  const res = await fetch('/api/wishlist', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ countryId, userId }),
  });
  if (!res.ok) throw new Error('Failed to remove from wishlist');
}
