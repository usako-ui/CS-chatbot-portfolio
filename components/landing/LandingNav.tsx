/**
 * ランディングページの固定ヘッダー
 *
 * ロゴは架空クライアント名ではなくプロダクト名（AI CS Bot）を出す。
 * リンクはすべて同一ページ内のアンカー。ページ遷移を挟まないので
 * Link ではなく a を使う（Next.js の Link はアンカー移動に不要）。
 */
import Link from 'next/link';
import { BotIcon } from '@/components/icons';

const NAV_LINKS = [
  { href: '#demo', label: 'デモを試す' },
  { href: '#features', label: '機能紹介' },
  { href: '#flow', label: '導入の流れ' },
  { href: '#tech', label: '技術スタック' },
];

export function LandingNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-brand-night-line/70 bg-brand-night/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-brand-night-text"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-night-accent/40 bg-brand-night-accent/10 text-brand-night-accent">
            <BotIcon size={18} />
          </span>
          <span className="text-[15px] font-bold tracking-wide">AI CS Bot</span>
        </Link>

        {/* 画面が狭いとリンクが折り返してヘッダーが2段になるため、
            狭い幅ではリンクを畳んでCTAだけ残す */}
        <ul className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-[14px] text-brand-night-muted transition-colors hover:text-brand-night-text"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <a
          href="#demo"
          className="shrink-0 rounded-xl bg-brand-night-accent px-4 py-2 text-[14px] font-bold text-brand-night transition-opacity hover:opacity-90"
        >
          デモを試す
        </a>
      </nav>
    </header>
  );
}
