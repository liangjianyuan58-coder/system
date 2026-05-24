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
    let theme = '';
    try { theme = (await request.json())?.theme || ''; } catch { theme = ''; }
    const result = await modelScript(theme);
    return NextResponse.json({ ok: true, script: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: 'お手本生成エラー: ' + String(err && err.message ? err.message : err) },
      { status: 500 }
    );
  }
}
