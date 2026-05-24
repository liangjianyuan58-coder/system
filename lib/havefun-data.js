// =============================================================
// lib/havefun-data.js
// 初期テキスト管理（旧 data.gs）
// マニュアル＋7ステップ定義を一元管理。サーバー/クライアント両方から参照。
// ★将来 Attitude / Student Mentality へ拡張する際は、
//   MODULES に追記し ACTIVE_MODULE を切り替えるだけ。
// =============================================================

// 現在アクティブな研修モジュール
export const ACTIVE_MODULE = 'havefun';

// 1アウトプット = +10EXP / 100EXPで1レベル
export const EXP_PER_OUTPUT = 10;
export const EXP_PER_LEVEL = 100;

// 全モジュールのテキストデータ（1モジュール = { manual, steps }）
export const MODULES = {
  havefun: {
    manual: {
      title: 'Have fun',
      reading: 'ハブファン',
      tagline: '物事を楽しむセンスを磨く',
      summary:
        'ビジネス・営業現場における最重要マインドセット。' +
        '「楽しむこと」は生まれ持った才能ではなく、訓練で身につく“スキル”。' +
        '単調な作業や面倒な状況も、自分の捉え方ひとつでクリエイティブでワクワクする仕事に変換する技術です。',
      points: [
        { label: '楽しむ＝スキル', desc: '気合や性格ではなく、磨ける技術。誰でも後天的に習得できる。' },
        { label: '単調 → クリエイティブ', desc: '作業を「攻略ゲーム」に変換し、退屈をやりがいに変える。' },
        { label: '困難 → レアイベント', desc: 'クレームやトラブルを“はぐれメタル”級のチャンスとして捉える。' },
      ],
      oneLiner: '「同じ現場なら、楽しんだ者勝ち。」',
    },

    // 黄金のアウトプットフロー（7ステップ）。key は保存データと一致。
    steps: [
      {
        no: 1, key: 'tup', label: 'T-UP（ティーアップ）',
        hint: '直接答えをバラさない。相手の「聞きたい」を引き出し、期待値（インパルス）を上げる前振り。',
        example: '例：「同じ仕事してるのに、毎日楽しそうな人としんどそうな人がいるの、気づいてます？」',
        rows: 2,
      },
      {
        no: 2, key: 'conclusion', label: '結論',
        hint: 'Have fun の核心を“一言”で言い切る。',
        example: '例：「楽しむことは、才能じゃなくてスキルです。」',
        rows: 2,
      },
      {
        no: 3, key: 'content', label: '内容',
        hint: 'なぜそう言えるのか、仕組みで説明する。「楽しむ＝スキル」「単調をクリエイティブに変える捉え方」。',
        example: '例：捉え方を変えるだけで、脳は同じ作業を“攻略対象”として処理し始める。',
        rows: 3,
      },
      {
        no: 4, key: 'example', label: '一般的な例',
        hint: '誰でもわかる日常の例。ゲーム・アニメ・映画など。',
        example: '例：ドラクエのレベル上げ。作業自体は単調でも「強くなる過程」と思えば夢中になれる。',
        rows: 3,
      },
      {
        no: 5, key: 'workExample', label: '稼働における例',
        hint: 'コール現場など、自分の仕事に落とし込んだ具体例。',
        example: '例：クレーム＝はぐれメタル。逃すと痛いが、倒せば一気に経験値が跳ね上がるレアキャラ。',
        rows: 3,
      },
      {
        no: 6, key: 'reconclusion', label: '再結論',
        hint: 'だからこそ Have fun が絶対に重要、という確信をもう一度。',
        example: '例：捉え方を制する者が、現場を制す。だから楽しむスキルは最優先で磨く。',
        rows: 2,
      },
      {
        no: 7, key: 'ap', label: 'AP（アクションプラン）',
        hint: '“今この瞬間から”具体的にどう行動するかの約束。明日ではなく今から。',
        example: '例：次の1コールを「攻略対象キャラとの戦闘」だと思って、ワクワクしながら臨む。',
        rows: 2,
      },
    ],
  },

  studentMentality: {
    manual: {
      title: 'Student Mentality',
      reading: 'スチューデント・メンタリティ',
      tagline: '学ぶ姿勢・教わる前提で最速成長する',
      summary:
        '自分の過去の経験やプライドを完全に捨て、成果を出している先達の言葉を素直に受け入れ即実行する学習態度。' +
        '「教える前提」でインプットし、行動の裏にある思考・ロジックまで盗み取り、自らダメ出しを奪いに行く能動性こそが研修スピードを爆発的に高める。',
      points: [
        { label: '素直に即実行', desc: '自己フィルターを排除し、成功者のシステムにパスタのレシピのように忠実に従う。' },
        { label: '教える前提のインプット', desc: '明日新人に教えるつもりで聞くだけで定着率が2倍以上変わる。' },
        { label: 'ダメ出しを奪いに行く', desc: '指導を待つ受動から、自ら課題を聞きに行く能動へ。' },
      ],
      oneLiner: '「プライドを捨てた瞬間、成長のリミッターが外れる。」',
    },
    steps: [
      {
        no: 1, key: 'tup', label: 'T-UP（ティーアップ）',
        hint: '直接答えをバラさない。「これを身につけるだけで10倍速く成長する」等で期待値を最大に。',
        example: '例：「研修で一番伸びる人と伸びない人の"たった1つの違い"、知りたくないですか？」',
        rows: 2,
      },
      {
        no: 2, key: 'conclusion', label: '結論',
        hint: 'Student Mentality の核心を"一言"で言い切る。',
        example: '例：「スチューデント・メンタリティとは、プライドを捨てて教える前提で全てを素直に吸収するスキルです。」',
        rows: 2,
      },
      {
        no: 3, key: 'content', label: '内容',
        hint: 'なぜ必要か、仕組みで説明。「教える前提で定着率2倍」「TTPは思考ロジックまで盗む」「自らFBを取りに行く」。',
        example: '例：自分のフィルターで判断した瞬間に成長は止まる。結果を出している仕組みに忠実に自分を適応させる必要がある。',
        rows: 3,
      },
      {
        no: 4, key: 'example', label: '一般的な例',
        hint: '誰でもわかる日常の例。自転車の練習、料理のレシピ、部活の先輩から学ぶ等。',
        example: '例：パスタのレシピを勝手にアレンジする人は毎回失敗する。まず型通りに作れてから応用するのが最短。',
        rows: 3,
      },
      {
        no: 5, key: 'workExample', label: '稼働における例',
        hint: 'コール現場でのリアルなシーン。ダメ出しへの反応、トップのログ分析、リーダーへの質問等。',
        example: '例：ダメ出しされたら「ボーナスチャンスだ」と捉え、1秒で「もう一回お願いします！」と食らいつく。',
        rows: 3,
      },
      {
        no: 6, key: 'reconclusion', label: '再結論',
        hint: 'だからこそ Student Mentality が絶対に重要、という確信をもう一度。',
        example: '例：素直さは才能じゃなく選択。選んだ瞬間から全ての学びが何倍にも加速する。',
        rows: 2,
      },
      {
        no: 7, key: 'ap', label: 'AP（アクションプラン）',
        hint: '"今この瞬間から"何をするか。抽象×→行動ベースで実行確認できるレベルまで具体化。',
        example: '例：「稼働後、リーダーに『今日の私の課題を3つダメ出ししてください』と自分から言いに行く。」',
        rows: 2,
      },
    ],
  },
};

// モジュール一覧（UIのセレクタ用）
export const MODULE_LIST = Object.entries(MODULES).map(([id, m]) => ({ id, title: m.manual.title }));

// 現在アクティブなモジュール（デフォルト）
export function getModule(moduleId) {
  return MODULES[moduleId || ACTIVE_MODULE];
}

// ステップの key 配列（バリデーション/保存で使用）
export const STEP_KEYS = MODULES[ACTIVE_MODULE].steps.map((s) => s.key);

// 動的にステップ key を取得
export function getStepKeys(moduleId) {
  const mod = MODULES[moduleId || ACTIVE_MODULE];
  return mod ? mod.steps.map((s) => s.key) : STEP_KEYS;
}

// EXP からレベル情報を算出
export function calcStats(exp) {
  return {
    exp,
    level: Math.floor(exp / EXP_PER_LEVEL) + 1,
    expInLevel: exp % EXP_PER_LEVEL,
    expPerLevel: EXP_PER_LEVEL,
    expPerOutput: EXP_PER_OUTPUT,
  };
}
