import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const PROTECTED_IDS = ['tati', 'iva'];

function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function GET() {
  try {
    const users = await prisma.userProfile.findMany({
      orderBy: [{ protected: 'desc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error('GET /api/users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { displayName, color, emoji } = (await req.json()) as {
      displayName: string;
      color?: string;
      emoji?: string;
    };

    if (!displayName?.trim()) {
      return NextResponse.json({ error: 'displayName required' }, { status: 400 });
    }

    const id = makeId();
    const user = await prisma.userProfile.create({
      data: {
        id,
        displayName: displayName.trim(),
        color: color ?? '#8B5CF6',
        protected: false,
      },
    });

    // Persist emoji in settings if provided
    if (emoji) {
      await prisma.setting.upsert({
        where: { key: `emoji_${id}` },
        update: { value: emoji },
        create: { key: `emoji_${id}`, value: emoji },
      });
    }

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('POST /api/users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id: string };

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    if (PROTECTED_IDS.includes(id)) {
      return NextResponse.json({ error: 'This user cannot be deleted' }, { status: 403 });
    }

    // Cascade deletes all related data via FK constraints
    await prisma.userProfile.delete({ where: { id } });

    // Clean up settings for this user
    await prisma.setting.deleteMany({ where: { key: { startsWith: `emoji_${id}` } } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
