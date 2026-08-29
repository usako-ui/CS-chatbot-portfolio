/**
 * 問い合わせ一覧（T-26・T-27・FR-OPS-003〜004・AC-007）
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { fetchConversations, fetchWaitingCount } from '@/actions/dashboard';
import type { ConversationListItem } from '@/lib/operatorData';
import { StatusBadge } from '@/components/operator/StatusBadge';
import { useOperatorRealtime } from '@/components/operator/useOperatorRealtime';
import { AlertIcon, BotIcon, ChatIcon, OperatorIcon } from '@/components/icons';
import type { ConversationStatus } from '@/types';

/** サイドバーの絞り込みをステータス配列に変換する */
function toStatuses(param: string | null): ConversationStatus[] | undefined {
  if (!param || param === 'all') return undefined;
  const valid: ConversationStatus[] = [
    'ai_handling',
    'waiting_operator',
    'operator_handling',
    'closed',
  ];
  return valid.includes(param as ConversationStatus)
    ? [param as ConversationStatus]
    : undefined;
}

/** 相対時刻。一覧では「何分前か」のほうが絶対時刻より把握しやすい */
function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}時間前`;
  return `${Math.floor(hour / 24)}日前`;
}

export function ConversationList({
  onWaitingCountChange,
}: {
  onWaitingCountChange?: (n: number) => void;
}) {
  const params = useSearchParams();
  const statusParam = params.get('status');

  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const statuses = toStatuses(statusParam);
    const [list, waiting] = await Promise.all([
      fetchConversations(statuses),
      fetchWaitingCount(),
    ]);

    if (!list.success || !list.data) {
      setError(list.error ?? '一覧を取得できませんでした。');
    } else {
      setItems(list.data);
      setError(null);
    }
    if (waiting.success && waiting.data !== undefined) {
      onWaitingCountChange?.(waiting.data);
    }
    setIsLoading(false);
  }, [statusParam, onWaitingCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  // 顧客の新着・エスカレーションを即時に反映する（FR-OPS-008）
  const connection = useOperatorRealtime(load);

  if (isLoading) {
    return <p className="px-6 py-8 text-sm text-brand-secondary">読み込んでいます...</p>;
  }

  return (
    <div>
      {connection === 'reconnecting' && (
        <div
          role="status"
          className="flex items-center gap-2 bg-amber-50 px-6 py-2 text-[12px] text-amber-800"
        >
          <AlertIcon size={14} />
          接続が切れました。再接続しています...
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mx-6 mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700"
        >
          <AlertIcon size={15} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {items.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-brand-secondary">
          該当する問い合わせはありません。
        </p>
      ) : (
        <ul className="divide-y divide-brand-accent/60">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/${c.id}`}
                className={`flex items-start gap-3 px-6 py-3.5 transition-colors hover:bg-brand-accent/15 ${
                  // 未対応は放置されると顧客を待たせ続けるため、行ごと色を変えて気づかせる（Q-009）
                  c.status === 'waiting_operator' ? 'bg-amber-50/60' : ''
                }`}
              >
                <span className="mt-0.5 text-brand-secondary">
                  {c.status === 'ai_handling' ? (
                    <BotIcon size={18} />
                  ) : (
                    <ChatIcon size={18} />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={c.status} size="sm" />
                    {c.assigned_operator_name ? (
                      <span className="flex items-center gap-1 text-[11px] text-brand-secondary">
                        <OperatorIcon size={12} />
                        {c.assigned_operator_name} 対応中
                      </span>
                    ) : (
                      <span className="text-[11px] text-brand-secondary/70">未割当</span>
                    )}
                  </div>

                  <p className="mt-1.5 truncate text-[14px] text-brand-text">
                    {c.last_message ?? 'メッセージはまだありません'}
                  </p>
                </div>

                <time
                  dateTime={c.last_message_at ?? c.updated_at}
                  className="mt-0.5 shrink-0 text-[11px] text-brand-secondary/80"
                >
                  {relativeTime(c.last_message_at ?? c.updated_at)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
