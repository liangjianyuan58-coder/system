// =============================================================
// app/api/feedback/route.js
// POST /api/feedback : 7ステップを Gemini で査定（70点満点FB）
// =============================================================

import { NextResponse } from 'next/server';
import { gradeOutput } from '@/lib/gemini';
import { getStepKeys } from '@/lib/havefun-data';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel: Gemini応答待ちの余裕

export async function POST(request) {
  try {
    const data = await request.json();

    const keys = getStepKeys(data && data.moduleId);
    for (let i = 0; i < keys.length; i++) {
      const v = data && data[keys[i]] ? String(data[keys[i]]).trim() : '';
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
