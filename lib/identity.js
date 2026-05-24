// =============================================================
// lib/identity.js
// ユーザー識別（方式A：名前入力）。クライアント専用。
//   - userId: 端末に一度だけ発行して localStorage に保存（重複名でも区別可能）
//   - name  : 表示名。いつでも変更可。
// ★方式B（LINE/LIFF）へ移行する際は、ここを「LINEのuserID・表示名を返す」実装に
//   差し替えるだけ。アプリ側の {userId, name} 契約は不変。
// =============================================================

const KEY_ID = 'hf_userId';
const KEY_NAME = 'hf_name';

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function getOrCreateUserId() {
  if (typeof window === 'undefined') return '';
  let id = window.localStorage.getItem(KEY_ID);
  if (!id) { id = uuid(); window.localStorage.setItem(KEY_ID, id); }
  return id;
}

export function loadName() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(KEY_NAME) || '';
}

export function saveName(name) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY_NAME, (name || '').trim());
}
