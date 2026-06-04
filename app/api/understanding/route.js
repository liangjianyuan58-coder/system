// app/api/understanding/route.js
// GET  ?moduleId=xxx           → 4択理解チェック問題を生成
// POST { moduleId, question, selectedIndex, correctIndex, isCorrect, explanation, userId, name } → ログ記録
import { NextResponse } from 'next/server';
import { generateUnderstandingQuestion } from '@/lib/gemini';
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
  const { moduleId, question, selectedIndex, correctIndex, isCorrect, explanation, userId, name } = data;
  if (!moduleId || !question) {
    return NextResponse.json({ ok: false, message: 'moduleId・question は必須です' }, { status: 400 });
  }
  const modName = MODULES[moduleId]?.manual?.title || '';
  if (userId) {
    appendActivity({
      userId,
      name: name || '(名無し)',
      type: '理解チェック(4択)',
      module: modName,
      keyword: question,
      userInput: `選択: ${selectedIndex} / 正解: ${correctIndex} / ${isCorrect ? '正解' : '不正解'}`,
      total: isCorrect ? '10/10' : '0/10',
      comment: explanation || '',
    }).catch((e) => console.error('[understanding] appendActivity error:', e?.message));
  }
  return NextResponse.json({ ok: true });
}
