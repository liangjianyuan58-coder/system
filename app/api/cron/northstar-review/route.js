// =============================================================
// app/api/cron/northstar-review/route.js
// GET → 毎週月曜 10:00 JST に Vercel Cron から呼ばれ、
//   北極星を登録済みの LINE ユーザー全員へ AI 振り返りをプッシュ。
//   認証: CRON_SECRET (?key= または Bearer)
// =============================================================
import { NextResponse } from 'next/server';
import { getAllNorthStars, getRecentOutputs } from '@/lib/sheet';
import { northStarReview } from '@/lib/gemini';
import { pushText } from '@/lib/line';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const url = new URL(request.url);
  if (url.searchParams.get('key') === secret) return true;
  return (request.headers.get('authorization') || '') === `Bearer ${secret}`;
}

function formatReview(name, northStar, review) {
  return (
    `⭐ 北極星 週次振り返り\n` +
    `${name ? name + 'さんの' : ''}北極星：\n「${northStar}」\n\n` +
    `整合度: ${review.alignment ?? '-'} / 10\n\n` +
    `📝 ${review.comment || ''}\n\n` +
    `✅ 良かった点:\n${review.good || '-'}\n\n` +
    `💡 課題:\n${review.challenge || '-'}\n\n` +
    `🎯 来週のAP:\n${review.nextAP || '-'}`
  );
}

export async function GET(request) {
  if (!authorized(request)) return new NextResponse('unauthorized', { status: 401 });
  try {
    const allStars = await getAllNorthStars();
    const lineUsers = allStars.filter((s) => s.lineUserId);
    if (lineUsers.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, reason: 'LINE ユーザーなし' });
    }

    let sent = 0;
    let errors = 0;
    for (const user of lineUsers) {
      try {
        const recentOutputs = await getRecentOutputs(user.userId, 7);
        const review = await northStarReview(user.northStar, recentOutputs);
        const msg = formatReview(user.name, user.northStar, review);
        await pushText(user.lineUserId, msg);
        sent++;
      } catch (_) {
        errors++;
      }
    }
    return NextResponse.json({ ok: true, sent, errors });
  } catch (err) {
    return NextResponse.json({ ok: false, message: String(err?.message || err) }, { status: 500 });
  }
}
