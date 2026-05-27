'use client';

export default function ResultError({ error, reset }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f0f4f8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, sans-serif',
      padding: '24px',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '32px 24px',
        textAlign: 'center',
        maxWidth: 400,
        boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
      }}>
        <p style={{ fontSize: 36, margin: '0 0 12px' }}>⚠️</p>
        <h1 style={{ fontSize: 18, color: '#1e293b', margin: '0 0 8px' }}>読み込みエラー</h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 20px' }}>
          結果の取得に失敗しました。<br />時間をおいてから再度お試しください。
        </p>
        <button
          onClick={reset}
          style={{
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 24px',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          再試行
        </button>
      </div>
    </div>
  );
}
