/**
 * メッセージ吹き出し（T-19）
 *
 * 顧客・AI・オペレーターを色と配置で区別する（FR-CUS-009）。
 * 色だけで区別すると色覚特性のある方に伝わらないため、
 * 送信者ラベルとアイコンも併せて表示している。
 *
 * 【新着のフェードイン】
 * 新着だけを下からフェードインさせる。既存の履歴まで動かすと、
 * リロードのたびに会話全体が動いて「何が新しいのか」が読み取れなくなる。
 * 新着かどうかの判定は呼び出し側が持つ（isNew）。
 * このコンポーネントは渡された結果に従うだけにして、
 * 「どれが新着か」の知識を1か所に閉じ込めている。
 */
'use client';

import { motion, useReducedMotion } from 'framer-motion';

import { LeafIcon, OperatorIcon } from '@/components/icons';
import type { SenderType } from '@/types';

interface MessageBubbleProps {
  senderType: SenderType;
  content: string;
  createdAt: string;
  /** 営業設定のタイムゾーン。判定側と表示側で食い違わないよう受け取る */
  timezone: string;
  /**
   * この往復で届いた新着か。
   * true のときだけフェードインする。リロードで復元した履歴は false。
   */
  isNew?: boolean;
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
  isNew = false,
}: MessageBubbleProps) {
  const style = SENDER_STYLE[senderType];
  const isCustomer = senderType === 'customer';

  // OS側で「視差効果を減らす」を選んでいる利用者には動かさない。
  // 前庭障害のある方は動きで気分が悪くなることがあるため、
  // 装飾のアニメーションは必ず尊重する（Reduce Motion）。
  const prefersReducedMotion = useReducedMotion();
  const animate = isNew && !prefersReducedMotion;

  return (
    <motion.div
      // 履歴の復元時は initial を false にして、最終状態のまま描画する
      initial={animate ? { opacity: 0, y: 16 } : false}
      animate={animate ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex flex-col gap-1 ${style.align}`}
    >
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
    </motion.div>
  );
}
