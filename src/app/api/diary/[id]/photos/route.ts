import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { url, positionX, positionY, rotation, caption } = body;
    if (!url) {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }
    const photo = await prisma.diaryPhoto.create({
      data: {
        diaryEntryId: params.id,
        url,
        positionX: positionX ?? 50,
        positionY: positionY ?? 20,
        rotation: rotation ?? (Math.random() * 8 - 4),
        caption: caption ?? '',
      },
    });
    return NextResponse.json(photo);
  } catch (error) {
    console.error('POST /api/diary/[id]/photos error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
