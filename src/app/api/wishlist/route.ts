import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  try {
    const where = userId ? { userId } : {};
    const items = await prisma.wishlist.findMany({
      where,
      include: { country: true, user: true },
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
    const { countryId, userId } = (await req.json()) as { countryId: string; userId: string };
    if (!countryId || !userId) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const item = await prisma.wishlist.upsert({
      where: { countryId_userId: { countryId, userId } },
      update: {},
      create: { countryId, userId },
      include: { country: true, user: true },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('POST /api/wishlist error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { countryId, userId } = (await req.json()) as { countryId: string; userId: string };
    if (!countryId || !userId) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    await prisma.wishlist.deleteMany({ where: { countryId, userId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/wishlist error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
