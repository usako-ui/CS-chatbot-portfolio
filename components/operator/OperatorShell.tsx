/**
 * 管理画面の共通シェル（T-33）
 *
 * サイドバーと未対応バッジの状態を一箇所で持つ。
 * 未対応件数は複数の画面（サイドバーのバッジ・ログイン時モーダル）が
 * 参照するため、各画面で個別に取りに行かず、ここから配る。
 *
 * 【レスポンシブ】境界は xl（1280px）。
 *   1280px以上（PC）        : サイドバー常時表示の2カラム
 *   768〜1279px（タブレット）: ハンバーガーで開閉するドロワー
 * スマートフォン（767px以下）はMVPスコープ外。
 */
'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/operator/Sidebar';
import { WaitingModal } from '@/components/operator/WaitingModal';
import { MenuIcon } from '@/components/icons';

export function OperatorShell({
  operatorName,
  waitingCount,
  title,
  actions,
  children,
}: {
  operatorName: string;
  /**
   * 未対応件数。呼び出し側（DashboardClient）が保持し、
   * 一覧の更新に合わせて渡し直す。
   *
   * ここで useState の初期値として受けてはいけない。
   * useState の初期値は最初のレンダーでしか使われないため、
   * 一覧が件数を更新してもサイドバーのバッジが古いまま止まる。
   */
  waitingCount: number;
  title: string;
  /** ヘッダー右側に置く操作（当日休業トグル等） */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [isNavOpen, setIsNavOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-brand-sand">
      {/* Sidebar は useSearchParams を使うため Suspense で包む */}
      <Suspense
        fallback={<div className="hidden w-56 shrink-0 bg-brand-sidebar xl:block" />}
      >
        <Sidebar
          operatorName={operatorName}
          waitingCount={waitingCount}
          isOpen={isNavOpen}
          onClose={() => setIsNavOpen(false)}
        />
      </Suspense>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-brand-accent bg-white px-4 py-3.5 xl:px-6">
          {/* ハンバーガー。PC幅ではサイドバーが常時見えているので隠す */}
          <button
            type="button"
            onClick={() => setIsNavOpen(true)}
            aria-label="メニューを開く"
            aria-expanded={isNavOpen}
            className="-ml-1 rounded-lg p-1.5 text-brand-text transition-colors hover:bg-brand-sand xl:hidden"
          >
            <MenuIcon size={22} />
          </button>

          <h1 className="min-w-0 flex-1 truncate text-[16px] font-bold text-brand-text">
            {title}
          </h1>
          {actions}
        </header>

        {/* 未対応件数は各画面から props で渡ってくる（DashboardClient 経由）。
            Context は使っていない */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      <WaitingModal waitingCount={waitingCount} />

      {/* 画面遷移でドロワーを閉じる。
          リンク側でも閉じているが、ブラウザの戻る等を経由した遷移も拾う */}
      <Suspense fallback={null}>
        <CloseNavOnNavigate onClose={() => setIsNavOpen(false)} />
      </Suspense>
    </div>
  );
}

/**
 * パスまたはクエリが変わったらドロワーを閉じる。
 * useSearchParams を使うため Suspense 境界の内側に置く必要があり、
 * シェル本体から切り出している。
 */
function CloseNavOnNavigate({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const key = `${pathname}?${params.toString()}`;

  useEffect(() => {
    onClose();
    // onClose は毎レンダー新しい関数になるため依存に入れない。
    // 入れるとレンダーのたびに閉じてしまい、開けなくなる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}
