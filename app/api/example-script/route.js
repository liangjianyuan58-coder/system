// =============================================================
// app/api/example-script/route.js
// POST /api/example-script : 7ステップの模範スクリプトを生成
//   body: { theme?: string }
// =============================================================
import { NextResponse } from 'next/server';
import { modelScript } from '@/lib/gemini';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  try {
    let theme = '', moduleId = '';
    try { const body = await request.json(); theme = body?.theme || ''; moduleId = body?.moduleId || ''; } catch {}
    const result = await modelScript(theme, moduleId);
    return NextResponse.json({ ok: true, script: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: 'お手本生成エラー: ' + String(err && err.message ? err.message : err) },
      { status: 500 }
    );
  }
}
