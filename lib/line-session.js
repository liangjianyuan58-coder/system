// =============================================================
// lib/line-session.js
// LINE Bot 用セッション管理（ハイブリッド: in-memory 主 + Sheets バックアップ）
// - in-memory は同期・即時・絶対に失敗しない
// - Sheets への読み書きは fire-and-forget（コールドスタート時の復元用）
// =============================================================

import { getLineSession as sheetGet, setLineSession as sheetSet, clearLineSession as sheetClear } from './sheet';

const SESSION_TTL = 10 * 60 * 1000; // 10分

// { userId: { action, moduleId, extra, createdAt } }
const sessions = new Map();

// セッションを取得。メモリになければ Sheets から復元を試みる。
export async function getSession(userId) {
  const mem = sessions.get(userId);
  if (mem) {
    if (Date.now() - mem.createdAt <= SESSION_TTL) return mem;
    sessions.delete(userId);
  }
  // コールドスタート時: Sheets からフォールバック取得
  try {
    const s = await sheetGet(userId);
    if (s) sessions.set(userId, { ...s, createdAt: Date.now() });
    return s || null;
  } catch {
    return null;
  }
}

// セッションを保存。in-memory は同期・Sheets は非同期バックアップ。
export function setSession(userId, data) {
  sessions.set(userId, { ...data, createdAt: Date.now() });
  sheetSet(userId, data).catch(() => {});
}

// セッションを削除。in-memory は同期・Sheets は非同期バックアップ。
export function clearSession(userId) {
  sessions.delete(userId);
  sheetClear(userId).catch(() => {});
}
