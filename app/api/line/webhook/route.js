// =============================================================
// app/api/line/webhook/route.js
// LINE Messaging API Webhook — フル機能対応
//   #採点 / #お手本 / #こじつけ / #リフレーム / #逆質問
//   + モジュール選択 Quick Reply + セッション管理
// =============================================================
import { NextResponse } from 'next/server';
import { verifySignature, replyText, replyMessages, pushText, pushMessages, textWithQuickReply, chunkMessages } from '@/lib/line';
import { gradeOutput, kojitsukeFeedback, reframeFeedback, modelScript } from '@/lib/gemini';
import { MODULES, MODULE_CATEGORIES } from '@/lib/havefun-data';
import { getSession, setSession, clearSession, cleanupSessions } from '@/lib/line-session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
  return `【${name}】7ステップを以下のフォーマットで送ってください：\n\n` +
    `1.T-UP:\n（ここに入力）\n\n` +
    `2.結論:\n（ここに入力）\n\n` +
    `3.内容:\n（ここに入力）\n\n` +
    `4.一般的な例:\n（ここに入力）\n\n` +
    `5.稼働における例:\n（ここに入力）\n\n` +
    `6.再結論:\n（ここに入力）\n\n` +
    `7.AP:\n（ここに入力）\n\n` +
    `※上記をコピーして各項目を埋めて送信！`;
}

// ── 7ステップのテキストをパース ──
function parseSevenSteps(text) {
  const keys = ['tup', 'conclusion', 'content', 'example', 'workExample', 'reconclusion', 'ap'];
  const labels = ['T-UP', '結論', '内容', '一般的な例', '稼働における例', '再結論', 'AP'];
  const result = {};

  // 番号付きパターンでスプリット: "1." "2." ... "7."
  const parts = text.split(/(?:^|\n)\s*[１-７1-7][.．:：\s]/);

  if (parts.length >= 8) {
    // parts[0]はヘッダー（空 or モジュール名）、parts[1]〜parts[7]が各ステップ
    for (let i = 0; i < 7; i++) {
      result[keys[i]] = (parts[i + 1] || '').replace(/^[^:：]*[：:]?\s*/, '').trim();
    }
  } else {
    // ラベルマッチ試行
    for (let i = 0; i < 7; i++) {
      const regex = new RegExp(`(?:${i + 1}[.．]?\\s*)?${labels[i]}[：:]?\\s*([\\s\\S]*?)(?=(?:\\n\\s*(?:[１-７1-7][.．]|${labels[i + 1] || '$END$'}))`, 'i');
      const m = text.match(regex);
      result[keys[i]] = m ? m[1].trim() : '';
    }
    // 最後のAPが取れない場合のフォールバック
    if (!result.ap) {
      const apMatch = text.match(/(?:7[.．]?\s*)?AP[：:]\s*([\s\S]*?)$/i);
      if (apMatch) result.ap = apMatch[1].trim();
    }
  }

  return result;
}

// ── 採点結果フォーマット ──
function formatGradeResult(fb) {
  const scores = fb.scores || {};
  const labels = { tup: 'T-UP', conclusion: '結論', content: '内容', example: '一般例', workExample: '稼働例', reconclusion: '再結論', ap: 'AP' };
  const scoreLines = Object.entries(labels).map(([k, l]) => `${l}: ${scores[k] ?? '-'}/10`).join('\n');

  return `━━━━━━━━━━━━━━━\n` +
    `🎯 合計: ${fb.total || 0}/70  ${fb.verdict || ''}\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    `📊 各ステップ:\n${scoreLines}\n\n` +
    `✅ Good:\n${fb.good || '-'}\n\n` +
    `🔍 T-UPチェック:\n${fb.tupCheck || '-'}\n\n` +
    `🔍 APチェック:\n${fb.apCheck || '-'}\n\n` +
    `💡 改善ポイント:\n${(fb.improvements || []).map((s, i) => `${i + 1}. ${s}`).join('\n') || '-'}\n\n` +
    `🔥 コメント:\n${fb.comment || '-'}`;
}

// ── お手本結果フォーマット ──
function formatModelScript(script) {
  const labels = { tup: '1.T-UP', conclusion: '2.結論', content: '3.内容', example: '4.一般的な例', workExample: '5.稼働における例', reconclusion: '6.再結論', ap: '7.AP' };
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

  // 定期クリーンアップ
  cleanupSessions();

  await Promise.all(events.map((ev) =>
    handleEvent(ev).catch(async () => {
      // 予期せぬ未捕捉エラーをユーザーへ通知（サイレント落ち防止）
      const userId = ev.source?.userId;
      if (userId) {
        await pushText(userId, '⚠️ 予期せぬエラーが発生しました。もう一度お試しください。\n\nコマンド一覧は #ヘルプ').catch(() => {});
      }
    })
  ));
  return NextResponse.json({ ok: true });
}

// ── イベントハンドラ ──
async function handleEvent(ev) {
  const userId = ev.source?.userId;

  // フォローイベント
  if (ev.type === 'follow') {
    await replyText(ev.replyToken,
      '友だち追加ありがとう！\n\n' +
      'このBotでは以下の機能が使えます：\n\n' +
      '#採点 → 7ステップ採点\n' +
      '#お手本 → お手本スクリプト生成\n' +
      '#こじつけ → こじつけ力FB\n' +
      '#リフレーム → リフレーミングFB\n\n' +
      'リッチメニューからコマンドを選ぶか、上のコマンドをそのまま送ってね！');
    return;
  }

  // ポストバック（Quick Reply選択）
  if (ev.type === 'postback') {
    await handlePostback(ev, userId);
    return;
  }

  // テキストメッセージ
  if (ev.type === 'message' && ev.message?.type === 'text') {
    await handleText(ev, userId);
    return;
  }
}

// ── ポストバック処理 ──
async function handlePostback(ev, userId) {
  const data = ev.postback?.data || '';

  // カテゴリ選択の処理（grade_cat:マインドセット 等）
  if (data.includes('_cat:')) {
    const [cmdWithCat, categoryLabel] = data.split('_cat:');
    const commandPrefix = cmdWithCat; // "grade", "model", "reverse"
    const items = modulesInCategory(commandPrefix, categoryLabel);
    if (items.length === 0) {
      await replyText(ev.replyToken, 'カテゴリが見つかりません。もう一度やり直してください。');
      return;
    }
    const msg = textWithQuickReply(
      `【${categoryLabel}】モジュールを選んでください：`,
      items
    );
    await replyMessages(ev.replyToken, [msg]);
    return;
  }

  const [command, moduleId] = data.split(':');

  if (!moduleId || !MODULES[moduleId]) {
    await replyText(ev.replyToken, 'モジュールが見つかりません。もう一度やり直してください。');
    return;
  }

  const modName = MODULES[moduleId].manual.title;

  switch (command) {
    case 'grade': {
      setSession(userId, { action: 'grade', moduleId });
      await replyText(ev.replyToken, gradeTemplate(moduleId));
      break;
    }

    case 'model': {
      // Gemini処理前にreplyTokenで「処理中」を即返信し、結果はpushで送る
      await replyText(ev.replyToken, `⏳【${modName}】お手本を生成中です。少々お待ちください...`);
      try {
        const script = await modelScript('', moduleId);
        const result = `📝【${modName}】お手本スクリプト\n━━━━━━━━━━━━━━━\n\n${formatModelScript(script)}`;
        const msgs = chunkMessages(result, [
          { label: '別のモジュール', text: '#お手本' },
          { label: '#採点', text: '#採点' },
        ]);
        await pushMessages(userId, msgs);
      } catch (e) {
        await pushText(userId, `⚠️ お手本生成でエラーが発生しました。もう一度お試しください。\n（${e.message || 'AIエラー'}）`).catch(() => {});
      }
      break;
    }

    case 'reverse': {
      setSession(userId, { action: 'reverse', moduleId });
      await replyText(ev.replyToken,
        `【${modName}】逆質問モード\n\n` +
        `あなたが「${modName}」について知っていることを自由に説明してください。\n` +
        `AIが理解度を測る質問を返します。`);
      break;
    }

    default:
      await replyText(ev.replyToken, 'コマンドが認識できませんでした。');
  }
}

// ── テキストメッセージ処理 ──
async function handleText(ev, userId) {
  const text = ev.message.text.trim();

  // ---- コマンド検出 ----

  // #採点
  if (/^[#＃]採点/.test(text)) {
    const items = categoryQuickReplyItems('grade');
    const msg = textWithQuickReply(
      '📝 カテゴリを選んでください：',
      items
    );
    await replyMessages(ev.replyToken, [msg]);
    return;
  }

  // #お手本
  if (/^[#＃]お手本/.test(text)) {
    const items = categoryQuickReplyItems('model');
    const msg = textWithQuickReply(
      '📖 カテゴリを選んでください：',
      items
    );
    await replyMessages(ev.replyToken, [msg]);
    return;
  }

  // #逆質問
  if (/^[#＃]逆質問/.test(text)) {
    const items = categoryQuickReplyItems('reverse');
    const msg = textWithQuickReply(
      '❓ カテゴリを選んでください：',
      items
    );
    await replyMessages(ev.replyToken, [msg]);
    return;
  }

  // #こじつけ [word] [explanation]
  if (/^[#＃]こじつけ/.test(text)) {
    const content = text.replace(/^[#＃]こじつけ\s*/, '');
    if (!content) {
      setSession(userId, { action: 'kojitsuke_word' });
      await replyText(ev.replyToken,
        '💪 こじつけ力トレーニング！\n\n' +
        'まずお題の「単語」を送ってください。\n' +
        '（例: カレーライス、信号機、ジェットコースター）');
      return;
    }
    // 1行目=単語、残り=説明のパターン
    const lines = content.split('\n');
    const word = lines[0].trim();
    const output = lines.slice(1).join('\n').trim();
    if (!output) {
      setSession(userId, { action: 'kojitsuke_output', extra: { word } });
      await replyText(ev.replyToken,
        `お題：「${word}」\n\n` +
        `この単語を使ってモジュールの本質を説明してください！`);
      return;
    }
    // 即採点: replyTokenで「処理中」→ pushで結果
    await replyText(ev.replyToken, `⏳ こじつけを査定中です。少々お待ちください...`);
    try {
      const fb = await kojitsukeFeedback(word, output);
      const msgs = chunkMessages(formatKojitsuke(fb), [
        { label: 'もう1回', text: '#こじつけ' },
      ]);
      await pushMessages(userId, msgs);
    } catch (e) {
      await pushText(userId, `⚠️ こじつけ査定でエラーが発生しました。もう一度お試しください。\n（${e.message || 'AIエラー'}）`).catch(() => {});
    }
    return;
  }

  // #リフレーム [situation]\n[reframe]
  if (/^[#＃]リフレーム/.test(text)) {
    const content = text.replace(/^[#＃]リフレーム\s*/, '');
    if (!content) {
      setSession(userId, { action: 'reframe_input' });
      await replyText(ev.replyToken,
        '🔄 リフレーミング・ジム！\n\n' +
        'ネガ事象とリフレーミングを以下のフォーマットで送ってください：\n\n' +
        '事象: （ネガ事象を書く）\n' +
        '捉え方: （プラスに変える捉え方を書く）\n\n' +
        '例)\n事象: 10件連続でガチャ切りされた\n' +
        '捉え方: 10件分のNGパターンデータが貯まった。次の1件はその分精度が上がってる');
      return;
    }
    // パースして即採点
    const { situation, reframe } = parseReframeInput(content);
    if (!situation || !reframe) {
      setSession(userId, { action: 'reframe_input' });
      await replyText(ev.replyToken,
        '以下のフォーマットで送ってください：\n\n事象: （ネガ事象）\n捉え方: （リフレーミング）');
      return;
    }
    // 即採点: replyTokenで「処理中」→ pushで結果
    await replyText(ev.replyToken, `⏳ リフレーミングを査定中です。少々お待ちください...`);
    try {
      const fb = await reframeFeedback(situation, reframe);
      const msgs = chunkMessages(formatReframe(fb), [
        { label: 'もう1回', text: '#リフレーム' },
      ]);
      await pushMessages(userId, msgs);
    } catch (e) {
      await pushText(userId, `⚠️ リフレーミング査定でエラーが発生しました。もう一度お試しください。\n（${e.message || 'AIエラー'}）`).catch(() => {});
    }
    return;
  }

  // #ヘルプ / #help
  if (/^[#＃](ヘルプ|help)/i.test(text)) {
    await replyText(ev.replyToken,
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

        // 最低限の入力チェック
        const filled = Object.values(steps).filter((v) => typeof v === 'string' && v.length > 0).length;
        if (filled < 3) {
          await replyText(ev.replyToken,
            '入力が足りないようです。\n7ステップのフォーマットで送り直してください。\n\n' +
            '（もう一度 #採点 から始めることもできます）');
          return;
        }

        // Gemini処理前にreplyTokenで「処理中」を即返信し、結果はpushで送る
        await replyText(ev.replyToken, '⏳ AIが採点中です。少々お待ちください...');
        try {
          const fb = await gradeOutput(steps);
          const modName = MODULES[session.moduleId]?.manual?.title || '';
          const result = `📋【${modName}】採点結果\n${formatGradeResult(fb)}`;
          const msgs = chunkMessages(result, [
            { label: 'もう1回採点', text: '#採点' },
            { label: 'お手本を見る', data: `model:${session.moduleId}`, displayText: '#お手本' },
          ]);
          await pushMessages(userId, msgs);
        } catch (e) {
          await pushText(userId, `⚠️ 採点でエラーが発生しました。もう一度お試しください。\n（${e.message || 'AIエラー'}）`).catch(() => {});
        }
        return;
      }

      case 'kojitsuke_word': {
        const word = text;
        setSession(userId, { action: 'kojitsuke_output', extra: { word } });
        await replyText(ev.replyToken,
          `お題：「${word}」\n\n` +
          `この単語を使ってHave fun（またはアクティブモジュール）の本質をこじつけて説明してください！`);
        return;
      }

      case 'kojitsuke_output': {
        clearSession(userId);
        const word = session.extra?.word || '?';
        await replyText(ev.replyToken, '⏳ こじつけを査定中です。少々お待ちください...');
        try {
          const fb = await kojitsukeFeedback(word, text);
          const msgs = chunkMessages(formatKojitsuke(fb), [
            { label: 'もう1回', text: '#こじつけ' },
          ]);
          await pushMessages(userId, msgs);
        } catch (e) {
          await pushText(userId, `⚠️ こじつけ査定でエラーが発生しました。もう一度お試しください。\n（${e.message || 'AIエラー'}）`).catch(() => {});
        }
        return;
      }

      case 'reframe_input': {
        clearSession(userId);
        const { situation, reframe } = parseReframeInput(text);
        await replyText(ev.replyToken, '⏳ リフレーミングを査定中です。少々お待ちください...');
        try {
          // フォーマット無視の自由入力の場合はテキスト全体をリフレームとして処理
          const sit = situation || '（LINEで送られた状況/捉え方）';
          const ref = reframe || text;
          const fb = await reframeFeedback(sit, ref);
          const msgs = chunkMessages(formatReframe(fb), [
            { label: 'もう1回', text: '#リフレーム' },
          ]);
          await pushMessages(userId, msgs);
        } catch (e) {
          await pushText(userId, `⚠️ リフレーミング査定でエラーが発生しました。もう一度お試しください。\n（${e.message || 'AIエラー'}）`).catch(() => {});
        }
        return;
      }

      case 'reverse': {
        clearSession(userId);
        const moduleId = session.moduleId;
        const modName = MODULES[moduleId]?.manual?.title || '';
        await replyText(ev.replyToken, `⏳【${modName}】理解度をチェック中です。少々お待ちください...`);
        try {
          const steps = {
            moduleId,
            tup: '',
            conclusion: text,
            content: text,
            example: '',
            workExample: '',
            reconclusion: '',
            ap: '',
          };
          const fb = await gradeOutput(steps);
          const result = `❓【${modName}】理解度チェック結果\n\n` +
            `🎯 スコア: ${fb.total || 0}/70\n\n` +
            `✅ Good:\n${fb.good || '-'}\n\n` +
            `💡 改善ポイント:\n${(fb.improvements || []).map((s, i) => `${i + 1}. ${s}`).join('\n') || '-'}\n\n` +
            `🔥 コメント:\n${fb.comment || '-'}`;
          const msgs = chunkMessages(result, [
            { label: 'もう1回', data: `reverse:${moduleId}`, displayText: '#逆質問' },
            { label: 'お手本を見る', data: `model:${moduleId}`, displayText: '#お手本' },
          ]);
          await pushMessages(userId, msgs);
        } catch (e) {
          await pushText(userId, `⚠️ 逆質問査定でエラーが発生しました。もう一度お試しください。\n（${e.message || 'AIエラー'}）`).catch(() => {});
        }
        return;
      }
    }
  }

  // ---- セッションなし・コマンドなし ----
  // セッション切れの可能性があるので、7ステップっぽい入力には案内を返す
  const looksLikeSteps = /[1１][.．]/.test(text) && /[7７][.．]/.test(text);
  if (looksLikeSteps) {
    await replyText(ev.replyToken,
      'セッションが切れているかもしれません。\n\n' +
      '#採点 からモジュールを選び直して、もう一度送ってください。');
    return;
  }

  // それ以外は自由リフレーム査定
  await replyText(ev.replyToken, '⏳ リフレーミングを査定中です。少々お待ちください...');
  try {
    const fb = await reframeFeedback('（ユーザーがLINEで自由に送った状況/捉え方）', text);
    const msgs = chunkMessages(formatReframe(fb), [
      { label: '#採点', text: '#採点' },
      { label: '#お手本', text: '#お手本' },
      { label: '#こじつけ', text: '#こじつけ' },
      { label: '#ヘルプ', text: '#ヘルプ' },
    ]);
    await pushMessages(userId, msgs);
  } catch (e) {
    await pushText(userId, `⚠️ エラーが発生しました。もう一度お試しください。\n（${e.message || 'AIエラー'}）\n\nコマンド一覧は #ヘルプ`).catch(() => {});
  }
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
