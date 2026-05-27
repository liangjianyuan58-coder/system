// =============================================================
// app/result/[id]/page.js
// 採点結果詳細ページ（LINE から誘導）
// =============================================================
import { getOutputById } from '@/lib/sheet';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ResultPage({ params }) {
  const { id } = await params;
  const result = await getOutputById(id);
  if (!result) notFound();

  let fb = null;
  try {
    if (result.rawJson) fb = JSON.parse(result.rawJson);
  } catch {}

  const scores = fb?.scores || {};
  const scoreLabels = [
    ['tup', 'T-UP'],
    ['conclusion', '結論'],
    ['content', '内容'],
    ['example', '一般例'],
    ['workExample', '稼働例'],
    ['reconclusion', '再結論'],
    ['apTup', 'APのT-UP'],
    ['ap', 'AP'],
  ];

  const isPassed = fb?.verdict === '合格';
  const ts = result.ts
    ? new Date(result.ts).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    : '';

  const checks = [
    ['🔍 T-UPチェック', fb?.tupCheck],
    ['🔍 APのT-UPチェック', fb?.apTupCheck],
    ['🔍 APチェック', fb?.apCheck],
    ['🔗 内容→例→AP一貫性', fb?.consistencyCheck],
    ['⚡ インパルスファクター', fb?.impulseFactorCheck],
    ['🛠 アプローチ話法', fb?.approachTechniquesCheck],
    ['🪜 5ステップス構成', fb?.stepsCheck],
    ['👁 初めて聴く人チェック', fb?.clarityCheck],
  ].filter(([, v]) => v);

  return (
    <>
      <div className="scanlines" />
      <div className="screen">
        <header className="app-header">
          <p className="app-header__sub">SCORE RESULT</p>
          <h1 className="app-header__title" style={{ fontSize: 'clamp(18px,6vw,28px)' }}>採点結果</h1>
          {result.module && <p className="app-header__reading">{result.module}</p>}
          {result.name && result.name !== '(名無し)' && (
            <p style={{ color: 'var(--dim)', fontSize: 12, margin: '2px 0 0' }}>{result.name}</p>
          )}
          {ts && <p style={{ color: 'var(--dim)', fontSize: 11, margin: '2px 0 0' }}>{ts}</p>}
        </header>

        {/* 合計スコア・判定 */}
        <div className={`fb-verdict ${isPassed ? 'pass' : 'fail'}`}>
          <div style={{ fontSize: 36, fontWeight: 'bold', marginBottom: 6 }}>
            {fb?.total ?? '-'}<span style={{ fontSize: 18 }}>/80</span>
          </div>
          <div>{fb?.verdict ?? '-'}</div>
        </div>

        {/* 各ステップのスコア */}
        {fb && (
          <div className="window">
            <p className="window__title">📊 各ステップ</p>
            <div className="fb-scores">
              {scoreLabels.map(([k, l]) => (
                <div key={k} className="fb-score">
                  <span className="fb-score__label">{l}</span>
                  <div className="fb-score__bar">
                    <i style={{ width: `${(scores[k] ?? 0) * 10}%` }} />
                  </div>
                  <span className="fb-score__num">{scores[k] ?? '-'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Good */}
        {fb?.good && (
          <div className="window fb-block fb-good">
            <p className="window__title">✅ Good</p>
            <p style={{ margin: 0 }}>{fb.good}</p>
          </div>
        )}

        {/* 各チェック項目 */}
        {checks.map(([label, text]) => (
          <div key={label} className="window fb-block">
            <p className="window__title">{label}</p>
            <p style={{ margin: 0 }}>{text}</p>
          </div>
        ))}

        {/* 改善ポイント */}
        {fb?.improvements?.length > 0 && (
          <div className="window fb-block">
            <p className="window__title">💡 改善ポイント</p>
            <ol className="fb-improve">
              {fb.improvements.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>
        )}

        {/* コメント */}
        {fb?.comment && (
          <div className="window">
            <p className="fb-comment">🔥 {fb.comment}</p>
          </div>
        )}

        <footer className="app-footer">HAVE FUN TRAINING</footer>
      </div>
    </>
  );
}
