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
import { getConversationMessages } from '@/actions/chat';
import { createClient } from '@/lib/supabase/client';
import type { Message } from '@/types';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting';

interface UseConversationMessagesResult {
  messages: Message[];
  connection: ConnectionState;
  /** 楽観的更新用。Realtimeで同じidが来ても重複しない */
  appendMessage: (message: Message) => void;
  /** サーバーの履歴と突き合わせて取りこぼしを埋める */
  resync: () => Promise<void>;
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

  /**
   * サーバー側の履歴で状態を作り直す。
   *
   * 購読が確立するまでの間に発生したINSERTはイベントが飛んでこないため、
   * 購読直後と再接続後にこれを呼んで取りこぼしを埋める。
   * 差し替えではなくマージにしているのは、楽観的に足した分を消さないため。
   */
  const syncFromServer = useCallback(async (id: string) => {
    // 呼び出し元は購読コールバック内から void で呼び捨てるため、
    // ここで例外を握りつぶさないと unhandled rejection になる。
    // 通信断ではServer Action自体が reject する（戻り値のerrorにはならない）。
    let result: Awaited<ReturnType<typeof getConversationMessages>>;
    try {
      result = await getConversationMessages(id);
    } catch (error) {
      console.error('[useConversationMessages] 履歴の再取得に失敗:', error);
      return;
    }
    if (!result.success || !result.data) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const added = result.data!.filter((m) => !seen.has(m.id));
      if (added.length === 0) return prev;
      return [...prev, ...added].sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      );
    });
  }, []);

  // appendMessage を購読の依存から外すための参照。
  // これを挟まないと再購読が走り、チャンネルが張り直されてしまう。
  const appendRef = useRef(appendMessage);
  appendRef.current = appendMessage;
  const syncRef = useRef(syncFromServer);
  syncRef.current = syncFromServer;

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
          // 購読確立前に入ったメッセージを取り戻す。
          // 再接続時もここを通るので、切断中の分もまとめて回収できる
          void syncRef.current(conversationId);
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

  const resync = useCallback(async () => {
    if (conversationId) await syncRef.current(conversationId);
  }, [conversationId]);

  return { messages, connection, appendMessage, resync };
}
