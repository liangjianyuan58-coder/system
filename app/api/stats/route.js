// =============================================================
// app/api/stats/route.js
// GET /api/stats?userId=... : その人のEXP＋連続記録を返す
// =============================================================
import { NextResponse } from 'next/server';
import { getUserStats } from '@/lib/sheet';
import { calcStats, EXP_PER_OUTPUT, getModule } from '@/lib/havefun-data';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const userId = new URL(request.url).searchParams.get('userId') || '';
  try {
    const u = await getUserStats(userId);
    const stats = calcStats(u.count * EXP_PER_OUTPUT);
    return NextResponse.json({
      ok: true, ...stats, streak: u.streak, doneToday: u.doneToday,
      totalAll: u.totalAll, module: getModule(),
    });
  } catch (err) {
    return NextResponse.json({
      ok: false, message: String(err && err.message ? err.message : err),
      ...calcStats(0), streak: 0, doneToday: false, totalAll: 0, module: getModule(),
    });
  }
}
