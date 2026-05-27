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
import { ATTITUDE_KNOWLEDGE, ATTITUDE_PERSONA } from './attitude-knowledge';
import {
  BEONTIME_KNOWLEDGE, BEONTIME_PERSONA,
  JUNBI_KNOWLEDGE, JUNBI_PERSONA,
  HACHIJIKAN_KNOWLEDGE, HACHIJIKAN_PERSONA,
  TERRITORY_KNOWLEDGE, TERRITORY_PERSONA,
  ATTITUDE_KEEP_KNOWLEDGE, ATTITUDE_KEEP_PERSONA,
  NAZEKOKO_KNOWLEDGE, NAZEKOKO_PERSONA,
  TAKECONTROL_KNOWLEDGE, TAKECONTROL_PERSONA,
} from './steps8-knowledge';
import {
  HEIKINRITSU_KNOWLEDGE, HEIKINRITSU_PERSONA,
  INTRO_KNOWLEDGE, INTRO_PERSONA,
  SHORTSTORY_KNOWLEDGE, SHORTSTORY_PERSONA,
  HEARING_KNOWLEDGE, HEARING_PERSONA,
  PRESENTATION_KNOWLEDGE, PRESENTATION_PERSONA,
  CLOSE_KNOWLEDGE, CLOSE_PERSONA,
} from './sales-knowledge';
import {
  TAIDO_KNOWLEDGE, TAIDO_PERSONA,
  SEKININKAN_KNOWLEDGE, SEKININKAN_PERSONA,
  LEADERSHIP_KNOWLEDGE, LEADERSHIP_PERSONA,
  YASHIN_KNOWLEDGE, YASHIN_PERSONA,
  IKKANSEI_KNOWLEDGE, IKKANSEI_PERSONA,
} from './taseriyai-knowledge';
import { MODULES, ACTIVE_MODULE } from './havefun-data';

const KNOWLEDGE_MAP = {
  havefun: { knowledge: HAVEFUN_KNOWLEDGE, persona: PERSONA },
  studentMentality: { knowledge: STUDENTMENTALITY_KNOWLEDGE, persona: STUDENTMENTALITY_PERSONA },
  honesty: { knowledge: HONESTY_KNOWLEDGE, persona: HONESTY_PERSONA },
  hardWork: { knowledge: HARDWORK_KNOWLEDGE, persona: HARDWORK_PERSONA },
  attitude: { knowledge: ATTITUDE_KNOWLEDGE, persona: ATTITUDE_PERSONA },
  beOnTime: { knowledge: BEONTIME_KNOWLEDGE, persona: BEONTIME_PERSONA },
  junbi: { knowledge: JUNBI_KNOWLEDGE, persona: JUNBI_PERSONA },
  hachijikan: { knowledge: HACHIJIKAN_KNOWLEDGE, persona: HACHIJIKAN_PERSONA },
  territory: { knowledge: TERRITORY_KNOWLEDGE, persona: TERRITORY_PERSONA },
  attitudeKeep: { knowledge: ATTITUDE_KEEP_KNOWLEDGE, persona: ATTITUDE_KEEP_PERSONA },
  nazeKoko: { knowledge: NAZEKOKO_KNOWLEDGE, persona: NAZEKOKO_PERSONA },
  takeControl: { knowledge: TAKECONTROL_KNOWLEDGE, persona: TAKECONTROL_PERSONA },
  heikinritsu: { knowledge: HEIKINRITSU_KNOWLEDGE, persona: HEIKINRITSU_PERSONA },
  intro: { knowledge: INTRO_KNOWLEDGE, persona: INTRO_PERSONA },
  shortStory: { knowledge: SHORTSTORY_KNOWLEDGE, persona: SHORTSTORY_PERSONA },
  hearing: { knowledge: HEARING_KNOWLEDGE, persona: HEARING_PERSONA },
  presentation: { knowledge: PRESENTATION_KNOWLEDGE, persona: PRESENTATION_PERSONA },
  close: { knowledge: CLOSE_KNOWLEDGE, persona: CLOSE_PERSONA },
  taido: { knowledge: TAIDO_KNOWLEDGE, persona: TAIDO_PERSONA },
  sekininkan: { knowledge: SEKININKAN_KNOWLEDGE, persona: SEKININKAN_PERSONA },
  leadership: { knowledge: LEADERSHIP_KNOWLEDGE, persona: LEADERSHIP_PERSONA },
  yashin: { knowledge: YASHIN_KNOWLEDGE, persona: YASHIN_PERSONA },
  ikkansei: { knowledge: IKKANSEI_KNOWLEDGE, persona: IKKANSEI_PERSONA },
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

// Gemini を JSON モードで呼ぶ共通ヘルパー（503/429時に最大3回リトライ）
async function runJSON(systemInstruction, userText, temperature) {
  const ai = getClient();
  const delays = [3000, 8000, 15000]; // リトライ間隔: 3秒, 8秒, 15秒

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
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
    } catch (e) {
      const msg = String(e?.message || e);
      const isRetryable = msg.includes('503') || msg.includes('UNAVAILABLE') ||
                          msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');

      if (isRetryable && attempt < delays.length) {
        console.warn(`[Gemini] リトライ ${attempt + 1}/${delays.length}: ${msg}`);
        await new Promise((r) => setTimeout(r, delays[attempt]));
        continue;
      }
      throw e;
    }
  }
}

// ── ① 8ステップ アウトプットの査定 ──
export async function gradeOutput(steps) {
  const mid = steps.moduleId || ACTIVE_MODULE;
  const stepDefs = MODULES[mid].steps;
  const labeled = stepDefs
    .map((s, i) => `【${i + 1}. ${s.label}】\n${(steps[s.key] || '').trim() || '(空欄)'}`)
    .join('\n\n');

  const moduleName = MODULES[mid].manual.title;
  const system = `${getPersona(mid)}

${getKnowledge(mid)}

━━━━━━ インパルス（Impulse）の定義 ━━━━━━
営業における「インパルス」とは「相手の心が動いている状態（感情の熱量・購買意欲・話を聞く姿勢のピーク）」を指す。
インパルスは意図的に引き上げるものであり、インパルスが低い状態でクローズしてもYESは絶対に引き出せない。

インパルスファクター（引き上げトリガー）：
1. 仲間意識（バンドワゴン効果）
2. 具体的な数字（エビデンス）
3. 限定意識（希少性・緊急性）
4. 感情への直接アプローチ（共感・笑い・褒め）

T-UPでインパルスを最大限に引き上げ、APのT-UPで行動へのインパルスを再度引き上げてからAPで約束を取る、が黄金の構造。

━━━━━━ 営業5ステップス ━━━━━━
プロの営業フローは以下の5ステップで構成される。各ステップの目的を理解した上でアウトプットに落とし込めているかを評価する。
1. 導入（イントロ）：相手との信頼関係構築・インパルスの初期引き上げ。
2. ショートストーリー：実績・体験談で一気に信頼と共感を得る。
3. ヒアリング：相手のニーズ・課題・状況を引き出し、提案の根拠を作る。
4. プレゼンテーション：ヒアリングに基づいた解決策の提示。
5. クロージング：インパルスのピークを見極めて一切の迷いなく言い切る。

━━━━━━ 8ステップ採点基準 ━━━━━━
1. T-UP（必須）：答え（「${moduleName}」等のワード）を冒頭でバラしてはならない。ストーリーや興味付けで聞き手のインパルス（熱量）を最大に引き上げられているか。
2. 結論：結論ファーストで、ブレのない明快な概念を一言で強烈に言語化しているか。
3. 内容：精神論・道徳論ではなく、なぜ必要なのかロジックと仕組みで論理的に解説しているか。5ステップスとの関連・必要性が語られているとさらに加点。
4. 一般的な例：営業未経験者でも1秒で直感的に納得できる日常例か。
5. 稼働における例：明日の現場でそのままイメージして使えるほどリアルで生々しいシーンか。5ステップスのいずれかのシーンに紐づいているとさらに加点。
6. 再結論：最初の結論より確信度・納得度がさらに深まる強烈な言い切りになっているか。
7. APのT-UP（必須）：APの具体的な行動内容をいきなりバラさず、行動への強力な動機付けとストーリーでインパルスを引き上げてからAPへつなげているか。「明日これをやらなければ今日の学びはドブに捨てることになる」「明日これを発動させるだけで一気に突き抜けられる」のレベルの言い切りがあるか。
8. AP（最重要）：「意識します」「頑張ります」は一発不合格。誰が見ても実行したか判断できる行動ベース（分・秒単位・件数など数値や事実で確認できるレベル）で具体化されているか。

合否判定：T-UPで答えをバラしておらず、APのT-UPが行動へのインパルスを引き上げており、APが行動ベース、かつ合計64点以上（8ステップ×10点満点×80%）なら "合格"、それ以外は "要書き直し"。

必ず次のJSONのみを出力（前後に説明文やコードフェンスを付けない）：
{
  "scores": { "tup": 0, "conclusion": 0, "content": 0, "example": 0, "workExample": 0, "reconclusion": 0, "apTup": 0, "ap": 0 },
  "total": 0,
  "verdict": "合格" | "要書き直し",
  "good": "良かった点を熱く具体的に（2〜3文）",
  "tupCheck": "T-UPでインパルスを最大限に引き上げられているか・答えをバラしていないかへの一言指摘",
  "apTupCheck": "APのT-UPで行動へのインパルスを引き上げてからAPへつなげているかへの一言指摘",
  "apCheck": "APが行動ベースで数値・事実で確認できるレベルかへの一言指摘",
  "impulseFactorCheck": "T-UPとAPのT-UPで4つのインパルスファクター（仲間意識・数字・限定意識・感情アプローチ）のどれが使われていてどれが不足しているかの一言指摘",
  "stepsCheck": "内容・稼働例に5ステップス（導入→ショートストーリー→ヒアリング→プレゼン→クロージング）の構造・視点が組み込まれているかへの一言指摘",
  "improvements": ["改善提案1", "改善提案2", "改善提案3"],
  "comment": "プロマネージャーからの熱いひとことFB（1〜2文）"
}`;

  const user = `以下が提出された8ステップのアウトプットです。査定してください。\n\n${labeled}`;
  return runJSON(system, user, 0.1);
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
