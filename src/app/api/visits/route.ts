import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const visits = await prisma.visit.findMany({
      include: { country: true },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(visits);
  } catch (error) {
    console.error('GET /api/visits error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
