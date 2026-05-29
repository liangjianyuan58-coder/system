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
  type: '種別',
  tup: '①T-UP',
  conclusion: '②結論',
  content: '③内容',
  example: '④一般的な例',
  workExample: '⑤稼働における例',
  reconclusion: '⑥再結論',
  apTup: 'APのT-UP',
  ap: '⑦AP（アクションプラン）',
  // AI採点結果
  module: 'モジュール',
  total: '合計点',
  verdict: '判定',
  good: 'Good',
  improvements: '改善ポイント',
  comment: 'コメント',
  // 他機能（こじつけ/リフレーム/逆質問）
  keyword: 'キーワード/事象',
  userInput: 'ユーザー入力',
  aiExample: 'AIお手本',
  // 結果ページ用
  id: '結果ID',
  rawJson: '採点詳細JSON',
  resultUrl: '結果URL',
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

  // 既存シートに新しい列が足りなければ末尾に追加
  const currentHeaders = sheet.headerValues || [];
  const missingHeaders = HEADER.filter((h) => !currentHeaders.includes(h));
  if (missingHeaders.length > 0) {
    try {
      await sheet.setHeaderRow([...currentHeaders, ...missingHeaders]);
      await sheet.loadHeaderRow();
    } catch (err) {
      console.error('[getSheet] 列追加失敗（既存スキーマで続行）:', err?.message || err);
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
    type: r.get(C.type) || '',
    tup: r.get(C.tup) || '',
    conclusion: r.get(C.conclusion) || '',
    content: r.get(C.content) || '',
    example: r.get(C.example) || '',
    workExample: r.get(C.workExample) || '',
    reconclusion: r.get(C.reconclusion) || '',
    apTup: r.get(C.apTup) || '',
    ap: r.get(C.ap) || '',
    module: r.get(C.module) || '',
    total: r.get(C.total) || '',
    verdict: r.get(C.verdict) || '',
    good: r.get(C.good) || '',
    improvements: r.get(C.improvements) || '',
    comment: r.get(C.comment) || '',
    keyword: r.get(C.keyword) || '',
    userInput: r.get(C.userInput) || '',
    aiExample: r.get(C.aiExample) || '',
    id: r.get(C.id) || '',
    rawJson: r.get(C.rawJson) || '',
    resultUrl: r.get(C.resultUrl) || '',
  };
}

// ── 書き込み ──
export async function appendOutput(data) {
  const sheet = await getSheet();
  const id = data.id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  await sheet.addRow({
    [C.ts]: new Date().toISOString(),
    [C.uid]: data.userId || '',
    [C.name]: data.name || '(名無し)',
    [C.type]: '採点',
    [C.tup]: data.tup,
    [C.conclusion]: data.conclusion,
    [C.content]: data.content,
    [C.example]: data.example,
    [C.workExample]: data.workExample,
    [C.reconclusion]: data.reconclusion,
    [C.apTup]: data.apTup || '',
    [C.ap]: data.ap,
    [C.module]: data.module || '',
    [C.total]: data.total != null ? String(data.total) : '',
    [C.verdict]: data.verdict || '',
    [C.good]: data.good || '',
    [C.improvements]: data.improvements || '',
    [C.comment]: data.comment || '',
    [C.id]: id,
    [C.rawJson]: data.rawJson || '',
    [C.resultUrl]: data.resultUrl || '',
  });
  const stats = await getUserStats(data.userId);
  return { ...stats, id };
}

// ── IDで採点結果を取得（結果ページ用）──
export async function getOutputById(id) {
  if (!id) return null;
  const sheet = await getSheet();
  const rows = await sheet.getRows();
  const row = rows.find((r) => (r.get(C.id) || '') === id);
  return row ? rowToObj(row) : null;
}

// こじつけ / リフレーム / 逆質問 など採点以外の活動を記録
export async function appendActivity(data) {
  const sheet = await getSheet();
  await sheet.addRow({
    [C.ts]: new Date().toISOString(),
    [C.uid]: data.userId || '',
    [C.name]: data.name || '(名無し)',
    [C.type]: data.type || '',
    [C.module]: data.module || '',
    [C.keyword]: data.keyword || '',
    [C.userInput]: data.userInput || '',
    [C.total]: data.total != null ? String(data.total) : '',
    [C.good]: data.good || '',
    [C.improvements]: data.improvements || '',
    [C.comment]: data.comment || '',
    [C.aiExample]: data.aiExample || '',
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
