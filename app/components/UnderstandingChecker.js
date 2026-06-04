'use client';
import { useState } from 'react';

export default function UnderstandingChecker({ moduleId, userId, name, compact = false }) {
  const [phase, setPhase] = useState('idle'); // idle | loading_q | answering | result
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
    <div className={compact ? 'uc uc--compact' : 'uc'}>
      {phase === 'idle' && (
        <div className="uc-start">
          <p className="uc-lead">4択で本質を確認する。「分かったつもり」を崩そう。</p>
          {error && <p className="uc-error">{error}</p>}
          <button className="btn btn--sub" onClick={loadQuestion}>🧠 理解チェックを受ける</button>
        </div>
      )}

      {phase === 'loading_q' && (
        <div className="uc-loading">⏳ 問題を生成中...</div>
      )}

      {phase === 'answering' && (
        <div className="uc-answering">
          <div className="uc-question-block">
            <p className="uc-q-label">❓ 問い</p>
            <p className="uc-q-text">{question}</p>
          </div>
          <div className="uc-choices">
            {choices.map((c, i) => (
              <button key={i} className="uc-choice-btn" onClick={() => submitAnswer(i)}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'result' && (
        <div className="uc-result">
          <div className={'uc-result-verdict ' + (isCorrect ? 'uc-correct' : 'uc-wrong')}>
            {isCorrect ? '✅ 正解！' : '❌ 不正解'}
          </div>
          <div className="uc-choices uc-choices--result">
            {choices.map((c, i) => (
              <div
                key={i}
                className={
                  'uc-choice-result ' +
                  (i === correctIndex ? 'uc-choice-correct' : '') +
                  (i === selected && !isCorrect ? ' uc-choice-wrong' : '')
                }
              >
                {i === correctIndex && '✅ '}{i === selected && !isCorrect && '❌ '}{c}
              </div>
            ))}
          </div>
          {explanation && (
            <div className="uc-block uc-block--essence">
              <p className="uc-block-title">📖 解説</p>
              <p className="uc-essence-text">{explanation}</p>
            </div>
          )}
          <button className="btn btn--sub" style={{ marginTop: '12px' }} onClick={loadQuestion}>
            ↻ もう一問チャレンジ
          </button>
        </div>
      )}
    </div>
  );
}
