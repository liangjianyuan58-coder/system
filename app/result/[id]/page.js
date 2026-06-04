// =============================================================
// app/result/[id]/page.js
// 採点結果詳細ページ（LINE から誘導）
// rawJson が空の場合は AI 採点を実行してシートに書き戻す
// =============================================================
import { getOutputById, updateOutputById } from '@/lib/sheet';
import { gradeOutput } from '@/lib/gemini';
import { MODULES, ACTIVE_MODULE } from '@/lib/havefun-data';
import { notFound } from 'next/navigation';
import styles from './result.module.css';
import GradingErrorCard from './GradingErrorCard';
import UnderstandingSection from './UnderstandingSection';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function barColor(score) {
  if (score >= 9) return '#22c55e';
  if (score >= 7) return '#84cc16';
  if (score >= 5) return '#f59e0b';
  return '#ef4444';
}

export default async function ResultPage({ params }) {
  const { id } = await params;

  let result = null;
  try {
    result = await getOutputById(id);
  } catch (err) {
    console.error('[result page] getOutputById error:', err?.message || err);
  }
  if (!result) notFound();

  let fb = null;
  let gradingError = null;

  if (result.rawJson) {
    try { fb = JSON.parse(result.rawJson); } catch {}
  } else if (result.tup || result.conclusion) {
    // rawJson なし → このページで採点を実行してシートに書き戻す
    try {
      const moduleId = Object.keys(MODULES).find(
        (mid) => MODULES[mid].manual.title === result.module
      ) || ACTIVE_MODULE;

      fb = await gradeOutput({
        moduleId,
        tup: result.tup,
        conclusion: result.conclusion,
        content: result.content,
        example: result.example,
        workExample: result.workExample,
        reconclusion: result.reconclusion,
        apTup: result.apTup,
        ap: result.ap,
      });

      // 採点結果をシートに書き戻す（失敗しても表示は続行）
      const langScore = fb.languageCheck
        ? `${fb.languageCheck.score}/10 ${fb.languageCheck.verdict}${
            fb.languageCheck.patterns?.length > 0
              ? ' / ' + fb.languageCheck.patterns.map((p) => `「${p.ending}」${p.count}回`).join(' ')
              : ''
          }`
        : '';
      updateOutputById(id, {
        total: fb.total != null ? `${fb.total}/80` : '',
        verdict: fb.verdict || '',
        good: fb.good || '',
        improvements: Array.isArray(fb.improvements)
          ? fb.improvements.join(' / ')
          : (fb.improvements || ''),
        comment: fb.comment || '',
        rawJson: JSON.stringify(fb),
        consistencyCheck: fb.consistencyCheck || '',
        languageScore: langScore,
      }).catch((e) => console.error('[result page] updateOutputById error:', e?.message || e));
    } catch (err) {
      console.error('[result page] gradeOutput error:', err?.message || err);
      gradingError = err?.message || 'AI採点でエラーが発生しました';
    }
  }

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
    ['AP理解度', fb?.apUnderstandingCheck],
    ['AP適切性', fb?.apAppropriatenessCheck],
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

        {/* AI採点エラー時 */}
        {gradingError && <GradingErrorCard errorMessage={gradingError} />}

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

        {/* 書き直し例 */}
        {fb?.directFix?.rewrite && (
          <div className={styles.card} style={{ borderLeft: '4px solid #f97316' }}>
            <p className={styles.cardTitle}>✏️ まずここを直せ — {fb.directFix.targetLabel}</p>
            <p className={styles.cardText} style={{ whiteSpace: 'pre-wrap', background: '#fff7ed', padding: '10px', borderRadius: '8px', color: '#9a3412', lineHeight: 1.8 }}>{fb.directFix.rewrite}</p>
          </div>
        )}

        {/* コメント */}
        {fb?.comment && (
          <div className={styles.card}>
            <p className={styles.cardTitle}>🔥 コメント</p>
            <p className={styles.commentText}>{fb.comment}</p>
          </div>
        )}

        {/* 言語チェック */}
        {fb?.languageCheck && (
          <div className={styles.card}>
            <p className={styles.cardTitle}>📝 言語チェック（台本の自然さ）</p>
            <div className={styles.langScoreRow}>
              <span className={styles.langScore}
                style={{ color: fb.languageCheck.score >= 8 ? '#15803d' : fb.languageCheck.score >= 6 ? '#d97706' : '#dc2626' }}>
                {fb.languageCheck.score}<span className={styles.langScoreMax}>/10</span>
              </span>
              <span style={{ fontSize: '14px', fontWeight: 700,
                color: fb.languageCheck.score >= 8 ? '#15803d' : fb.languageCheck.score >= 6 ? '#d97706' : '#dc2626' }}>
                {fb.languageCheck.verdict}
              </span>
            </div>
            {fb.languageCheck.patterns?.length > 0 && (
              <div className={styles.langPatterns}>
                {fb.languageCheck.patterns.map((p, i) => (
                  <span key={i} className={styles.langTag}
                    style={{ background: p.level === '高' ? '#fef2f2' : p.level === '中' ? '#fff7ed' : '#fefce8',
                             color: p.level === '高' ? '#dc2626' : p.level === '中' ? '#d97706' : '#ca8a04',
                             border: `1px solid ${p.level === '高' ? '#fca5a5' : p.level === '中' ? '#fed7aa' : '#fde68a'}` }}>
                    「{p.ending}」{p.count}回
                  </span>
                ))}
              </div>
            )}
            {fb.languageCheck.issues?.length > 0 && (
              <ul className={styles.improvementList} style={{ marginTop: '10px' }}>
                {fb.languageCheck.issues.map((s, i) => (
                  <li key={i} className={styles.improvementItem}>
                    <span className={styles.improvementNum}>!</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            )}
            {fb.languageCheck.tips?.length > 0 && (
              <p className={styles.cardText} style={{ marginTop: '8px', color: '#64748b', fontSize: '12px' }}>
                💡 {fb.languageCheck.tips.join('　')}
              </p>
            )}
            {fb.languageCheck.improved && (
              <details style={{ marginTop: '10px' }}>
                <summary style={{ fontSize: '12px', color: '#94a3b8', cursor: 'pointer' }}>✏ 修正例を見る</summary>
                <p className={styles.cardText} style={{ marginTop: '8px', background: '#f0fdf4', padding: '10px', borderRadius: '8px', color: '#15803d', whiteSpace: 'pre-wrap' }}>
                  {fb.languageCheck.improved}
                </p>
              </details>
            )}
          </div>
        )}

        {/* 理解度を深める */}
        {result.module && (() => {
          const moduleId = Object.keys(MODULES).find(
            (mid) => MODULES[mid].manual.title === result.module
          ) || ACTIVE_MODULE;
          return (
            <UnderstandingSection
              moduleId={moduleId}
              userId={result.userId}
              name={result.name}
            />
          );
        })()}

        <footer className={styles.footer}>HAVE FUN TRAINING</footer>
      </div>
    </div>
  );
}
