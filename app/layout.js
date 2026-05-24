// =============================================================
// app/layout.js
// ルートレイアウト（全ページ共通）
// =============================================================
import './globals.css';

export const metadata = {
  title: 'Have fun トレーニング',
  description: '物事を楽しむセンスを磨く・アウトプットトレーニング',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
