import type { Metadata } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import './globals.css';

/**
 * Noto Sans JP（Q-010 確定）
 *
 * next/font/google はビルド時にフォントを自己ホストする。
 * Google のCDNへ実行時アクセスしないため、表示のちらつき（FOUT）が出ず、
 * 利用者のIPがGoogleに渡ることもない。
 *
 * CSS変数として出し、tailwind.config.ts の fontFamily.sans から参照する。
 * display:'swap' は読み込み中も代替フォントで文字を表示させる指定。
 * これがないと読み込み完了まで本文が空白になる。
 */
const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-jp',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BOTANICA カスタマーサポート',
  // 顧客チャット（/chat）と管理画面の両方にこのルートlayoutが適用されるため、
  // どちらか一方に寄せた説明文にしない
  description: 'BOTANICAカスタマーサポート',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // lang="ja" は日本語の折り返し・読み上げの精度に影響するため必ず指定する
    <html lang="ja" className={`${notoSansJP.variable} scroll-smooth`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
