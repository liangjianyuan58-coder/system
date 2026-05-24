// =============================================================
// app/api/line/setup-menu/route.js
// GET /api/line/setup-menu
//   LINE Rich Menu をAPI経由で作成・登録する（初回セットアップ用）
//   リッチメニュー画像は別途アップロードが必要（後述のcURL手順）
// =============================================================
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API = 'https://api.line.me/v2/bot';

function token() {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!t) throw new Error('LINE_CHANNEL_ACCESS_TOKEN が未設定です。');
  return t;
}

// 6分割リッチメニュー（2行3列）
const RICH_MENU_OBJECT = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'アウトプット筋トレ',
  chatBarText: 'メニューを開く',
  areas: [
    // 上段左: #採点
    {
      bounds: { x: 0, y: 0, width: 833, height: 843 },
      action: { type: 'message', text: '#採点' },
    },
    // 上段中: #お手本
    {
      bounds: { x: 833, y: 0, width: 834, height: 843 },
      action: { type: 'message', text: '#お手本' },
    },
    // 上段右: #逆質問
    {
      bounds: { x: 1667, y: 0, width: 833, height: 843 },
      action: { type: 'message', text: '#逆質問' },
    },
    // 下段左: #こじつけ
    {
      bounds: { x: 0, y: 843, width: 833, height: 843 },
      action: { type: 'message', text: '#こじつけ' },
    },
    // 下段中: #リフレーム
    {
      bounds: { x: 833, y: 843, width: 834, height: 843 },
      action: { type: 'message', text: '#リフレーム' },
    },
    // 下段右: #ヘルプ
    {
      bounds: { x: 1667, y: 843, width: 833, height: 843 },
      action: { type: 'message', text: '#ヘルプ' },
    },
  ],
};

export async function GET(request) {
  try {
    // 1. 既存リッチメニューを確認
    const listRes = await fetch(`${API}/richmenu/list`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    const listData = await listRes.json();
    const existing = (listData.richmenus || []).find((m) => m.name === 'アウトプット筋トレ');

    let richMenuId;

    if (existing) {
      richMenuId = existing.richMenuId;
    } else {
      // 2. リッチメニュー作成
      const createRes = await fetch(`${API}/richmenu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(RICH_MENU_OBJECT),
      });
      if (!createRes.ok) {
        const err = await createRes.text();
        return NextResponse.json({ ok: false, error: `作成失敗: ${err}` }, { status: 500 });
      }
      const createData = await createRes.json();
      richMenuId = createData.richMenuId;
    }

    // 3. デフォルトに設定
    const defaultRes = await fetch(`${API}/user/all/richmenu/${richMenuId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (!defaultRes.ok) {
      const err = await defaultRes.text();
      return NextResponse.json({ ok: false, richMenuId, error: `デフォルト設定失敗: ${err}` }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      richMenuId,
      message: 'リッチメニュー登録完了！画像のアップロードが必要です。',
      imageUploadCommand: `curl -v -X POST https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content -H "Authorization: Bearer {TOKEN}" -H "Content-Type: image/png" -T richmenu.png`,
      menuLayout: {
        '上段左': '#採点',
        '上段中': '#お手本',
        '上段右': '#逆質問',
        '下段左': '#こじつけ',
        '下段中': '#リフレーム',
        '下段右': '#ヘルプ',
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
