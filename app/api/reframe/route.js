// =============================================================
// app/api/reframe/route.js
// POST /api/reframe : { situation, reframe } を Gemini で査定＋お手本
// =============================================================
import { NextResponse } from 'next/server';
import { reframeFeedback } from '@/lib/gemini';
import { appendTrainingLog } from '@/lib/sheet';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  try {
    const { situation, reframe, moduleId, userId, name } = await request.json();
    if (!situation || !String(situation).trim())
      return NextResponse.json({ ok: false, message: 'お題（ネガ事象）がありません。' }, { status: 400 });
    if (!reframe || !String(reframe).trim())
      return NextResponse.json({ ok: false, message: 'リフレーミングを入力してください。' }, { status: 400 });
    const result = await reframeFeedback(String(situation).trim(), String(reframe).trim(), moduleId || '');

    if (userId) {
      appendTrainingLog({
        userId: String(userId).trim(),
        name: String(name || '').trim(),
        type: 'reframe',
        moduleId: moduleId || '',
        input1: String(situation).trim(),
        input2: String(reframe).trim(),
        aiScore: result.score,
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, feedback: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: 'AI査定エラー: ' + String(err && err.message ? err.message : err) },
      { status: 500 }
    );
  }
}
