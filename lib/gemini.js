// =============================================================
// lib/gemini.js
// Gemini 連携（@google/genai / モデル: gemini-2.5-flash）
// サーバー側専用。GEMINI_API_KEY が無い場合は明示的にエラーを投げる。
// =============================================================

import { GoogleGenAI } from '@google/genai';
import { HAVEFUN_KNOWLEDGE, PERSONA } from './havefun-knowledge';
import { STUDENTMENTALITY_KNOWLEDGE, STUDENTMENTALITY_PERSONA } from './studentmentality-knowledge';
import { HONESTY_KNOWLEDGE, HONESTY_PERSONA } from './honesty-knowledge';
import { HARDWORK_KNOWLEDGE, HARDWORK_PERSONA } from './hardwork-knowledge';
import { MODULES, ACTIVE_MODULE } from './havefun-data';

const KNOWLEDGE_MAP = {
  havefun: { knowledge: HAVEFUN_KNOWLEDGE, persona: PERSONA },
  studentMentality: { knowledge: STUDENTMENTALITY_KNOWLEDGE, persona: STUDENTMENTALITY_PERSONA },
  honesty: { knowledge: HONESTY_KNOWLEDGE, persona: HONESTY_PERSONA },
  hardWork: { knowledge: HARDWORK_KNOWLEDGE, persona: HARDWORK_PERSONA },
};

function getKnowledge(mid) {
  return (KNOWLEDGE_MAP[mid || ACTIVE_MODULE] || KNOWLEDGE_MAP.havefun).knowledge;
}
function getPersona(mid) {
  return (KNOWLEDGE_MAP[mid || ACTIVE_MODULE] || KNOWLEDGE_MAP.havefun).persona;
}

const MODEL = 'gemini-2.5-flash';

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY が未設定です。');
  }
  return new GoogleGenAI({ apiKey });
}

// JSON応答を安全にパース（コードフェンス等を除去）
function parseJSON(text) {
  if (!text) throw new Error('AIから空の応答が返りました。');
  let t = String(text).trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s >= 0 && e >= s) t = t.slice(s, e + 1);
  return JSON.parse(t);
}

// Gemini を JSON モードで呼ぶ共通ヘルパー
async function runJSON(systemInstruction, userText, temperature) {
  const ai = getClient();
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: userText,
    config: {
      systemInstruction,
      temperature: typeof temperature === 'number' ? temperature : 0.6,
      responseMimeType: 'application/json',
    },
  });
  return parseJSON(res.text);
}

// ── ① 7ステップ アウトプットの査定 ──
export async function gradeOutput(steps) {
  const mid = steps.moduleId || ACTIVE_MODULE;
  const stepDefs = MODULES[mid].steps;
  const labeled = stepDefs
    .map((s, i) => `【${i + 1}. ${s.label}】\n${(steps[s.key] || '').trim() || '(空欄)'}`)
    .join('\n\n');

  const moduleName = MODULES[mid].manual.title;
  const system = `${getPersona(mid)}

${getKnowledge(mid)}

あなたはこれからユーザーの「7ステップ アウトプット」を、第四部の厳格な合格基準で査定します。
各ステップを10点満点（合計70点満点）で採点してください。
特に次の2点を最重視すること：
- T-UP：冒頭で答え（「${moduleName}」等のワード自体）をバラしていないか。
- AP：行動ベースで、誰が見ても実行したか数値・事実で確認できるレベルまで具体化されているか。抽象的な感想（頑張る/意識する）は大幅減点。

合否は、T-UPで答えを割っておらず、APが行動ベースで、かつ合計56点以上なら "合格"、それ以外は "要書き直し"。

必ず次のJSONのみを出力（前後に説明文やコードフェンスを付けない）：
{
  "scores": { "tup": 0, "conclusion": 0, "content": 0, "example": 0, "workExample": 0, "reconclusion": 0, "ap": 0 },
  "total": 0,
  "verdict": "合格" | "要書き直し",
  "good": "良かった点を熱く具体的に（2〜3文）",
  "tupCheck": "T-UPで答えをバラしていないかへの一言指摘",
  "apCheck": "APが行動ベースで実行確認できるレベルかへの一言指摘",
  "improvements": ["改善提案1", "改善提案2", "改善提案3"],
  "comment": "プロマネージャーからの熱いひとことFB（1〜2文）"
}`;

  const user = `以下が提出された7ステップのアウトプットです。査定してください。\n\n${labeled}`;
  return runJSON(system, user, 0.5);
}

// ── ② こじつけ力強化モードの査定＋お手本例 ──
export async function kojitsukeFeedback(word, output) {
  const moduleName = MODULES[ACTIVE_MODULE].manual.title;
  const system = `${getPersona()}

${getKnowledge()}

これは「こじつけ力強化モード」です。目的は、${moduleName} の本質を、
一見まったく無関係な単語に強引かつ論理的に結びつけて説明する「こじつけ力＝リフレーミング筋力」を鍛えることです。
ユーザーは与えられた単語を使って${moduleName}を説明します。あなたはそれを評価し、さらに同じ単語を使ったお手本のこじつけ説明を示してください。

評価観点：
- ${moduleName}の本質に芯を食って結びついているか（ただ単語を出しただけ＝低評価）。
- こじつけの論理に飛躍はあっても「なるほど！」と膝を打つ意外性・ウィットがあるか。
- 現場（営業・架電）に落ちる示唆があると加点。

必ず次のJSONのみを出力（前後に説明文やコードフェンスを付けない）：
{
  "score": 0,
  "good": "良かった点（1〜2文、熱く）",
  "improvement": "もっとこじつけ力を上げる具体的な指摘（1〜2文）",
  "example": "同じ単語『${word}』を使った、あなた（トップオーナー）によるお手本のこじつけ説明。意外性があり本質を突き、最後に軽い現場示唆を入れる（3〜5文）"
}
（score は0〜10の整数）`;

  const user = `お題の単語：「${word}」\n\nユーザーのこじつけ説明：\n${(output || '').trim() || '(空欄)'}`;
  return runJSON(system, user, 0.85);
}


// ── ③ リフレーミング・ジム（ネガ事象→プラス変換の査定＋お手本）──
export async function reframeFeedback(situation, userReframe) {
  const system = `${getPersona()}

${getKnowledge()}

これは「リフレーミング・ジム」です。��的は、現場で実際に起きるネガティブな事象に対して捉え方を変えてプラスに転じる力を鍛えることです。
ユーザーは、提示されたネガ事象に対して「自分の物差しで意味付けを変え、引き算の結果をプラスにする」リフレーミングを書きます。
あなたはそれを評価し、さらに同じ事象に対するお手本のリフレーミングを示してください。

評価観点：
- 客観的事実を否定・歪曲せず、それでも「意味付け」だけを変えてプラスに転じられているか（現実逃避や根性論はNG）。
- 第三部のように、ゲーム化・レアキャラ化・確率の収束・演技などの具体的な捉え方に落ちているか。
- そのリフレーミングが「次の行動を止めない（むしろ進める）」ものになっているか。

必ず次のJSONのみを出力（前後に説明文やコードフェンスを付けない）：
{
  "score": 0,
  "good": "良かった点（1〜2文、熱く）",
  "improvement": "もっと引き算をプラスにする具体的な指摘（1〜2文）",
  "example": "同じ事象へのお手本リフレーミング。事実は認めた上で意味付けを変え、ゲーム感覚の捉え方と『だから次こう動く』までを含める（3〜5文）"
}
（score は0〜10の整数）`;

  const user = `ネガ事象：「${situation}」\n\nユーザーのリフレーミング：\n${(userReframe || '').trim() || '(空欄)'}`;
  return runJSON(system, user, 0.8);
}

// ── ④ お手本スクリプト生成（7ステップの模範例）──
export async function modelScript(theme, moduleId) {
  const t = (theme || '').trim();
  const mid = moduleId || ACTIVE_MODULE;
  const moduleName = MODULES[mid].manual.title;
  const system = `${getPersona(mid)}

${getKnowledge(mid)}

これは「お手本スクリプト生成」です。第五部の手順2に従い、7ステップ（T-UP→結論→内容→一般的な例→稼働における例→再結論→AP）を
完璧に踏んだ「${moduleName} の模範説明スクリプト」を生成してください。
ルール：
- T-UPでは答え（「${moduleName}」というワード自体）をバラさない。
- APは行動ベースで、誰が見ても実行確認できるレベルまで具体化する。
- 各ステップは2〜4文。現場（架電・クレーム等）の生々しさを入れる。

必ず次のJSONのみを出力（前後に説明文やコードフェンスを付けない）：
{
  "tup": "...",
  "conclusion": "...",
  "content": "...",
  "example": "...",
  "workExample": "...",
  "reconclusion": "...",
  "ap": "..."
}`;

  const user = t
    ? `次のテーマ/状況に寄せたお手本を作ってください：「${t}」`
    : `標準的なお手本を1つ作ってください。`;
  return runJSON(system, user, 0.7);
}
