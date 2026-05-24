// =============================================================
// lib/line-session.js
// LINE Bot 用セッション管理（in-memory / TTL付き）
// Vercel Serverless では同一インスタンス内で保持。
// コールドスタートでクリアされるが、Quick Replyフローなら問題なし。
// =============================================================

const SESSION_TTL = 5 * 60 * 1000; // 5分

// { userId: { action, moduleId, extra, createdAt } }
const sessions = new Map();

export function getSession(userId) {
  const s = sessions.get(userId);
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL) {
    sessions.delete(userId);
    return null;
  }
  return s;
}

export function setSession(userId, data) {
  sessions.set(userId, { ...data, createdAt: Date.now() });
}

export function clearSession(userId) {
  sessions.delete(userId);
}

// 古いセッションを定期的にクリーンアップ（メモリリーク防止）
export function cleanupSessions() {
  const now = Date.now();
  for (const [uid, s] of sessions) {
    if (now - s.createdAt > SESSION_TTL) sessions.delete(uid);
  }
}
