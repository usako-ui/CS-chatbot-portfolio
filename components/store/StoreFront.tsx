/**
 * BOTANICA ECサイト風レイアウト（表示のみ）
 *
 * 本番チャット（/botanica）とデモチャット（/demo-ec）の2ページで使う。
 * 違うのは右下に載せるウィジェットと注記だけなので、
 * ページ側で同じマークアップを書かずここに寄せている。
 * 片方だけ直して見た目がずれるのを防ぐため。
 *
 * このコンポーネント自体は状態も通信も持たないサーバーコンポーネント。
 * クライアント側で動くのは、children として渡されるウィジェットだけ。
 */
import Link from 'next/link';
import { LeafIcon } from '@/components/icons';

/** ECサイトの見た目を再現するためのダミー商品 */
const PRODUCTS = [
  { name: 'モイスチャークリーム', category: 'クリーム', size: '50g', price: 4_620 },
  { name: 'フェイスオイル', category: 'オイル', size: '30mL', price: 5_280 },
  { name: 'ハーバルトナー', category: '化粧水', size: '150mL', price: 3_960 },
  { name: 'リペアセラム', category: '美容液', size: '30mL', price: 6_600 },
] as const;

const NAV = ['新着', '商品一覧', 'ご利用ガイド', 'カート'];

const YEN = new Intl.NumberFormat('ja-JP');

export function StoreFront({
  /** フッターに出す注記。ページごとに位置づけが違うので外から渡す */
  notice,
  /** 右下に固定するチャットウィジェット */
  children,
}: {
  notice: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-brand-sand text-brand-text">
      {/* ECサイトのヘッダー（ブランドカラー・テキストロゴ：Q-010） */}
      <header className="sticky top-0 z-40 border-b border-brand-accent bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-2">
            <LeafIcon size={24} className="text-brand-primary" />
            <div>
              <p className="text-lg font-bold tracking-[0.18em] text-brand-primary">
                BOTANICA
              </p>
              <p className="text-[11px] tracking-wide text-brand-secondary">
                自然派スキンケア
              </p>
            </div>
          </div>

          {/* 画面が狭いとナビが折り返してヘッダーが2段になるため、狭い幅では畳む */}
          <nav className="hidden sm:block">
            <ul className="flex items-center gap-6">
              {NAV.map((label) => (
                <li key={label} className="text-[13px] text-brand-secondary">
                  {label}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 pb-28">
        {/* 簡易ヒーロー */}
        <section className="rounded-2xl border border-brand-accent bg-white px-6 py-8 sm:px-10 sm:py-12">
          <p className="text-[12px] font-bold tracking-[0.16em] text-brand-secondary">
            NEW ARRIVAL
          </p>
          <h1 className="mt-3 text-2xl font-bold leading-snug sm:text-3xl">
            肌にやさしい、毎日のスキンケア。
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-brand-secondary">
            送料・返品・お届け日のご質問は、右下のチャットからお気軽にどうぞ。
          </p>
        </section>

        {/* 商品カード */}
        <h2 className="mt-12 text-[17px] font-bold">おすすめの商品</h2>

        <ul className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUCTS.map((p) => (
            <li
              key={p.name}
              className="overflow-hidden rounded-xl border border-brand-accent bg-white"
            >
              {/* 商品画像のプレースホルダー。画像アセットは本案件のスコープ外 */}
              <div className="flex h-36 items-center justify-center bg-brand-accent/25">
                <LeafIcon size={36} className="text-brand-secondary/50" />
              </div>

              <div className="p-4">
                <p className="text-[11px] tracking-wide text-brand-secondary">
                  {p.category}
                </p>
                <p className="mt-1 text-[14px] font-medium leading-snug">{p.name}</p>
                <p className="mt-0.5 text-[12px] text-brand-secondary">{p.size}</p>
                <p className="mt-2.5 text-[15px] font-bold text-brand-primary">
                  {YEN.format(p.price)}円
                  <span className="ml-1 text-[11px] font-normal text-brand-secondary">
                    税込
                  </span>
                </p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-center text-[13px] text-brand-secondary">
          右下のボタンからチャットを開けます。AIが一次対応し、必要な場合は担当者へ引き継ぎます。
        </p>

        <p className="mt-8 text-center text-[13px]">
          <Link href="/" className="text-brand-secondary underline underline-offset-4">
            紹介ページに戻る
          </Link>
        </p>
      </main>

      {/* 注記（このページの位置づけ）。本文の邪魔をしないようフッターに置く */}
      <footer className="border-t border-brand-accent bg-white px-5 py-8">
        <div className="mx-auto max-w-5xl text-center text-[12px] leading-relaxed text-brand-secondary">
          {notice}
        </div>
      </footer>

      {/* 右下固定のチャットウィジェット */}
      {children}
    </div>
  );
}
