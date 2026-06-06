// =============================================================
// lib/strengths.js
// 強みプロフィール — Google Sheets に「強みプロフィール」シートを作成し
// ユーザーごとの強みをJSON形式で1行に保持（upsert）
// 環境変数: GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY / SHEET_ID
// =============================================================

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const SHEET_TITLE = '強みプロフィール';

const C = {
  userId: 'userId',
  name: 'name',
  strengthsJson: 'strengthsJson',
  updatedAt: 'updatedAt',
};
const HEADER = Object.values(C);

const STEP_LABELS = {
  tup: 'T-UP',
  conclusion: '結論',
  content: '内容',
  example: '一般例',
  workExample: '稼働例',
  reconclusion: '再結論',
  apTup: 'APのT-UP',
  ap: 'AP',
};

// 秘密鍵を正規化（lib/sheet.js と同じパターン）
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

async function getStrengthsSheet() {
  const doc = new GoogleSpreadsheet(process.env.SHEET_ID, getAuth());
  await doc.loadInfo();

  // シートが存在するか確認、なければ作成
  let sheet = doc.sheetsByTitle[SHEET_TITLE];
  if (!sheet) {
    sheet = await doc.addSheet({ title: SHEET_TITLE, headerValues: HEADER });
    await sheet.loadHeaderRow();
    return sheet;
  }

  let loaded = false;
  try {
    await sheet.loadHeaderRow();
    loaded = true;
  } catch (_) {}

  const hv = loaded ? (sheet.headerValues || []) : [];
  if (hv.length === 0 || !hv.includes(C.userId)) {
    if (!loaded || hv.length === 0) {
      await sheet.setHeaderRow(HEADER);
    } else {
      const rows = await sheet.getRows();
      if (rows.length === 0) await sheet.setHeaderRow(HEADER);
    }
    await sheet.loadHeaderRow();
  }

  // 不足している列を追加
  const currentHeaders = sheet.headerValues || [];
  const missingHeaders = HEADER.filter((h) => !currentHeaders.includes(h));
  if (missingHeaders.length > 0) {
    try {
      await sheet.setHeaderRow([...currentHeaders, ...missingHeaders]);
      await sheet.loadHeaderRow();
    } catch (err) {
      console.error('[getStrengthsSheet] 列追加失敗:', err?.message || err);
    }
  }

  return sheet;
}

// ── ユーザーの強みを取得 ──
export async function getStrengths(userId) {
  try {
    if (!userId) return [];
    const sheet = await getStrengthsSheet();
    const rows = await sheet.getRows();
    const row = rows.find((r) => (r.get(C.userId) || '') === userId);
    if (!row) return [];
    const raw = row.get(C.strengthsJson) || '[]';
    try {
      return JSON.parse(raw);
    } catch (_) {
      return [];
    }
  } catch (err) {
    console.error('[getStrengths] エラー:', err?.message || err);
    return [];
  }
}

// ── 強みを更新し退行を検出 ──
export async function updateStrengths(userId, name, stepNotes, scores) {
  try {
    if (!userId || !stepNotes || !scores) return { updated: [], regressions: [] };

    const sheet = await getStrengthsSheet();
    const rows = await sheet.getRows();
    const existingRow = rows.find((r) => (r.get(C.userId) || '') === userId);

    // 現在保存されている強みを読み込む
    let strengths = [];
    if (existingRow) {
      try {
        strengths = JSON.parse(existingRow.get(C.strengthsJson) || '[]');
      } catch (_) {
        strengths = [];
      }
    }

    const now = new Date().toISOString();
    const regressions = [];

    // 各ステップを処理
    for (const [key, note] of Object.entries(stepNotes)) {
      if (!note) continue;
      const score = scores[key];
      const label = STEP_LABELS[key] || key;

      // 退行チェック：count >= 2 かつ新スコア <= 6
      const existingIdx = strengths.findIndex((s) => s.key === key);
      if (existingIdx >= 0) {
        const existing = strengths[existingIdx];
        if (existing.count >= 2 && score != null && score <= 6) {
          regressions.push({
            key,
            label,
            prevScore: existing.score,
            newScore: score,
            description: existing.description,
          });
          // 退行情報を記録
          strengths[existingIdx] = {
            ...existing,
            lastRegressionScore: score,
            lastRegressionAt: now,
          };
        }
      }

      // 強みの追加/更新：note.good が存在 かつ スコア >= 8
      if (note.good && score != null && score >= 8) {
        if (existingIdx >= 0) {
          // 既存エントリを更新
          strengths[existingIdx] = {
            ...strengths[existingIdx],
            description: note.good,
            score,
            count: (strengths[existingIdx].count || 0) + 1,
            updatedAt: now,
          };
        } else {
          // 新規エントリを追加
          strengths.push({
            key,
            label,
            description: note.good,
            score,
            count: 1,
            updatedAt: now,
          });
        }
      }
    }

    // シートに保存（upsert）
    const strengthsJson = JSON.stringify(strengths);
    if (existingRow) {
      existingRow.set(C.name, name || '');
      existingRow.set(C.strengthsJson, strengthsJson);
      existingRow.set(C.updatedAt, now);
      await existingRow.save();
    } else {
      await sheet.addRow({
        [C.userId]: userId,
        [C.name]: name || '',
        [C.strengthsJson]: strengthsJson,
        [C.updatedAt]: now,
      });
    }

    return { updated: strengths, regressions };
  } catch (err) {
    console.error('[updateStrengths] エラー:', err?.message || err);
    return { updated: [], regressions: [] };
  }
}
