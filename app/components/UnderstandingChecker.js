'use client';
// 理解チェックの共通UIコンポーネント（メインタブ・結果ページ両方で使用）
import { useState } from 'react';

export default function UnderstandingChecker({ moduleId, userId, name, compact = false }) {
  const [phase, setPhase] = useState('idle'); // idle | loading_q | answering | loading_eval | result
  const [question, setQuestion] = useState('');
  const [subQuestion, setSubQuestion] = useState('');
  const [hint, setHint] = useState('');
  const [answer, setAnswer] = useState('');
  const [fb, setFb] = useState(null);
  const [error, setError] = useState('');

  async function loadQuestion() {
    setPhase('loading_q');
    setError('');
    setFb(null);
    setAnswer('');
    try {
      const res = await fetch(`/api/understanding?moduleId=${encodeURIComponent(moduleId)}`).then((r) => r.json());
      if (res.ok) {
        setQuestion(res.mainQuestion);
        setSubQuestion(res.subQuestion);
        setHint(res.hint);
        setPhase('answering');
      } else {
        setError(res.message || '問題の生成に失敗しました');
        setPhase('idle');
      }
    } catch (e) {
      setError('通信エラー: ' + (e.message || e));
      setPhase('idle');
    }
  }

  async function submitAnswer() {
    if (!answer.trim()) return;
    setPhase('loading_eval');
    setError('');
    try {
      const res = await fetch('/api/understanding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, question, subQuestion, answer: answer.trim(), userId, name }),
      }).then((r) => r.json());
      if (res.ok) {
        setFb(res.feedback);
        setPhase('result');
      } else {
        setError(res.message || '評価に失敗しました');
        setPhase('answering');
      }
    } catch (e) {
      setError('通信エラー: ' + (e.message || e));
      setPhase('answering');
    }
  }

  const scoreColor = fb
    ? fb.score >= 8 ? '#15803d' : fb.score >= 6 ? '#d97706' : fb.score >= 4 ? '#ea580c' : '#dc2626'
    : '#1e293b';

  return (
    <div className={compact ? 'uc uc--compact' : 'uc'}>
      {phase === 'idle' && (
        <div className="uc-start">
          <p className="uc-lead">本質問答 ＋ なぜなぜ深掘りで「分かったつもり」を崩す。</p>
          <button className="btn btn--sub" onClick={loadQuestion}>🧠 理解チェックを受ける</button>
        </div>
      )}

      {phase === 'loading_q' && (
        <div className="uc-loading">⏳ 問題を生成中...</div>
      )}

      {(phase === 'answering' || phase === 'loading_eval') && (
        <div className="uc-answering">
          <div className="uc-question-block">
            <p className="uc-q-label">❓ 問い 1</p>
            <p className="uc-q-text">{question}</p>
          </div>
          <div className="uc-question-block">
            <p className="uc-q-label">❓ 問い 2</p>
            <p className="uc-q-text">{subQuestion}</p>
          </div>
          {hint && <p className="uc-hint">💡 {hint}</p>}
          <textarea
            className="uc-textarea"
            rows={6}
            placeholder="2つの問いへの回答を書いてください..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={phase === 'loading_eval'}
          />
          {error && <p className="uc-error">{error}</p>}
          <button
            className={'btn' + (answer.trim() ? ' ready' : '')}
            disabled={!answer.trim() || phase === 'loading_eval'}
            onClick={submitAnswer}
          >
            {phase === 'loading_eval' ? '⏳ 評価中...' : '▶ 回答して評価してもらう'}
          </button>
        </div>
      )}

      {phase === 'result' && fb && (
        <div className="uc-result">
          <div className="uc-score-row">
            <span className="uc-score" style={{ color: scoreColor }}>{fb.score}<span className="uc-score-max">/10</span></span>
            <span className="uc-verdict" style={{ color: scoreColor }}>{fb.verdict}</span>
          </div>

          {fb.understood?.length > 0 && (
            <div className="uc-block">
              <p className="uc-block-title">✅ 理解できている点</p>
              <ul className="uc-list">{fb.understood.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          {fb.missing?.length > 0 && (
            <div className="uc-block">
              <p className="uc-block-title">💡 まだ抜けている本質</p>
              <ul className="uc-list">{fb.missing.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          {fb.trueEssence && (
            <div className="uc-block uc-block--essence">
              <p className="uc-block-title">📖 この概念の真の本質</p>
              <p className="uc-essence-text">{fb.trueEssence}</p>
            </div>
          )}
          {fb.comment && (
            <div className="uc-block">
              <p className="uc-block-title">🔥 コメント</p>
              <p className="uc-comment-text">{fb.comment}</p>
            </div>
          )}
          <button className="btn btn--sub" style={{ marginTop: '12px' }} onClick={loadQuestion}>
            ↻ もう一度チャレンジ
          </button>
        </div>
      )}
    </div>
  );
}
