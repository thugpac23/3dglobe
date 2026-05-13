import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DEFAULT_AVATAR = {
  hairStyle: 'short', hairColor: '#8B4513', eyeColor: '#4B5563',
  skinColor: '#FBBF8A', outfit: 'casual', accessories: '[]',
  faceType: 'standard', expression: 'smile', avatarUrl: null,
};

async function getOrCreate(userId: string) {
  return prisma.avatar.upsert({
    where: { userId },
    update: {},
    create: { userId, ...DEFAULT_AVATAR },
  });
}

export async function GET() {
  try {
    const users = await prisma.userProfile.findMany({
      orderBy: [{ protected: 'desc' }, { createdAt: 'asc' }],
    });
    const rows = await Promise.all(users.map(u => getOrCreate(u.id)));
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.userId] = { ...row, accessories: JSON.parse(row.accessories) as string[] };
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/avatar error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { userId: string; [k: string]: unknown };
    const { userId, hairStyle, hairColor, eyeColor, skinColor, outfit, accessories, faceType, expression, avatarUrl } = body;
    if (!userId) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 400 });
    }
    const updated = await prisma.avatar.upsert({
      where: { userId },
      update: {
        ...(hairStyle    !== undefined && { hairStyle:   String(hairStyle) }),
        ...(hairColor    !== undefined && { hairColor:   String(hairColor) }),
        ...(eyeColor     !== undefined && { eyeColor:    String(eyeColor) }),
        ...(skinColor    !== undefined && { skinColor:   String(skinColor) }),
        ...(outfit       !== undefined && { outfit:      String(outfit) }),
        ...(accessories  !== undefined && { accessories: JSON.stringify(accessories) }),
        ...(faceType     !== undefined && { faceType:    String(faceType) }),
        ...(expression   !== undefined && { expression:  String(expression) }),
        ...(avatarUrl    !== undefined && { avatarUrl:   avatarUrl === null ? null : String(avatarUrl) }),
      },
      create: { userId, ...DEFAULT_AVATAR },
    });
    return NextResponse.json({ ...updated, accessories: JSON.parse(updated.accessories) as string[] });
  } catch (error) {
    console.error('POST /api/avatar error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
