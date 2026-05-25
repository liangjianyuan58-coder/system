// POST { userId, ts, total, verdict } → メインシートのAI採点列を更新
import { NextResponse } from 'next/server';
import { saveGrade } from '@/lib/sheet';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false }); }
  const { userId, ts, total, verdict } = body || {};
  if (!userId || !ts) return NextResponse.json({ ok: false });
  try {
    await saveGrade(userId, ts, Number(total) || 0, verdict || '');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
