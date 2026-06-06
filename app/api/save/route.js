// =============================================================
// app/api/save/route.js
// POST /api/save : 7ステップ＋ユーザー情報を検証→シート追記→個人EXPを返す
//   body: { userId, name, tup, conclusion, content, example, workExample, reconclusion, ap }
// =============================================================
import { NextResponse } from 'next/server';
import { appendOutput } from '@/lib/sheet';
import { calcStats, EXP_PER_OUTPUT, getStepKeys } from '@/lib/havefun-data';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const data = await request.json();

    if (!data || !String(data.userId || '').trim()) {
      return NextResponse.json({ ok: false, message: 'ユーザー識別子がありません。' }, { status: 400 });
    }
    if (!String(data.name || '').trim()) {
      return NextResponse.json({ ok: false, message: '名前が未設定です。' }, { status: 400 });
    }
    const keys = getStepKeys(data.moduleId);
    for (let i = 0; i < keys.length; i++) {
      const v = data[keys[i]] ? String(data[keys[i]]).trim() : '';
      if (!v) {
        return NextResponse.json({ ok: false, message: `未入力の項目があります（ステップ${i + 1}）。` }, { status: 400 });
      }
    }

    const before = await currentLevel(data.userId);
    const u = await appendOutput({
      userId: String(data.userId).trim(),
      name: String(data.name).trim(),
      moduleId: data.moduleId || '',
      tup: data.tup, conclusion: data.conclusion, content: data.content,
      example: data.example, workExample: data.workExample,
      reconclusion: data.reconclusion, apTup: data.apTup || '', ap: data.ap,
    });
    const after = calcStats(u.count * EXP_PER_OUTPUT);

    return NextResponse.json({
      ok: true,
      id: u.id,
      message: 'アウトプットを記録しました！',
      gained: EXP_PER_OUTPUT,
      levelUp: after.level > before,
      streak: u.streak,
      doneToday: u.doneToday,
      id: u.id,
      ...after,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: '保存エラー: ' + String(err && err.message ? err.message : err) },
      { status: 500 }
    );
  }
}

// 追記前のレベルだけ取得（レベルアップ判定用）
async function currentLevel(userId) {
  try {
    const { getUserStats } = await import('@/lib/sheet');
    const u = await getUserStats(userId);
    return calcStats(u.count * EXP_PER_OUTPUT).level;
  } catch { return 1; }
}
