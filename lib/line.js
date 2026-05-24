// =============================================================
// lib/line.js
// LINE Messaging API ヘルパー（fetch + crypto のみ。SDK不要）
// 環境変数:
//   LINE_CHANNEL_ACCESS_TOKEN  長期チャネルアクセストークン
//   LINE_CHANNEL_SECRET        Webhook署名検証用のチャネルシークレット
// ※ LINE Notify は2025/3末で終了。現在は公式アカウント＋Messaging APIが必須。
// =============================================================

import crypto from 'crypto';

const API = 'https://api.line.me/v2/bot';

function token() {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!t) throw new Error('LINE_CHANNEL_ACCESS_TOKEN が未設定です。');
  return t;
}

// Webhook署名検証：x-line-signature と HMAC-SHA256(channelSecret, rawBody) を比較
export function verifySignature(rawBody, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
  } catch {
    return false;
  }
}

// 返信（replyToken は1回・短時間のみ有効）
export async function replyText(replyToken, text) {
  const res = await fetch(`${API}/message/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: JSON.stringify({ replyToken, messages: chunk(text) }),
  });
  if (!res.ok) throw new Error(`LINE reply failed: ${res.status} ${await res.text()}`);
}

// 友だち全員へ一斉送信（個別ID不要）
export async function broadcastText(text) {
  const res = await fetch(`${API}/message/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: JSON.stringify({ messages: chunk(text) }),
  });
  if (!res.ok) throw new Error(`LINE broadcast failed: ${res.status} ${await res.text()}`);
}

// 特定ユーザーへプッシュ（将来の個別通知用）
export async function pushText(to, text) {
  const res = await fetch(`${API}/message/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: JSON.stringify({ to, messages: chunk(text) }),
  });
  if (!res.ok) throw new Error(`LINE push failed: ${res.status} ${await res.text()}`);
}

// LINEは1メッセージ5000字・最大5通。長文は分割する。
function chunk(text) {
  const s = String(text || '');
  const out = [];
  for (let i = 0; i < s.length && out.length < 5; i += 4900) {
    out.push({ type: 'text', text: s.slice(i, i + 4900) });
  }
  return out.length ? out : [{ type: 'text', text: '(空)' }];
}
