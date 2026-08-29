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

import { createContext, Suspense, useContext, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/operator/Sidebar';
import { WaitingModal } from '@/components/operator/WaitingModal';
import { MenuIcon } from '@/components/icons';

export function OperatorShell({
  operatorName,
  initialWaitingCount,
  title,
  actions,
  children,
}: {
  operatorName: string;
  initialWaitingCount: number;
  title: string;
  /** ヘッダー右側に置く操作（当日休業トグル等） */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [waitingCount, setWaitingCount] = useState(initialWaitingCount);
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

        <main className="flex-1 overflow-y-auto">
          {/* 子側から未対応件数を更新できるようにコンテキスト代わりに渡す */}
          <WaitingCountContext.Provider value={setWaitingCount}>
            {children}
          </WaitingCountContext.Provider>
        </main>
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

/** 一覧が最新の未対応件数を拾ったときにサイドバーへ伝えるための経路 */
const WaitingCountContext = createContext<(n: number) => void>(() => {});

export function useSetWaitingCount() {
  return useContext(WaitingCountContext);
}
