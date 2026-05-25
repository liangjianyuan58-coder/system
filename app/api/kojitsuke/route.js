// =============================================================
// app/api/kojitsuke/route.js
// POST /api/kojitsuke : { word, output } を Gemini で査定＋お手本例
// =============================================================

import { NextResponse } from 'next/server';
import { kojitsukeFeedback } from '@/lib/gemini';
import { appendTrainingLog } from '@/lib/sheet';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  try {
    const { word, output, moduleId, userId, name } = await request.json();

    if (!word || !String(word).trim()) {
      return NextResponse.json({ ok: false, message: 'お題の単語がありません。' }, { status: 400 });
    }
    if (!output || !String(output).trim()) {
      return NextResponse.json({ ok: false, message: 'こじつけ説明を入力してください。' }, { status: 400 });
    }

    const result = await kojitsukeFeedback(String(word).trim(), String(output).trim(), moduleId || '');

    if (userId) {
      appendTrainingLog({
        userId: String(userId).trim(),
        name: String(name || '').trim(),
        type: 'kojitsuke',
        moduleId: moduleId || '',
        input1: String(word).trim(),
        input2: String(output).trim(),
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
