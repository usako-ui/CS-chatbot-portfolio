/**
 * 会話メッセージの Realtime 購読（T-20・FR-RT・AC-008）
 *
 * RLS で「自分の会話しか SELECT できない」ようにしてあるため、
 * Realtime も自動的に自分の会話のぶんしか配信されない。
 * さらに conversation_id でフィルターして二重に絞っている。
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { Message } from '@/types';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting';

interface UseConversationMessagesResult {
  messages: Message[];
  connection: ConnectionState;
  /** 楽観的更新用。Realtimeで同じidが来ても重複しない */
  appendMessage: (message: Message) => void;
}

/**
 * @param conversationId 購読対象。null の間は購読しない（会話準備前）
 * @param initialMessages 継続会話の既存履歴
 */
export function useConversationMessages(
  conversationId: string | null,
  initialMessages: Message[]
): UseConversationMessagesResult {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [connection, setConnection] = useState<ConnectionState>('connecting');

  // 初期履歴は会話が確定したタイミングで一度だけ流し込む
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  /**
   * id で重複排除しながら追加する。
   *
   * 自分が送ったメッセージも INSERT イベントとして返ってくるため、
   * 楽観的更新をしていると同じ発言が2つ並ぶ。それを防ぐ。
   */
  const appendMessage = useCallback((incoming: Message) => {
    setMessages((prev) =>
      prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
    );
  }, []);

  // appendMessage を購読の依存から外すための参照。
  // これを挟まないと再購読が走り、チャンネルが張り直されてしまう。
  const appendRef = useRef(appendMessage);
  appendRef.current = appendMessage;

  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();
    let channel: RealtimeChannel | null = null;

    channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          appendRef.current(payload.new as Message);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnection('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Supabaseクライアントが自動で再接続を試みる。
          // ここでは顧客に状態を見せることだけを担当する。
          setConnection('reconnecting');
        }
      });

    // 【必須】これを忘れると画面遷移や再レンダーのたびに購読が積み上がり、
    // 1件の受信で同じメッセージが何度も処理される
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return { messages, connection, appendMessage };
}
