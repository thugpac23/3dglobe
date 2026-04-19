import { Visit, UserType } from '@/types';

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
