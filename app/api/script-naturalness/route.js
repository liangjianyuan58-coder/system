// app/api/script-naturalness/route.js
// POST { script } → 台本の言語自然さチェック
import { NextResponse } from 'next/server';
import { checkScriptNaturalness } from '@/lib/gemini';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  let data;
  try { data = await request.json(); } catch {
    return NextResponse.json({ ok: false, message: 'リクエスト不正' }, { status: 400 });
  }
  const { script } = data;
  if (!script || !script.trim()) {
    return NextResponse.json({ ok: false, message: '台本が空です' }, { status: 400 });
  }
  try {
    const fb = await checkScriptNaturalness(script);
    return NextResponse.json({ ok: true, feedback: fb });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e.message || 'AI エラー' }, { status: 500 });
  }
}
