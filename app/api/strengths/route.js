// GET  /api/strengths?userId=xxx  → { ok: true, strengths: [...] }
// POST /api/strengths  body: { userId, name, stepNotes, scores }  → { ok: true, updated: [...], regressions: [...] }

import { NextResponse } from 'next/server';
import { getStrengths, updateStrengths } from '@/lib/strengths';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || '';
    const strengths = await getStrengths(userId);
    return NextResponse.json({ ok: true, strengths });
  } catch (err) {
    console.error('[GET /api/strengths]', err);
    return NextResponse.json({ ok: false, message: err?.message || 'エラーが発生しました' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, name, stepNotes, scores } = body || {};
    const result = await updateStrengths(userId, name, stepNotes, scores);
    return NextResponse.json({ ok: true, updated: result.updated, regressions: result.regressions });
  } catch (err) {
    console.error('[POST /api/strengths]', err);
    return NextResponse.json({ ok: false, message: err?.message || 'エラーが発生しました' }, { status: 500 });
  }
}
