// app/api/template-script/route.js
// POST /api/template-script : 穴埋めテンプレートを生成
//   body: { theme?: string, moduleId?: string }
import { NextResponse } from 'next/server';
import { modelTemplate } from '@/lib/gemini';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  try {
    let theme = '', moduleId = '';
    try { const body = await request.json(); theme = body?.theme || ''; moduleId = body?.moduleId || ''; } catch {}
    const result = await modelTemplate(theme, moduleId);
    return NextResponse.json({ ok: true, script: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: 'テンプレート生成エラー: ' + String(err && err.message ? err.message : err) },
      { status: 500 }
    );
  }
}
