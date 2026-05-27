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
T-UPでインパルスを最大限に引き上げ、APのT-UPで行動へのインパルスを再度引き上げてからAPで約束を取る、が黄金の構造。

━━━━━━ アプローチ話法（6つのパーツ）━━━━━━
以下6つの話法が内容・稼働例・APに組み込まれているかを評価する。

1. hand in（ハンドイン）── 所有感
   商品やサービスをすでに自分のものとして疑似体験させる。保有効果を利用し手放すことへの心理的苦痛を生む。
   例：「コンセントにカチッと挿すだけで…」「毎月3,000円のお小遣いが増えたとすると…」

2. High & Low（ハイ・アンド・ロー）── 値引き・ギャップ
   高い基準（コスト・手間・デメリット）を先に提示してから本命の提案を出し、高低差でお得感を極限まで引き上げる。
   枕詞：「通常は〇〇ですが、今回は」

3. stress the deal（ストレス・ザ・ディール）── 価値の強調・付加価値
   提案内容がどれほど特別で大きな価値があるかを、声のトーン・言葉の重みを変えて強烈に落とし込む。
   例：「なんと通信速度が2倍になるとんでもない付加価値が勝手についてくる」

4. fear of loss（フィア・オブ・ロス）── 期間限定・限定意識
   「今を逃すと手に入らない」という希少性・緊急性で損失回避バイアスを刺激し即断を促す。
   例：「このお電話を切ってしまうと二度とこのプランは適用できなくなります」

5. bandwagon（バンドワゴン）── 仲間意識
   「みんなもう手に入れている」という社会的証明で「取り残されたくない」心理を刺激する。
   例：「この地域の〇〇代の方はほぼ100%切り替え済みです」

6. suggestion（サジェスチョン）── おすすめ・価値を推す
   選択肢を並べず「あなたにはこれが絶対ベスト」とプロとして迷いなく言い切り背中を押す。
   例：「〇〇様には【これ一択】です。自信を持っておすすめします！」

━━━━━━ インパルスファクター（6大要素・順序が命）━━━━━━
インパルスを引き上げてクロージングへ向かう基本4ステップ＋後半2つの「生命線」ディフェンス要素。

① greed factor（グリードファクター）── 人間の本能に訴える
   「得したい・楽したい・損したくない」という根源的欲求を刺激して話を聴く体勢を作るスタート地点。

② fear of loss（フィア・オブ・ロス）── 限定意識
   本能を刺激した直後に「誰でもいつでも手に入るわけではない」という希少性を提示し価値を跳ね上げる。

③ bandwagon（バンドワゴン）── 仲間意識
   「限定のものだが仲間はすでに手に入れて得している」という社会的証明で決断のハードルを下げる。

④ suggestion（サジェスチョン）── 提案
   高まったインパルスに「だからこそあなたにはこれです」とプロの提案をバシッと打ち込む。

⑤ indifference（インディファレンス）── どっちでもよい【生命線】
   執着が1%でも透けた瞬間インパルスは冷める。「No buy, Good byeの精神」でフラットな余裕のスタンスを保ち
   お客様の警戒心を消し去り主体的な購買意欲を維持させる。

⑥ sense of urgency（センス・オブ・アージェンシー）── Noに粘りすぎない【生命線】
   インパルスには賞味期限がある。脈のないNoや不毛な押し問答にダラダラ粘るとトーク全体のスピード感が死ぬ。
   引くべき時はインディファレンスにテンポよく引き締め、スピード感をもって次のコールへ回す。

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
3. 内容：精神論・道徳論ではなく、なぜ必要なのかロジックと仕組みで論理的に解説しているか。5ステップスとの関連・アプローチ話法6つ（hand in/High&Low/stress the deal/fear of loss/bandwagon/suggestion）・インパルスファクター6つへの言及・理解があると加点。
4. 一般的な例：営業未経験者でも1秒で直感的に納得できる日常例か。
5. 稼働における例：明日の現場でそのままイメージして使えるほどリアルで生々しいシーンか。5ステップスのいずれかのシーン・またはアプローチ話法・インパルスファクターの活用シーンに紐づいているとさらに加点。
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
  "impulseFactorCheck": "インパルスファクター6要素（greed factor/fear of loss/bandwagon/suggestion/indifference/sense of urgency）のうちどれが使われていてどれが不足しているか。特にindifferenceとsense of urgencyという2つの生命線が意識されているかを指摘（1〜2文）",
  "approachTechniquesCheck": "アプローチ話法6つ（hand in/High&Low/stress the deal/fear of loss/bandwagon/suggestion）のうち内容・稼働例でどれが活用されていてどれが不足しているかを指摘（1〜2文）",
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

// ── ④ お手本スクリプト生成（8ステップの模範例）──
export async function modelScript(theme, moduleId) {
  const t = (theme || '').trim();
  const mid = moduleId || ACTIVE_MODULE;
  const moduleName = MODULES[mid].manual.title;
  const system = `${getPersona(mid)}

${getKnowledge(mid)}

これは「お手本スクリプト生成」です。8ステップ（T-UP→結論→内容→一般的な例→稼働における例→再結論→APのT-UP→AP）を
完璧に踏んだ「${moduleName} の模範説明スクリプト」を生成してください。

ルール：
- T-UP：「${moduleName}」というワードを絶対にバラさない。ストーリーと興味付けでインパルスを最大に引き上げる。
- 内容：精神論NG。アプローチ話法（hand in/High&Low/stress the deal/fear of loss/bandwagon/suggestion）や
  インパルスファクター（greed factor→fear of loss→bandwagon→suggestion→indifference→sense of urgency）の
  概念と「${moduleName}」の関係を論理的に解説する。
- 稼働における例：5ステップス（導入→ショートストーリー→ヒアリング→プレゼン→クロージング）のいずれかのシーンに紐づけ、
  アプローチ話法やインパルスファクターを活用した生々しい現場シーンを描く。
- APのT-UP：APの内容をいきなりバラさない。行動への強力な動機付けとインパルスを引き上げてからAPへつなぐ。
  「明日これを発動させるだけで一気に突き抜けられる」レベルの言い切りで。
- AP：「意識します」「頑張ります」は絶対NG。分・件数など数値や事実で誰が見ても実行確認できるレベルまで具体化。
- 各ステップは2〜4文。

必ず次のJSONのみを出力（前後に説明文やコードフェンスを付けない）：
{
  "tup": "...",
  "conclusion": "...",
  "content": "...",
  "example": "...",
  "workExample": "...",
  "reconclusion": "...",
  "apTup": "...",
  "ap": "..."
}`;

  const user = t
    ? `次のテーマ/状況に寄せたお手本を作ってください：「${t}」`
    : `標準的なお手本を1つ作ってください。`;
  return runJSON(system, user, 0.7);
}
