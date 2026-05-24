// =============================================================
// lib/sheet.js
// Google スプレッドシート接続（サービスアカウント方式）
//   スキーマ: タイムスタンプ, ユーザーID, 名前, ①..⑦
//   ・ユーザーID を各行に保存 → 「誰が何を書いたか」を識別。
//   ・方式A（名前入力）でも方式B（LINE/LIFF）でも、この userId 列を使い回す。
// 環境変数: GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY / SHEET_ID
// =============================================================

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const C = {
  ts: 'タイムスタンプ',
  uid: 'ユーザーID',
  name: '名前',
  tup: '①T-UP',
  conclusion: '②結論',
  content: '③内容',
  example: '④一般的な例',
  workExample: '⑤稼働における例',
  reconclusion: '⑥再結論',
  ap: '⑦AP（アクションプラン）',
};
const HEADER = Object.values(C);

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key || !process.env.SHEET_ID) {
    throw new Error('環境変数が未設定です（GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY / SHEET_ID）。');
  }
  return new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
}

async function getSheet() {
  const doc = new GoogleSpreadsheet(process.env.SHEET_ID, getAuth());
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  await sheet.loadHeaderRow().catch(() => null);

  const hv = sheet.headerValues || [];
  if (hv.length === 0) {
    await sheet.setHeaderRow(HEADER);
  } else if (!hv.includes(C.uid)) {
    // 旧スキーマ。データが無ければ新スキーマへ更新（あれば互換のまま使う）
    const rows = await sheet.getRows();
    if (rows.length === 0) await sheet.setHeaderRow(HEADER);
  }
  return sheet;
}

// ── 日付ユーティリティ（JST基準） ──
function jstDate(d) {
  return new Date(new Date(d).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
function todayJST() {
  return jstDate(new Date());
}
// 日付集合から「今日(or 昨日)起点の連続日数」を算出
function computeStreak(daySet) {
  const today = todayJST();
  const doneToday = daySet.has(today);
  let streak = 0;
  const cursor = new Date(Date.now() + 9 * 3600 * 1000);
  if (!doneToday) cursor.setUTCDate(cursor.getUTCDate() - 1);
  for (let i = 0; i < 3650; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (daySet.has(key)) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
    else break;
  }
  return { streak, doneToday };
}

function rowToObj(r) {
  return {
    ts: r.get(C.ts) || '',
    userId: r.get(C.uid) || '',
    name: r.get(C.name) || '(名無し)',
    tup: r.get(C.tup) || '',
    conclusion: r.get(C.conclusion) || '',
    content: r.get(C.content) || '',
    example: r.get(C.example) || '',
    workExample: r.get(C.workExample) || '',
    reconclusion: r.get(C.reconclusion) || '',
    ap: r.get(C.ap) || '',
  };
}

// ── 書き込み ──
// data: { userId, name, tup, conclusion, content, example, workExample, reconclusion, ap }
export async function appendOutput(data) {
  const sheet = await getSheet();
  await sheet.addRow({
    [C.ts]: new Date().toISOString(),
    [C.uid]: data.userId || '',
    [C.name]: data.name || '(名無し)',
    [C.tup]: data.tup,
    [C.conclusion]: data.conclusion,
    [C.content]: data.content,
    [C.example]: data.example,
    [C.workExample]: data.workExample,
    [C.reconclusion]: data.reconclusion,
    [C.ap]: data.ap,
  });
  return getUserStats(data.userId);
}

// ── 個人別の集計（EXPは件数×10で route 側が算出） ──
export async function getUserStats(userId) {
  const sheet = await getSheet();
  const rows = await sheet.getRows();
  const mine = userId ? rows.filter((r) => (r.get(C.uid) || '') === userId) : [];
  const days = new Set(mine.map((r) => r.get(C.ts)).filter(Boolean).map(jstDate));
  const { streak, doneToday } = computeStreak(days);
  return {
    count: mine.length,        // 個人の累計アウトプット数
    streak,                    // 個人の連続日数
    doneToday,                 // 個人が今日記録済みか
    totalAll: rows.length,     // 全体の累計（参考）
  };
}

// ── 全体: 今日誰かが記録したか＋全体ストリーク（Cronのブロードキャスト用） ──
export async function getGlobalInfo() {
  const sheet = await getSheet();
  const rows = await sheet.getRows();
  const days = new Set(rows.map((r) => r.get(C.ts)).filter(Boolean).map(jstDate));
  const { streak, doneToday } = computeStreak(days);
  return { streak, doneToday, total: rows.length };
}

// ── 履歴一覧（誰が何を書いたか） ──
// opts: { scope: 'all'|'me', userId, limit }
export async function listOutputs({ scope = 'all', userId = '', limit = 30 } = {}) {
  const sheet = await getSheet();
  const rows = await sheet.getRows();
  let list = rows.map(rowToObj);
  if (scope === 'me') list = list.filter((o) => o.userId === userId);
  // 新しい順
  list.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  return list.slice(0, Math.max(1, Math.min(200, limit)));
}
