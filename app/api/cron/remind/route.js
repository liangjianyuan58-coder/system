// =============================================================
// app/api/cron/remind/route.js
// GET /api/cron/remind : Vercel Cron から毎日呼ばれ、
//   今日まだ誰も記録していなければ友だち全員へ一斉リマインド。
//   不正実行防止に CRON_SECRET をチェック（?key= または Bearer）。
// =============================================================
import { NextResponse } from 'next/server';
import { getGlobalInfo } from '@/lib/sheet';
import { broadcastText } from '@/lib/line';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const url = new URL(request.url);
  if (url.searchParams.get('key') === secret) return true;
  return (request.headers.get('authorization') || '') === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!authorized(request)) return new NextResponse('unauthorized', { status: 401 });
  try {
    const info = await getGlobalInfo();
    if (info.doneToday) return NextResponse.json({ ok: true, sent: false, reason: '本日は記録済み' });
    const streakLine = info.streak > 0
      ? `今の連続記録は ${info.streak}日。ここで止めるのはもったいない！`
      : '今日が再スタートの1日目。';
    await broadcastText(
      '🔥 Have fun リマインド\n今日のアウトプット、まだ誰も出してないよ。\n' +
      streakLine + '\n1件でいい。今この瞬間を「楽しむ工夫」に変えて、サクッと記録しにいこう！'
    );
    return NextResponse.json({ ok: true, sent: true, streak: info.streak });
  } catch (err) {
    return NextResponse.json({ ok: false, message: String(err && err.message ? err.message : err) }, { status: 500 });
  }
}
