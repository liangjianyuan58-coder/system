// =============================================================
// app/components/History.js
// 履歴：7ステップ / こじつけ / リフレーム を統合表示
// =============================================================
'use client';

import { useEffect, useState } from 'react';

const STEP_VIEW = [
  ['tup', '①T-UP'], ['conclusion', '②結論'], ['content', '③内容'],
  ['example', '④一般的な例'], ['workExample', '⑤稼働における例'],
  ['reconclusion', '⑥再結論'], ['ap', '⑦AP'],
];

function fmt(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d)) return ts;
  const j = new Date(d.getTime() + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${j.getUTCFullYear()}/${p(j.getUTCMonth() + 1)}/${p(j.getUTCDate())} ${p(j.getUTCHours())}:${p(j.getUTCMinutes())}`;
}

function TypeBadge({ type }) {
  if (type === 'output') return <span className="hist-type-badge hist-type-output">7ステップ</span>;
  if (type === 'kojitsuke') return <span className="hist-type-badge hist-type-kojitsuke">こじつけ</span>;
  if (type === 'reframe') return <span className="hist-type-badge hist-type-reframe">リフレーム</span>;
  return null;
}

function VerdictBadge({ verdict, total }) {
  if (!verdict) return null;
  const pass = verdict === '合格';
  return (
    <span className={'hist-verdict ' + (pass ? 'pass' : 'fail')}>
      {verdict} {total != null ? total + '/70' : ''}
    </span>
  );
}

function ScoreBadge({ score }) {
  if (score == null) return null;
  return <span className="hist-score">{score}/10</span>;
}

function OutputItem({ it, isMe, expanded, onToggle }) {
  return (
    <li className={'hist-item' + (isMe ? ' mine' : '')}>
      <button className="hist-head" onClick={onToggle}>
        <span className="hist-head-left">
          <TypeBadge type="output" />
          <span className="hist-name">{it.name || '(名無し)'}{isMe ? ' ★' : ''}</span>
          {it.aiVerdict && <VerdictBadge verdict={it.aiVerdict} total={it.aiTotal} />}
          {it.usedModel && <span className="hist-model-badge">✨お手本</span>}
        </span>
        <span className="hist-date">{fmt(it.ts)}</span>
      </button>
      <div className="hist-conclusion">{it.conclusion || it.tup || '(内容なし)'}</div>
      {expanded && (
        <div className="hist-detail">
          {it.moduleId && <div className="hist-module">{'モジュール: ' + it.moduleId}</div>}
          {STEP_VIEW.map(([k, label]) => (
            <div className="hist-step" key={k}>
              <b>{label}</b>
              <span>{it[k] || '—'}</span>
            </div>
          ))}
          {it.aiVerdict && (
            <div className="hist-step">
              <b>AI採点</b>
              <span>{it.aiVerdict + (it.aiTotal != null ? '　' + it.aiTotal + '/70点' : '')}</span>
            </div>
          )}
        </div>
      )}
      <button className="hist-more" onClick={onToggle}>{expanded ? '▲ 閉じる' : '▼ 全文を見る'}</button>
    </li>
  );
}

function TrainingItem({ it, isMe, expanded, onToggle }) {
  const isKoji = it.type === 'kojitsuke';
  const label1 = isKoji ? 'お題' : '事象';
  const label2 = isKoji ? 'こじつけ説明' : 'リフレーミング';
  return (
    <li className={'hist-item' + (isMe ? ' mine' : '')}>
      <button className="hist-head" onClick={onToggle}>
        <span className="hist-head-left">
          <TypeBadge type={it.type} />
          <span className="hist-name">{it.name || '(名無し)'}{isMe ? ' ★' : ''}</span>
          {it.aiScore != null && <ScoreBadge score={it.aiScore} />}
        </span>
        <span className="hist-date">{fmt(it.ts)}</span>
      </button>
      <div className="hist-conclusion">{it.input1 || '(内容なし)'}</div>
      {expanded && (
        <div className="hist-detail">
          {it.moduleId && <div className="hist-module">{'モジュール: ' + it.moduleId}</div>}
          <div className="hist-step"><b>{label1}</b><span>{it.input1 || '—'}</span></div>
          <div className="hist-step"><b>{label2}</b><span>{it.input2 || '—'}</span></div>
          {it.aiScore != null && <div className="hist-step"><b>AI点数</b><span>{it.aiScore}/10</span></div>}
        </div>
      )}
      <button className="hist-more" onClick={onToggle}>{expanded ? '▲ 閉じる' : '▼ 詳細を見る'}</button>
    </li>
  );
}

export default function History({ userId, name }) {
  const [scope, setScope] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState({});

  async function load(s = scope) {
    setLoading(true); setError('');
    try {
      const q = new URLSearchParams({ scope: s, userId: userId || '', limit: '60' });
      const res = await fetch('/api/history?' + q.toString()).then((r) => r.json());
      if (res && res.ok) setItems(res.items || []);
      else setError(res && res.message ? res.message : '取得に失敗しました');
    } catch (e) {
      setError('通信エラー: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load('all'); }, []); // eslint-disable-line

  function switchScope(s) { setScope(s); setOpen({}); load(s); }

  const filtered = typeFilter === 'all' ? items
    : typeFilter === 'output' ? items.filter((i) => i.type === 'output')
    : items.filter((i) => i.type === 'kojitsuke' || i.type === 'reframe');

  return (
    <>
      <section className="window">
        <div className="window__title">＊ 履歴</div>
        <p className="flow-lead">アウトプット・こじつけ・リフレームの記録。タップで詳細表示。</p>
        <div className="hist-toggle">
          <button className={'seg' + (scope === 'all' ? ' on' : '')} onClick={() => switchScope('all')}>全員</button>
          <button className={'seg' + (scope === 'me' ? ' on' : '')} onClick={() => switchScope('me')}>自分{name ? '（' + name + '）' : ''}</button>
          <button className="seg seg--refresh" onClick={() => load()} title="更新">⟳</button>
        </div>
        <div className="hist-toggle hist-type-filter">
          <button className={'seg' + (typeFilter === 'all' ? ' on' : '')} onClick={() => setTypeFilter('all')}>全て</button>
          <button className={'seg' + (typeFilter === 'output' ? ' on' : '')} onClick={() => setTypeFilter('output')}>7ステップ</button>
          <button className={'seg' + (typeFilter === 'training' ? ' on' : '')} onClick={() => setTypeFilter('training')}>こじ・リフレ</button>
        </div>
      </section>

      <section className="window">
        {loading && <div className="fb-loading">▼ 読み込み中…</div>}
        {error && <div className="fb-error">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="hist-empty">まだ記録がありません。</div>
        )}
        <ul className="hist-list">
          {filtered.map((it, i) => {
            const isMe = it.userId && it.userId === userId;
            const id = (it.ts || '') + i;
            const expanded = !!open[id];
            const toggle = () => setOpen((o) => ({ ...o, [id]: !o[id] }));
            if (it.type === 'output') {
              return <OutputItem key={id} it={it} isMe={isMe} expanded={expanded} onToggle={toggle} />;
            }
            return <TrainingItem key={id} it={it} isMe={isMe} expanded={expanded} onToggle={toggle} />;
          })}
        </ul>
      </section>
    </>
  );
}
