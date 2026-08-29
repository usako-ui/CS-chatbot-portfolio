/**
 * 会話ステータスのバッジ（T-26・FR-OPS-003）
 *
 * 色だけで区別すると色覚特性のある方に伝わらないため、必ず文字を添える。
 * waiting_operator（未対応）だけ強い配色にしているのは、
 * オペレーターが真っ先に拾うべき状態だから。
 */
import type { ConversationStatus } from '@/types';

export const STATUS_LABEL: Record<ConversationStatus, string> = {
  ai_handling: 'AI対応中',
  waiting_operator: '未対応',
  operator_handling: '対応中',
  closed: '完了',
};

const STATUS_STYLE: Record<ConversationStatus, string> = {
  ai_handling: 'bg-brand-accent/40 text-brand-text border-brand-accent',
  // 未対応は放置されると顧客を待たせ続けるため、一覧で最も目立たせる
  waiting_operator: 'bg-amber-100 text-amber-900 border-amber-300 font-medium',
  operator_handling: 'bg-brand-primary text-white border-brand-primary',
  closed: 'bg-slate-100 text-slate-500 border-slate-200',
};

export function StatusBadge({
  status,
  size = 'md',
}: {
  status: ConversationStatus;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      } ${STATUS_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
