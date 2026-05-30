// =============================================================
// app/page.js
// 識別子（userId/名前）を管理し、各モードへ受け渡す。
//   タブ: ① 7ステップ / ② リフレーミング / ③ こじつけ / 📋 履歴
//   上部に「あなた」プロフィールバー（名前の設定・変更）。
// =============================================================
'use client';

import { useEffect, useState } from 'react';
import { getModule, MODULE_CATEGORIES, MODULES } from '@/lib/havefun-data';
import { getOrCreateUserId, loadName, saveName } from '@/lib/identity';
import OutputTrainer from './components/OutputTrainer';
import ReframeGym from './components/ReframeGym';
import KojitsukeMode from './components/KojitsukeMode';
import History from './components/History';
import UnderstandingMode from './components/UnderstandingMode';

export default function Page() {
  const [activeModule, setActiveModule] = useState('havefun');
  const [mode, setMode] = useState('output');
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const MODULE = getModule(activeModule);

  // 起動時にローカルの識別子・名前を読み込み（無ければ名前入力を促す）
  useEffect(() => {
    const id = getOrCreateUserId();
    const n = loadName();
    setUserId(id);
    setName(n);
    if (!n) { setEditing(true); setDraft(''); }
  }, []);

  function commitName() {
    const v = draft.trim();
    if (!v) return;
    saveName(v);
    setName(v);
    setEditing(false);
  }

  return (
    <>
      <div className="scanlines" aria-hidden="true" />
      <main className="screen">
        <header className="app-header">
          <div className="app-header__sub">▼ OUTPUT TRAINING</div>
          <h1 className="app-header__title">{MODULE.manual.title}</h1>
          <div className="app-header__reading">{MODULE.manual.reading}</div>
          <nav className="module-selector">
            {MODULE_CATEGORIES.map((cat) => (
              <div key={cat.label} className="module-category">
                <span className="module-category__label">{cat.label}</span>
                <div className="module-category__btns">
                  {cat.modules.map((id) => (
                    <button key={id} className={'module-btn' + (activeModule === id ? ' active' : '')} onClick={() => setActiveModule(id)}>
                      {MODULES[id].manual.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </header>

        {/* プロフィールバー */}
        <section className={'profile' + (!name ? ' need' : '')}>
          {editing ? (
            <div className="profile-edit">
              <input
                className="profile-input"
                type="text"
                maxLength={20}
                placeholder="名前 / ニックネームを入力"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitName(); }}
                autoFocus
              />
              <button className="btn btn--sub profile-save" onClick={commitName} disabled={!draft.trim()}>決定</button>
            </div>
          ) : (
            <div className="profile-view">
              <span className="profile-label">あなた：</span>
              <span className="profile-name">{name || '未設定'}</span>
              <button className="profile-editbtn" onClick={() => { setDraft(name); setEditing(true); }}>✎ 変更</button>
            </div>
          )}
          {!name && !editing && <div className="profile-hint">※ 記録するには名前の設定が必要です</div>}
        </section>

        {/* タブ */}
        <nav className="tabs" role="tablist">
          <button className={'tab' + (mode === 'output' ? ' active' : '')} onClick={() => setMode('output')}>① 8ステップ</button>
          <button className={'tab' + (mode === 'reframe' ? ' active' : '')} onClick={() => setMode('reframe')}>② リフレ</button>
          <button className={'tab' + (mode === 'kojitsuke' ? ' active' : '')} onClick={() => setMode('kojitsuke')}>③ こじつけ</button>
          <button className={'tab' + (mode === 'understanding' ? ' active' : '')} onClick={() => setMode('understanding')}>🧠 理解</button>
          <button className={'tab' + (mode === 'history' ? ' active' : '')} onClick={() => setMode('history')}>📋 履歴</button>
        </nav>

        {mode === 'output' && <OutputTrainer userId={userId} name={name} moduleId={activeModule} onNeedName={() => setEditing(true)} />}
        {mode === 'reframe' && <ReframeGym />}
        {mode === 'kojitsuke' && <KojitsukeMode />}
        {mode === 'understanding' && <UnderstandingMode userId={userId} name={name} moduleId={activeModule} />}
        {mode === 'history' && <History userId={userId} name={name} />}

        <footer className="app-footer">Have fun System ─ v4.0（個人識別）</footer>
      </main>
    </>
  );
}
