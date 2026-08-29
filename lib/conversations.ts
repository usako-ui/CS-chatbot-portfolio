/**
 * 会話の所有権チェック（T-12）
 *
 * Server Action は service_role で動くため RLS が効かない。
 * conversation_id を引数に取る処理は、必ずここを通して
 * 「その会話が本当にその顧客のものか」をアプリ側で突合する。
 * これを省くと、他人のIDを推測して投げるだけで会話を覗ける（AC-012 崩壊）。
 */
import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { ConversationStatus, SenderType } from '@/types';

/** DBの status は TEXT 型のため、型定義側の4種と一致するか実際に確認する */
const CONVERSATION_STATUSES: readonly ConversationStatus[] = [
  'ai_handling',
  'waiting_operator',
  'operator_handling',
  'closed',
];

function isConversationStatus(value: string): value is ConversationStatus {
  return (CONVERSATION_STATUSES as readonly string[]).includes(value);
}

/** 所有権チェックの結果として返す最小限の会話情報 */
export interface OwnedConversation {
  id: string;
  status: ConversationStatus;
}

/**
 * 会話が指定顧客のものであることを確認する。
 *
 * @param conversationId 会話ID（クライアントから渡されるため信用しない）
 * @param customerUserId requireCustomerId() で確定させた顧客のUID
 * @throws 会話が存在しない、または他人の会話だった場合
 */
export async function requireOwnedConversation(
  conversationId: string,
  customerUserId: string
): Promise<OwnedConversation> {
  const { data, error } = await getSupabaseAdmin()
    .from('conversations')
    .select('id, status, customer_user_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) {
    throw new Error(`会話の取得に失敗しました: ${error.message}`);
  }

  // 「存在しない」と「他人のもの」でメッセージを分けない。
  // 分けると会話IDの存在有無を外部から探れてしまうため。
  if (!data || data.customer_user_id !== customerUserId) {
    throw new Error('この会話にアクセスする権限がありません。');
  }

  if (!isConversationStatus(data.status)) {
    throw new Error(`会話のステータスが不正です: ${data.status}`);
  }

  return { id: data.id, status: data.status };
}

/**
 * メッセージを1件保存する。
 *
 * @param senderId オペレーターのみ指定する。顧客・AIは NULL（DBスキーマの取り決め）
 * @throws 保存に失敗した場合。呼び出し側は顧客に再送信を促すこと
 */
export async function insertMessage(
  conversationId: string,
  senderType: SenderType,
  content: string,
  senderId: string | null = null
): Promise<void> {
  const { error } = await getSupabaseAdmin().from('messages').insert({
    conversation_id: conversationId,
    sender_type: senderType,
    sender_id: senderId,
    content,
  });

  if (error) {
    throw new Error(`メッセージの保存に失敗しました: ${error.message}`);
  }
}

/**
 * 会話のステータスを更新する。
 *
 * updated_at を明示的に入れているのは、管理画面の一覧を
 * 「最終更新が新しい順」で並べるため（DBにトリガーを置いていない）。
 *
 * @param assignedOperatorId 指定すると担当者も同時にセットする（Q-001の自動割り当て）
 */
export async function setConversationStatus(
  conversationId: string,
  status: ConversationStatus,
  assignedOperatorId?: string
): Promise<void> {
  const patch: {
    status: ConversationStatus;
    updated_at: string;
    assigned_operator_id?: string;
  } = { status, updated_at: new Date().toISOString() };

  if (assignedOperatorId) {
    patch.assigned_operator_id = assignedOperatorId;
  }

  const { error } = await getSupabaseAdmin()
    .from('conversations')
    .update(patch)
    .eq('id', conversationId);

  if (error) {
    throw new Error(`会話ステータスの更新に失敗しました: ${error.message}`);
  }
}
