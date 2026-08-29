/**
 * 管理画面のデータ取得（T-26・T-28）
 *
 * オペレーターは全会話を扱えるため、顧客側のような所有権チェックは行わない。
 * ただし呼び出し元の Server Action で必ず requireOperatorId() を通すこと。
 * 匿名顧客も role は authenticated になるため、
 * 「サインイン済みか」だけの判定では管理画面のデータが顧客に漏れる。
 */
import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type {
  Conversation,
  ConversationStatus,
  Message,
  OperatorProfile,
} from '@/types';

/** 一覧に出す1行分。担当者名と最終メッセージを添えて1クエリ分の往復を減らす */
export interface ConversationListItem extends Conversation {
  /** 担当者の表示名。未割当は null */
  assigned_operator_name: string | null;
  /** 一覧のプレビュー用。メッセージが無ければ null */
  last_message: string | null;
  last_message_at: string | null;
}

/** 会話詳細。メッセージと発言者名をまとめて返す */
export interface ConversationDetail {
  conversation: Conversation;
  messages: Message[];
  /** sender_id -> 表示名。オペレーター名の表示に使う */
  operatorNames: Record<string, string>;
  assigned_operator_name: string | null;
}

/**
 * オペレーター一覧を取得する。
 *
 * 担当者名は auth.users の user_metadata に入れてあるため、
 * 通常のテーブル結合では引けない。Admin API で引いてメモリ上で突き合わせる。
 * オペレーターは2名（FR-OPS-009）なので全件取得で十分。
 */
export async function listOperators(): Promise<OperatorProfile[]> {
  const { data, error } = await getSupabaseAdmin().auth.admin.listUsers();
  if (error) {
    throw new Error(`オペレーター情報の取得に失敗しました: ${error.message}`);
  }
  return data.users
    .filter((u) => !u.is_anonymous)
    .map((u) => ({
      id: u.id,
      email: u.email ?? null,
      display_name: (u.user_metadata?.display_name as string) ?? u.email ?? null,
      role_label: (u.user_metadata?.role_label as string) ?? null,
    }));
}

/** UID から表示名を引ける辞書にする */
function toNameMap(operators: OperatorProfile[]): Record<string, string> {
  return Object.fromEntries(
    operators.map((o) => [o.id, o.display_name ?? o.email ?? '担当者'])
  );
}

/**
 * 問い合わせ一覧を取得する（T-26）。
 *
 * 並び順は updated_at の降順。
 * 新着・ステータス変更があったものが上に来るので、
 * オペレーターは常に一覧の上から処理すればよい状態になる。
 *
 * @param statuses 指定すると該当ステータスだけに絞る（サイドバーの絞り込み用）
 */
export async function listConversations(
  statuses?: ConversationStatus[]
): Promise<ConversationListItem[]> {
  const admin = getSupabaseAdmin();

  let query = admin
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(200);

  if (statuses && statuses.length > 0) {
    query = query.in('status', statuses);
  }

  const { data: conversations, error } = await query;
  if (error) {
    throw new Error(`問い合わせ一覧の取得に失敗しました: ${error.message}`);
  }
  if (!conversations || conversations.length === 0) return [];

  // 各会話の最終メッセージをまとめて取得する。
  // 会話ごとに1クエリ投げるとN+1になり、件数が増えたときに一覧が重くなる。
  const ids = conversations.map((c) => c.id);
  const { data: messages } = await admin
    .from('messages')
    .select('conversation_id, content, created_at')
    .in('conversation_id', ids)
    .order('created_at', { ascending: false });

  const latest = new Map<string, { content: string; created_at: string }>();
  for (const m of messages ?? []) {
    // 取得済み＝より新しいものが既にあるので上書きしない
    if (!latest.has(m.conversation_id)) {
      latest.set(m.conversation_id, {
        content: m.content,
        created_at: m.created_at,
      });
    }
  }

  const names = toNameMap(await listOperators());

  return conversations.map((c) => {
    const last = latest.get(c.id);
    return {
      ...(c as Conversation),
      assigned_operator_name: c.assigned_operator_id
        ? (names[c.assigned_operator_id] ?? '担当者')
        : null,
      last_message: last?.content ?? null,
      last_message_at: last?.created_at ?? null,
    };
  });
}

/**
 * 未対応件数を数える（Q-006・ログイン時モーダルと一覧バッジ）。
 *
 * waiting_operator が「人間の対応を待っている」状態。
 * ai_handling はAIが対応中なので未対応には含めない。
 */
export async function countWaitingConversations(): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'waiting_operator');

  if (error) {
    throw new Error(`未対応件数の取得に失敗しました: ${error.message}`);
  }
  return count ?? 0;
}

/**
 * 会話詳細を取得する（T-28・AC-013）。
 *
 * AIとのやり取りも含めて全件返す。
 * エスカレーション前の経緯が見えないと、
 * オペレーターは顧客に同じことを聞き直すことになる。
 */
export async function getConversationDetail(
  conversationId: string
): Promise<ConversationDetail | null> {
  const admin = getSupabaseAdmin();

  const { data: conversation, error } = await admin
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) {
    throw new Error(`会話の取得に失敗しました: ${error.message}`);
  }
  if (!conversation) return null;

  const { data: messages, error: msgError } = await admin
    .from('messages')
    .select('id, conversation_id, sender_type, sender_id, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (msgError) {
    throw new Error(`メッセージの取得に失敗しました: ${msgError.message}`);
  }

  const names = toNameMap(await listOperators());

  return {
    conversation: conversation as Conversation,
    messages: (messages ?? []) as Message[],
    operatorNames: names,
    assigned_operator_name: conversation.assigned_operator_id
      ? (names[conversation.assigned_operator_id] ?? '担当者')
      : null,
  };
}
