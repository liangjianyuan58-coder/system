# Have fun トレーニング（Next.js + Vercel + Google Sheets）

「物事を楽しむセンス（Have fun）」を鍛えるトレーニングアプリ。
フロントは **Vercel** で公開、データは **Google スプレッドシート** にサービスアカウント経由で直接保存します（GAS不要）。
AI査定・フィードバックは **Gemini API（gemini-2.5-flash）** を使用します。

## 機能

- **① 7ステップ査定**：黄金のアウトプットフロー（T-UP〜AP）を入力 → スプレッドシート保存＋EXP獲得（RPG演出）＋**連続記録（ストリーク）**表示＋Geminiが70点満点で査定。「お手本スクリプト生成」でテーマ別の模範例をワンタップ流し込みも可能。
- **② リフレーミング・ジム**：現場のネガ事象をお題に出し、捉え方を変えてプラス化 → Geminiが「楽しい−悲しいをプラスにできたか」を10点満点で査定＋お手本。
- **③ こじつけ力強化**：無関係な単語のお題をHave funにこじつけ → Geminiが10点満点＋お手本こじつけ。
- **LINE連携（Messaging API）**：①毎日のリマインドを公式アカウントから一斉通知（Vercel Cron）／②LINEに送った文章をその場でGeminiが添削して返信するBot。

> ※ LINE Notify は2025年3月末で終了したため、通知は後継の **LINE Messaging API**（公式アカウント）を使用します。

---

## 構成

```
havefun-next/
├── app/
│   ├── layout.js              ルートレイアウト
│   ├── page.js                モード切替タブ
│   ├── globals.css            クラシックRPG風デザイン
│   ├── components/
│   │   ├── OutputTrainer.js    モード①：7ステップ＋AI査定
│   │   └── KojitsukeMode.js    モード②：こじつけ力強化
│   └── api/
│       ├── stats/route.js     GET: 現在EXP（シート行数から算出）
│       ├── save/route.js      POST: 7ステップ検証→シート追記
│       ├── feedback/route.js  POST: Geminiで7ステップ査定（70点満点）
│       └── kojitsuke/route.js POST: Geminiでこじつけ査定＋お手本例
├── lib/
│   ├── havefun-data.js        マニュアル＋7ステップ定義（★拡張ポイント）
│   ├── havefun-knowledge.js   マスターナレッジ全文（Gemini採点基準）
│   ├── gemini.js              Gemini連携（査定／こじつけFB）
│   ├── words.js               こじつけお題の単語プール
│   └── sheet.js               Google Sheets 接続ヘルパー
├── .env.local.example         環境変数のサンプル
├── package.json
└── next.config.mjs
```

EXPは別途DBを持たず「保存済み行数 × 10」で算出するため、シート1枚だけで完結します。

---

## セットアップ手順

### 1. Google 側の準備（初回のみ）

1. [Google Cloud Console](https://console.cloud.google.com) でプロジェクトを作成
2. 「APIとサービス」→「ライブラリ」で **Google Sheets API** を有効化
3. 「認証情報」→「認証情報を作成」→ **サービスアカウント** を作成
4. 作成したサービスアカウントの「キー」→「鍵を追加」→ **JSON** をダウンロード
   - JSON内の `client_email` と `private_key` を後で使う
5. 保存先のスプレッドシートを新規作成し、**サービスアカウントのメールアドレス**（`〜@〜.iam.gserviceaccount.com`）を **編集者** として共有する
   - ※これを忘れると保存できません（最頻出のつまずきポイント）
6. スプレッドシートのURL `https://docs.google.com/spreadsheets/d/【ここがID】/edit` から **ID** を控える
7. [Google AI Studio](https://aistudio.google.com/apikey) で **Gemini APIキー** を発行する（AI査定に使用）

### 2. ローカルで動かす

```bash
npm install
cp .env.local.example .env.local   # 中身を自分の値に書き換える
npm run dev                        # http://localhost:3000
```

`.env.local` には次の4つを設定：

| 変数 | 値 |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | JSONの `client_email` |
| `GOOGLE_PRIVATE_KEY` | JSONの `private_key`（`"-----BEGIN...\n...\n-----END...\n"` をダブルクオートで囲む） |
| `SHEET_ID` | スプレッドシートのID |
| `GEMINI_API_KEY` | Google AI Studio で発行したキー |
| `LINE_CHANNEL_ACCESS_TOKEN` | （LINE連携を使う場合）Messaging API の長期アクセストークン |
| `LINE_CHANNEL_SECRET` | （同上）Webhook署名検証用のチャネルシークレット |
| `CRON_SECRET` | （同上）リマインドCronの不正実行防止トークン（任意の長い文字列） |

LINE連携を使わない場合、下3つは未設定でOK（Webアプリの①②③は動きます）。

### 3. GitHub → Vercel デプロイ

1. このフォルダをGitHubリポジトリにpush
2. [Vercel](https://vercel.com) で「New Project」→ そのリポジトリを Import（Framework は自動で Next.js）
3. **Settings → Environment Variables** に上記4つ（`GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` / `SHEET_ID` / `GEMINI_API_KEY`）を登録
   - `GOOGLE_PRIVATE_KEY` は、JSONの `private_key` の値をそのまま貼り付ける（改行入りのままでOK。コード側で `\n` を復元します）
4. Deploy → 発行されたURLでアプリが動きます

以降はGitHubにpushするたびにVercelが自動で再デプロイします。

---

## LINE連携のセットアップ（任意）

通知Bot・添削Botを使う場合のみ。

1. [LINE Developers](https://developers.line.biz/) でプロバイダーを作成し、**Messaging API チャネル**を作成（LINE公式アカウントが紐づく）
2. チャネル設定から **チャネルシークレット**と、**長期のチャネルアクセストークン**を発行
3. Vercel の環境変数に `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` / `CRON_SECRET` を登録して再デプロイ
4. LINE Developers の **Messaging API設定**で：
   - Webhook URL に `https://<あなたのVercelドメイン>/api/line/webhook` を設定し、**Webhookの利用をON**
   - 「応答メッセージ（自動応答）」は**OFF**（Botの返信と競合するため）
5. 公式アカウントを友だち追加 → メッセージを送ると、その場でGeminiが添削して返信します。

### 毎日のリマインド（Cron）
`vercel.json` に毎日のCronを定義済みです（`0 10 * * *` = **UTC10時 = 日本時間19時**）。
時刻を変えたい場合は `schedule` を編集してください（VercelのCronはUTC基準）。
本番デプロイで自動的に有効になり、`/api/cron/remind` が叩かれて「今日まだ記録が無ければ」友だち全員へ一斉通知します。

### 注意・制約
- **無料枠**：Messaging API は月200通まで（送信人数×通数でカウント）。友だちが増えると有料プラン検討が必要です。
- **個別通知・個人別ストリークは未対応**：現状はユーザー識別が無く、通知は「全員へ一斉」、ストリークは「システム全体」の連続日数です。
  個人ごとにやるには **LINEログイン / LIFF** でユーザーIDを取得する拡張が必要です（次段の課題）。

---

## 将来の拡張（モジュール／個人識別）

### ユーザー識別（実装済み：方式A／名前入力）
- 端末ごとに一意の `userId` を発行して `localStorage` に保存し、画面上部で設定した「名前」と一緒に各アウトプットへ保存します（シート列：`ユーザーID`・`名前`）。
- これにより「誰が・いつ・どんなアウトプットをしたか」が **📋履歴タブ**（全員／自分で切替）とスプレッドシートの両方で確認でき、EXP・連続記録（ストリーク）も**個人ごと**に集計されます。
- データ契約は `{ userId, name, ...7steps }` で統一。**方式B（LINEログイン/LIFF）** へ移行する際は、`lib/identity.js` を「LINEの検証済みユーザーID・表示名を返す」実装に差し替えるだけで、API・シート・集計はそのまま使えます。

> ⚠ スキーマ変更：シートに `ユーザーID`・`名前` 列が追加されました。旧バージョンで作成済みのシートに古いデータがある場合は、当該シートを削除して作り直す（次回保存時に新スキーマで自動生成）のが確実です。空シートなら自動で新ヘッダーに更新されます。

### モジュール拡張（Attitude / Student Mentality 等）

`lib/havefun-data.js` にすべてのテキストとフロー定義を集約しています。

```js
export const MODULES = {
  havefun: { manual: {...}, steps: [...] },
  attitude: { manual: {...}, steps: [...] },   // ← 追加
};
export const ACTIVE_MODULE = 'havefun';        // ← 切り替え
```

`MODULES` にモジュールを追記し、`ACTIVE_MODULE` を変えるだけで、UIやAPIに手を入れず別研修へ展開できます。
（保存シートを分けたい場合は、モジュールごとに `SHEET_ID` を切り替える実装に拡張するのが簡単です）

---

## 注意

- スプレッドシートにサービスアカウントを**編集者**で共有していないと保存に失敗します。
- 認証情報なしでもトップ画面は表示されます（EXP表示が0になり、保存時にエラーメッセージが出ます）。切り分けに使えます。
"# system" 
"# system" 
"# system" 
"# system" 
