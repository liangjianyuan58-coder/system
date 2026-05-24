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

  // attitude: { manual: {...}, steps: [...] },          // ← 将来ここに追加
  // studentMentality: { manual: {...}, steps: [...] },  // ← ← ←
};

// 現在アクティブなモジュール
export function getModule() {
  return MODULES[ACTIVE_MODULE];
}

// ステップの key 配列（バリデーション/保存で使用）
export const STEP_KEYS = MODULES[ACTIVE_MODULE].steps.map((s) => s.key);

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
