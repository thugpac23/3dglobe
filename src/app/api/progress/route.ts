import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UserProgress } from '@/types';

function toProgress(row: { id: string; userId: string; xp: number; level: number; achievements: string }): UserProgress {
  return {
    id: row.id,
    userId: row.userId,
    xp: row.xp,
    level: row.level,
    achievements: JSON.parse(row.achievements) as string[],
  };
}

async function getOrCreate(userId: string) {
  return prisma.userProgress.upsert({
    where: { userId },
    update: {},
    create: { userId, xp: 0, level: 1, achievements: '[]' },
  });
}

export async function GET() {
  try {
    const users = await prisma.userProfile.findMany({
      orderBy: [{ protected: 'desc' }, { createdAt: 'asc' }],
    });
    const rows = await Promise.all(users.map(u => getOrCreate(u.id)));
    const result: Record<string, UserProgress> = {};
    for (const row of rows) result[row.userId] = toProgress(row);
    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/progress error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
