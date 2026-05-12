import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const entries = await prisma.diaryEntry.findMany({
      orderBy: { date: 'desc' },
      include: { photos: { orderBy: { createdAt: 'asc' } } },
    });
    return NextResponse.json(entries);
  } catch (error) {
    console.error('GET /api/diary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user, title, content, date } = body;
    if (!user || !title || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const entry = await prisma.diaryEntry.create({
      data: {
        user,
        title,
        content,
        date: date ? new Date(date) : new Date(),
      },
      include: { photos: true },
    });
    return NextResponse.json(entry);
  } catch (error) {
    console.error('POST /api/diary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
