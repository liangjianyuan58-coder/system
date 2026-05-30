// app/api/understanding/route.js
// GET  ?moduleId=xxx           → 理解チェック問題を生成
// POST { moduleId, question, subQuestion, answer, userId, name } → 評価＋ログ記録
import { NextResponse } from 'next/server';
import { generateUnderstandingQuestion, evaluateUnderstanding } from '@/lib/gemini';
import { appendActivity } from '@/lib/sheet';
import { MODULES, ACTIVE_MODULE } from '@/lib/havefun-data';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const moduleId = searchParams.get('moduleId') || ACTIVE_MODULE;
  if (!MODULES[moduleId]) {
    return NextResponse.json({ ok: false, message: '無効なmoduleIdです' }, { status: 400 });
  }
  try {
    const q = await generateUnderstandingQuestion(moduleId);
    return NextResponse.json({ ok: true, ...q });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e.message || 'AI エラー' }, { status: 500 });
  }
}

export async function POST(request) {
  let data;
  try { data = await request.json(); } catch {
    return NextResponse.json({ ok: false, message: 'リクエスト不正' }, { status: 400 });
  }
  const { moduleId, question, subQuestion, answer, userId, name } = data;
  if (!moduleId || !question || !answer) {
    return NextResponse.json({ ok: false, message: 'moduleId・question・answer は必須です' }, { status: 400 });
  }
  if (!MODULES[moduleId]) {
    return NextResponse.json({ ok: false, message: '無効なmoduleIdです' }, { status: 400 });
  }
  try {
    const fb = await evaluateUnderstanding(moduleId, question, subQuestion || '', answer);
    const modName = MODULES[moduleId]?.manual?.title || '';
    // ログ記録（失敗しても評価結果は返す）
    if (userId) {
      appendActivity({
        userId,
        name: name || '(名無し)',
        type: '理解チェック',
        module: modName,
        keyword: `${question}　/　${subQuestion || ''}`,
        userInput: answer,
        total: `${fb.score}/10`,
        good: (fb.understood || []).join(' / '),
        improvements: (fb.missing || []).join(' / '),
        comment: fb.comment || '',
        aiExample: fb.trueEssence || '',
      }).catch((e) => console.error('[understanding] appendActivity error:', e?.message));
    }
    return NextResponse.json({ ok: true, feedback: fb });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e.message || 'AI エラー' }, { status: 500 });
  }
}
