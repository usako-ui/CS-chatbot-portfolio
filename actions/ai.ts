/**
 * AI回答生成 Server Action（T-12）
 *
 * 本人確認と所有権チェックを行ったうえで lib/aiReply.ts を呼ぶ薄い外殻。
 * 実際の顧客チャットの1往復は actions/chat.ts の sendCustomerMessage が担当する。
 * この Server Action は「AIの応答だけを試したい」場面（デバッグ・検証）向けに残してある。
 *
 * 【戻り値の約束】
 * AIが失敗しても success: false は返さない。
 * 「担当者に接続しています」＋ escalate: true を正常な結果として返す（AI-009）。
 * success: false になるのは本人確認・所有権・入力検証に失敗したときだけ。
 */
'use server';

import { resolveAiReply } from '@/lib/aiReply';
import { requireOwnedConversation } from '@/lib/conversations';
import { requireCustomerId } from '@/lib/supabase/server';
import { validateMessageText } from '@/lib/validation';
import type { ActionResult, AIResponse } from '@/types';

/**
 * AI応答を生成する（DBには何も保存しない）。
 *
 * @param conversationId 会話ID。所有権をサーバー側で必ず突合する
 * @param customerMessage 顧客が送信した本文
 */
export async function generateAiReply(
  conversationId: string,
  customerMessage: string
): Promise<ActionResult<AIResponse>> {
  const validation = validateMessageText(customerMessage);
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }

  // 引数の conversationId はクライアントが自由に書き換えられるため、
  // Cookie の匿名JWTから確定した顧客IDと必ず突合する（AC-012）
  try {
    const customerUserId = await requireCustomerId();
    const conversation = await requireOwnedConversation(conversationId, customerUserId);

    // エスカレーション後はAIを黙らせる（requirements.md「エスカレーション後の状態管理」）
    if (conversation.status !== 'ai_handling') {
      return { success: false, error: 'この会話はすでに担当者が対応しています。' };
    }
  } catch (error) {
    console.error('[generateAiReply] 認証・所有権チェック失敗:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'アクセスが拒否されました。',
    };
  }

  return { success: true, data: await resolveAiReply(validation.message) };
}
