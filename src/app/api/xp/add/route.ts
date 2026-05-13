import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { XPResult } from '@/types';
import { calculateLevel, ACHIEVEMENTS } from '@/lib/xp';

export async function POST(req: NextRequest) {
  try {
    const { userId, amount } = (await req.json()) as { userId: string; amount: number };
    if (!userId || typeof amount !== 'number') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const [current, visitCount, wishlistCount] = await Promise.all([
      prisma.userProgress.upsert({
        where: { userId },
        update: {},
        create: { userId, xp: 0, level: 1, achievements: '[]' },
      }),
      prisma.visit.count({ where: { userId } }),
      prisma.wishlist.count({ where: { userId } }),
    ]);

    const unlocked: string[] = JSON.parse(current.achievements) as string[];
    const newAchievements: string[] = [];
    let bonus = 0;

    for (const ach of ACHIEVEMENTS) {
      if (unlocked.includes(ach.id)) continue;
      const meetsVisit = ach.visitThreshold > 0 && visitCount >= ach.visitThreshold;
      const meetsWishlist = 'wishlistThreshold' in ach && wishlistCount >= (ach as { wishlistThreshold: number }).wishlistThreshold;
      if (meetsVisit || meetsWishlist) {
        unlocked.push(ach.id);
        newAchievements.push(ach.id);
        bonus += ach.xp;
      }
    }

    const newXp = current.xp + amount + bonus;
    const oldLevel = current.level;
    const newLevel = calculateLevel(newXp);

    const updated = await prisma.userProgress.update({
      where: { userId },
      data: { xp: newXp, level: newLevel, achievements: JSON.stringify(unlocked) },
    });

    const result: XPResult = {
      progress: {
        id: updated.id,
        userId: updated.userId,
        xp: updated.xp,
        level: updated.level,
        achievements: unlocked,
      },
      leveledUp: newLevel > oldLevel,
      newAchievements,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/xp/add error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
