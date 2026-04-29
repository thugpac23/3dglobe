import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await req.json() as { positionX?: number; positionY?: number; page?: number; rotation?: number };

  const data: Record<string, number> = {};
  if (body.positionX !== undefined) data.positionX = body.positionX;
  if (body.positionY !== undefined) data.positionY = body.positionY;
  if (body.page      !== undefined) data.page      = body.page;
  if (body.rotation  !== undefined) data.rotation  = body.rotation;

  const stamp = await prisma.passportStamp.update({ where: { id }, data });
  return NextResponse.json(stamp);
}
