/**
 * チャット本体（T-16・T-19〜T-23）
 *
 * ウィジェットを開いたときに会話を用意し、メッセージの送受信を担当する。
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { createOrGetConversation, sendCustomerMessage } from '@/actions/chat';
import { CloseIcon, LeafIcon, SendIcon } from '@/components/icons';
import { MessageBubble } from '@/components/chat/MessageBubble';
import {
  AfterHoursNotice,
  ErrorNotice,
  EscalationNotice,
  PrivacyNotice,
  ReconnectingNotice,
  TypingIndicator,
} from '@/components/chat/Notices';
import { useConversationMessages } from '@/components/chat/useConversationMessages';
import { ensureAnonymousSession } from '@/lib/session';
import { MAX_MESSAGE_LENGTH } from '@/lib/validation';
import type { Message } from '@/types';

/**
 * 歓迎メッセージ（FR-CUS-010）
 *
 * DBには保存しない。会話の実データではなく毎回出す案内であり、
 * 保存するとオペレーターの履歴画面が定型文で埋まるため。
 */
const WELCOME_TEXT = `BOTANICAのカスタマーサポートへようこそ。
在庫確認・配送・返品などのご質問をどうぞ。
AIがお答えします。人間のサポートが必要な場合は自動でつなぎます。`;

const EMPTY_MESSAGES: Message[] = [];

/**
 * 進行中の会話準備。同時呼び出しをここで1本にまとめる。
 *
 * Reactの開発モードは useEffect を2回実行する。
 * まとめないと createOrGetConversation が2回並走し、
 * どちらも「未完了の会話なし」と判定して会話を2件作ってしまう。
 *
 * finally で解放しているので、共有されるのは同時に走ったぶんだけ。
 * ウィジェットを閉じて開き直したときは改めて取得し直し、
 * その間に届いたメッセージも履歴に反映される。
 */
let bootstrapInFlight: ReturnType<typeof createOrGetConversation> | null = null;

function bootstrapConversation() {
  if (bootstrapInFlight) return bootstrapInFlight;
  bootstrapInFlight = createOrGetConversation().finally(() => {
    bootstrapInFlight = null;
  });
  return bootstrapInFlight;
}

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<Message[]>(EMPTY_MESSAGES);
  const [isBusinessHours, setIsBusinessHours] = useState(true);
  const [hoursStart, setHoursStart] = useState(10);

  const [input, setInput] = useState('');
  const [isBooting, setIsBooting] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const { messages, connection, resync } = useConversationMessages(
    conversationId,
    initialMessages
  );

  // ---- 起動処理：匿名サインイン -> 会話の取得または作成 ----
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        // 先に匿名サインインを終わらせる。
        // JWTが無い状態でRealtimeを購読するとRLSで弾かれ、
        // 「購読は成功しているのに何も届かない」状態になる
        await ensureAnonymousSession();

        const result = await bootstrapConversation();
        if (cancelled) return;

        if (!result.success || !result.data) {
          setErrorText(result.error ?? 'チャットを開始できませんでした。');
          return;
        }

        setInitialMessages(result.data.messages);
        setIsBusinessHours(result.data.isBusinessHours);
        setHoursStart(result.data.hoursStart);
        setEscalated(result.data.status !== 'ai_handling');
        // conversationId を最後に入れることで、履歴を反映してから購読が始まる
        setConversationId(result.data.conversationId);
      } catch (error) {
        if (cancelled) return;
        console.error('[ChatPanel] 起動に失敗:', error);
        setErrorText('チャットを開始できませんでした。時間をおいてお試しください。');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- 新着で最下部へスクロール ----
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || !conversationId || isSending) return;

    setErrorText(null);
    setIsSending(true);
    // 送信中に再入力できてしまうと二重送信になるため、先に空にする
    setInput('');

    try {
      const result = await sendCustomerMessage(conversationId, text);

      if (!result.success) {
        // 失敗時は入力内容を戻す。打ち直しは負担が大きい
        setInput(text);
        setErrorText(result.error ?? '送信に失敗しました。もう一度お試しください。');
        return;
      }

      if (result.data?.escalated) setEscalated(true);
      if (result.data) setIsBusinessHours(!result.data.afterHours);

      // 通常は顧客メッセージもAI回答もRealtimeのINSERTで届く。
      // ただし購読が確立する前や瞬断中に送信された分はイベントが飛ばないため、
      // 送信完了後に必ずサーバーと突き合わせて取りこぼしを埋める。
      // 既に届いている分は id で弾かれるので二重表示にはならない。
      await resync();
    } catch (error) {
      console.error('[ChatPanel] 送信に失敗:', error);
      setInput(text);
      setErrorText('送信に失敗しました。もう一度お試しください。');
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enterで送信、Shift+Enterで改行。日本語入力の変換確定Enterで
    // 誤送信しないよう isComposing を必ず見る
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSend();
    }
  }

  const canSend = Boolean(
    input.trim() && conversationId && !isSending && !isBooting
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-brand-sand">
      {/* ヘッダー */}
      <header className="flex items-center justify-between bg-brand-primary px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <LeafIcon size={20} />
          <div>
            <p className="text-[15px] font-bold leading-tight tracking-wide">
              BOTANICA
            </p>
            <p className="text-[11px] leading-tight text-white/80">
              カスタマーサポート
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="チャットを閉じる"
          className="rounded-full p-1.5 transition-colors hover:bg-white/15"
        >
          <CloseIcon size={20} />
        </button>
      </header>

      {connection === 'reconnecting' && <ReconnectingNotice />}
      {!isBusinessHours && <AfterHoursNotice hoursStart={hoursStart} />}
      <PrivacyNotice />

      {/* メッセージ一覧 */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {/* 歓迎メッセージ（DB非保存） */}
        <div className="flex flex-col items-start gap-1">
          <span className="flex items-center gap-1 px-1 text-xs text-brand-secondary">
            <LeafIcon size={13} />
            AIサポート
          </span>
          <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-brand-accent bg-white px-3.5 py-2.5 text-[15px] leading-relaxed text-brand-text shadow-sm">
            <p className="whitespace-pre-wrap">{WELCOME_TEXT}</p>
          </div>
        </div>

        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            senderType={m.sender_type}
            content={m.content}
            createdAt={m.created_at}
          />
        ))}

        {isSending && <TypingIndicator />}
        {escalated && <EscalationNotice afterHours={!isBusinessHours} />}
        {errorText && <ErrorNotice message={errorText} />}

        <div ref={bottomRef} />
      </div>

      {/* 入力欄 */}
      <div className="border-t border-brand-accent bg-white px-3 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={isBooting || Boolean(errorText && !conversationId)}
            placeholder={isBooting ? '準備しています...' : 'メッセージを入力'}
            aria-label="メッセージ入力"
            className="max-h-28 min-h-[42px] flex-1 resize-none rounded-xl border border-brand-accent bg-brand-sand px-3 py-2.5 text-[15px] text-brand-text outline-none transition-colors placeholder:text-brand-secondary/60 focus:border-brand-secondary disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend}
            aria-label="送信"
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-brand-primary text-white transition-opacity hover:opacity-90 disabled:opacity-35"
          >
            <SendIcon size={18} />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-brand-secondary/70">
          Enterで送信 / Shift+Enterで改行
        </p>
      </div>
    </div>
  );
}
