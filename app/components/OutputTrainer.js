// =============================================================
// app/components/OutputTrainer.js
// モード①：7ステップ アウトプット
//   - 起動時 /api/stats で EXP・連続記録（ストリーク）を取得
//   - お手本スクリプト生成（/api/example-script）→ ワンタップで型を流し込み
//   - 送信時に並行実行: /api/save（保存＋EXP＋RPG演出） と /api/feedback（70点査定）
// =============================================================
'use client';

import { useEffect, useRef, useState } from 'react';
import { getModule, getStepKeys, calcStats } from '@/lib/havefun-data';

export default function OutputTrainer({ userId, name, moduleId, onNeedName }) {
  const MODULE = getModule(moduleId);
  const stepKeys = getStepKeys(moduleId);
  const EMPTY_STATE = stepKeys.reduce((o, k) => ((o[k] = ''), o), {});
  const STEP_LABELS = MODULE.steps.reduce((o, s) => ((o[s.key] = s.label), o), {});
  const [values, setValues] = useState(EMPTY_STATE);
  const [stats, setStats] = useState(calcStats(0));
  const [streak, setStreak] = useState(0);
  const [doneToday, setDoneToday] = useState(false);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState('');
  const [fx, setFx] = useState({ show: false, gained: 0, levelUp: false });
  const [barAnim, setBarAnim] = useState(false);
  const [fb, setFb] = useState(null);
  const [fbLoading, setFbLoading] = useState(false);
  const [fbError, setFbError] = useState('');
  const [resultId, setResultId] = useState('');
  const [theme, setTheme] = useState('');
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState('');
  const fxTimer = useRef(null);

  useEffect(() => {
    if (!userId) return;
    fetch('/api/stats?userId=' + encodeURIComponent(userId))
      .then((r) => r.json())
      .then((d) => {
        if (!d) return;
        setStats(calcStats(d.exp ?? 0));
        setStreak(d.streak ?? 0);
        setDoneToday(!!d.doneToday);
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    setValues(EMPTY_STATE);
    setFb(null); setFbError(''); setNote(''); setResultId('');
  }, [moduleId]);

  const filled = stepKeys.filter((k) => values[k].trim().length > 0).length;
  const allFilled = filled === stepKeys.length;
  const ready = allFilled && !sending;
  const pct = Math.max(0, Math.min(100, (stats.expInLevel / stats.expPerLevel) * 100));

  function onChange(key, v) { setValues((s) => ({ ...s, [key]: v })); }

  // お手本スクリプト生成 → そのままフォームへ流し込む
  async function genModel() {
    setModelLoading(true); setModelError('');
    try {
      const res = await fetch('/api/example-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: theme.trim(), moduleId }),
      }).then((r) => r.json());
      if (res && res.ok && res.script) {
        const next = {};
        stepKeys.forEach((k) => (next[k] = res.script[k] || ''));
        setValues(next);
        setNote('お手本を流し込みました。自分の言葉に書き換えてから記録しよう。');
      } else {
        setModelError(res && res.message ? res.message : 'お手本生成に失敗しました');
      }
    } catch (e) {
      setModelError('通信エラー: ' + (e.message || e));
    } finally {
      setModelLoading(false);
    }
  }

  async function onSubmit() {
    if (!ready) return;
    if (!name || !name.trim()) {
      setNote('まず上部で名前を設定してください。');
      if (onNeedName) onNeedName();
      return;
    }
    setSending(true); setNote('記録中...'); setFb(null); setFbError(''); setFbLoading(true);

    const payload = { userId, name, moduleId };
    stepKeys.forEach((k) => (payload[k] = values[k].trim()));

    const savePromise = fetch('/api/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }).then((r) => r.json());

    fetch('/api/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((res) => { if (res && res.ok) setFb(res.feedback); else setFbError(res?.message || 'AI査定に失敗しました'); })
      .catch((e) => setFbError('AI査定通信エラー: ' + (e.message || e)))
      .finally(() => setFbLoading(false));

    try {
      const res = await savePromise;
      if (res && res.ok) {
        setStats(calcStats(res.exp));
        setStreak((s) => (doneToday ? s : s + 1));
        setDoneToday(true);
        setBarAnim(true);
        setTimeout(() => setBarAnim(false), 900);
        setFx({ show: true, gained: res.gained || 10, levelUp: !!res.levelUp });
        playSound(!!res.levelUp);
        clearTimeout(fxTimer.current);
        fxTimer.current = setTimeout(() => setFx((f) => ({ ...f, show: false })), res.levelUp ? 2600 : 1800);
        if (res.id) setResultId(res.id);
        setNote('記録しました。下の査定FBを確認して、必要なら書き直そう。');
      } else {
        setNote(res?.message || '保存に失敗しました');
      }
    } catch (e) {
      setNote('保存通信エラー: ' + (e.message || e));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* EXP＋ストリーク */}
      <section className="window exp-window" aria-label="経験値メーター">
        <div className="exp-top">
          <span className="exp-lv">LV. {stats.level}</span>
          <span className="exp-num">{stats.expInLevel} / {stats.expPerLevel} EXP</span>
        </div>
        <div className="exp-bar">
          <div className={'exp-bar__fill' + (barAnim ? ' flash' : '')} style={{ width: pct + '%', transition: barAnim ? undefined : 'none' }} />
        </div>
        <div className="exp-meta">
          <span className="exp-total">累計 {stats.exp} EXP</span>
          <span className={'streak' + (streak > 0 ? ' active' : '')}>🔥 連続 {streak}日{doneToday ? '（今日済）' : ''}</span>
        </div>
      </section>

      {/* 辞書カード */}
      <section className="window dict-window" aria-label="Have fun システム解説">
        <div className="window__title">＊ {MODULE.manual.title} とは？</div>
        <p className="dict-tagline">{MODULE.manual.tagline}</p>
        <p className="dict-summary">{MODULE.manual.summary}</p>
        <ul className="dict-points">
          {MODULE.manual.points.map((p, i) => (<li key={i}><b>{p.label}</b><span>{p.desc}</span></li>))}
        </ul>
        <p className="dict-oneliner">{MODULE.manual.oneLiner}</p>
      </section>

      {/* お手本スクリプト生成 */}
      <section className="window model-window">
        <div className="window__title">＊ お手本スクリプトを見る</div>
        <p className="flow-lead">迷ったらまず型を。テーマを入れて生成すると、下の{stepKeys.length}欄に模範例が入ります。</p>
        <input className="koji-custom" type="text" placeholder="テーマ（任意）例：クレーム対応 / 飛び込み営業" value={theme} onChange={(e) => setTheme(e.target.value)} />
        <button type="button" className="btn btn--sub model-btn" onClick={genModel} disabled={modelLoading}>
          {modelLoading ? '生成中...' : '✨ お手本を生成して流し込む'}
        </button>
        {modelError && <div className="fb-error">{modelError}</div>}
      </section>

      {/* 7ステップフォーム */}
      <section className="window flow-window" aria-label="アウトプットフォーム">
        <div className="window__title">＊ 黄金のアウトプットフロー</div>
        <p className="flow-lead">▼ 7つの手順をすべて埋めて “言語化” を完成させよ。</p>
        {MODULE.steps.map((s) => {
          const done = values[s.key].trim().length > 0;
          return (
            <div className={'step' + (done ? ' done' : '')} key={s.key}>
              <div className="step__head"><span className="step__no">{s.no}</span><span className="step__label">{s.label}</span></div>
              <p className="step__hint">{s.hint}</p>
              <textarea className="step__input" rows={s.rows || 2} placeholder="ここにアウトプット..." value={values[s.key]} onChange={(e) => onChange(s.key, e.target.value)} />
              <p className="step__example">{s.example}</p>
            </div>
          );
        })}
      </section>

      <div className="submit-area">
        <div className={'progress' + (allFilled ? ' full' : '')}>入力済み {filled} / {stepKeys.length}</div>
        <button type="button" className={'btn' + (ready ? ' ready' : '')} disabled={!ready} onClick={onSubmit}>
          {sending ? '査定中...' : '▶ 記録してプロマネージャーに査定してもらう'}
        </button>
        <div className="submit-note">{allFilled && !sending ? '※ 記録＋AI査定が走ります' : (note || `※ ${stepKeys.length}項目すべて埋めないと記録できません`)}</div>
      </div>

      {resultId && (
        <section className="window" aria-label="採点結果URL">
          <div className="window__title">＊ 採点結果ページ</div>
          <a className="result-url-link" href={`/result/${resultId}`} target="_blank" rel="noreferrer">
            📊 採点結果を開く
          </a>
          <p className="result-url-text">/result/{resultId}</p>
        </section>
      )}

      {(fbLoading || fb || fbError) && (
        <section className="window fb-window" aria-label="AI査定フィードバック">
          <div className="window__title">＊ プロマネージャー査定</div>
          {fbLoading && <div className="fb-loading">▼ 査定中… 基準は厳しめにいくぞ</div>}
          {fbError && <div className="fb-error">{fbError}</div>}
          {fb && <OutputFeedback fb={fb} stepLabels={STEP_LABELS} />}
        </section>
      )}

      <div className={'fx-overlay' + (fx.show ? ' show' : '')} aria-hidden={!fx.show} onClick={() => setFx((f) => ({ ...f, show: false }))}>
        <div className="fx-flash" />
        <div className="fx-box">
          <div className="fx-title">アウトプット成功！</div>
          <div className="fx-exp">Have fun EXP ＋{fx.gained}</div>
          {fx.levelUp && <div className="fx-levelup">▲ レベルアップ！ LV.{stats.level}</div>}
          <div className="fx-tap">▼ タップで閉じる</div>
        </div>
      </div>
    </>
  );
}

function OutputFeedback({ fb, stepLabels }) {
  const pass = fb.verdict === '合格';
  return (
    <div className="fb">
      <div className={'fb-verdict ' + (pass ? 'pass' : 'fail')}>
        {pass ? '✓ 合格' : '✗ 要書き直し'}　<span className="fb-total">{fb.total} / 80 点</span>
      </div>
      <div className="fb-scores">
        {Object.entries(fb.scores || {}).map(([k, v]) => (
          <div className="fb-score" key={k}>
            <span className="fb-score__label">{(stepLabels && stepLabels[k]) || k}</span>
            <span className="fb-score__bar"><i style={{ width: (Number(v) / 10) * 100 + '%' }} /></span>
            <span className="fb-score__num">{v}</span>
          </div>
        ))}
      </div>
      {fb.good && <p className="fb-block fb-good"><b>◎ Good</b>{fb.good}</p>}
      {fb.tupCheck && <p className="fb-block"><b>T-UPチェック</b>{fb.tupCheck}</p>}
      {fb.apTupCheck && <p className="fb-block"><b>APのT-UPチェック</b>{fb.apTupCheck}</p>}
      {fb.apCheck && <p className="fb-block"><b>APチェック</b>{fb.apCheck}</p>}
      {fb.apUnderstandingCheck && <p className="fb-block"><b>AP理解度</b>{fb.apUnderstandingCheck}</p>}
      {fb.apAppropriatenessCheck && <p className="fb-block"><b>AP適切性</b>{fb.apAppropriatenessCheck}</p>}
      {fb.consistencyCheck && <p className="fb-block"><b>内容→例→AP 一貫性</b>{fb.consistencyCheck}</p>}
      {fb.impulseFactorCheck && <p className="fb-block"><b>インパルスファクター</b>{fb.impulseFactorCheck}</p>}
      {fb.approachTechniquesCheck && <p className="fb-block"><b>アプローチ話法</b>{fb.approachTechniquesCheck}</p>}
      {fb.stepsCheck && <p className="fb-block"><b>5ステップス構成</b>{fb.stepsCheck}</p>}
      {fb.clarityCheck && <p className="fb-block"><b>初めて聴く人チェック</b>{fb.clarityCheck}</p>}
      {Array.isArray(fb.improvements) && fb.improvements.length > 0 && (
        <div className="fb-block"><b>△ 改善ポイント</b><ul className="fb-improve">{fb.improvements.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
      )}
      {fb.comment && <p className="fb-comment">{fb.comment}</p>}

      {fb.languageCheck && (
        <div className="fb-block fb-lang">
          <b>📝 言語チェック</b>
          <div className="fb-lang-score">自然さ {fb.languageCheck.score}/10　{fb.languageCheck.verdict}</div>
          {fb.languageCheck.patterns?.length > 0 && (
            <div className="fb-lang-patterns">
              {fb.languageCheck.patterns.map((p, i) => (
                <span key={i} className={`fb-lang-tag fb-lang-tag--${p.level === '高' ? 'high' : p.level === '中' ? 'mid' : 'low'}`}>
                  「{p.ending}」{p.count}回
                </span>
              ))}
            </div>
          )}
          {fb.languageCheck.issues?.length > 0 && (
            <ul className="fb-improve">{fb.languageCheck.issues.map((s, i) => <li key={i}>{s}</li>)}</ul>
          )}
          {fb.languageCheck.tips?.length > 0 && (
            <p className="fb-lang-tips">💡 {fb.languageCheck.tips.join('　')}</p>
          )}
          {fb.languageCheck.improved && (
            <details className="fb-lang-improved">
              <summary>✏ 修正例を見る</summary>
              <p>{fb.languageCheck.improved}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function playSound(levelUp) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = levelUp ? [523, 659, 784, 1047, 1319] : [784, 1047];
    const t = ctx.currentTime;
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'square'; o.frequency.value = f;
      const st = t + i * 0.09;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.15, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.12);
      o.connect(g); g.connect(ctx.destination); o.start(st); o.stop(st + 0.13);
    });
    setTimeout(() => { try { ctx.close(); } catch (e) {} }, 1200);
  } catch (e) {}
}
