/**
 * Hero に置く管理画面（受信トレイ）のモック
 *
 * 顧客チャット側の演出に合わせて、一定間隔で新着が上に入るように見せる。
 * リアルタイムで問い合わせが届く画面であることを、静止画より短く伝えるため。
 * 通信もDBもしない、見た目だけのループ。
 *
 * ここは実際に実装した管理画面と同じ配色をそのまま使う。
 * ステータスの語彙と色分けも実装の StatusBadge に合わせている。
 *
 * 【注意】実績と誤解される数値（自動回答率・削減率など）を書かないこと。
 * このプロジェクトは実運用実績のない模擬案件のため、
 * 集計値を出すと架空の実績を掲げたことになる。
 */
'use client';

import { useEffect, useState } from 'react';
import { LeafIcon, OperatorIcon } from '@/components/icons';

/** 実際の管理画面と同じステータス語彙。色分けもそちらに合わせる */
type MockStatus = '対応中' | '未対応' | '完了';

const STATUS_STYLE: Record<MockStatus, string> = {
  対応中: 'bg-brand-accent text-brand-text',
  未対応: 'bg-amber-100 text-amber-800',
  完了: 'bg-brand-sand text-brand-secondary',
};

interface MockRow {
  id: string;
  title: string;
  time: string;
  status: MockStatus;
}

const ROWS: MockRow[] = [
  { id: 'delivery', title: '配送について', time: '10:24', status: '対応中' },
  { id: 'return', title: '返品について', time: '10:15', status: '未対応' },
  { id: 'product', title: '商品について', time: '09:47', status: '対応中' },
  { id: 'payment', title: '支払い方法について', time: '09:31', status: '未対応' },
  { id: 'stock', title: '在庫について', time: '09:15', status: '完了' },
];

/** 新着が入る間隔。速いと落ち着きが無くなるので、チャット1往復より長めにする */
const ROTATE_INTERVAL_MS = 4200;

export function MockOperatorUI() {
  /** 先頭に来ている行の位置。ずらすだけで新着が届いたように見せる */
  const [offset, setOffset] = useState(0);
  /**
   * 動きを減らす設定のときはループを止める。
   * 前庭障害などで動きに強い不快感を覚える利用者がいるため、
   * 装飾のアニメーションは必ず止められるようにする。
   */
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(
      () => setOffset((n) => (n + 1) % ROWS.length),
      ROTATE_INTERVAL_MS
    );
    return () => clearInterval(timer);
  }, [reduceMotion]);

  // 末尾から順に先頭へ回す。行の中身は変えないので表示は常に実装どおり
  const rows = [
    ...ROWS.slice(ROWS.length - offset),
    ...ROWS.slice(0, ROWS.length - offset),
  ];

  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-2xl border border-brand-accent bg-white shadow-2xl"
    >
      {/* ヘッダー。実装のサイドバー色に合わせる */}
      <div className="flex items-center gap-2 bg-brand-sidebar px-4 py-3 text-white">
        <LeafIcon size={17} />
        <span className="text-[13px] font-bold tracking-wide">受信トレイ</span>
        <span className="ml-auto rounded-full bg-white/15 px-2.5 py-0.5 text-[11px]">
          すべて
        </span>
      </div>

      <ul className="divide-y divide-brand-accent/60">
        {rows.map((r, i) => (
          <li
            // key に offset を混ぜることで、先頭に来た行だけ入場アニメーションが走る
            key={`${r.id}-${i === 0 ? offset : 'rest'}`}
            className={`flex items-center gap-3 px-4 py-2.5 ${
              // 未対応は実装と同じく行ごと色を変えて気づかせる
              r.status === '未対応' ? 'bg-amber-50/60' : ''
            } ${i === 0 ? 'animate-row-in motion-reduce:animate-none' : ''}`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-sand text-brand-secondary">
              <OperatorIcon size={14} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-brand-text">
              {r.title}
            </span>
            <span className="shrink-0 text-[11px] text-brand-secondary">{r.time}</span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[r.status]}`}
            >
              {r.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
