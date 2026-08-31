/**
 * 引き継ぎ提案の選択カード（ソフトエスカレーション）
 *
 * AIがFAQを案内したうえで「個別手続きは担当者へ」と提案したときに、
 * 顧客が自分で行き先を選ぶためのUI。
 *
 * 【なぜ選択させるのか】
 * 「FAQで案内はできるが、実際の解決には個別手続きが要る」案件
 * （商品破損・返品手続きなど）を、AIが一方的に人間へ回すと
 * 案内を読めば済む人まで待たせることになる。
 * 逆にAIだけで終わらせると、手続きしたい人が行き止まりになる。
 *
 * 表示するかどうかの判断（pendingHandoff）は呼び出し側が持つ。
 * このコンポーネントは押されたことを伝えるだけにして、
 * 通信とステータス遷移は Server Action 側に寄せている。
 */
'use client';

import { OperatorIcon, SendIcon } from '@/components/icons';

export function HandoffChoice({
  /** 提案の本文。固定文をサーバー側と共有する */
  text,
  /** 送信中はボタンを無効化して二重押しを防ぐ */
  isBusy,
  onContinue,
  onHandoff,
}: {
  text: string;
  isBusy: boolean;
  onContinue: () => void;
  onHandoff: () => void;
}) {
  return (
    <div
      role="group"
      aria-label="担当者へつなぐかどうかの選択"
      className="rounded-xl border border-brand-accent bg-white px-3.5 py-3 shadow-sm"
    >
      <p className="text-[13px] leading-relaxed text-brand-text">{text}</p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onContinue}
          disabled={isBusy}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-brand-accent bg-brand-sand px-4 py-2.5 text-[13px] font-bold text-brand-text transition-colors hover:border-brand-secondary disabled:opacity-45"
        >
          <SendIcon size={15} className="text-brand-secondary" />
          続けて質問する
        </button>
        <button
          type="button"
          onClick={onHandoff}
          disabled={isBusy}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-45"
        >
          <OperatorIcon size={15} />
          担当者へつなぐ
        </button>
      </div>
    </div>
  );
}
