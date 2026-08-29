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
import type { ConversationStatus } from '@/types';

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
