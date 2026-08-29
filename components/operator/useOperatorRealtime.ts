/**
 * 管理画面の Realtime 購読（T-27・FR-RT・FR-OPS-008）
 *
 * 一覧では messages の INSERT と conversations の UPDATE を全件購読する。
 * conversations の UPDATE を見ないと、エスカレーション（ai_handling →
 * waiting_operator）が一覧に反映されず、未対応の問い合わせに気づけない。
 *
 * オペレーターは is_operator() を満たすため、RLSで全会話が見える。
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting';

/**
 * 会話の更新を監視し、変化があったら onChange を呼ぶ。
 *
 * 差分をこの中で組み立てず、呼び出し側にサーバーから取り直させている。
 * 一覧の行は「最終メッセージ」「担当者名」「未対応件数」など
 * 複数テーブルにまたがる情報を含むため、イベントのpayloadだけでは再現できない。
 * 会話数が数百件規模のMVPでは取り直しのほうが確実で速い。
 */
export function useOperatorRealtime(onChange: () => void): ConnectionState {
  const [connection, setConnection] = useState<ConnectionState>('connecting');

  // onChange を購読の依存から外す。
  // 依存に入れると呼び出し側の再レンダーごとにチャンネルが張り直される
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    /**
     * 短時間に複数イベントが来たときの取り直しをまとめる。
     * 顧客のメッセージ保存とステータス更新はほぼ同時に発生するため、
     * まとめないと同じ内容を2回取りに行くことになる。
     */
    function scheduleRefresh() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => onChangeRef.current(), 300);
    }

    /**
     * 購読の前にセッションを確定させる。
     *
     * createClient() で作った直後のクライアントは、まだCookieから
     * セッションを読み込んでいない。その状態で購読すると Realtime は
     * 匿名（anon）として接続し、オペレーター向けRLSポリシーを満たさないため
     * 1件も配信されない。購読自体は "Subscribed to PostgreSQL" と
     * 成功するので、原因の切り分けが難しい形で表面化する。
     *
     * setAuth でアクセストークンを明示的に渡し、
     * Realtime 側にもオペレーターとして認識させる。
     */
    async function start() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      subscribe();
    }

    function subscribe() {
      channel = supabase
      .channel('operator-dashboard')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        scheduleRefresh
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnection('connected');
          // 購読が確立するまでの間に起きた変更を取り戻す。
          // 再接続時もここを通るので切断中の分もまとめて回収できる
          onChangeRef.current();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnection('reconnecting');
        }
      });
    }

    void start();

    // 【必須】購読の後片付け。忘れると画面遷移のたびに購読が積み上がり、
    // 1件の受信で何度も取り直しが走る
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return connection;
}
