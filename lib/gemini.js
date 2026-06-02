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

const MODEL_PRIMARY = 'gemini-2.5-flash';
const MODEL_FALLBACK = 'gemini-2.0-flash';
const MODEL_FALLBACK2 = 'gemini-2.0-flash-lite'; // 無料枠が別クォータプール・RPM高め

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
// 一時エラー(503) → 同モデルを5s後リトライ → 次モデルへ
// クォータエラー(429) → 即座に次モデルへ（同モデルリトライ無駄なため）
// モデル順: gemini-2.5-flash → gemini-2.0-flash → gemini-1.5-flash-latest
async function runJSON(systemInstruction, userText, temperature) {
  const ai = getClient();
  const models = [MODEL_PRIMARY, MODEL_FALLBACK, MODEL_FALLBACK2];
  let lastError;

  for (const model of models) {
    // 一次モデルは一時エラー時に1回リトライ、フォールバックは1回のみ
    const maxTries = model === MODEL_PRIMARY ? 2 : 1;
    for (let t = 0; t < maxTries; t++) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: userText,
          config: {
            systemInstruction,
            temperature: typeof temperature === 'number' ? temperature : 0.6,
            responseMimeType: 'application/json',
          },
        });
        if (model !== MODEL_PRIMARY) console.warn(`[Gemini] フォールバック成功: ${model}`);
        return parseJSON(res.text);
      } catch (e) {
        lastError = e;
        const msg = String(e?.message || e);
        const isQuota = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
        const isTransient = msg.includes('503') || msg.includes('UNAVAILABLE');

        if (isQuota) {
          // クォータ枯渇は同モデルリトライ無意味 → 次モデルへ
          console.warn(`[Gemini] クォータ超過 (${model}) → 次モデルへ`);
          break;
        }
        if (isTransient && t < maxTries - 1) {
          // 一時エラーは5s待ってリトライ
          console.warn(`[Gemini] 一時エラー リトライ (${model})`);
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        // その他エラーまたは最終リトライ失敗 → 次モデルへ
        break;
      }
    }
  }
  throw lastError;
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

━━━━━━ 大前提：アウトプットの目的 ━━━━━━
このアウトプットの唯一の目的は「APを行動に移させること」、つまり「APを購入させること」である。
8ステップのアウトプットはAPというプロダクトを売るための営業トークであり、全ステップはその目的のために存在する。

【各ステップの役割】
- T-UP：聴き手のインパルスを引き上げ「この話を聞かなければ損だ」と前のめりにさせる（導入・初期インパルス）
- 結論〜再結論：APの価値・必要性をロジックと例で証明し「なぜこのAPをやるべきか」を腹落ちさせる（ショートストーリー〜プレゼン）
- APのT-UP〜AP：インパルスをピークに引き上げてからAPを提示し「今すぐやる」という購買決定を取る（クロージング）

このトークを「業界用語を知らない初めての聴き手」が聞いた場合に：
① APの価値・必要性を理解できるか
② APをやりたいというインパルスが上がるか
③ APを実際に行動に移したくなるか
この3点が評価の根幹。どれほど形式が整っていても聴き手が「APをやろう」と思わないアウトプットには高得点を与えない。

━━━━━━ 8ステップ採点基準 ━━━━━━
【重要な前提】「${moduleName}」というモジュール名は「結論」ステップで初めて明かすのが正しい構成である。
結論でモジュール名を言うことは正しい行為であり、絶対に減点してはならない。
減点対象は「T-UP（結論より前のステップ）でモジュール名をバラすこと」のみ。

各ステップの採点は0〜10点。以下のスコア帯を厳守すること。

1. T-UP（必須）：答え（「${moduleName}」等のワード）を冒頭でバラしてはならない。ストーリーや興味付けで聞き手のインパルス（熱量）を最大に引き上げられているか。
   ▸ 0-3点：モジュール名・答えを冒頭でバラしている、または興味付けが全くない
   ▸ 4-6点：バラしてはいないが興味付けが弱い・インパルスがほぼ上がらない
   ▸ 7-8点：興味付けはできているがgreed factorの強度が弱い
   ▸ 9-10点：モジュール名をバラさず、greed factorで「聞かないと損」「知らないと危ない」レベルの強烈なインパルス引き上げができている

2. 結論：「${moduleName}」というモジュール名をここで初めて明かし、その核心を一言で強烈に言語化しているか。結論ファーストで明快か。※ここでモジュール名を言うのは正しい・減点しない。
   ▸ 0-3点：核心が曖昧・モジュール名の説明だけで終わっている
   ▸ 4-6点：結論はあるが言い切りが弱い・一言で落ちていない
   ▸ 7-8点：明快な結論があるがインパクトが弱め
   ▸ 9-10点：モジュール名を初めて明かし「これだ」と即座に刺さる強烈な一言で核心を言い切っている

3. 内容：「なぜ${moduleName}が絶対に必要なのか」をロジックと仕組みで解説しているか。
   ▸ 0-3点：「やる気が大事」「気持ちで勝て」等の精神論・道徳論のみ（NG）
   ▸ 4-5点：ロジックの片鱗はあるが説明が浅い・または精神論が多数混在
   ▸ 6-7点：ロジックと仕組みで説明できているが、フレームワーク（アプローチ話法/インパルスファクター/5ステップス）への言及がない
   ▸ 8-9点：ロジックが明快 + アプローチ話法・インパルスファクター・5ステップスのいずれかへの具体的言及がある
   ▸ 10点：ロジックが明快 + 複数のフレームワーク要素が有機的に組み込まれ、初心者でも論理的に理解できる

4. 一般的な例：営業未経験者でも1秒で直感的に納得できる日常例か。かつ内容で説明した側面を具体化した例になっているか（内容と関係のない例はAP理解を妨げるため減点）。ある程度の誇張はOKだが、フィクションに寄りすぎて「自分には関係ない話」になるのはNG。聴き手が「自分ごと」として想像できる範囲に収まっているかを確認する。
   ▸ 0-3点：例が難解・業界用語だらけ・内容と無関係で混乱を招く、または現実離れしすぎて誰も自分ごとにできない
   ▸ 4-6点：例はあるが「確かに！」の瞬発力がない・内容との繋がりが弱い・または少し非現実的で共感しにくい
   ▸ 7-8点：わかりやすい例で内容と繋がっているが、APへの橋渡しとしての強度が弱い
   ▸ 9-10点：「そういうことか！」と1秒で腑に落ち、誰でも自分ごとにできる身近さがあり、内容→例→APの流れが自然につながる対比が明確な例

5. 稼働における例：明日の現場でそのままイメージして使えるほどリアルで生々しいシーンか。かつ内容で説明した側面を現場に落とした例になっているか（内容と無関係な現場話はNG）。ある程度のドラマチックな演出はOKだが、フィクションに寄りすぎて「そんな状況ありえない」となるのはNG。聴き手が「明日の自分の稼働でありえる」と想像できる範囲に収まっているかを確認する。アプローチ話法・インパルスファクターの活用シーンに紐づいているとさらに加点。
   ▸ 0-3点：抽象的・現場感ゼロ・内容と無関係・または非現実的すぎて誰も自分ごとにできない
   ▸ 4-6点：現場の話はあるが生々しさが弱い・内容との繋がりが弱い・または少し非現実的で「自分の現場」として想像しにくい
   ▸ 7-8点：生々しい現場シーンで内容と繋がっているが、アプローチ話法やインパルスファクターとの紐づけが弱い
   ▸ 9-10点：内容→稼働例→APの流れが一本線で繋がり、誰でも「明日の自分の現場」として想像できるリアルさがあり、アプローチ話法/インパルスファクターが実際に使われている生々しい架電・現場シーン

6. 再結論：最初の結論より確信度・納得度がさらに深まる強烈な言い切りになっているか。
   ▸ 0-3点：最初の結論の繰り返しのみ・コピペレベル
   ▸ 4-6点：少し深まっているが確信の強さが弱い・「だから大事」程度
   ▸ 7-8点：具体例を経た上での確信が出ており「やっぱりそうだ」と感じさせる
   ▸ 9-10点：最初の結論より圧倒的に確信・納得度が深まり、一切迷いなく言い切っており「これをやらない選択肢はない」レベル

7. APのT-UP（必須）：APの具体的な行動内容をいきなりバラさず、行動への強力な動機付けとストーリーでインパルスを引き上げてからAPへつなげているか。
   ▸ 0-3点：APの内容を直接バラしている・または「よろしくお願いします」程度の締め言葉のみ
   ▸ 4-6点：動機付けはあるが弱い・インパルスが上がり切らない・urgencyがない
   ▸ 7-8点：行動への動機付けがあり「やらなければ」という気持ちになる
   ▸ 9-10点：APをバラさず「今すぐやらなければ今日の学びがすべてドブになる」レベルの強力インパルス引き上げ + sense of urgency/indifferenceの両立

8. AP（最重要）：「意識します」「頑張ります」は一発不合格。誰が見ても実行したか判断できる行動ベース（分・秒単位・件数など数値や事実で確認できるレベル）で具体化されているか。さらに「内容で説明した側面」とAPが一致していること（例：内容で笑顔の話だけしたなら、APも笑顔に関する行動であるべき。内容と無関係なAPは大幅減点）。
   【重要】APの最終的な行動は必ず「仕事（架電・稼働・日報など現場の業務）で行う具体的な行動」でなければならない。ゲーム・スポーツ・趣味などの例で概念を説明するのはOKだが、行動の着地点が「ゲームをやる」「趣味を楽しむ」など仕事以外の活動で終わっているのは失格。聴き手が「この話を聞いて明日の仕事で何をすればいいのか」が明確にわかること。
   ▸ 0-2点：「意識します」「頑張ります」「心がけます」等の精神論AP（即失格）／または行動の着地点が仕事ではなくゲーム・趣味等で終わっている（即失格）
   ▸ 3-5点：行動には触れているが数値・時間・件数がなく確認できない、または内容と大きくズレている
   ▸ 6-7点：数値はあるが「いつ」「何を」のどちらかが曖昧、または内容との一貫性が弱い
   ▸ 8-9点：いつ・何を・何回/何分/何件が明確 かつ 内容で説明した側面と一致している
   ▸ 10点：いつ・何を・何回/何分/何件が完全に数値化され、誰が見ても実行有無を事実確認できる かつ 内容で取り上げた側面と完全に一致している

合否判定：T-UPで答えをバラしておらず、APのT-UPが行動へのインパルスを引き上げており、APが行動ベース、かつ合計64点以上（8ステップ×10点満点×80%）なら "合格"、それ以外は "要書き直し"。

【重要】スコアを出す前に、必ず以下の手順で考えること：
1. まず "reasoning" フィールドで各ステップを詳細に分析する
2. その分析に基づいて "scores" を決定する
3. reasoning を書いた後にスコアを変えてはならない（分析と点数を一致させること）

━━━━━━ 言語チェック（languageCheck）━━━━━━
台本として「人前で読む」際の言葉の自然さを評価する。以下を必ず確認すること：
- 「ですね」「んですね」「ますね」などの文末が繰り返されていないか（3回以上連続 → 要指摘）
- 同じ接続詞・副詞（「なので」「じゃあ」等）が多用されていないか
- 一文が長すぎて息継ぎできない構造になっていないか
- "score"：文末の単調さ・繰り返しの少なさで採点（10＝ほぼ問題なし、1＝全文同じ文末）
- "patterns"：実際に何回使われているか数えて記録する（0回のパターンは含めない）
- "improved"：最も繰り返しの多い箇所だけを抜き出して文末を整えた1〜3文の修正例

必ず次のJSONのみを出力（前後に説明文やコードフェンスを付けない）：
{
  "reasoning": {
    "tup": "T-UPの分析：T-UP内でモジュール名をバラしていないか／greed factorでインパルスを引き上げているか／ストーリーと興味付けの質はどうか（2〜3文）。※結論でのモジュール名開示はここで言及しない",
    "conclusion": "結論の分析：モジュール名をここで初めて明かし核心を一言で言い切れているか／結論ファーストか（1〜2文）",
    "content": "内容の分析：精神論になっていないか／ロジックと仕組みで説明しているか／フレームワーク（アプローチ話法・インパルスファクター・5ステップス）への言及はあるか（2〜3文）",
    "example": "一般例の分析：営業未経験者が1秒で直感的に納得できるか／対比構造があるか（1〜2文）",
    "workExample": "稼働例の分析：現場のリアルなシーンか／内容で説明した側面と繋がっているか／アプローチ話法やインパルスファクターは使われているか（2〜3文）",
    "reconclusion": "再結論の分析：最初の結論より確信・納得度が深まっているか／言い切りの強度はどうか（1〜2文）",
    "apTup": "APのT-UPの分析：行動内容をバラしていないか／インパルスを引き上げているか／sense of urgencyとindifferenceが出ているか（1〜2文）",
    "ap": "APの分析：数値・時間・件数で実行確認できるか／精神論になっていないか／具体的に何をいつやるかが明確か／行動の着地点が『仕事（架電・稼働・現場の業務）での具体的な行動』か（ゲームや趣味で終わっていないか）（2〜3文）",
    "consistency": "一貫性の分析（以下の順で必ず確認）：①内容でどの側面・テーマを取り上げたかを特定する。②APを構成要素に分解する（例：「目標と振り返り」なら「目標設定」と「振り返り→実感→継続」の2要素）。③一般例・稼働例の中でAPの各構成要素が実際のシーンとして描写されているかを1要素ずつ確認する。④欠けている要素があれば「例の中に〇〇の場面がない」と具体的に指摘する。⑤内容→例→APで一本線が通っているかを総評する（3〜4文）",
    "clarity": "APを売る視点での総評：業界用語・専門用語を説明なしで使っていないか／APの価値・必要性が初心者でも理解できる説明量か／全体の流れで「APをやりたい」というインパルスが上がり行動コミットにつながるかを分析（2〜3文）"
  },
  "scores": { "tup": 0, "conclusion": 0, "content": 0, "example": 0, "workExample": 0, "reconclusion": 0, "apTup": 0, "ap": 0 },
  "total": 0,
  "verdict": "合格" | "要書き直し",
  "good": "良かった点を熱く具体的に（2〜3文）",
  "tupCheck": "T-UP（結論より前）でモジュール名をバラしていないか・インパルスを最大限に引き上げているかへの一言指摘。※結論でのモジュール名開示は正しい構成なので言及しない",
  "apTupCheck": "APのT-UPで行動へのインパルスを引き上げてからAPへつなげているかへの一言指摘",
  "apCheck": "APが行動ベースで数値・事実で確認できるレベルか、かつ行動の着地点が『仕事（架電・稼働）での具体的な行動』になっているかへの一言指摘。ゲームや趣味の例で説明したまま仕事の行動に変換されていない場合は『APが仕事の行動に繋がっていない』と明確に指摘すること",
  "impulseFactorCheck": "インパルスファクター6要素（greed factor/fear of loss/bandwagon/suggestion/indifference/sense of urgency）のうちどれが使われていてどれが不足しているか。特にindifferenceとsense of urgencyという2つの生命線が意識されているかを指摘（1〜2文）",
  "approachTechniquesCheck": "アプローチ話法6つ（hand in/High&Low/stress the deal/fear of loss/bandwagon/suggestion）のうち内容・稼働例でどれが活用されていてどれが不足しているかを指摘（1〜2文）",
  "stepsCheck": "「APを購入させる」という目的に対して、アウトプット全体の流れが5ステップスを体現した構成になっているかの評価：T-UPが導入（インパルス初期引き上げ）として機能しているか／内容・例がショートストーリー+プレゼン（APの価値証明）として機能しているか／APのT-UP→APがクロージング（購買決定を取る）として機能しているか（1〜2文）",
  "consistencyCheck": "内容→例→APの一貫性評価：【必須チェック】APを構成要素に分解し（例：「目標と振り返り」→「目標設定」と「振り返りによる成長実感・継続」の2要素）、一般例・稼働例の中でその全要素が描写されているかを確認する。欠けている要素があれば「例の中に〇〇の場面がなく、APの〇〇の部分が例で証明されていない」と具体的に指摘すること。内容・例・APが一本線で繋がっていれば合格（2〜3文）",
  "clarityCheck": "APを購入させる視点での評価：①APの価値・必要性を初めての聴き手が理解できるか②APをやりたいというインパルスが上がるか③APを実際に行動に移したくなるか④例や稼働例が「自分ごと」として想像できる現実的な範囲に収まっているか（フィクションに寄りすぎていれば具体的に指摘）。達成できていない点があれば具体的に指摘（1〜2文）",
  "improvements": ["改善提案1", "改善提案2", "改善提案3"],
  "comment": "プロマネージャーからの熱いひとことFB（1〜2文）",
  "languageCheck": {
    "score": 0,
    "verdict": "自然" | "やや気になる" | "要改善" | "要全面見直し",
    "patterns": [{"ending": "繰り返しパターン（例：んですね）", "count": 回数, "level": "高" | "中" | "低"}],
    "issues": ["指摘事項（最大3個。なければ空配列）"],
    "tips": ["文末バリエーションの具体的ヒント（最大2個）"],
    "improved": "最も繰り返しが多い箇所を1〜3文だけ修正した例（問題がなければ空文字）"
  }
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

// ── ⑤ 理解チェック - 問題生成 ──
export async function generateUnderstandingQuestion(moduleId) {
  const mid = moduleId || ACTIVE_MODULE;
  const moduleName = MODULES[mid].manual.title;
  const system = `${getPersona(mid)}

${getKnowledge(mid)}

あなたは「${moduleName}」の本質的な理解度を確認する問題を作る役割です。
表面的な知識（定義を暗記しているか）ではなく、本質を掴んでいるかを問う問いを作ってください。

条件：
- 「${moduleName}とは何ですか？」のような単純な定義問いはNG
- 「なぜ〇〇なのか」「〇〇がない人はどうなるか」「〇〇と△△の違いは何か」など本質を問うこと
- ヒントは「何を考えればいいか」の方向性のみ（答えを教えない）

必ず次のJSONのみを出力：
{
  "mainQuestion": "本質を問うメインの問い（1文）",
  "subQuestion": "さらに深掘りするサブの問い（1文）",
  "hint": "考える方向性のヒント（1文、答えは含めない）"
}`;
  return runJSON(system, `「${moduleName}」の理解度チェック問題を作成してください。`, 0.7);
}

// ── ⑥ 理解チェック - 回答評価 ──
export async function evaluateUnderstanding(moduleId, question, subQuestion, answer) {
  const mid = moduleId || ACTIVE_MODULE;
  const moduleName = MODULES[mid].manual.title;
  const system = `${getPersona(mid)}

${getKnowledge(mid)}

あなたは「${moduleName}」の理解度を評価するプロコーチです。
「なんとなく正しい」ではなく「本質を掴んでいるか」を基準に厳しく評価してください。

採点基準：
- 9〜10点：本質を完全に言語化できており、表面的な理解との差も説明できる
- 7〜8点：本質は掴んでいるが、言語化が浅い部分がある
- 5〜6点：部分的に理解しているが重要な要素が抜けている
- 3〜4点：表面的な理解のみ。本質が見えていない
- 1〜2点：ほぼ理解できていない

必ず次のJSONのみを出力：
{
  "score": 数値(1〜10),
  "verdict": "本質理解" | "理解中" | "部分理解" | "要学習",
  "understood": ["理解できている点を具体的に（1〜3個）"],
  "missing": ["抜けている本質的な要素を具体的に（1〜3個）"],
  "trueEssence": "この概念の真の本質（3〜5文。知識として教えるように丁寧に）",
  "comment": "全体的なコメント（2〜3文、厳しめかつ建設的に）"
}`;
  const user = `【問い1】${question}\n\n【問い2】${subQuestion}\n\n【回答】\n${answer || '(未回答)'}`;
  return runJSON(system, user, 0.4);
}
export async function modelScript(theme, moduleId) {
  const t = (theme || '').trim();
  const mid = moduleId || ACTIVE_MODULE;
  const moduleName = MODULES[mid].manual.title;
  const system = `${getPersona(mid)}

${getKnowledge(mid)}

これは「お手本スクリプト生成」です。
採点基準で全ステップ10点・合計80点満点を取れる「${moduleName} の最高品質模範説明スクリプト」を生成してください。

━━ 各ステップの満点基準（これを完全に満たすこと）━━

【1. T-UP／10点満点の条件】
- 「${moduleName}」というワードを冒頭で絶対にバラさない
- greed factor（得したい・損したくない本能）を刺激するショートストーリーで開始
- 「これを知らないと〇〇になる」「これを極めれば〇〇できる」レベルの強力な興味付けで
  聞き手のインパルスを最大限に引き上げ、前のめりな状態を作る

【2. 結論／10点満点の条件】
- 結論ファーストで「${moduleName}」の核心を一言で強烈に言語化
- ブレのない明快な一言。スキル・仕組みであることを明確にする

【3. 内容／10点満点の条件】
- 「なぜ${moduleName}が絶対に必要なのか」をロジックと仕組みで解説（精神論・道徳論NG）
- アプローチ話法（hand in/High&Low/stress the deal/fear of loss/bandwagon/suggestion）の
  少なくとも2つを「${moduleName}」の解説に組み込む
- インパルスファクターの順序（greed factor→fear of loss→bandwagon→suggestion）と
  「${moduleName}」の関係性を論理的に紐づける

【4. 一般的な例／10点満点の条件】
- 営業未経験者・新人が「確かに！」と1秒で直感的に納得できる日常例（スポーツ・ゲーム・映画等）
- 「${moduleName}」がある人/ない人の対比で差が一目でわかる構成にする

【5. 稼働における例／10点満点の条件】
- 5ステップス（導入/ショートストーリー/ヒアリング/プレゼン/クロージング）の具体的な1シーンに紐づける
- アプローチ話法（bandwagon/fear of loss/suggestion等）を実際に使っている生々しい架電・現場シーンを描く
- 「${moduleName}」がある人とない人の結果の差が明確に見えること

【6. 再結論／10点満点の条件】
- 最初の「結論」より確信・納得度がさらに深まる強烈な言い切り
- 具体例を経た上で「だからこそ絶対に必要」という確信を一切の迷いなく落とし込む

【7. APのT-UP／10点満点の条件】
- APの具体的な行動内容をいきなりバラさない
- 「明日これを発動させなければ今日の学びはすべてドブに捨てることになる」レベルの
  行動への強力な動機付けとインパルスの再引き上げ
- sense of urgency（今すぐ動く緊急性）とindifference（余裕のある言い切り）を両立させる

【8. AP／10点満点の条件】
- 「意識します」「頑張ります」「心がけます」は絶対NG・即0点
- 「いつ・何を・何回/何分/何件」まで数値で明記し、誰が見ても実行したか事実で確認できること
- 例レベル：「架電中に作業感を感じた瞬間に心の中で『はぐれメタル！』と叫び、
  次の1コールで声のトーンを3倍に上げる。稼働終了後に『今日楽しかった瞬間』を
  日報に3つ以上書き出してから退勤する」

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

// ── ⑦ 台本言語チェック（話し言葉の自然さ・繰り返しパターン検出）──
export async function checkScriptNaturalness(script) {
  const system = `あなたは話し言葉・スピーチ原稿の専門コーチです。
「人前で読む台本」として提出された文章を分析し、聴き手が違和感を覚える表現パターンを指摘してください。

最重要チェック項目：
1. 文末の繰り返し（「ですね」「んですね」「ますね」などが連続していないか）
2. 一文が長すぎて息継ぎできないか
3. 同じ接続詞・副詞の繰り返し（「なので」「じゃあ」など）
4. 話し言葉として不自然な表現

ルール：
- 各セクション（①T-UP〜⑦APなど）が含まれていれば、セクション単位で指摘すること
- "improved"（修正例）は原文の意味を変えず、文末だけを自然に整えた例を書くこと
- スコアは台本全体の「聴き手への自然さ」で判断（繰り返しが多いほど低い）

必ず次のJSONのみを出力：
{
  "patterns": [
    { "ending": "繰り返しパターン例", "count": 回数, "level": "高" }
  ],
  "sections": [
    {
      "name": "セクション名",
      "issueCount": 0,
      "issues": ["具体的な指摘"],
      "improved": "このセクションの文末を整えた修正例"
    }
  ],
  "totalSentences": 0,
  "score": 0,
  "verdict": "自然" | "やや気になる" | "要改善" | "要全面見直し",
  "summary": "全体的な総評（2〜3文）",
  "tips": ["改善ヒント1", "改善ヒント2"]
}`;

  return runJSON(system, `以下の台本を分析してください。\n\n${(script || '').trim()}`, 0.3);
}
