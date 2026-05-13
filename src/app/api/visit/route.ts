import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { countryId, userId } = body as { countryId: string; userId: string };

    if (!countryId || !userId) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const visit = await prisma.visit.upsert({
      where: { countryId_userId: { countryId, userId } },
      update: {},
      create: { countryId, userId },
      include: { country: true, user: true },
    });

    return NextResponse.json(visit, { status: 201 });
  } catch (error) {
    console.error('POST /api/visit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { countryId, userId } = body as { countryId: string; userId: string };

    if (!countryId || !userId) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    await prisma.visit.deleteMany({
      where: { countryId, userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/visit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
