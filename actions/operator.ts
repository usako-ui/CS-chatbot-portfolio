/**
 * オペレーター向け Server Action（T-13）
 *
 * 顧客向けとの最大の違いは本人確認の関数。
 * 匿名顧客も Postgres ロールは 'authenticated' になるため、
 * 「サインイン済みか」だけでは判定できない。requireOperatorId() が
 * is_anonymous まで見てオペレーターかどうかを確定する。
 */
'use server';

import {
  insertMessage,
  setConversationStatus,
} from '@/lib/conversations';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireOperatorId } from '@/lib/supabase/server';
import { validateMessageText } from '@/lib/validation';
import type { ActionResult, ConversationStatus } from '@/types';

/**
 * オペレーターが返信を送る。
 *
 * 最初の返信を送ったオペレーターがそのまま担当者になる（Q-001 確定）。
 * 同時にステータスを operator_handling へ進める。
 * 会話をロックしないのは、担当者が離席したときに誰も返信できなくなるのを避けるため（Q-002）。
 *
 * @param conversationId 返信先の会話ID
 * @param replyText 返信本文
 */
export async function sendOperatorReply(
  conversationId: string,
  replyText: string
): Promise<ActionResult<void>> {
  const validation = validateMessageText(replyText);
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }

  let operatorId: string;
  try {
    operatorId = await requireOperatorId();
  } catch (error) {
    console.error('[sendOperatorReply] オペレーター認証失敗:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'ログインが必要です。',
    };
  }

  // 現在の担当者とステータスを取得する。
  // 顧客向けと違い所有権の突合はしない（オペレーターは全会話を扱えるため）。
  const { data, error } = await getSupabaseAdmin()
    .from('conversations')
    .select('id, status, assigned_operator_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (error || !data) {
    console.error('[sendOperatorReply] 会話の取得失敗:', error);
    return { success: false, error: '対象の会話が見つかりませんでした。' };
  }

  const status = data.status as ConversationStatus;
  if (status === 'closed') {
    return { success: false, error: '完了済みの会話には返信できません。' };
  }

  try {
    await insertMessage(conversationId, 'operator', validation.message, operatorId);
  } catch (err) {
    console.error('[sendOperatorReply] 返信の保存失敗:', err);
    return { success: false, error: '送信に失敗しました。もう一度お試しください。' };
  }

  // 未割当のときだけ担当者をセットする。
  // 毎回上書きすると、後から返信した別のオペレーターに担当が移ってしまう。
  const assignOperator = data.assigned_operator_id ? undefined : operatorId;

  try {
    await setConversationStatus(conversationId, 'operator_handling', assignOperator);
  } catch (err) {
    // 返信自体は届いている。ステータスが古いままでも会話は継続できるため失敗にはしない。
    console.error('[sendOperatorReply] ステータス更新失敗:', err);
  }

  return { success: true };
}

/**
 * 会話を完了にする。
 *
 * operator_handling の会話だけを closed にできる（Q-009 確定）。
 * ai_handling や waiting_operator を直接閉じられると、
 * 人間が一度も見ていない問い合わせが完了扱いで消えてしまうため。
 */
export async function closeConversation(
  conversationId: string
): Promise<ActionResult<void>> {
  try {
    await requireOperatorId();
  } catch (error) {
    console.error('[closeConversation] オペレーター認証失敗:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'ログインが必要です。',
    };
  }

  const { data, error } = await getSupabaseAdmin()
    .from('conversations')
    .select('id, status')
    .eq('id', conversationId)
    .maybeSingle();

  if (error || !data) {
    console.error('[closeConversation] 会話の取得失敗:', error);
    return { success: false, error: '対象の会話が見つかりませんでした。' };
  }

  if ((data.status as ConversationStatus) !== 'operator_handling') {
    return {
      success: false,
      error: '担当者が対応中の会話のみ完了にできます。',
    };
  }

  try {
    await setConversationStatus(conversationId, 'closed');
  } catch (err) {
    console.error('[closeConversation] ステータス更新失敗:', err);
    return { success: false, error: '完了処理に失敗しました。もう一度お試しください。' };
  }

  return { success: true };
}
