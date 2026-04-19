import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UserType } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { countryId, user } = body as { countryId: string; user: UserType };

    if (!countryId || !user || !['tati', 'iva'].includes(user)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const visit = await prisma.visit.upsert({
      where: { countryId_user: { countryId, user } },
      update: {},
      create: { countryId, user },
      include: { country: true },
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
    const { countryId, user } = body as { countryId: string; user: UserType };

    if (!countryId || !user || !['tati', 'iva'].includes(user)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    await prisma.visit.deleteMany({
      where: { countryId, user },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/visit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
