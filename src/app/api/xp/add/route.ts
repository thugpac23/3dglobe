import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UserType, XPResult } from '@/types';
import { calculateLevel, ACHIEVEMENTS } from '@/lib/xp';

export async function POST(req: NextRequest) {
  try {
    const { user, amount } = (await req.json()) as { user: UserType; amount: number };
    if (!user || !['tati', 'iva'].includes(user) || typeof amount !== 'number') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const [current, visitCount, wishlistCount] = await Promise.all([
      prisma.userProgress.upsert({
        where: { user },
        update: {},
        create: { user, xp: 0, level: 1, achievements: '[]' },
      }),
      prisma.visit.count({ where: { user } }),
      prisma.wishlist.count({ where: { user } }),
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
      where: { user },
      data: { xp: newXp, level: newLevel, achievements: JSON.stringify(unlocked) },
    });

    const result: XPResult = {
      progress: {
        id: updated.id,
        user: updated.user as UserType,
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
