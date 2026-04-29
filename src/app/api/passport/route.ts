import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { User } from '@prisma/client';

const STAMPS_PER_PAGE = 6;

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

function defaultPosition(index: number, countryId: string): { positionX: number; positionY: number; rotation: number; page: number } {
  const pageIndex = index % STAMPS_PER_PAGE;
  const col = pageIndex % 3;
  const row = Math.floor(pageIndex / 3);
  const h = hashCode(countryId);
  // Grid positions: x ≈ 20,50,80%  y ≈ 28,62%
  const baseX = 20 + col * 30;
  const baseY = 28 + row * 34;
  const jitterX = (h % 9) - 4;
  const jitterY = ((h >> 4) % 9) - 4;
  const rotation = ((h >> 8) % 31) - 15;
  return {
    positionX: baseX + jitterX,
    positionY: baseY + jitterY,
    rotation,
    page: Math.floor(index / STAMPS_PER_PAGE),
  };
}

export async function GET(req: NextRequest) {
  const user = req.nextUrl.searchParams.get('user') as User | null;
  if (!user || !['tati', 'iva'].includes(user)) {
    return NextResponse.json({ error: 'Invalid user' }, { status: 400 });
  }

  // Fetch all visits for user (sorted by createdAt for stable ordering)
  const visits = await prisma.visit.findMany({
    where: { user },
    include: { country: true },
    orderBy: { createdAt: 'asc' },
  });

  // Lazily upsert stamps for all visits
  const stamps = await Promise.all(
    visits.map(async (visit, index) => {
      const defaults = defaultPosition(index, visit.countryId);
      return prisma.passportStamp.upsert({
        where: { countryId_user: { countryId: visit.countryId, user } },
        create: {
          user,
          countryId: visit.countryId,
          stampedAt: visit.createdAt,
          ...defaults,
        },
        update: {},
        include: { country: true },
      });
    }),
  );

  return NextResponse.json(stamps);
}
