import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UserProgress } from '@/types';

function toProgress(row: { id: string; user: string; xp: number; level: number; achievements: string }): UserProgress {
  return {
    id: row.id,
    user: row.user as 'tati' | 'iva',
    xp: row.xp,
    level: row.level,
    achievements: JSON.parse(row.achievements) as string[],
  };
}

async function getOrCreate(user: 'tati' | 'iva') {
  return prisma.userProgress.upsert({
    where: { user },
    update: {},
    create: { user, xp: 0, level: 1, achievements: '[]' },
  });
}

export async function GET() {
  try {
    const [tati, iva] = await Promise.all([getOrCreate('tati'), getOrCreate('iva')]);
    return NextResponse.json({ tati: toProgress(tati), iva: toProgress(iva) });
  } catch (error) {
    console.error('GET /api/progress error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
