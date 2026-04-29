import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UserType } from '@/types';

const DEFAULTS = {
  tati: { hairStyle: 'short', hairColor: '#8B4513', eyeColor: '#4B5563', skinColor: '#FBBF8A', outfit: 'casual', accessories: '[]' },
  iva:  { hairStyle: 'long',  hairColor: '#1a1a1a', eyeColor: '#4B5563', skinColor: '#FBBF8A', outfit: 'casual', accessories: '[]' },
};

async function getOrCreate(user: UserType) {
  return prisma.avatar.upsert({
    where: { user },
    update: {},
    create: { user, ...DEFAULTS[user] },
  });
}

export async function GET() {
  try {
    const [tati, iva] = await Promise.all([getOrCreate('tati'), getOrCreate('iva')]);
    const parse = (a: typeof tati) => ({ ...a, accessories: JSON.parse(a.accessories) as string[] });
    return NextResponse.json({ tati: parse(tati), iva: parse(iva) });
  } catch (error) {
    console.error('GET /api/avatar error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { user: UserType; [k: string]: unknown };
    const { user, hairStyle, hairColor, eyeColor, skinColor, outfit, accessories } = body;
    if (!user || !['tati', 'iva'].includes(user)) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 400 });
    }
    const updated = await prisma.avatar.upsert({
      where: { user },
      update: {
        ...(hairStyle !== undefined && { hairStyle: String(hairStyle) }),
        ...(hairColor !== undefined && { hairColor: String(hairColor) }),
        ...(eyeColor  !== undefined && { eyeColor:  String(eyeColor) }),
        ...(skinColor !== undefined && { skinColor: String(skinColor) }),
        ...(outfit    !== undefined && { outfit:    String(outfit) }),
        ...(accessories !== undefined && { accessories: JSON.stringify(accessories) }),
      },
      create: { user, ...DEFAULTS[user] },
    });
    return NextResponse.json({ ...updated, accessories: JSON.parse(updated.accessories) as string[] });
  } catch (error) {
    console.error('POST /api/avatar error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
