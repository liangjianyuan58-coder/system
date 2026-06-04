'use client';
import { useState } from 'react';
import styles from './result.module.css';

export default function UnderstandingSection({ moduleId, userId, name }) {
  const [phase, setPhase] = useState('idle');
  const [question, setQuestion] = useState('');
  const [choices, setChoices] = useState([]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [selected, setSelected] = useState(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [error, setError] = useState('');

  async function loadQuestion() {
    setPhase('loading_q');
    setError('');
    setSelected(null);
    setIsCorrect(false);
    try {
      const res = await fetch(`/api/understanding?moduleId=${encodeURIComponent(moduleId)}`).then((r) => r.json());
      if (res.ok) {
        setQuestion(res.question);
        setChoices(res.choices || []);
        setCorrectIndex(res.correctIndex ?? 0);
        setExplanation(res.explanation || '');
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

  function submitAnswer(idx) {
    const correct = idx === correctIndex;
    setSelected(idx);
    setIsCorrect(correct);
    setPhase('result');
    if (userId) {
      fetch('/api/understanding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, question, selectedIndex: idx, correctIndex, isCorrect: correct, explanation, userId, name }),
      }).catch(() => {});
    }
  }

  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>🧠 理解度を深める</p>

      {phase === 'idle' && (
        <>
          <p className={styles.cardText} style={{ marginBottom: '12px' }}>
            4択で本質を確認する。チャレンジした記録はスプレッドシートに残ります。
          </p>
          {error && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '10px' }}>{error}</p>}
          <button className={styles.ucStartBtn} onClick={loadQuestion}>🧠 理解チェックを受ける</button>
        </>
      )}

      {phase === 'loading_q' && (
        <p className={styles.cardText}>⏳ 問題を生成中...</p>
      )}

      {phase === 'answering' && (
        <div className={styles.ucForm}>
          <div className={styles.ucQuestionBlock}>
            <span className={styles.ucQLabel}>❓ 問い</span>
            <p className={styles.ucQText}>{question}</p>
          </div>
          <div className={styles.ucChoices}>
            {choices.map((c, i) => (
              <button key={i} className={styles.ucChoiceBtn} onClick={() => submitAnswer(i)}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'result' && (
        <div className={styles.ucResult}>
          <div className={`${styles.ucResultVerdict} ${isCorrect ? styles.ucCorrect : styles.ucWrong}`}>
            {isCorrect ? '✅ 正解！' : '❌ 不正解'}
          </div>
          <div className={styles.ucChoices}>
            {choices.map((c, i) => (
              <div
                key={i}
                className={`${styles.ucChoiceResult} ${i === correctIndex ? styles.ucChoiceCorrect : ''} ${i === selected && !isCorrect ? styles.ucChoiceWrong : ''}`}
              >
                {i === correctIndex && '✅ '}{i === selected && !isCorrect && '❌ '}{c}
              </div>
            ))}
          </div>
          {explanation && (
            <div className={styles.ucBlock} style={{ borderLeft: '3px solid #3b82f6' }}>
              <span className={styles.cardTitle}>📖 解説</span>
              <p className={styles.cardText}>{explanation}</p>
            </div>
          )}
          <button className={styles.ucStartBtn} style={{ marginTop: '8px' }} onClick={loadQuestion}>
            ↻ もう一問チャレンジ
          </button>
        </div>
      )}
    </div>
  );
}
