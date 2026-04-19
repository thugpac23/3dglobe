import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const iso = req.nextUrl.searchParams.get('iso');
  if (!iso) {
    return NextResponse.json({ error: 'iso parameter required' }, { status: 400 });
  }

  try {
    const country = await prisma.country.findUnique({
      where: { isoCode: iso.toUpperCase() },
    });
    if (!country) {
      return NextResponse.json({ error: 'Country not found' }, { status: 404 });
    }
    return NextResponse.json(country);
  } catch (error) {
    console.error('GET /api/country error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
