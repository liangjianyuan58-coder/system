// =============================================================
// app/result/[id]/page.js
// 採点結果詳細ページ（LINE から誘導）
// =============================================================
import { getOutputById } from '@/lib/sheet';
import { notFound } from 'next/navigation';
import styles from './result.module.css';

export const dynamic = 'force-dynamic';

function barColor(score) {
  if (score >= 9) return '#22c55e';
  if (score >= 7) return '#84cc16';
  if (score >= 5) return '#f59e0b';
  return '#ef4444';
}

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
    ['T-UPチェック', fb?.tupCheck],
    ['APのT-UPチェック', fb?.apTupCheck],
    ['APチェック', fb?.apCheck],
    ['内容→例→AP 一貫性', fb?.consistencyCheck],
    ['インパルスファクター', fb?.impulseFactorCheck],
    ['アプローチ話法', fb?.approachTechniquesCheck],
    ['5ステップス構成', fb?.stepsCheck],
    ['初めて聴く人チェック', fb?.clarityCheck],
  ].filter(([, v]) => v);

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* ヘッダー */}
        <header className={styles.header}>
          <p className={styles.headerLabel}>採点結果</p>
          <h1 className={styles.headerTitle}>{result.module || 'アウトプット採点'}</h1>
          {result.name && result.name !== '(名無し)' && (
            <p className={styles.headerMeta}>{result.name}</p>
          )}
          {ts && <p className={styles.headerMeta}>{ts}</p>}
        </header>

        {/* 合計スコア・判定 */}
        <div className={styles.scoreCard}>
          <div
            className={styles.scoreNumber}
            style={{ color: isPassed ? '#15803d' : '#c2410c' }}
          >
            {fb?.total ?? '-'}
            <span className={styles.scoreMax}>/80</span>
          </div>
          <div className={`${styles.verdict} ${isPassed ? styles.pass : styles.fail}`}>
            {fb?.verdict ?? '-'}
          </div>
        </div>

        {/* 各ステップのスコア */}
        {fb && (
          <div className={styles.card}>
            <p className={styles.cardTitle}>各ステップ</p>
            {scoreLabels.map(([k, l]) => {
              const s = scores[k] ?? 0;
              return (
                <div key={k} className={styles.stepRow}>
                  <span className={styles.stepLabel}>{l}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${s * 10}%`, background: barColor(s) }}
                    />
                  </div>
                  <span className={styles.stepScore}>{scores[k] ?? '-'}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Good */}
        {fb?.good && (
          <div className={styles.card}>
            <p className={styles.cardTitle}>✅ Good</p>
            <p className={`${styles.cardText} ${styles.goodText}`}>{fb.good}</p>
          </div>
        )}

        {/* 改善ポイント */}
        {fb?.improvements?.length > 0 && (
          <div className={styles.card}>
            <p className={styles.cardTitle}>💡 改善ポイント</p>
            <ol className={styles.improvementList}>
              {fb.improvements.map((s, i) => (
                <li key={i} className={styles.improvementItem}>
                  <span className={styles.improvementNum}>{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* 各チェック項目 */}
        {checks.length > 0 && (
          <div className={styles.card}>
            <p className={styles.cardTitle}>詳細チェック</p>
            <div className={styles.checkList}>
              {checks.map(([label, text]) => (
                <div key={label} className={styles.checkItem}>
                  <span className={styles.checkLabel}>{label}</span>
                  <p className={styles.checkText}>{text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* コメント */}
        {fb?.comment && (
          <div className={styles.card}>
            <p className={styles.cardTitle}>🔥 コメント</p>
            <p className={styles.commentText}>{fb.comment}</p>
          </div>
        )}

        <footer className={styles.footer}>HAVE FUN TRAINING</footer>
      </div>
    </div>
  );
}
