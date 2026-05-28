// =============================================================
// app/api/line/webhook/route.js
// LINE Messaging API Webhook — フル機能対応
//   #採点 / #お手本 / #こじつけ / #リフレーム / #逆質問
//   + モジュール選択 Quick Reply + セッション管理
// =============================================================
import { NextResponse } from 'next/server';
import { verifySignature, replyText, replyMessages, pushText, pushMessages, textWithQuickReply, chunkMessages, getUserProfile } from '@/lib/line';
import { gradeOutput, kojitsukeFeedback, reframeFeedback, modelScript } from '@/lib/gemini';
import { MODULES, MODULE_CATEGORIES, ACTIVE_MODULE } from '@/lib/havefun-data';
import { getSession, setSession, clearSession, cleanupSessions } from '@/lib/line-session';
import { appendOutput, appendActivity } from '@/lib/sheet';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// デバッグ用バージョン番号（エラーメッセージに含めてどのコードが動いているか確認）
const CODE_VERSION = 'v4';

// ══════════════════════════════════════
// 安全な送信ヘルパー
// ══════════════════════════════════════

// 「処理中」メッセージ: 失敗しても無視（結果は push で届く）
async function replyProcessing(replyToken, text) {
  try { await replyText(replyToken, text); } catch {}
}

// 通常の即時返信: 失敗したら push にフォールバック
async function safeReply(replyToken, userId, text) {
  try {
    await replyText(replyToken, text);
  } catch {
    if (userId) await pushText(userId, text).catch(() => {});
  }
}

// 通常の即時返信（メッセージ配列）
async function safeReplyMessages(replyToken, userId, messages) {
  try {
    await replyMessages(replyToken, messages);
  } catch {
    if (userId) await pushMessages(userId, messages).catch(() => {});
  }
}

// エラー通知（常に push）
async function sendError(userId, message) {
  if (userId) await pushText(userId, `⚠️ ${message}`).catch(() => {});
}

// ── テキストの【モジュール名】ヘッダーからmoduleIdを特定 ──
function detectModuleId(text) {
  const match = text.match(/^【([^】]+)】/);
  if (!match) return null;
  const title = match[1];
  return Object.keys(MODULES).find((mid) => MODULES[mid].manual.title === title) || null;
}

// ── カテゴリ Quick Reply 生成（1段階目）──
function categoryQuickReplyItems(commandPrefix) {
  return MODULE_CATEGORIES.map((cat) => ({
    label: cat.label,
    data: `${commandPrefix}_cat:${cat.label}`,
    displayText: cat.label,
  }));
}

// ── カテゴリ内モジュール Quick Reply 生成（2段階目）──
function modulesInCategory(commandPrefix, categoryLabel) {
  const cat = MODULE_CATEGORIES.find((c) => c.label === categoryLabel);
  if (!cat) return [];
  return cat.modules.map((mid) => {
    const mod = MODULES[mid];
    if (!mod) return null;
    return {
      label: mod.manual.title,
      data: `${commandPrefix}:${mid}`,
      displayText: mod.manual.title,
    };
  }).filter(Boolean);
}

// ── 7ステップ入力テンプレート ──
function gradeTemplate(moduleId) {
  const mod = MODULES[moduleId];
  const name = mod.manual.title;
  return `【${name}】8ステップを以下のフォーマットで送ってください：\n\n` +
    `1.T-UP:\n（ここに入力）\n\n` +
    `2.結論:\n（ここに入力）\n\n` +
    `3.内容:\n（ここに入力）\n\n` +
    `4.一般的な例:\n（ここに入力）\n\n` +
    `5.稼働における例:\n（ここに入力）\n\n` +
    `6.再結論:\n（ここに入力）\n\n` +
    `7.APのT-UP:\n（ここに入力）\n\n` +
    `8.AP:\n（ここに入力）\n\n` +
    `※上記をコピーして各項目を埋めて送信！`;
}

// ── 7ステップのテキストをパース ──
function parseSevenSteps(text) {
  const keys = ['tup', 'conclusion', 'content', 'example', 'workExample', 'reconclusion', 'apTup', 'ap'];
  const result = {};

  // 番号付き行でスプリット: "1." ... "8."（全角・半角・スペースあり対応）
  const parts = text.split(/(?:^|\n)\s*[１-８1-8]\s*[.．:：\s]/);

  if (parts.length >= 9) {
    // 8ステップ: parts[0] はヘッダー、parts[1]〜parts[8] が各ステップ
    for (let i = 0; i < 8; i++) {
      result[keys[i]] = (parts[i + 1] || '').replace(/^[^\n]*[\n]/, '').trim()
        || (parts[i + 1] || '').replace(/^[^:：]*[：:]?\s*/, '').trim();
    }
  } else if (parts.length >= 8) {
    // 7ステップ（旧フォーマット互換）: apTup は空、ap を7番目に割り当て
    const oldKeys = ['tup', 'conclusion', 'content', 'example', 'workExample', 'reconclusion', 'ap'];
    for (let i = 0; i < 7; i++) {
      result[oldKeys[i]] = (parts[i + 1] || '').replace(/^[^\n]*[\n]/, '').trim()
        || (parts[i + 1] || '').replace(/^[^:：]*[：:]?\s*/, '').trim();
    }
  } else {
    // スプリットがうまくいかない場合: ラベルで区切って取り出す
    const stepMarkers = [
      { key: 'tup', patterns: [/(?:^|\n)\s*1\s*[.．:：]?\s*T[-\s]?UP[^:：\n]*[：:]?\s*/i] },
      { key: 'conclusion', patterns: [/(?:^|\n)\s*2\s*[.．:：]?\s*結論[^:：\n]*[：:]?\s*/i] },
      { key: 'content', patterns: [/(?:^|\n)\s*3\s*[.．:：]?\s*内容[^:：\n]*[：:]?\s*/i] },
      { key: 'example', patterns: [/(?:^|\n)\s*4\s*[.．:：]?\s*一般[^:：\n]*[：:]?\s*/i] },
      { key: 'workExample', patterns: [/(?:^|\n)\s*5\s*[.．:：]?\s*稼働[^:：\n]*[：:]?\s*/i] },
      { key: 'reconclusion', patterns: [/(?:^|\n)\s*6\s*[.．:：]?\s*再結論[^:：\n]*[：:]?\s*/i] },
      { key: 'apTup', patterns: [/(?:^|\n)\s*7\s*[.．:：]?\s*AP[のノ]T[-\s]?UP[^:：\n]*[：:]?\s*/i] },
      { key: 'ap', patterns: [/(?:^|\n)\s*8\s*[.．:：]?\s*AP[^のノT:：\n]*[：:]?\s*/i, /(?:^|\n)\s*7\s*[.．:：]?\s*AP[^のノT:：\n]*[：:]?\s*/i] },
    ];

    const positions = stepMarkers.map(({ key, patterns }) => {
      for (const pat of patterns) {
        const m = text.match(pat);
        if (m) return { key, index: m.index + m[0].length - (m[0].endsWith('\n') ? 1 : 0), matchLen: m[0].length };
      }
      return { key, index: -1, matchLen: 0 };
    }).filter((p) => p.index >= 0).sort((a, b) => a.index - b.index);

    for (let i = 0; i < positions.length; i++) {
      const start = positions[i].index;
      const end = i + 1 < positions.length ? positions[i + 1].index - positions[i + 1].matchLen : text.length;
      result[positions[i].key] = text.slice(start, end).trim();
    }

    if (!result.ap) {
      const apMatch = text.match(/(?:[78]\s*[.．]?\s*)?AP[：:][^\n]*\n?([\s\S]*?)$/i);
      if (apMatch) result.ap = apMatch[1].trim();
    }
  }

  for (const k of keys) {
    if (!result[k]) result[k] = '';
  }

  return result;
}

// ── 採点を実行して結果を送る共通処理（採点+スプレッドシート記録）──
// replyToken があればまず reply で試み、失敗時のみ push にフォールバック
async function runGrade(userId, replyToken, moduleId, steps) {
  try {
    const fb = await gradeOutput(steps);
    const modName = MODULES[moduleId]?.manual?.title || '';

    // 結果IDを事前生成してスプレッドシートに保存（成功時のみURLをLINEに含める）
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
    const resultId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const candidateUrl = appUrl ? `${appUrl}/result/${resultId}` : null;
    let resultUrl = null; // 保存成功後にのみ確定

    try {
      const profile = await getUserProfile(userId);
      const displayName = profile?.displayName || '(名無し)';
      await appendOutput({
        id: resultId,
        userId,
        name: displayName,
        tup: steps.tup || '',
        conclusion: steps.conclusion || '',
        content: steps.content || '',
        example: steps.example || '',
        workExample: steps.workExample || '',
        reconclusion: steps.reconclusion || '',
        apTup: steps.apTup || '',
        ap: steps.ap || '',
        module: MODULES[moduleId]?.manual?.title || '',
        total: fb.total != null ? `${fb.total}/80` : '',
        verdict: fb.verdict || '',
        good: fb.good || '',
        improvements: Array.isArray(fb.improvements) ? fb.improvements.join(' / ') : (fb.improvements || ''),
        comment: fb.comment || '',
        rawJson: JSON.stringify(fb),
        resultUrl: candidateUrl || '',
      });
      resultUrl = candidateUrl; // 保存成功 → URLを確定
    } catch (saveErr) {
      console.error('[runGrade] save error (URLなしで送信):', saveErr?.message || saveErr);
      // resultUrl は null のまま → LINEメッセージからURLを省略
    }

    const gradeText = `📋【${modName}】採点結果\n${formatGradeResultShort(fb, resultUrl)}`;
    const quickReplies = [
      { label: 'もう1回採点', text: '#採点' },
      { label: 'お手本を見る', data: `model:${moduleId}`, displayText: '#お手本' },
    ];
    const msgs = chunkMessages(gradeText, quickReplies);

    // reply を試みて、失敗したら push にフォールバック
    let sent = false;
    if (replyToken) {
      try { await replyMessages(replyToken, msgs); sent = true; } catch {}
    }
    if (!sent) await pushMessages(userId, msgs);
  } catch (e) {
    console.error('[runGrade] error:', e);
    await sendError(userId, `採点でエラーが発生しました。もう一度お試しください。\n（${e.message || 'AIエラー'}）`);
  }
}

// ── こじつけを実行してpushで結果を送る（+記録）──
async function runKojitsuke(userId, word, output) {
  try {
    const fb = await kojitsukeFeedback(word, output);
    let saveNote = '';
    try {
      const profile = await getUserProfile(userId);
      const displayName = profile?.displayName || '(名無し)';
      await appendActivity({
        userId, name: displayName, type: 'こじつけ',
        keyword: word, userInput: output,
        total: fb.score != null ? `${fb.score}/10` : '',
        good: fb.good || '',
        improvements: fb.improvement || '',
        aiExample: fb.example || '',
      });
      saveNote = `\n\n📊 記録しました（${displayName}）`;
    } catch (saveErr) {
      console.error('[runKojitsuke] save error:', saveErr);
    }
    await pushMessages(userId, chunkMessages(formatKojitsuke(fb) + saveNote, [{ label: 'もう1回', text: '#こじつけ' }]));
  } catch (e) {
    console.error('[runKojitsuke] error:', e);
    await sendError(userId, `こじつけ査定でエラーが発生しました。もう一度お試しください。\n（${e.message || 'AIエラー'}）`);
  }
}

// ── リフレームを実行してpushで結果を送る（+記録）──
async function runReframe(userId, situation, reframe, quickReplyItems) {
  try {
    const fb = await reframeFeedback(situation, reframe);
    let saveNote = '';
    try {
      const profile = await getUserProfile(userId);
      const displayName = profile?.displayName || '(名無し)';
      await appendActivity({
        userId, name: displayName, type: 'リフレーム',
        keyword: situation, userInput: reframe,
        total: fb.score != null ? `${fb.score}/10` : '',
        good: fb.good || '',
        improvements: fb.improvement || '',
        aiExample: fb.example || '',
      });
      saveNote = `\n\n📊 記録しました（${displayName}）`;
    } catch (saveErr) {
      console.error('[runReframe] save error:', saveErr);
    }
    const items = quickReplyItems || [{ label: 'もう1回', text: '#リフレーム' }];
    await pushMessages(userId, chunkMessages(formatReframe(fb) + saveNote, items));
  } catch (e) {
    console.error('[runReframe] error:', e);
    await sendError(userId, `リフレーミング査定でエラーが発生しました。もう一度お試しください。\n（${e.message || 'AIエラー'}）`);
  }
}

// ── 採点結果フォーマット（LINE用ショート版）──
function formatGradeResultShort(fb, resultUrl) {
  const improvements = (fb.improvements || []).slice(0, 2)
    .map((s, i) => `${i + 1}. ${s}`).join('\n');
  return `━━━━━━━━━━━━━━━\n` +
    `🎯 合計: ${fb.total || 0}/80  ${fb.verdict || ''}\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    `✅ Good:\n${fb.good || '-'}\n\n` +
    `💡 改善ポイント:\n${improvements || '-'}` +
    (resultUrl ? `\n\n📱 詳細を見る:\n${resultUrl}` : '');
}

// ── 採点結果フォーマット（フル版・予備）──
function formatGradeResult(fb) {
  const scores = fb.scores || {};
  const labels = { tup: 'T-UP', conclusion: '結論', content: '内容', example: '一般例', workExample: '稼働例', reconclusion: '再結論', apTup: 'APのT-UP', ap: 'AP' };
  const scoreLines = Object.entries(labels).map(([k, l]) => `${l}: ${scores[k] ?? '-'}/10`).join('\n');

  return `━━━━━━━━━━━━━━━\n` +
    `🎯 合計: ${fb.total || 0}/80  ${fb.verdict || ''}\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    `📊 各ステップ:\n${scoreLines}\n\n` +
    `✅ Good:\n${fb.good || '-'}\n\n` +
    `🔍 T-UPチェック:\n${fb.tupCheck || '-'}\n\n` +
    `🔍 APのT-UPチェック:\n${fb.apTupCheck || '-'}\n\n` +
    `🔍 APチェック:\n${fb.apCheck || '-'}\n\n` +
    `🔗 内容↔AP一貫性:\n${fb.consistencyCheck || '-'}\n\n` +
    `⚡ インパルスファクターチェック:\n${fb.impulseFactorCheck || '-'}\n\n` +
    `🛠 アプローチ話法チェック:\n${fb.approachTechniquesCheck || '-'}\n\n` +
    `🪜 5ステップスチェック:\n${fb.stepsCheck || '-'}\n\n` +
    `👁 初めて聴く人チェック:\n${fb.clarityCheck || '-'}\n\n` +
    `💡 改善ポイント:\n${(fb.improvements || []).map((s, i) => `${i + 1}. ${s}`).join('\n') || '-'}\n\n` +
    `🔥 コメント:\n${fb.comment || '-'}`;
}

// ── お手本結果フォーマット ──
function formatModelScript(script) {
  const labels = { tup: '1.T-UP', conclusion: '2.結論', content: '3.内容', example: '4.一般的な例', workExample: '5.稼働における例', reconclusion: '6.再結論', apTup: '7.APのT-UP', ap: '8.AP' };
  return Object.entries(labels)
    .map(([k, l]) => `【${l}】\n${script[k] || '-'}`)
    .join('\n\n');
}

// ── こじつけ結果フォーマット ──
function formatKojitsuke(fb) {
  return `🎯 こじつけ査定: ${fb.score}/10\n\n` +
    `✅ Good:\n${fb.good || '-'}\n\n` +
    `💡 改善:\n${fb.improvement || '-'}\n\n` +
    `★ お手本:\n${fb.example || '-'}`;
}

// ── リフレーム結果フォーマット ──
function formatReframe(fb) {
  return `🎯 リフレーミング査定: ${fb.score}/10\n\n` +
    `✅ Good:\n${fb.good || '-'}\n\n` +
    `💡 改善:\n${fb.improvement || '-'}\n\n` +
    `★ お手本:\n${fb.example || '-'}`;
}

// ══════════════════════════════════════
// POST ハンドラ
// ══════════════════════════════════════
export async function POST(request) {
  const raw = await request.text();
  const signature = request.headers.get('x-line-signature');
  if (!verifySignature(raw, signature)) {
    return new NextResponse('invalid signature', { status: 401 });
  }

  let body;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }
  const events = Array.isArray(body.events) ? body.events : [];

  cleanupSessions();

  await Promise.all(events.map((ev) =>
    handleEvent(ev).catch(async (e) => {
      console.error('[handleEvent] uncaught error:', e);
      const userId = ev.source?.userId;
      if (userId) {
        const msg = e?.message ? `\n(${e.message})` : '';
        await pushText(userId, `⚠️ [${CODE_VERSION}] 予期せぬエラーが発生しました。もう一度お試しください。${msg}\n\nコマンド一覧は #ヘルプ`).catch(() => {});
      }
    })
  ));
  return NextResponse.json({ ok: true });
}

// ── イベントハンドラ ──
async function handleEvent(ev) {
  const userId = ev.source?.userId;

  if (ev.type === 'follow') {
    await safeReply(ev.replyToken, userId,
      '友だち追加ありがとう！\n\n' +
      'このBotでは以下の機能が使えます：\n\n' +
      '#採点 → 7ステップ採点\n' +
      '#お手本 → お手本スクリプト生成\n' +
      '#こじつけ → こじつけ力FB\n' +
      '#リフレーム → リフレーミングFB\n\n' +
      'リッチメニューからコマンドを選ぶか、上のコマンドをそのまま送ってね！');
    return;
  }

  if (ev.type === 'postback') {
    await handlePostback(ev, userId);
    return;
  }

  if (ev.type === 'message' && ev.message?.type === 'text') {
    await handleText(ev, userId);
    return;
  }
}

// ── ポストバック処理 ──
async function handlePostback(ev, userId) {
  const data = ev.postback?.data || '';

  if (data.includes('_cat:')) {
    const [cmdWithCat, categoryLabel] = data.split('_cat:');
    const commandPrefix = cmdWithCat;
    const items = modulesInCategory(commandPrefix, categoryLabel);
    if (items.length === 0) {
      await safeReply(ev.replyToken, userId, 'カテゴリが見つかりません。もう一度やり直してください。');
      return;
    }
    const msg = textWithQuickReply(`【${categoryLabel}】モジュールを選んでください：`, items);
    await safeReplyMessages(ev.replyToken, userId, [msg]);
    return;
  }

  const [command, moduleId] = data.split(':');

  if (!moduleId || !MODULES[moduleId]) {
    await safeReply(ev.replyToken, userId, 'モジュールが見つかりません。もう一度やり直してください。');
    return;
  }

  const modName = MODULES[moduleId].manual.title;

  switch (command) {
    case 'grade': {
      setSession(userId, { action: 'grade', moduleId });
      await safeReply(ev.replyToken, userId, gradeTemplate(moduleId));
      break;
    }

    case 'model': {
      await replyProcessing(ev.replyToken, `⏳【${modName}】お手本を生成中です。少々お待ちください...`);
      try {
        const script = await modelScript('', moduleId);
        const result = `📝【${modName}】お手本スクリプト\n━━━━━━━━━━━━━━━\n\n${formatModelScript(script)}`;
        const msgs = chunkMessages(result, [
          { label: '別のモジュール', text: '#お手本' },
          { label: '#採点', text: '#採点' },
        ]);
        await pushMessages(userId, msgs);
      } catch (e) {
        console.error('[model] error:', e);
        await sendError(userId, `お手本生成でエラーが発生しました。もう一度お試しください。\n（${e.message || 'AIエラー'}）`);
      }
      break;
    }

    case 'reverse': {
      setSession(userId, { action: 'reverse', moduleId });
      await safeReply(ev.replyToken, userId,
        `【${modName}】逆質問モード\n\n` +
        `あなたが「${modName}」について知っていることを自由に説明してください。\n` +
        `AIが理解度を測る質問を返します。`);
      break;
    }

    default:
      await safeReply(ev.replyToken, userId, 'コマンドが認識できませんでした。');
  }
}

// ── テキストメッセージ処理 ──
async function handleText(ev, userId) {
  const text = ev.message.text.trim();

  // ---- コマンド検出 ----

  if (/^[#＃]採点/.test(text)) {
    const msg = textWithQuickReply('📝 カテゴリを選んでください：', categoryQuickReplyItems('grade'));
    await safeReplyMessages(ev.replyToken, userId, [msg]);
    return;
  }

  if (/^[#＃]お手本/.test(text)) {
    const msg = textWithQuickReply('📖 カテゴリを選んでください：', categoryQuickReplyItems('model'));
    await safeReplyMessages(ev.replyToken, userId, [msg]);
    return;
  }

  if (/^[#＃]逆質問/.test(text)) {
    const msg = textWithQuickReply('❓ カテゴリを選んでください：', categoryQuickReplyItems('reverse'));
    await safeReplyMessages(ev.replyToken, userId, [msg]);
    return;
  }

  if (/^[#＃]こじつけ/.test(text)) {
    const content = text.replace(/^[#＃]こじつけ\s*/, '');
    if (!content) {
      setSession(userId, { action: 'kojitsuke_word' });
      await safeReply(ev.replyToken, userId,
        '💪 こじつけ力トレーニング！\n\n' +
        'まずお題の「単語」を送ってください。\n' +
        '（例: カレーライス、信号機、ジェットコースター）');
      return;
    }
    const lines = content.split('\n');
    const word = lines[0].trim();
    const output = lines.slice(1).join('\n').trim();
    if (!output) {
      setSession(userId, { action: 'kojitsuke_output', extra: { word } });
      await safeReply(ev.replyToken, userId,
        `お題：「${word}」\n\n` +
        `この単語を使ってモジュールの本質を説明してください！`);
      return;
    }
    await replyProcessing(ev.replyToken, '⏳ こじつけを査定中です。少々お待ちください...');
    await runKojitsuke(userId, word, output);
    return;
  }

  if (/^[#＃]リフレーム/.test(text)) {
    const content = text.replace(/^[#＃]リフレーム\s*/, '');
    if (!content) {
      setSession(userId, { action: 'reframe_input' });
      await safeReply(ev.replyToken, userId,
        '🔄 リフレーミング・ジム！\n\n' +
        'ネガ事象とリフレーミングを以下のフォーマットで送ってください：\n\n' +
        '事象: （ネガ事象を書く）\n' +
        '捉え方: （プラスに変える捉え方を書く）\n\n' +
        '例)\n事象: 10件連続でガチャ切りされた\n' +
        '捉え方: 10件分のNGパターンデータが貯まった。次の1件はその分精度が上がってる');
      return;
    }
    const { situation, reframe } = parseReframeInput(content);
    if (!situation || !reframe) {
      setSession(userId, { action: 'reframe_input' });
      await safeReply(ev.replyToken, userId,
        '以下のフォーマットで送ってください：\n\n事象: （ネガ事象）\n捉え方: （リフレーミング）');
      return;
    }
    await replyProcessing(ev.replyToken, '⏳ リフレーミングを査定中です。少々お待ちください...');
    await runReframe(userId, situation, reframe);
    return;
  }

  if (/^[#＃](ヘルプ|help)/i.test(text)) {
    await safeReply(ev.replyToken, userId,
      '📋 使えるコマンド一覧：\n\n' +
      '#採点 → 7ステップの採点\n' +
      '#お手本 → お手本スクリプト生成\n' +
      '#こじつけ → こじつけ力トレーニング\n' +
      '#リフレーム → リフレーミング・ジム\n' +
      '#逆質問 → 理解度チェック\n\n' +
      'リッチメニューのボタンからも同じ操作ができます！');
    return;
  }

  // ---- セッションに基づく処理 ----
  const session = getSession(userId);

  if (session) {
    switch (session.action) {
      case 'grade': {
        clearSession(userId);
        const steps = parseSevenSteps(text);
        steps.moduleId = session.moduleId;

        const filled = Object.values(steps).filter((v) => typeof v === 'string' && v.length > 0).length;
        if (filled < 3) {
          await safeReply(ev.replyToken, userId,
            '入力が足りないようです。\n7ステップのフォーマットで送り直してください。\n\n' +
            '（もう一度 #採点 から始めることもできます）');
          return;
        }
        await runGrade(userId, ev.replyToken, session.moduleId, steps);
        return;
      }

      case 'kojitsuke_word': {
        setSession(userId, { action: 'kojitsuke_output', extra: { word: text } });
        await safeReply(ev.replyToken, userId,
          `お題：「${text}」\n\n` +
          `この単語を使ってHave fun（またはアクティブモジュール）の本質をこじつけて説明してください！`);
        return;
      }

      case 'kojitsuke_output': {
        clearSession(userId);
        const word = session.extra?.word || '?';
        await replyProcessing(ev.replyToken, '⏳ こじつけを査定中です。少々お待ちください...');
        await runKojitsuke(userId, word, text);
        return;
      }

      case 'reframe_input': {
        clearSession(userId);
        const { situation, reframe } = parseReframeInput(text);
        await replyProcessing(ev.replyToken, '⏳ リフレーミングを査定中です。少々お待ちください...');
        await runReframe(userId, situation || '（LINEで送られた状況/捉え方）', reframe || text);
        return;
      }

      case 'reverse': {
        clearSession(userId);
        const moduleId = session.moduleId;
        const modName = MODULES[moduleId]?.manual?.title || '';
        await replyProcessing(ev.replyToken, `⏳【${modName}】理解度をチェック中です。少々お待ちください...`);
        try {
          const steps = { moduleId, tup: '', conclusion: text, content: text, example: '', workExample: '', reconclusion: '', ap: '' };
          const fb = await gradeOutput(steps);
          let saveNote = '';
          try {
            const profile = await getUserProfile(userId);
            const displayName = profile?.displayName || '(名無し)';
            await appendActivity({
              userId, name: displayName, type: '逆質問',
              module: modName, userInput: text,
              total: fb.total != null ? `${fb.total}/80` : '',
              good: fb.good || '',
              improvements: Array.isArray(fb.improvements) ? fb.improvements.join(' / ') : (fb.improvements || ''),
              comment: fb.comment || '',
            });
            saveNote = `\n\n📊 記録しました（${displayName}）`;
          } catch (saveErr) {
            console.error('[reverse] save error:', saveErr);
          }
          const result = `❓【${modName}】理解度チェック結果\n\n` +
            `🎯 スコア: ${fb.total || 0}/80\n\n` +
            `✅ Good:\n${fb.good || '-'}\n\n` +
            `💡 改善ポイント:\n${(fb.improvements || []).map((s, i) => `${i + 1}. ${s}`).join('\n') || '-'}\n\n` +
            `🔥 コメント:\n${fb.comment || '-'}` + saveNote;
          await pushMessages(userId, chunkMessages(result, [
            { label: 'もう1回', data: `reverse:${moduleId}`, displayText: '#逆質問' },
            { label: 'お手本を見る', data: `model:${moduleId}`, displayText: '#お手本' },
          ]));
        } catch (e) {
          console.error('[reverse] error:', e);
          await sendError(userId, `逆質問査定でエラーが発生しました。もう一度お試しください。\n（${e.message || 'AIエラー'}）`);
        }
        return;
      }
    }
  }

  // ---- セッションなし・コマンドなし ----
  // 7ステップ形式の入力は採点+記録（ヘッダーからモジュール特定、なければデフォルト）
  const looksLikeSteps = /[1１][.．]/.test(text) && (/[8８][.．]/.test(text) || /[7７][.．]/.test(text));
  if (looksLikeSteps) {
    // ヘッダー【モジュール名】があれば特定、なければ ACTIVE_MODULE をデフォルトに
    const detectedModuleId = detectModuleId(text) || ACTIVE_MODULE;
    const steps = parseSevenSteps(text);
    steps.moduleId = detectedModuleId;
    const filled = Object.values(steps).filter((v) => typeof v === 'string' && v.length > 0).length;
    if (filled < 3) {
      await safeReply(ev.replyToken, userId,
        '入力が足りないようです。\n7ステップのフォーマットで送り直してください。\n\n' +
        '（もう一度 #採点 から始めることもできます）');
      return;
    }
    await runGrade(userId, ev.replyToken, detectedModuleId, steps);
    return;
  }

  // それ以外は自由リフレーム査定
  await replyProcessing(ev.replyToken, '⏳ リフレーミングを査定中です。少々お待ちください...');
  await runReframe(userId, '（ユーザーがLINEで自由に送った状況/捉え方）', text, [
    { label: '#採点', text: '#採点' },
    { label: '#お手本', text: '#お手本' },
    { label: '#こじつけ', text: '#こじつけ' },
    { label: '#ヘルプ', text: '#ヘルプ' },
  ]);
}

// ── リフレーム入力パーサー ──
function parseReframeInput(text) {
  const situationMatch = text.match(/(?:事象|状況|ネガ)[：:]\s*([\s\S]*?)(?=\n\s*(?:捉え方|リフレーム|変換)[：:])/i);
  const reframeMatch = text.match(/(?:捉え方|リフレーム|変換)[：:]\s*([\s\S]*?)$/i);
  return {
    situation: situationMatch ? situationMatch[1].trim() : '',
    reframe: reframeMatch ? reframeMatch[1].trim() : '',
  };
}

// LINEの接続確認(GET)用
export async function GET() {
  return NextResponse.json({ ok: true, message: 'LINE webhook is alive (full-featured)' });
}
