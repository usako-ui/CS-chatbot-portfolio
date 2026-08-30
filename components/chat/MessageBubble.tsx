/**
 * メッセージ吹き出し（T-19）
 *
 * 顧客・AI・オペレーターを色と配置で区別する（FR-CUS-009）。
 * 色だけで区別すると色覚特性のある方に伝わらないため、
 * 送信者ラベルとアイコンも併せて表示している。
 */
import { LeafIcon, OperatorIcon } from '@/components/icons';
import type { SenderType } from '@/types';

interface MessageBubbleProps {
  senderType: SenderType;
  content: string;
  createdAt: string;
  /** 営業設定のタイムゾーン。判定側と表示側で食い違わないよう受け取る */
  timezone: string;
}

/** 送信者ごとの見た目。追加するときはここだけ触れば済むようまとめている */
const SENDER_STYLE: Record<
  SenderType,
  { label: string; bubble: string; align: string }
> = {
  customer: {
    label: 'お客様',
    bubble: 'bg-brand-primary text-white rounded-br-sm',
    align: 'items-end',
  },
  ai: {
    label: 'AIサポート',
    bubble: 'bg-white text-brand-text border border-brand-accent rounded-bl-sm',
    align: 'items-start',
  },
  operator: {
    label: '担当者',
    bubble: 'bg-brand-accent text-brand-text rounded-bl-sm',
    align: 'items-start',
  },
};

/** HH:MM 形式。日付は会話が短時間で完結する前提のため省く */
function formatTime(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    }).format(d);
  } catch {
    // 設定に不正なタイムゾーン名が入っていても時刻表示だけで画面を壊さない
    return new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }
}

export function MessageBubble({
  senderType,
  content,
  createdAt,
  timezone,
}: MessageBubbleProps) {
  const style = SENDER_STYLE[senderType];
  const isCustomer = senderType === 'customer';

  return (
    <div className={`flex flex-col gap-1 ${style.align}`}>
      {/* 顧客側は自分の発言なのでラベル不要 */}
      {!isCustomer && (
        <span className="flex items-center gap-1 px-1 text-xs text-brand-secondary">
          {senderType === 'ai' ? <LeafIcon size={13} /> : <OperatorIcon size={13} />}
          {style.label}
        </span>
      )}

      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed shadow-sm ${style.bubble}`}
      >
        {/* AIの回答は改行を含むため whitespace-pre-wrap で保持する。
            content は React が自動エスケープするのでXSSの心配はない */}
        <p className="whitespace-pre-wrap break-words">{content}</p>
      </div>

      <time
        dateTime={createdAt}
        className="px-1 text-[11px] text-brand-secondary/70"
      >
        {formatTime(createdAt, timezone)}
      </time>
    </div>
  );
}
