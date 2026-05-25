// =============================================================
// app/components/ReframeGym.js
// モード：リフレーミング・ジム
// =============================================================
'use client';

import { useEffect, useState } from 'react';
import { getModule } from '@/lib/havefun-data';
import { randomScenario } from '@/lib/scenarios';

export default function ReframeGym({ moduleId }) {
  const MODULE = getModule(moduleId);
  const [situation, setSituation] = useState('');
  const [reframe, setReframe] = useState('');
  const [sending, setSending] = useState(false);
  const [fb, setFb] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { setSituation(randomScenario()); }, []);

  useEffect(() => {
    setReframe('');
    setFb(null);
    setError('');
  }, [moduleId]);

  function draw() {
    setSituation(randomScenario(situation));
    setReframe('');
    setFb(null);
    setError('');
  }

  const ready = situation.trim() && reframe.trim() && !sending;

  async function onSubmit() {
    if (!ready) return;
    setSending(true); setFb(null); setError('');
    try {
      const res = await fetch('/api/reframe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situation: situation.trim(), reframe: reframe.trim(), moduleId: moduleId || '' }),
      }).then((r) => r.json());
      if (res && res.ok) setFb(res.feedback);
      else setError(res && res.message ? res.message : 'AI査定に失敗しました');
    } catch (e) {
      setError('通信エラー: ' + (e.message || e));
    } finally {
      setSending(false);
    }
  }

  const modTitle = MODULE ? MODULE.manual.title : '';

  return (
    <>
      <section className="window dict-window">
        <div className="window__title">＊ リフレーミング・ジム</div>
        <p className="dict-summary">
          {'現場で起きるネガ事象は変えられない。だが「意味付け」は自由に変えられる。'}
          {'[' + modTitle + ']の視点で事実を認めた上で、捉え方を変えてプラスに転じよ。'}
        </p>
      </section>

      <section className="window koji-word-window">
        <div className="window__title">＊ お題（ネガ事象）</div>
        <div className="reframe-situation">{situation || '—'}</div>
        <div className="koji-word-actions">
          <button type="button" className="btn btn--sub" onClick={draw}>🎲 別のお題を引く</button>
        </div>
      </section>

      <section className="window">
        <div className="window__title">＊ この事象を、楽しめる捉え方に変換せよ</div>
        <textarea
          className="step__input"
          rows={6}
          placeholder="事実は認めつつ、意味付けを変えて『だから次こう動く』まで書く…"
          value={reframe}
          onChange={(e) => setReframe(e.target.value)}
        />
      </section>

      <div className="submit-area">
        <button type="button" className={'btn' + (ready ? ' ready' : '')} disabled={!ready} onClick={onSubmit}>
          {sending ? '査定中...' : '▶ リフレーミングを査定してもらう'}
        </button>
        <div className="submit-note">{sending ? '※ 引き算をプラスにできてるか判定中' : '※ お題と変換の両方が必要です'}</div>
      </div>

      {(sending || fb || error) && (
        <section className="window fb-window">
          <div className="window__title">＊ リフレーミング査定 ＆ お手本</div>
          {sending && <div className="fb-loading">▼ 判定中… その捉え方、行動を進めるか見るぞ</div>}
          {error && <div className="fb-error">{error}</div>}
          {fb && (
            <div className="fb">
              <div className="fb-verdict koji-score">リフレーミング力 {fb.score} / 10</div>
              {fb.good && <p className="fb-block fb-good"><b>◎ Good</b>{fb.good}</p>}
              {fb.improvement && <p className="fb-block"><b>△ もっと伸ばすなら</b>{fb.improvement}</p>}
              {fb.example && (
                <div className="fb-block koji-example">
                  <b>★ トップオーナーのお手本リフレーミング</b>
                  <p>{fb.example}</p>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}
