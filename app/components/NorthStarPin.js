// =============================================================
// app/components/NorthStarPin.js
// 北極星ピン — 長期目標の登録・表示・AI週次振り返り
// =============================================================
'use client';

import { useEffect, useState } from 'react';

export default function NorthStarPin({ userId, name }) {
  const [northStar, setNorthStar] = useState('');
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState(null);
  const [reviewError, setReviewError] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!userId) return;
    fetch('/api/northstar?userId=' + encodeURIComponent(userId))
      .then((r) => r.json())
      .then((res) => {
        if (res.ok && res.data?.northStar) setNorthStar(res.data.northStar);
      })
      .catch(() => setLoadError('北極星の読み込みに失敗しました'));
  }, [userId]);

  async function save() {
    const v = draft.trim();
    if (!v || !userId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/northstar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: name || '', northStar: v }),
      }).then((r) => r.json());
      if (res.ok) {
        setNorthStar(v);
        setEditing(false);
        setReview(null);
        setReviewError('');
      } else {
        setLoadError(res.message || '保存に失敗しました');
      }
    } catch (e) {
      setLoadError('通信エラー: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function doReview() {
    if (!userId || !northStar) return;
    setReviewing(true);
    setReview(null);
    setReviewError('');
    try {
      const res = await fetch('/api/northstar/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      }).then((r) => r.json());
      if (res.ok) setReview(res.review);
      else setReviewError(res.message || 'AI振り返りに失敗しました');
    } catch (e) {
      setReviewError('通信エラー: ' + (e.message || e));
    } finally {
      setReviewing(false);
    }
  }

  function startEdit() {
    setDraft(northStar);
    setEditing(true);
    setReview(null);
    setReviewError('');
  }

  function cancelEdit() {
    setEditing(false);
    setDraft('');
  }

  return (
    <section className="window northstar-pin">
      <div className="window__title">{'⭐ 北極星（長期目標）'}</div>

      {loadError && <div className="fb-error">{loadError}</div>}

      {editing ? (
        <div className="northstar-edit">
          <textarea
            className="step__input northstar-input"
            rows={3}
            placeholder={'あなたが目指す長期目標を書く。例：「1年以内にチームトップの売上を出し、マネージャーに昇格する」'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
          <div className="northstar-edit-actions">
            <button type="button" className="btn btn--sub" onClick={cancelEdit} disabled={saving}>キャンセル</button>
            <button type="button" className={'btn' + (draft.trim() && !saving ? ' ready' : '')} onClick={save} disabled={!draft.trim() || saving}>
              {saving ? '保存中...' : '✓ 保存'}
            </button>
          </div>
        </div>
      ) : northStar ? (
        <div className="northstar-display">
          <p className="northstar-text">{'"' + northStar + '"'}</p>
          <div className="northstar-actions">
            <button type="button" className="btn btn--sub" onClick={startEdit}>{'✎ 変更'}</button>
            <button type="button" className={'btn btn--sub northstar-review-btn' + (reviewing ? ' reviewing' : '')} onClick={doReview} disabled={reviewing}>
              {reviewing ? '振り返り中...' : '🔍 AI振り返り'}
            </button>
          </div>
        </div>
      ) : (
        <div className="northstar-empty">
          <p className="northstar-hint">{'長期目標を登録すると、毎週AIが「先週の行動と合ってたか？」を振り返ってくれます。'}</p>
          <button type="button" className="btn btn--sub" onClick={() => { setDraft(''); setEditing(true); }}>{'⭐ 北極星を登録する'}</button>
        </div>
      )}

      {reviewError && <div className="fb-error" style={{ marginTop: 10 }}>{reviewError}</div>}

      {(reviewing || review) && (
        <div className="northstar-review-result">
          <div className="window__title" style={{ marginTop: 14 }}>{'AI振り返り結果'}</div>
          {reviewing && <div className="fb-loading">{'▼ 先週の行動と北極星を照合中…'}</div>}
          {review && (
            <div className="fb">
              <div className="fb-verdict koji-score">{'整合度 ' + (review.alignment ?? '-') + ' / 10'}</div>
              {review.comment && <p className="fb-block">{review.comment}</p>}
              {review.good && <p className="fb-block fb-good"><b>{'◎ 良かった点'}</b>{review.good}</p>}
              {review.challenge && <p className="fb-block"><b>{'△ 課題'}</b>{review.challenge}</p>}
              {review.nextAP && (
                <div className="fb-block koji-example">
                  <b>{'🎯 来週のAP'}</b>
                  <p>{review.nextAP}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
