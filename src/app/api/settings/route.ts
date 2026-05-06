import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (prisma as any).setting.findMany();
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value;
    return NextResponse.json(out);
  } catch (error) {
    console.error('GET /api/settings error:', error);
    // If the table doesn't exist yet (DB not migrated), fall back to empty.
    return NextResponse.json({}, { status: 200 });
  }
}

export async function PUT(req: Request) {
  try {
    const { key, value } = await req.json();
    if (typeof key !== 'string' || typeof value !== 'string') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await (prisma as any).setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    return NextResponse.json({ key: row.key, value: row.value });
  } catch (error) {
    console.error('PUT /api/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
