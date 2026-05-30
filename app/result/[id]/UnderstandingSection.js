'use client';
import { useState } from 'react';
import styles from './result.module.css';

export default function UnderstandingSection({ moduleId, userId, name }) {
  const [phase, setPhase] = useState('idle');
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

  const score = fb?.score ?? 0;
  const scoreColor = score >= 8 ? '#15803d' : score >= 6 ? '#d97706' : score >= 4 ? '#ea580c' : '#dc2626';

  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>🧠 理解度を深める</p>

      {phase === 'idle' && (
        <>
          <p className={styles.cardText} style={{ marginBottom: '12px' }}>
            本質問答＋なぜなぜ深掘りで「分かったつもり」を崩す。チャレンジした記録はスプレッドシートに残ります。
          </p>
          {error && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '10px' }}>{error}</p>}
          <button className={styles.ucStartBtn} onClick={loadQuestion}>🧠 理解チェックを受ける</button>
        </>
      )}

      {phase === 'loading_q' && (
        <p className={styles.cardText}>⏳ 問題を生成中...</p>
      )}

      {(phase === 'answering' || phase === 'loading_eval') && (
        <div className={styles.ucForm}>
          <div className={styles.ucQuestionBlock}>
            <span className={styles.ucQLabel}>❓ 問い 1</span>
            <p className={styles.ucQText}>{question}</p>
          </div>
          <div className={styles.ucQuestionBlock}>
            <span className={styles.ucQLabel}>❓ 問い 2</span>
            <p className={styles.ucQText}>{subQuestion}</p>
          </div>
          {hint && <p className={styles.ucHint}>💡 {hint}</p>}
          <textarea
            className={styles.ucTextarea}
            rows={6}
            placeholder="2つの問いへの回答を書いてください..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={phase === 'loading_eval'}
          />
          {error && <p style={{ color: '#ef4444', fontSize: '13px' }}>{error}</p>}
          <button
            className={styles.ucSubmitBtn}
            disabled={!answer.trim() || phase === 'loading_eval'}
            onClick={submitAnswer}
          >
            {phase === 'loading_eval' ? '⏳ 評価中...' : '▶ 回答して評価してもらう'}
          </button>
        </div>
      )}

      {phase === 'result' && fb && (
        <div className={styles.ucResult}>
          <div className={styles.ucScoreRow}>
            <span className={styles.ucScore} style={{ color: scoreColor }}>
              {fb.score}<span className={styles.ucScoreMax}>/10</span>
            </span>
            <span className={styles.ucVerdict} style={{ color: scoreColor }}>{fb.verdict}</span>
          </div>

          {fb.understood?.length > 0 && (
            <div className={styles.ucBlock}>
              <span className={styles.cardTitle}>✅ 理解できている点</span>
              <ul className={styles.ucList}>
                {fb.understood.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
          {fb.missing?.length > 0 && (
            <div className={styles.ucBlock}>
              <span className={styles.cardTitle}>💡 まだ抜けている本質</span>
              <ul className={styles.ucList}>
                {fb.missing.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
          {fb.trueEssence && (
            <div className={styles.ucBlock} style={{ borderLeft: '3px solid #3b82f6' }}>
              <span className={styles.cardTitle}>📖 この概念の真の本質</span>
              <p className={styles.cardText}>{fb.trueEssence}</p>
            </div>
          )}
          {fb.comment && (
            <div className={styles.ucBlock}>
              <span className={styles.cardTitle}>🔥 コメント</span>
              <p className={styles.commentText}>{fb.comment}</p>
            </div>
          )}
          <button className={styles.ucStartBtn} style={{ marginTop: '8px' }} onClick={loadQuestion}>
            ↻ もう一度チャレンジ
          </button>
        </div>
      )}
    </div>
  );
}
