/**
 * 会話詳細・返信（T-28・T-29・T-30・AC-007・AC-013）
 *
 * AIとのやり取りも含めた全履歴を表示する。
 * エスカレーション前の経緯が見えないと、
 * オペレーターは顧客に同じことを聞き直すことになる。
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { assignOperator, fetchConversationDetail, fetchOperators } from '@/actions/dashboard';
import { closeConversation, sendOperatorReply } from '@/actions/operator';
import { StatusBadge } from '@/components/operator/StatusBadge';
import { useOperatorRealtime } from '@/components/operator/useOperatorRealtime';
import {
  AlertIcon,
  BackIcon,
  BotIcon,
  CheckIcon,
  OperatorIcon,
  SendIcon,
} from '@/components/icons';
import { MAX_MESSAGE_LENGTH } from '@/lib/validation';
import type { ConversationDetail } from '@/lib/operatorData';
import type { OperatorProfile, SenderType } from '@/types';

/** 送信者ごとの見た目。顧客を左、AI・担当者を右に置いて視線を分ける */
const SENDER: Record<SenderType, { label: string; bubble: string; align: string }> = {
  customer: {
    label: 'お客様',
    bubble: 'bg-white border border-brand-accent text-brand-text rounded-bl-sm',
    align: 'items-start',
  },
  ai: {
    label: 'AI',
    bubble: 'bg-brand-accent/40 text-brand-text rounded-br-sm',
    align: 'items-end',
  },
  operator: {
    label: '担当者',
    bubble: 'bg-brand-primary text-white rounded-br-sm',
    align: 'items-end',
  },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  }).format(d);
}

export function ConversationDetailClient({
  conversationId,
}: {
  conversationId: string;
}) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [operators, setOperators] = useState<OperatorProfile[]>([]);
  const [reply, setReply] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  // 完了は取り消せない。押し間違いの実害が大きいので確認を挟む
  const [isConfirmingClose, setIsConfirmingClose] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    // Realtime のコールバックから void で呼ばれるため例外を捕まえる
    try {
      const result = await fetchConversationDetail(conversationId);
      if (!result.success || !result.data) {
        setError(result.error ?? '会話を取得できませんでした。');
      } else {
        setDetail(result.data);
        setError(null);
      }
    } catch (err) {
      console.error('[ConversationDetail] 会話の取得に失敗:', err);
      setError('通信に失敗しました。接続を確認してください。');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void load();
    void fetchOperators()
      .then((r) => {
        if (r.success && r.data) setOperators(r.data);
      })
      .catch((err) => {
        // 担当者一覧が取れなくても会話の閲覧・返信はできる。
        // プルダウンが空になるだけなので画面は止めない
        console.error('[ConversationDetail] オペレーター一覧の取得に失敗:', err);
      });
  }, [load]);

  // 顧客からの新着を即時反映する
  useOperatorRealtime(load);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [detail?.messages.length]);

  async function handleSend() {
    const text = reply.trim();
    if (!text || isSending) return;

    setError(null);
    setIsSending(true);
    setReply('');

    try {
      const result = await sendOperatorReply(conversationId, text);
      if (!result.success) {
        // 失敗時は入力を戻す。打ち直しは負担が大きい
        setReply(text);
        setError(result.error ?? '返信を送信できませんでした。');
        return;
      }
      // 送信直後は自分のRealtimeイベントを待たずに取り直す。
      // 担当者の自動割り当てとステータス変更も同時に反映させるため
      await load();
    } catch (err) {
      console.error('[ConversationDetail] 返信に失敗:', err);
      setReply(text);
      setError('返信を送信できませんでした。');
    } finally {
      setIsSending(false);
    }
  }

  async function handleClose() {
    setIsConfirmingClose(false);
    setIsClosing(true);
    setError(null);
    try {
      const result = await closeConversation(conversationId);
      if (!result.success) {
        setError(result.error ?? '完了にできませんでした。');
        return;
      }
      await load();
    } catch (err) {
      console.error('[ConversationDetail] 完了処理に失敗:', err);
      setError('通信に失敗しました。接続を確認してもう一度お試しください。');
    } finally {
      setIsClosing(false);
    }
  }

  async function handleAssign(operatorId: string) {
    try {
      const result = await assignOperator(
        conversationId,
        operatorId === '' ? null : operatorId
      );
      if (!result.success) {
        setError(result.error ?? '担当者を変更できませんでした。');
        return;
      }
    } catch (err) {
      console.error('[ConversationDetail] 担当者の変更に失敗:', err);
      setError('通信に失敗しました。接続を確認してもう一度お試しください。');
    }
    // 失敗時も取り直す。プルダウンの表示を実際の担当者に戻すため
    await load();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // 日本語入力の変換確定Enterで誤送信しないよう isComposing を見る
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSend();
    }
  }

  if (isLoading) {
    return <p className="px-6 py-8 text-sm text-brand-secondary">読み込んでいます...</p>;
  }
  if (!detail) {
    return (
      <div className="px-6 py-8">
        <p className="text-sm text-red-700">{error ?? '会話が見つかりません。'}</p>
        <Link href="/dashboard" className="mt-3 inline-block text-sm underline">
          一覧へ戻る
        </Link>
      </div>
    );
  }

  const { conversation, messages, operatorNames, assigned_operator_name } = detail;
  // closed にできるのは operator_handling のみ（Q-009）。
  // 人間が一度も見ていない問い合わせが完了扱いで消えるのを防ぐ
  const canClose = conversation.status === 'operator_handling';
  const isClosed = conversation.status === 'closed';

  return (
    <div className="flex h-full flex-col">
      {/* 会話ヘッダー：ステータス・担当者 */}
      <div className="shrink-0 border-b border-brand-accent bg-white px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-[13px] text-brand-secondary transition-colors hover:text-brand-primary"
          >
            <BackIcon size={16} />
            一覧
          </Link>

          <StatusBadge status={conversation.status} />

          {/* 担当者の常時表示と変更（Q-002：ロックしない代わりに付け替え可能にする） */}
          <div className="flex items-center gap-1.5">
            <OperatorIcon size={15} className="text-brand-secondary" />
            <select
              value={conversation.assigned_operator_id ?? ''}
              onChange={(e) => void handleAssign(e.target.value)}
              aria-label="担当者"
              className="rounded-md border border-brand-accent bg-brand-sand px-2 py-1 text-[13px] text-brand-text outline-none focus:border-brand-secondary"
            >
              <option value="">未割当</option>
              {operators.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.display_name ?? o.email}
                  {o.role_label ? `（${o.role_label}）` : ''}
                </option>
              ))}
            </select>
            {assigned_operator_name && (
              <span className="text-[12px] text-brand-secondary">対応中</span>
            )}
          </div>

          <div className="ml-auto">
            {canClose && (
              <button
                type="button"
                onClick={() => setIsConfirmingClose(true)}
                disabled={isClosing}
                className="flex items-center gap-1.5 rounded-lg border border-brand-primary px-3 py-1.5 text-[13px] font-medium text-brand-primary transition-colors hover:bg-brand-primary hover:text-white disabled:opacity-50"
              >
                <CheckIcon size={15} />
                {isClosing ? '処理中...' : '対応完了'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 完了の確認ダイアログ。
          window.confirm を使わないのは、ボタンの文言をOSに委ねると
          「OK」としか出せず、何が起きるのか読み取れないため */}
      {isConfirmingClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-text/40 px-5">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="close-confirm-title"
            className="w-full max-w-sm rounded-2xl border border-brand-accent bg-white p-6 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700">
                <AlertIcon size={20} />
              </span>
              <div className="flex-1">
                <h2
                  id="close-confirm-title"
                  className="text-[16px] font-bold text-brand-text"
                >
                  対応完了にしますか？
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-brand-secondary">
                  完了後はお客様への返信内容が読めなくなる場合があります。
                  よろしいですか？
                </p>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmingClose(false)}
                className="flex-1 rounded-lg border border-brand-accent py-2.5 text-[14px] text-brand-secondary transition-colors hover:bg-brand-sand"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => void handleClose()}
                className="flex-1 rounded-lg bg-brand-primary py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
              >
                対応完了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* メッセージ一覧（AI含む全履歴：AC-013） */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-5">
        {messages.length === 0 && (
          <p className="text-center text-sm text-brand-secondary">
            まだメッセージはありません。
          </p>
        )}

        {messages.map((m) => {
          const style = SENDER[m.sender_type];
          const name =
            m.sender_type === 'operator' && m.sender_id
              ? (operatorNames[m.sender_id] ?? '担当者')
              : style.label;
          return (
            <div key={m.id} className={`flex flex-col gap-1 ${style.align}`}>
              <span className="flex items-center gap-1 px-1 text-[11px] text-brand-secondary">
                {m.sender_type === 'ai' && <BotIcon size={12} />}
                {m.sender_type === 'operator' && <OperatorIcon size={12} />}
                {name}
              </span>
              <div
                className={`max-w-[70%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${style.bubble}`}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
              </div>
              <time
                dateTime={m.created_at}
                className="px-1 text-[10px] text-brand-secondary/70"
              >
                {formatTime(m.created_at)}
              </time>
            </div>
          );
        })}

        {error && (
          <div
            role="alert"
            className="mx-auto flex max-w-[70%] items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700"
          >
            <AlertIcon size={14} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 返信入力（T-29） */}
      <div className="shrink-0 border-t border-brand-accent bg-white px-6 py-3">
        {isClosed ? (
          <p className="py-2 text-center text-[13px] text-brand-secondary">
            この問い合わせは完了しています。
          </p>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder="お客様への返信を入力"
                aria-label="返信入力"
                className="max-h-32 min-h-[60px] flex-1 resize-none rounded-xl border border-brand-accent bg-brand-sand px-3 py-2.5 text-[14px] text-brand-text outline-none transition-colors placeholder:text-brand-secondary/60 focus:border-brand-secondary"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!reply.trim() || isSending}
                aria-label="返信を送信"
                className="flex h-[60px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-brand-primary text-white transition-opacity hover:opacity-90 disabled:opacity-35"
              >
                <SendIcon size={18} />
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-brand-secondary/70">
              最初に返信した担当者が自動で担当になります / Enterで送信・Shift+Enterで改行
            </p>
          </>
        )}
      </div>
    </div>
  );
}
