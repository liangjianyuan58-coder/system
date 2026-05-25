// =============================================================
// app/api/northstar/review/route.js
// POST { userId } → 北極星と直近APを照合してAI振り返りを返す
// =============================================================
import { NextResponse } from 'next/server';
import { getNorthStar, getRecentOutputs } from '@/lib/sheet';
import { northStarReview } from '@/lib/gemini';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, message: 'リクエストが不正です' }, { status: 400 }); }
  const { userId } = body || {};
  if (!userId) return NextResponse.json({ ok: false, message: 'userId が必要です' }, { status: 400 });
  try {
    const data = await getNorthStar(userId);
    if (!data || !data.northStar) {
      return NextResponse.json({ ok: false, message: 'まず北極星を登録してください' }, { status: 400 });
    }
    const recentOutputs = await getRecentOutputs(userId, 7);
    const review = await northStarReview(data.northStar, recentOutputs);
    return NextResponse.json({ ok: true, review });
  } catch (err) {
    return NextResponse.json({ ok: false, message: String(err?.message || err) }, { status: 500 });
  }
}
