/**
 * ログイン時の未対応件数モーダル（Q-006 確定・FR-OPS-004）
 *
 * 外部通知（Slack・メール）を使わない代わりに、
 * ログイン直後に必ず目に入る形で未対応の存在を知らせる。
 *
 * 表示は「ログインしてから1回だけ」。
 * 画面遷移のたびに出ると邪魔になり、いずれ読まずに閉じるようになるため。
 * 判定に sessionStorage を使うのは、タブを閉じれば消えて
 * 次回ログイン時にまた出したいから（localStorage だと出なくなる）。
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BellIcon, CloseIcon } from '@/components/icons';

/** 未対応モーダルの表示済みフラグ。ログアウト時に Sidebar から消す */
export const WAITING_NOTICE_SEEN_KEY = 'botanica_waiting_notice_seen';
const SEEN_KEY = WAITING_NOTICE_SEEN_KEY;

export function WaitingModal({ waitingCount }: { waitingCount: number }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (waitingCount <= 0) return;
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return;
      sessionStorage.setItem(SEEN_KEY, '1');
      setIsOpen(true);
    } catch {
      // プライベートモード等で sessionStorage が使えない場合。
      // 通知が出ないだけで業務は続けられるので、ここでは何もしない
    }
  }, [waitingCount]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-text/40 px-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="waiting-modal-title"
        className="w-full max-w-sm rounded-2xl border border-brand-accent bg-white p-6 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700">
            <BellIcon size={20} />
          </span>
          <div className="flex-1">
            <h2
              id="waiting-modal-title"
              className="text-[16px] font-bold text-brand-text"
            >
              未対応の問い合わせが{waitingCount}件あります
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-brand-secondary">
              AIが対応できず担当者へ引き継がれた問い合わせです。
              お客様をお待たせしているため、優先してご確認ください。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="閉じる"
            className="rounded-full p-1 text-brand-secondary transition-colors hover:bg-brand-sand"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex-1 rounded-lg border border-brand-accent py-2.5 text-[14px] text-brand-secondary transition-colors hover:bg-brand-sand"
          >
            あとで
          </button>
          <Link
            href="/dashboard?status=waiting_operator"
            onClick={() => setIsOpen(false)}
            className="flex-1 rounded-lg bg-brand-primary py-2.5 text-center text-[14px] font-medium text-white transition-opacity hover:opacity-90"
          >
            確認する
          </Link>
        </div>
      </div>
    </div>
  );
}
