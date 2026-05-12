import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request, { params }: { params: { photoId: string } }) {
  try {
    const body = await request.json();
    const { positionX, positionY, rotation, caption, url } = body;
    const photo = await prisma.diaryPhoto.update({
      where: { id: params.photoId },
      data: {
        ...(positionX !== undefined && { positionX }),
        ...(positionY !== undefined && { positionY }),
        ...(rotation !== undefined && { rotation }),
        ...(caption !== undefined && { caption }),
        ...(url !== undefined && { url }),
      },
    });
    return NextResponse.json(photo);
  } catch (error) {
    console.error('PUT /api/diary/photos/[photoId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { photoId: string } }) {
  try {
    await prisma.diaryPhoto.delete({ where: { id: params.photoId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/diary/photos/[photoId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
