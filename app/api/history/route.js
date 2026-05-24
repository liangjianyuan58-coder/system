// =============================================================
// app/api/history/route.js
// GET /api/history?scope=all|me&userId=...&limit=30
//   「誰がどういう入力をしたか」の一覧を返す
// =============================================================
import { NextResponse } from 'next/server';
import { listOutputs } from '@/lib/sheet';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const sp = new URL(request.url).searchParams;
  const scope = sp.get('scope') === 'me' ? 'me' : 'all';
  const userId = sp.get('userId') || '';
  const limit = parseInt(sp.get('limit') || '30', 10);
  try {
    const items = await listOutputs({ scope, userId, limit: isNaN(limit) ? 30 : limit });
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: String(err && err.message ? err.message : err), items: [] },
      { status: 500 }
    );
  }
}
