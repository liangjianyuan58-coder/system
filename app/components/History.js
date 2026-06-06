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
  ['apTup', '⑦APのT-UP'],
  ['ap', '⑧AP'],
];

function fmt(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d)) return ts;
  const j = new Date(d.getTime() + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${j.getUTCFullYear()}/${p(j.getUTCMonth() + 1)}/${p(j.getUTCDate())} ${p(j.getUTCHours())}:${p(j.getUTCMinutes())}`;
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
            return (
              <li className={'hist-item' + (isMe ? ' mine' : '')} key={id}>
                <button className="hist-head" onClick={() => setOpen((o) => ({ ...o, [id]: !o[id] }))}>
                  <span className="hist-name">{it.name || '(名無し)'}{isMe ? ' ★' : ''}</span>
                  <span className="hist-date">{fmt(it.ts)}</span>
                </button>
                <div className="hist-conclusion">{it.conclusion || it.tup || '(内容なし)'}</div>
                {expanded && (
                  <div className="hist-detail">
                    {STEP_VIEW.map(([k, label]) => (
                      <div className="hist-step" key={k}>
                        <b>{label}</b>
                        <span>{it[k] || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button className="hist-more" onClick={() => setOpen((o) => ({ ...o, [id]: !o[id] }))}>
                  {expanded ? '▲ 閉じる' : '▼ 全文を見る'}
                </button>
                {it.resultUrl && (
                  <a className="hist-result-link" href={it.resultUrl} target="_blank" rel="noreferrer">
                    📊 採点結果を見る
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
