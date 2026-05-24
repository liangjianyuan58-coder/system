// =============================================================
// app/api/feedback/route.js
// POST /api/feedback : 7ステップを Gemini で査定（70点満点FB）
// =============================================================

import { NextResponse } from 'next/server';
import { gradeOutput } from '@/lib/gemini';
import { STEP_KEYS } from '@/lib/havefun-data';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel: Gemini応答待ちの余裕

export async function POST(request) {
  try {
    const data = await request.json();

    // 全項目チェック
    for (let i = 0; i < STEP_KEYS.length; i++) {
      const v = data && data[STEP_KEYS[i]] ? String(data[STEP_KEYS[i]]).trim() : '';
      if (!v) {
        return NextResponse.json(
          { ok: false, message: `未入力の項目があります（ステップ${i + 1}）。` },
          { status: 400 }
        );
      }
    }

    const result = await gradeOutput(data);
    return NextResponse.json({ ok: true, feedback: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: 'AI査定エラー: ' + String(err && err.message ? err.message : err) },
      { status: 500 }
    );
  }
}
