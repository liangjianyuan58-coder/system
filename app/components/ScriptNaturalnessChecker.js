'use client';
import { useState } from 'react';

export default function ScriptNaturalnessChecker() {
  const [script, setScript] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | loading | result
  const [fb, setFb] = useState(null);
  const [error, setError] = useState('');

  async function check() {
    if (!script.trim()) return;
    setPhase('loading');
    setError('');
    setFb(null);
    try {
      const res = await fetch('/api/script-naturalness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: script.trim() }),
      }).then((r) => r.json());
      if (res.ok) {
        setFb(res.feedback);
        setPhase('result');
      } else {
        setError(res.message || 'チェックに失敗しました');
        setPhase('idle');
      }
    } catch (e) {
      setError('通信エラー: ' + (e.message || e));
      setPhase('idle');
    }
  }

  const scoreColor = fb
    ? fb.score >= 8 ? '#3cff8e' : fb.score >= 6 ? '#ffe14d' : fb.score >= 4 ? '#ff9f43' : '#ff6b6b'
    : '#fff';

  const levelColor = (lv) => lv === '高' ? '#ff6b6b' : lv === '中' ? '#ff9f43' : '#ffe14d';

  return (
    <>
      <section className="window" aria-label="言語チェック">
        <div className="window__title">＊ 台本の言語チェック</div>
        <p className="flow-lead">
          台本全文を貼り付けると、「ですね」などの繰り返しパターンや話し言葉として
          不自然な表現を検出して指摘します。
        </p>
        <textarea
          className="step__input"
          rows={12}
          placeholder="台本をここに貼り付けてください（①T-UP〜⑦APまで全文）"
          value={script}
          onChange={(e) => setScript(e.target.value)}
          disabled={phase === 'loading'}
          style={{ marginTop: '8px' }}
        />
        {error && <div className="fb-error" style={{ marginTop: '8px' }}>{error}</div>}
        <button
          type="button"
          className={'btn' + (script.trim() ? ' ready' : '')}
          disabled={!script.trim() || phase === 'loading'}
          onClick={check}
          style={{ marginTop: '10px' }}
        >
          {phase === 'loading' ? '⏳ 分析中...' : '📝 台本をチェックする'}
        </button>
      </section>

      {phase === 'result' && fb && (
        <section className="window fb-window" aria-label="言語チェック結果">
          <div className="window__title">＊ チェック結果</div>

          {/* スコア・総合判定 */}
          <div className="fb">
            <div className="fb-verdict" style={{ color: scoreColor, borderColor: scoreColor }}>
              自然さスコア：{fb.score}/10　{fb.verdict}
            </div>

            {/* 繰り返しパターン */}
            {fb.patterns?.length > 0 && (
              <div className="fb-block" style={{ marginTop: '14px' }}>
                <b>🔁 繰り返しパターン検出</b>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {fb.patterns.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                      <span style={{
                        background: levelColor(p.level),
                        color: '#000',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        flexShrink: 0,
                      }}>{p.level}</span>
                      <span>「{p.ending}」</span>
                      <span style={{ color: 'var(--dim)' }}>{p.count}回</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* セクション別指摘 */}
            {fb.sections?.length > 0 && (
              <div className="fb-block" style={{ marginTop: '14px' }}>
                <b>📋 セクション別指摘</b>
                {fb.sections.map((sec, i) => (
                  <div key={i} style={{
                    marginTop: '12px',
                    background: 'rgba(255,255,255,.05)',
                    borderRadius: '5px',
                    padding: '10px 12px',
                    borderLeft: '3px solid var(--accent)',
                  }}>
                    <p style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '13px', margin: '0 0 6px' }}>
                      {sec.name}　<span style={{ color: 'var(--dim)', fontWeight: 400 }}>問題箇所 {sec.issueCount}件</span>
                    </p>
                    {sec.issues?.map((issue, j) => (
                      <p key={j} style={{ fontSize: '12px', color: 'var(--fg)', margin: '0 0 4px', lineHeight: 1.6 }}>
                        ⚠ {issue}
                      </p>
                    ))}
                    {sec.improved && (
                      <details style={{ marginTop: '8px' }}>
                        <summary style={{ fontSize: '12px', color: 'var(--dim)', cursor: 'pointer' }}>
                          ✏ 修正例を見る
                        </summary>
                        <p style={{
                          fontSize: '12px',
                          color: '#3cff8e',
                          marginTop: '6px',
                          lineHeight: 1.7,
                          whiteSpace: 'pre-wrap',
                          background: 'rgba(60,255,142,.06)',
                          borderRadius: '4px',
                          padding: '8px',
                        }}>{sec.improved}</p>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 改善ヒント */}
            {fb.tips?.length > 0 && (
              <div className="fb-block" style={{ marginTop: '14px' }}>
                <b>💡 文末バリエーションのヒント</b>
                <ul className="fb-improve" style={{ marginTop: '8px' }}>
                  {fb.tips.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}

            {/* 総評 */}
            {fb.summary && (
              <p className="fb-comment" style={{ marginTop: '14px' }}>{fb.summary}</p>
            )}
          </div>

          <button
            type="button"
            className="btn btn--sub"
            style={{ marginTop: '12px' }}
            onClick={() => { setPhase('idle'); setFb(null); }}
          >
            ↻ 別の台本をチェックする
          </button>
        </section>
      )}
    </>
  );
}
