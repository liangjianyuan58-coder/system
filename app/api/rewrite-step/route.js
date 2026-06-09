import { NextResponse } from 'next/server';
import { rewriteStep } from '@/lib/gemini';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request) {
  try {
    const data = await request.json();
    const result = await rewriteStep(data);
    return NextResponse.json({ ok: true, rewritten: result.rewritten });
  } catch (err) {
    return NextResponse.json({ ok: false, message: err?.message || String(err) }, { status: 500 });
  }
}
