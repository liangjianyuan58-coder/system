// =============================================================
// app/api/history/route.js
// GET /api/history?scope=all|me&userId=...&limit=30
//   「誰がどういう入力をしたか」の一覧を返す
// =============================================================
import { NextResponse } from 'next/server';
import { listOutputs, listTrainingLogs } from '@/lib/sheet';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const sp = new URL(request.url).searchParams;
  const scope = sp.get('scope') === 'me' ? 'me' : 'all';
  const userId = sp.get('userId') || '';
  const limit = Math.max(1, Math.min(200, parseInt(sp.get('limit') || '50', 10) || 50));
  try {
    const [outputs, trainings] = await Promise.all([
      listOutputs({ scope, userId, limit }),
      listTrainingLogs({ scope, userId, limit }),
    ]);
    const items = [...outputs, ...trainings]
      .sort((a, b) => new Date(b.ts) - new Date(a.ts))
      .slice(0, limit);
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: String(err && err.message ? err.message : err), items: [] },
      { status: 500 }
    );
  }
}
