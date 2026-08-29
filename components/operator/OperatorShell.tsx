/**
 * 管理画面の共通シェル（T-33）
 *
 * サイドバーと未対応バッジの状態を一箇所で持つ。
 * 未対応件数は複数の画面（サイドバーのバッジ・ログイン時モーダル）が
 * 参照するため、各画面で個別に取りに行かず、ここから配る。
 */
'use client';

import { Suspense, useState } from 'react';
import { Sidebar } from '@/components/operator/Sidebar';
import { WaitingModal } from '@/components/operator/WaitingModal';

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

  return (
    <div className="flex h-screen overflow-hidden bg-brand-sand">
      {/* Sidebar は useSearchParams を使うため Suspense で包む */}
      <Suspense fallback={<div className="w-56 shrink-0 bg-brand-sidebar" />}>
        <Sidebar operatorName={operatorName} waitingCount={waitingCount} />
      </Suspense>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-brand-accent bg-white px-6 py-3.5">
          <h1 className="text-[16px] font-bold text-brand-text">{title}</h1>
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
    </div>
  );
}

import { createContext, useContext } from 'react';

/** 一覧が最新の未対応件数を拾ったときにサイドバーへ伝えるための経路 */
const WaitingCountContext = createContext<(n: number) => void>(() => {});

export function useSetWaitingCount() {
  return useContext(WaitingCountContext);
}
