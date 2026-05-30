'use client';
import styles from './result.module.css';

export default function GradingErrorCard({ errorMessage }) {
  const msg = errorMessage || '';
  const isQuota = /429|RESOURCE_EXHAUSTED|quota/i.test(msg);
  const isUnavailable = /503|UNAVAILABLE/i.test(msg);

  let icon, title, reason, solution;

  if (isQuota) {
    icon = '⏳';
    title = 'AI が混雑中です（無料枠の上限）';
    reason =
      'このアプリが使っている AI（Gemini）には1日あたりの無料利用回数に上限があります。' +
      '今日の上限に達したため、採点を一時的に受け付けられない状態です。';
    solution =
      'このページをブックマークして、数時間後（目安：翌朝）に再読み込みしてみてください。' +
      '入力内容はすでに保存されているので、消えることはありません。';
  } else if (isUnavailable) {
    icon = '🔧';
    title = 'AI サービスが一時停止中です';
    reason = 'AI サーバーが一時的にメンテナンス中、または高負荷状態です。こちら側の問題ではありません。';
    solution = '数分後にページを再読み込みしてみてください。たいてい短時間で回復します。';
  } else {
    icon = '⚠️';
    title = '採点中にエラーが発生しました';
    reason = 'AI との通信中に予期しないエラーが起きました。一時的なネットワーク障害の可能性があります。';
    solution =
      'ページを再読み込みすると再試行できます。' +
      '何度試しても失敗する場合は、しばらく時間を置いてからお試しください。';
  }

  return (
    <div className={styles.errorCard}>
      <p className={styles.errorTitle}>{icon}　{title}</p>
      <div className={styles.errorSection}>
        <span className={styles.errorSectionLabel}>何が起きているか</span>
        <p className={styles.errorSectionText}>{reason}</p>
      </div>
      <div className={styles.errorSection}>
        <span className={styles.errorSectionLabel}>どうすればいいか</span>
        <p className={styles.errorSectionText}>{solution}</p>
      </div>
      <button
        className={styles.retryButton}
        onClick={() => window.location.reload()}
      >
        ↻ 採点を再試行する
      </button>
    </div>
  );
}
