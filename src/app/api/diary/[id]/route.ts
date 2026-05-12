import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { title, content, date, photoUrl, photoX, photoY, photoRot } = body;
    const entry = await prisma.diaryEntry.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(photoUrl !== undefined && { photoUrl }),
        ...(photoX !== undefined && { photoX }),
        ...(photoY !== undefined && { photoY }),
        ...(photoRot !== undefined && { photoRot }),
      },
    });
    return NextResponse.json(entry);
  } catch (error) {
    console.error('PUT /api/diary/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.diaryEntry.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/diary/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
