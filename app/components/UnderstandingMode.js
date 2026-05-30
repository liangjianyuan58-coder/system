'use client';
import UnderstandingChecker from './UnderstandingChecker';

export default function UnderstandingMode({ userId, name, moduleId }) {
  return (
    <section className="window" aria-label="理解チェック">
      <div className="window__title">＊ 理解チェック</div>
      <UnderstandingChecker moduleId={moduleId} userId={userId} name={name} />
    </section>
  );
}
