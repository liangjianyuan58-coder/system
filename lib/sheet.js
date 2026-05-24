// =============================================================
// lib/sheet.js
// Google スプレッドシート接続（サービスアカウント方式）
//   スキーマ: タイムスタンプ, ユーザーID, 名前, ①..⑦
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

// 秘密鍵を正規化：どの貼り方でも OpenSSL が読める PEM に整える。
//  - 前後の余計なダブル/シングルクオートを除去
//  - リテラルの \n（2文字）を本物の改行へ
//  - \r\n / \r を \n に統一
//  - 改行が潰れて1行になった鍵を 64文字ごとに折り返して復元
function normalizePrivateKey(raw) {
  let k = (raw || '').trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1);
  }
  k = k.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n');
  k = k.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const begin = '-----BEGIN PRIVATE KEY-----';
  const end = '-----END PRIVATE KEY-----';
  if (k.includes(begin) && k.includes(end)) {
    const body = k.slice(k.indexOf(begin) + begin.length, k.indexOf(end)).replace(/\s+/g, '');
    if (body && !k.slice(begin.length, k.indexOf(end)).includes('\n')) {
      const wrapped = body.match(/.{1,64}/g).join('\n');
      k = `${begin}\n${wrapped}\n${end}\n`;
    }
  }
  if (!k.endsWith('\n')) k += '\n';
  return k;
}

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY);
  if (!email || !key.trim() || !process.env.SHEET_ID) {
    throw new Error('環境変数が未設定です（GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY / SHEET_ID）。');
  }
  if (!key.includes('BEGIN PRIVATE KEY')) {
    throw new Error('GOOGLE_PRIVATE_KEY の形式が不正です（JSONの private_key の値をそのまま設定してください）。');
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
    await sheet.loadHeaderRow();
  } else if (!hv.includes(C.uid)) {
    const rows = await sheet.getRows();
    if (rows.length === 0) {
      await sheet.setHeaderRow(HEADER);
      await sheet.loadHeaderRow();
    }
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

// ── 個人別の集計 ──
export async function getUserStats(userId) {
  const sheet = await getSheet();
  const rows = await sheet.getRows();
  const mine = userId ? rows.filter((r) => (r.get(C.uid) || '') === userId) : [];
  const days = new Set(mine.map((r) => r.get(C.ts)).filter(Boolean).map(jstDate));
  const { streak, doneToday } = computeStreak(days);
  return { count: mine.length, streak, doneToday, totalAll: rows.length };
}

// ── 全体情報（Cron用） ──
export async function getGlobalInfo() {
  const sheet = await getSheet();
  const rows = await sheet.getRows();
  const days = new Set(rows.map((r) => r.get(C.ts)).filter(Boolean).map(jstDate));
  const { streak, doneToday } = computeStreak(days);
  return { streak, doneToday, total: rows.length };
}

// ── 履歴一覧 ──
export async function listOutputs({ scope = 'all', userId = '', limit = 30 } = {}) {
  const sheet = await getSheet();
  const rows = await sheet.getRows();
  let list = rows.map(rowToObj);
  if (scope === 'me') list = list.filter((o) => o.userId === userId);
  list.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  return list.slice(0, Math.max(1, Math.min(200, limit)));
}
