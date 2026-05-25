// =============================================================
// app/api/northstar/route.js
// GET  ?userId=xxx        → 北極星を取得
// POST { userId, lineUserId, name, northStar } → 保存
// =============================================================
import { NextResponse } from 'next/server';
import { getNorthStar, setNorthStar } from '@/lib/sheet';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || '';
  if (!userId) return NextResponse.json({ ok: false, message: 'userId が必要です' }, { status: 400 });
  try {
    const data = await getNorthStar(userId);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json({ ok: false, message: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, message: 'リクエストが不正です' }, { status: 400 }); }
  const { userId, lineUserId, name, northStar } = body || {};
  if (!userId) return NextResponse.json({ ok: false, message: 'userId が必要です' }, { status: 400 });
  if (!northStar || !northStar.trim()) return NextResponse.json({ ok: false, message: '北極星の内容が必要です' }, { status: 400 });
  try {
    await setNorthStar(userId.trim(), (lineUserId || '').trim(), (name || '').trim(), northStar.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, message: String(err?.message || err) }, { status: 500 });
  }
}
