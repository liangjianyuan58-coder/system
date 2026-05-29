// =============================================================
// app/components/History.js
// 履歴：誰がどういう入力をしたか一覧（全員／自分 切替・タップで全文展開）
// =============================================================
'use client';

import { useEffect, useState } from 'react';

const STEP_VIEW = [
  ['tup', '①T-UP'],
  ['conclusion', '②結論'],
  ['content', '③内容'],
  ['example', '④一般的な例'],
  ['workExample', '⑤稼働における例'],
  ['reconclusion', '⑥再結論'],
  ['ap', '⑦AP'],
];

const SCORE_LABELS = {
  tup: 'T-UP', conclusion: '結論', content: '内容',
  example: '一般例', workExample: '稼働例', reconclusion: '再結論', ap: 'AP',
};

function fmt(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d)) return ts;
  const j = new Date(d.getTime() + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${j.getUTCFullYear()}/${p(j.getUTCMonth() + 1)}/${p(j.getUTCDate())} ${p(j.getUTCHours())}:${p(j.getUTCMinutes())}`;
}

function parseGrade(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}

export default function History({ userId, name }) {
  const [scope, setScope] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState({});

  async function load(s = scope) {
    setLoading(true); setError('');
    try {
      const q = new URLSearchParams({ scope: s, userId: userId || '', limit: '50' });
      const res = await fetch('/api/history?' + q.toString()).then((r) => r.json());
      if (res && res.ok) setItems(res.items || []);
      else setError(res && res.message ? res.message : '取得に失敗しました');
    } catch (e) {
      setError('通信エラー: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load('all'); /* 初回 */ }, []); // eslint-disable-line

  function switchScope(s) { setScope(s); setOpen({}); load(s); }

  return (
    <>
      <section className="window">
        <div className="window__title">＊ アウトプット履歴</div>
        <p className="flow-lead">誰が・いつ・どんなアウトプットをしたかの記録。タップで全文表示。</p>
        <div className="hist-toggle">
          <button className={'seg' + (scope === 'all' ? ' on' : '')} onClick={() => switchScope('all')}>全員</button>
          <button className={'seg' + (scope === 'me' ? ' on' : '')} onClick={() => switchScope('me')}>自分{name ? `（${name}）` : ''}</button>
          <button className="seg seg--refresh" onClick={() => load()} title="更新">⟳</button>
        </div>
      </section>

      <section className="window">
        {loading && <div className="fb-loading">▼ 読み込み中…</div>}
        {error && <div className="fb-error">{error}</div>}
        {!loading && !error && items.length === 0 && (
          <div className="hist-empty">まだ記録がありません。「① 7ステップ」から記録してみよう。</div>
        )}
        <ul className="hist-list">
          {items.map((it, i) => {
            const isMe = it.userId && it.userId === userId;
            const id = (it.ts || '') + i;
            const expanded = !!open[id];
            const grade = parseGrade(it.grade);
            const total = grade?.total ?? null;
            const verdict = grade?.verdict || '';
            return (
              <li className={'hist-item' + (isMe ? ' mine' : '')} key={id}>
                <button className="hist-head" onClick={() => setOpen((o) => ({ ...o, [id]: !o[id] }))}>
                  <span className="hist-name">{it.name || '(名無し)'}{isMe ? ' ★' : ''}</span>
                  <span className="hist-date">{fmt(it.ts)}</span>
                </button>

                {/* モジュール名 + スコア概要 */}
                <div className="hist-meta">
                  {it.module && <span className="hist-module">{it.module}</span>}
                  {total !== null && (
                    <span className={'hist-score' + (total >= 50 ? ' pass' : ' fail')}>
                      {total}/70 {verdict}
                    </span>
                  )}
                </div>

                <div className="hist-conclusion">{it.conclusion || it.tup || '(内容なし)'}</div>

                {expanded && (
                  <div className="hist-detail">
                    {STEP_VIEW.map(([k, label]) => (
                      <div className="hist-step" key={k}>
                        <b>{label}</b>
                        <span>{it[k] || '—'}</span>
                      </div>
                    ))}

                    {grade && (
                      <div className="hist-grade">
                        <div className="hist-grade__header">採点結果　{total}/70 {verdict}</div>
                        <div className="hist-grade__scores">
                          {Object.entries(SCORE_LABELS).map(([k, l]) => (
                            <div className="hist-grade__score" key={k}>
                              <span className="hist-grade__score-label">{l}</span>
                              <div className="hist-grade__score-bar">
                                <i style={{ width: `${((grade.scores?.[k] ?? 0) / 10) * 100}%` }} />
                              </div>
                              <span className="hist-grade__score-num">{grade.scores?.[k] ?? '-'}</span>
                            </div>
                          ))}
                        </div>
                        {grade.good && (
                          <div className="hist-grade__block hist-grade__good">
                            <b>✅ Good</b>
                            <span>{grade.good}</span>
                          </div>
                        )}
                        {grade.improvements?.length > 0 && (
                          <div className="hist-grade__block">
                            <b>💡 改善ポイント</b>
                            <ol className="hist-grade__list">
                              {grade.improvements.map((s, j) => <li key={j}>{s}</li>)}
                            </ol>
                          </div>
                        )}
                        {grade.comment && (
                          <div className="hist-grade__block hist-grade__comment">
                            <b>🔥 コメント</b>
                            <span>{grade.comment}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <button className="hist-more" onClick={() => setOpen((o) => ({ ...o, [id]: !o[id] }))}>
                  {expanded ? '▲ 閉じる' : '▼ 全文・採点を見る'}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
