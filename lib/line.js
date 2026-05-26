// =============================================================
// lib/line.js
// LINE Messaging API ヘルパー（fetch + crypto のみ。SDK不要）
// 環境変数:
//   LINE_CHANNEL_ACCESS_TOKEN  長期チャネルアクセストークン
//   LINE_CHANNEL_SECRET        Webhook署名検証用のチャネルシークレット
// =============================================================

import crypto from 'crypto';

const API = 'https://api.line.me/v2/bot';

function token() {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!t) throw new Error('LINE_CHANNEL_ACCESS_TOKEN が未設定です。');
  return t;
}

// Webhook署名検証
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

// ── 返信系 ──

// テキスト返信（replyToken は1回・短時間のみ有効）
export async function replyText(replyToken, text) {
  const res = await fetch(`${API}/message/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: JSON.stringify({ replyToken, messages: chunk(text) }),
  });
  if (!res.ok) throw new Error(`LINE reply failed: ${res.status} ${await res.text()}`);
}

// メッセージオブジェクト配列で返信（Quick Reply, Flex等対応）
export async function replyMessages(replyToken, messages) {
  const res = await fetch(`${API}/message/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: JSON.stringify({ replyToken, messages: messages.slice(0, 5) }),
  });
  if (!res.ok) throw new Error(`LINE reply failed: ${res.status} ${await res.text()}`);
}

// 友だち全員へ一斉送信
export async function broadcastText(text) {
  const res = await fetch(`${API}/message/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: JSON.stringify({ messages: chunk(text) }),
  });
  if (!res.ok) throw new Error(`LINE broadcast failed: ${res.status} ${await res.text()}`);
}

// 特定ユーザーへプッシュ
export async function pushText(to, text) {
  const res = await fetch(`${API}/message/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: JSON.stringify({ to, messages: chunk(text) }),
  });
  if (!res.ok) throw new Error(`LINE push failed: ${res.status} ${await res.text()}`);
}

// 特定ユーザーへメッセージ配列でプッシュ（Quick Reply付き対応）
export async function pushMessages(to, messages) {
  const res = await fetch(`${API}/message/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: JSON.stringify({ to, messages: messages.slice(0, 5) }),
  });
  if (!res.ok) throw new Error(`LINE push failed: ${res.status} ${await res.text()}`);
}

// ユーザープロフィール取得（名前取得用）
export async function getUserProfile(userId) {
  const res = await fetch(`${API}/profile/${userId}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!res.ok) throw new Error(`LINE profile failed: ${res.status}`);
  return res.json();
}

// ── Quick Reply ヘルパー ──

// Quick Replyボタン付きテキストメッセージを作成
export function textWithQuickReply(text, items) {
  return {
    type: 'text',
    text,
    quickReply: {
      items: items.map((item) => ({
        type: 'action',
        action: item.data
          ? { type: 'postback', label: item.label.slice(0, 20), data: item.data, displayText: item.displayText || item.label }
          : { type: 'message', label: item.label.slice(0, 20), text: item.text || item.label },
      })),
    },
  };
}

// ── Rich Menu 作成 API ──

// リッチメニューを作成してmenuIdを返す
export async function createRichMenu(menuObj) {
  const res = await fetch(`${API}/richmenu`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: JSON.stringify(menuObj),
  });
  if (!res.ok) throw new Error(`createRichMenu failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// リッチメニューに画像をアップロード
export async function uploadRichMenuImage(richMenuId, imageBuffer, contentType = 'image/png') {
  const res = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, Authorization: `Bearer ${token()}` },
    body: imageBuffer,
  });
  if (!res.ok) throw new Error(`uploadRichMenuImage failed: ${res.status} ${await res.text()}`);
}

// デフォルトリッチメニューとして設定
export async function setDefaultRichMenu(richMenuId) {
  const res = await fetch(`${API}/user/all/richmenu/${richMenuId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!res.ok) throw new Error(`setDefaultRichMenu failed: ${res.status} ${await res.text()}`);
}

// ── ユーティリティ ──

// LINEは1メッセージ5000字・最大5通。長文は分割する。
function chunk(text) {
  const s = String(text || '');
  const out = [];
  for (let i = 0; i < s.length && out.length < 5; i += 4900) {
    out.push({ type: 'text', text: s.slice(i, i + 4900) });
  }
  return out.length ? out : [{ type: 'text', text: '(空)' }];
}

// 長文を分割してメッセージ配列で返す（Quick Reply付き最終メッセージ対応）
export function chunkMessages(text, quickReplyItems) {
  const s = String(text || '');
  const msgs = [];
  for (let i = 0; i < s.length && msgs.length < 5; i += 4900) {
    msgs.push({ type: 'text', text: s.slice(i, i + 4900) });
  }
  if (!msgs.length) msgs.push({ type: 'text', text: '(空)' });
  // Quick Reply は最後のメッセージにつける
  if (quickReplyItems && quickReplyItems.length > 0 && msgs.length > 0) {
    msgs[msgs.length - 1].quickReply = {
      items: quickReplyItems.map((item) => ({
        type: 'action',
        action: item.data
          ? { type: 'postback', label: item.label.slice(0, 20), data: item.data, displayText: item.displayText || item.label }
          : { type: 'message', label: item.label.slice(0, 20), text: item.text || item.label },
      })),
    };
  }
  return msgs;
}
