import { NextResponse } from 'next/server';
import { generateStepHint } from '@/lib/gemini';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  try {
    const { moduleId, stepKey, stepLabel, issue, whyBad } = await request.json();
    const result = await generateStepHint({ moduleId, stepKey, stepLabel, issue, whyBad });
    return NextResponse.json({ ok: true, hint: result.hint });
  } catch (err) {
    return NextResponse.json({ ok: false, message: String(err?.message || err) }, { status: 500 });
  }
}
