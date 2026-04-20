import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UserType } from '@/types';

export async function GET(req: NextRequest) {
  const user = req.nextUrl.searchParams.get('user') as UserType | null;
  try {
    const where = user && ['tati', 'iva'].includes(user) ? { user } : {};
    const items = await prisma.wishlist.findMany({
      where,
      include: { country: true },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error('GET /api/wishlist error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { countryId, user } = (await req.json()) as { countryId: string; user: UserType };
    if (!countryId || !user || !['tati', 'iva'].includes(user)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const item = await prisma.wishlist.upsert({
      where: { countryId_user: { countryId, user } },
      update: {},
      create: { countryId, user },
      include: { country: true },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('POST /api/wishlist error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { countryId, user } = (await req.json()) as { countryId: string; user: UserType };
    if (!countryId || !user || !['tati', 'iva'].includes(user)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    await prisma.wishlist.deleteMany({ where: { countryId, user } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/wishlist error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
