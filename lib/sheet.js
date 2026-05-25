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

  let loaded = false;
  try {
    await sheet.loadHeaderRow();
    loaded = true;
  } catch (_) {}

  const hv = loaded ? (sheet.headerValues || []) : [];
  if (hv.length === 0 || !hv.includes(C.uid)) {
    if (!loaded || hv.length === 0) {
      await sheet.setHeaderRow(HEADER);
    } else {
      const rows = await sheet.getRows();
      if (rows.length === 0) await sheet.setHeaderRow(HEADER);
    }
    await sheet.loadHeaderRow();
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

// ── 直近のAP一覧（北極星振り返り用） ──
export async function getRecentOutputs(userId, days = 7) {
  const sheet = await getSheet();
  const rows = await sheet.getRows();
  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000);
  return rows
    .filter((r) => {
      const uid = r.get(C.uid) || '';
      const ts = r.get(C.ts) || '';
      return uid === userId && ts && new Date(ts) >= cutoff;
    })
    .map((r) => r.get(C.ap) || '')
    .filter(Boolean);
}

// ══════════════════════════════════════
// 北極星シート
// ══════════════════════════════════════

const NS = {
  uid: 'ユーザーID',
  lineUid: 'LINE_ユーザーID',
  name: '名前',
  star: '北極星',
  updatedAt: '更新日時',
};
const NS_HEADER = Object.values(NS);

async function getNorthStarSheet() {
  const doc = new GoogleSpreadsheet(process.env.SHEET_ID, getAuth());
  await doc.loadInfo();
  let sheet = doc.sheetsByTitle['北極星'];
  if (!sheet) {
    sheet = await doc.addSheet({ title: '北極星', headerValues: NS_HEADER });
  } else {
    let loaded = false;
    try { await sheet.loadHeaderRow(); loaded = true; } catch (_) {}
    const hv = loaded ? (sheet.headerValues || []) : [];
    if (hv.length === 0 || !hv.includes(NS.uid)) {
      await sheet.setHeaderRow(NS_HEADER);
      await sheet.loadHeaderRow();
    }
  }
  return sheet;
}

export async function getNorthStar(userId) {
  if (!userId) return null;
  const sheet = await getNorthStarSheet();
  const rows = await sheet.getRows();
  const row = rows.find((r) => (r.get(NS.uid) || '') === userId);
  if (!row) return null;
  return {
    userId: row.get(NS.uid) || '',
    lineUserId: row.get(NS.lineUid) || '',
    name: row.get(NS.name) || '',
    northStar: row.get(NS.star) || '',
    updatedAt: row.get(NS.updatedAt) || '',
  };
}

export async function setNorthStar(userId, lineUserId, name, northStar) {
  if (!userId) throw new Error('userId は必須です。');
  const sheet = await getNorthStarSheet();
  const rows = await sheet.getRows();
  const row = rows.find((r) => (r.get(NS.uid) || '') === userId);
  const now = new Date().toISOString();
  if (row) {
    if (lineUserId) row.set(NS.lineUid, lineUserId);
    if (name) row.set(NS.name, name);
    row.set(NS.star, northStar);
    row.set(NS.updatedAt, now);
    await row.save();
  } else {
    await sheet.addRow({
      [NS.uid]: userId,
      [NS.lineUid]: lineUserId || '',
      [NS.name]: name || '',
      [NS.star]: northStar,
      [NS.updatedAt]: now,
    });
  }
}

export async function getAllNorthStars() {
  const sheet = await getNorthStarSheet();
  const rows = await sheet.getRows();
  return rows
    .map((r) => ({
      userId: r.get(NS.uid) || '',
      lineUserId: r.get(NS.lineUid) || '',
      name: r.get(NS.name) || '',
      northStar: r.get(NS.star) || '',
      updatedAt: r.get(NS.updatedAt) || '',
    }))
    .filter((r) => r.userId && r.northStar);
}
