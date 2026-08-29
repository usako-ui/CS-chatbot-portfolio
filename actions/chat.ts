/**
 * 顧客向け Server Action（T-13・T-15）
 *
 * 顧客チャットの1往復（顧客メッセージ保存 → AI応答 → 必要ならエスカレーション）を担当する。
 *
 * 【実装規約・必読】
 * この中の処理は service_role で動くため RLS が効かない。
 * 顧客IDは必ず requireCustomerId()（Cookie上の匿名JWTをAuthサーバーで検証）で確定し、
 * conversationId は必ず requireOwnedConversation() で本人のものか突合する。
 * 引数で渡された userId を信用した時点で、他人の会話を読み書きできる（AC-012 崩壊）。
 */
'use server';

import { resolveAiReply } from '@/lib/aiReply';
import {
  buildAfterHoursNotice,
  getBusinessHoursStatus,
} from '@/lib/businessHours';
import {
  insertMessage,
  requireOwnedConversation,
  setConversationStatus,
} from '@/lib/conversations';
import { requireCustomerId } from '@/lib/supabase/server';
import { validateMessageText } from '@/lib/validation';
import type { ActionResult } from '@/types';

/** 顧客メッセージ送信の結果。UIはこれを見てローディング解除と表示を行う */
export interface SendMessageResult {
  /** AIが返した本文。AIが動かなかった場合（担当者対応中）は null */
  aiMessage: string | null;
  /** true ならこの往復でオペレーターへ引き継いだ */
  escalated: boolean;
  /** 営業時間外だったか。UIの案内表示に使う */
  afterHours: boolean;
}

/**
 * 顧客のメッセージを保存し、必要ならAI応答とエスカレーションまで行う。
 *
 * @param conversationId 会話ID（クライアントから渡されるため信用しない）
 * @param customerMessage 顧客が入力した本文
 */
export async function sendCustomerMessage(
  conversationId: string,
  customerMessage: string
): Promise<ActionResult<SendMessageResult>> {
  const validation = validateMessageText(customerMessage);
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }
  const message = validation.message;

  // ---- 本人確認と所有権の突合 ----
  let status: string;
  try {
    const customerUserId = await requireCustomerId();
    const conversation = await requireOwnedConversation(conversationId, customerUserId);
    status = conversation.status;
  } catch (error) {
    console.error('[sendCustomerMessage] 認証・所有権チェック失敗:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'アクセスが拒否されました。',
    };
  }

  if (status === 'closed') {
    return {
      success: false,
      error: 'この問い合わせは完了しています。新しくお問い合わせください。',
    };
  }

  // ---- 顧客メッセージの保存 ----
  // ここで失敗したら以降は進めない。AIだけ動いて顧客の発言が残らない状態を避けるため、
  // 必ず保存を先に確定させる（AC-009：全メッセージがDBに残ること）。
  try {
    await insertMessage(conversationId, 'customer', message);
  } catch (error) {
    console.error('[sendCustomerMessage] 顧客メッセージの保存失敗:', error);
    return { success: false, error: '送信に失敗しました。もう一度お試しください。' };
  }

  // エスカレーション済みの会話ではAIを動かさない。
  // 担当者が対応している最中にAIが割り込むと会話が二重になるため
  // （requirements.md「エスカレーション後はAIの自動回答を停止する」）。
  if (status !== 'ai_handling') {
    return {
      success: true,
      data: { aiMessage: null, escalated: false, afterHours: false },
    };
  }

  // ---- AI応答 ----
  // resolveAiReply は例外を投げない。失敗時もエスカレーション結果が返る。
  const aiResponse = await resolveAiReply(message);

  // 営業時間の判定はエスカレーション時のみ必要だが、
  // 判定自体がDBアクセス1回で軽く、UIが常に afterHours を参照できるほうが扱いやすい。
  const { isOpen, hoursStart } = await getBusinessHoursStatus();
  const afterHours = !isOpen;

  // 時間外は「翌営業日に対応する」ことまで伝える（FR-TIME-004・FR-CUS-006）。
  // 伝えないと、顧客が深夜に返信を待ち続けることになる。
  const aiMessage =
    aiResponse.escalate && afterHours
      ? `${aiResponse.answer}\n${buildAfterHoursNotice(hoursStart)}`
      : aiResponse.answer;

  // ---- AIメッセージの保存 ----
  try {
    await insertMessage(conversationId, 'ai', aiMessage);
  } catch (error) {
    // 保存に失敗しても顧客メッセージは残っている。
    // 「送信失敗」と伝えて再送させると同じ質問が二重に届くため、ここでは失敗にしない。
    // オペレーターが履歴を見れば対応できる状態にはなっている。
    console.error('[sendCustomerMessage] AIメッセージの保存失敗:', error);
  }

  // ---- エスカレーション（T-13）----
  // 時間内でも時間外でも waiting_operator に変更する。
  // 時間外は「即時通知しないだけ」でステータスは保持する（FR-TIME-002・003）。
  if (aiResponse.escalate) {
    try {
      await setConversationStatus(conversationId, 'waiting_operator');
    } catch (error) {
      // ここが失敗すると管理画面に上がらず放置される。最も重い失敗なのでログを残す。
      // 顧客側は引き継ぎ案内を受け取っているため、表示上は成功として返す。
      console.error('[sendCustomerMessage] エスカレーションのステータス更新失敗:', error);
    }
  }

  return {
    success: true,
    data: { aiMessage, escalated: aiResponse.escalate, afterHours },
  };
}
