// =============================================================
// app/api/line/webhook/route.js
// LINE Messaging API Webhook
//   ユーザーが送ったテキストを「リフレーミング/こじつけ」として受け取り、
//   Gemini で添削FB＋お手本を返信する（LINE上でのミニ筋トレ）。
//   ※署名検証あり。LINE Notify は2025/3終了のため Messaging API を使用。
// =============================================================
import { NextResponse } from 'next/server';
import { verifySignature, replyText } from '@/lib/line';
import { reframeFeedback } from '@/lib/gemini';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  // 生ボディで署名検証
  const raw = await request.text();
  const signature = request.headers.get('x-line-signature');
  if (!verifySignature(raw, signature)) {
    return new NextResponse('invalid signature', { status: 401 });
  }

  let body;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }
  const events = Array.isArray(body.events) ? body.events : [];

  // 各イベントを処理（reply は失敗しても200を返してLINEの再送を防ぐ）
  await Promise.all(
    events.map(async (ev) => {
      try {
        if (ev.type === 'follow') {
          await replyText(ev.replyToken,
            '友だち追加ありがとう！ここはハブファンの筋トレ部屋。\n' +
            '現場のネガ事象や、その捉え直し（リフレーミング）を送ってくれたら、プロマネージャー基準で添削＆お手本を返すよ。まず1つ送ってみて！');
          return;
        }
        if (ev.type === 'message' && ev.message?.type === 'text') {
          const text = ev.message.text.trim();
          const fb = await reframeFeedback('（ユーザーがLINEで自由に送った状況/捉え方）', text);
          const msg =
            `🎯 こじつけ/リフレーミング査定：${fb.score}/10\n\n` +
            `◎Good\n${fb.good || '-'}\n\n` +
            `△もっと\n${fb.improvement || '-'}\n\n` +
            `★お手本\n${fb.example || '-'}`;
          await replyText(ev.replyToken, msg);
        }
      } catch (e) {
        try { if (ev.replyToken) await replyText(ev.replyToken, '今ちょっと添削に失敗した…もう一度送ってみて！'); } catch {}
      }
    })
  );

  return NextResponse.json({ ok: true });
}

// LINEの接続確認(GET)用
export async function GET() {
  return NextResponse.json({ ok: true, message: 'LINE webhook is alive' });
}
