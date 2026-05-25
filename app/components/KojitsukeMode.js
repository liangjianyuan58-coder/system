// =============================================================
// app/components/KojitsukeMode.js
// モードB：こじつけ力強化
// =============================================================
'use client';

import { useEffect, useState } from 'react';
import { getModule } from '@/lib/havefun-data';
import { randomWord } from '@/lib/words';

export default function KojitsukeMode({ moduleId }) {
  const MODULE = getModule(moduleId);
  const [word, setWord] = useState('');
  const [output, setOutput] = useState('');
  const [sending, setSending] = useState(false);
  const [fb, setFb] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { setWord(randomWord()); }, []);

  useEffect(() => {
    setOutput('');
    setFb(null);
    setError('');
  }, [moduleId]);

  function draw() {
    setWord(randomWord(word));
    setOutput('');
    setFb(null);
    setError('');
  }

  const ready = word.trim().length > 0 && output.trim().length > 0 && !sending;

  async function onSubmit() {
    if (!ready) return;
    setSending(true);
    setFb(null);
    setError('');
    try {
      const res = await fetch('/api/kojitsuke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: word.trim(), output: output.trim(), moduleId: moduleId || '' }),
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
        <div className="window__title">＊ こじつけ力強化モード</div>
        <p className="dict-summary">
          {'一見まったく無関係な単語を、強引かつ論理的に「' + modTitle + '」へ結びつけて説明するトレーニング。'}
          {'リフレーミングの筋トレです。「なるほど！」と膝を打つこじつけを狙え。'}
        </p>
      </section>

      <section className="window koji-word-window">
        <div className="window__title">＊ お題の単語</div>
        <div className="koji-word">{word || '—'}</div>
        <div className="koji-word-actions">
          <button type="button" className="btn btn--sub" onClick={draw}>🎲 別のお題を引く</button>
        </div>
        <input
          className="koji-custom"
          type="text"
          placeholder="自分で単語を指定する場合はここに入力"
          value={word}
          onChange={(e) => setWord(e.target.value)}
        />
      </section>

      <section className="window">
        <div className="window__title">{'＊ この単語で' + modTitle + 'をこじつけ説明せよ'}</div>
        <textarea
          className="step__input"
          rows={6}
          placeholder={'例：「' + (word || 'お題') + '」と' + modTitle + 'の共通点は…'}
          value={output}
          onChange={(e) => setOutput(e.target.value)}
        />
      </section>

      <div className="submit-area">
        <button type="button" className={'btn' + (ready ? ' ready' : '')} disabled={!ready} onClick={onSubmit}>
          {sending ? '査定中...' : '▶ こじつけを査定してもらう'}
        </button>
        <div className="submit-note">{sending ? '※ プロマネージャーがこじつけ力を判定中' : '※ 単語と説明の両方が必要です'}</div>
      </div>

      {(sending || fb || error) && (
        <section className="window fb-window">
          <div className="window__title">＊ こじつけ査定 ＆ お手本</div>
          {sending && <div className="fb-loading">▼ 判定中… そのこじつけ、本質に届いてるか見るぞ</div>}
          {error && <div className="fb-error">{error}</div>}
          {fb && (
            <div className="fb">
              <div className="fb-verdict koji-score">こじつけ力 {fb.score} / 10</div>
              {fb.good && <p className="fb-block fb-good"><b>◎ Good</b>{fb.good}</p>}
              {fb.improvement && <p className="fb-block"><b>△ もっと伸ばすなら</b>{fb.improvement}</p>}
              {fb.example && (
                <div className="fb-block koji-example">
                  <b>★ トップオーナーのお手本こじつけ</b>
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
